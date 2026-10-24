import { DestroyRef, inject } from '@angular/core';
import { liveQuery } from 'dexie';
import { Subscription } from 'rxjs';
import { AuthService, EventoSesion } from '../core/auth/auth';
import { BaseLocal } from './base-local';
import { HabilitacionLocal } from './modelos';
import { PersistenciaOffline } from './persistencia';
import { SesionOffline } from './sesion-offline';

/** Política durable; la preparación ficticia pertenece solo al harness. */
export function crearAccesoLocal(): AccesoLocal {
  const acceso = new AccesoLocal(inject(BaseLocal), inject(AuthService), inject(SesionOffline));
  inject(DestroyRef).onDestroy(() => acceso.detener());
  return acceso;
}

export class AccesoLocal {
  private readonly cambios: { unsubscribe(): void };
  private readonly oyentes = new Set<() => void>();
  private readonly eventos: Subscription;
  private pendiente: Promise<void> = Promise.resolve();
  private fallo = false;
  private revision = 0;
  private readonly local: PersistenciaOffline;

  constructor(
    private readonly db: BaseLocal,
    private readonly auth: AuthService,
    private readonly remoto: SesionOffline,
  ) {
    this.local = new PersistenciaOffline(db);
    remoto.coordinarAcceso(async (propietario) => {
      await this.pendiente;
      const registro = await db.acceso_local.get('ultima');
      return !this.fallo && !registro?.revocados.includes(propietario);
    });
    this.cambios = liveQuery(async () => {
      await db.inspecciones.count();
      return db.acceso_local.get('ultima');
    }).subscribe({
      next: (registro) => {
        const propietario = remoto.propietarioActual() ?? registro?.propietario_id;
        if (propietario && registro?.revocados.includes(propietario)) this.invalidar();
        else for (const actualizar of this.oyentes) actualizar();
      },
      error: () => {
        this.fallo = true;
        this.invalidar();
      },
    });
    this.eventos = auth.eventosSesion.subscribe((evento) => {
      if (evento.tipo === 'red' || evento.tipo === 'invalida') return;
      this.invalidar();
      this.pendiente = this.pendiente
        .then(() => this.aplicar(evento))
        .catch(() => {
          // Un fallo de persistencia no debe dejar acceso concedido por memoria.
          this.fallo = true;
          this.invalidar();
        });
    });
  }

  private async aplicar(evento: EventoSesion): Promise<void> {
    await this.db.transaction('rw', this.db.acceso_local, async () => {
      const registro = await this.db.acceso_local.get('ultima');
      if (!registro) return;
      const revocados = new Set(registro.revocados);
      if (evento.tipo === 'login') {
        if (evento.propietario_id !== registro.propietario_id)
          revocados.add(registro.propietario_id);
        if (evento.propietario_id) revocados.delete(evento.propietario_id);
      } else {
        revocados.add(evento.propietario_id ?? registro.propietario_id);
      }
      await this.db.acceso_local.put({ ...registro, revocados: [...revocados] });
    });
  }

  /** Llamar solo después de completar la preparación; G2 no la implementa. */
  async habilitarPreparada(propietario_id: string): Promise<boolean> {
    if (this.remoto.propietarioActual() !== propietario_id) return false;
    const revision = this.revision;
    await this.pendiente;
    const anterior = await this.db.acceso_local.get('ultima');
    // Ni renovación ni selección de UUID recuperan una habilitación revocada.
    if (this.fallo || anterior?.revocados.includes(propietario_id)) return false;
    if (!(await this.remoto.preparar(propietario_id))) return false;
    return this.db.transaction('rw', this.db.acceso_local, async () => {
      const actual = await this.db.acceso_local.get('ultima');
      if (
        this.fallo ||
        revision !== this.revision ||
        actual?.revocados.includes(propietario_id) ||
        this.remoto.propietarioActual() !== propietario_id
      )
        return false;
      const revocados = new Set(actual?.revocados);
      if (actual && actual.propietario_id !== propietario_id) revocados.add(actual.propietario_id);
      await this.db.acceso_local.put({ id: 'ultima', propietario_id, revocados: [...revocados] });
      return true;
    });
  }

  /** Solo al terminar la hidratación inicial: P2 aún no tenía identidad anterior. */
  async reconciliarAlArrancar(): Promise<void> {
    await this.pendiente;
    const revision = this.revision;
    const propietario = this.remoto.propietarioActual();
    if (this.fallo || !propietario) return;
    await this.db.transaction('rw', this.db.acceso_local, async () => {
      const registro = await this.db.acceso_local.get('ultima');
      if (
        registro &&
        registro.propietario_id !== propietario &&
        revision === this.revision &&
        this.remoto.propietarioActual() === propietario
      )
        await this.aplicar({ tipo: 'cambio', propietario_id: registro.propietario_id });
    });
  }

  private async habilitacion(): Promise<HabilitacionLocal | undefined> {
    await this.pendiente;
    if (this.fallo) return undefined;
    const registro = await this.db.acceso_local.get('ultima');
    if (!registro || registro.revocados.includes(registro.propietario_id)) return undefined;
    const remoto = this.remoto.propietarioActual();
    // Una pestaña con sesión antigua no ve datos ajenos ni puede volver a revocarlos.
    return remoto && remoto !== registro.propietario_id ? undefined : registro;
  }

  async propietarioActual(): Promise<string | null> {
    return (await this.habilitacion())?.propietario_id ?? null;
  }

  async inspecciones() {
    const revision = this.revision;
    const propietario = await this.propietarioActual();
    if (!propietario) return [];
    const registros = await this.db.inspecciones
      .where('propietario_id')
      .equals(propietario)
      .primaryKeys();
    const capturas = await Promise.all(
      registros.map((id) => this.local.inspeccion(propietario, id)),
    );
    // Comprobar la revisión después de la última lectura asíncrona también.
    const propietarioFinal = await this.propietarioActual();
    return revision === this.revision && propietarioFinal === propietario ? capturas : [];
  }

  private invalidar(): void {
    this.revision++;
    this.remoto.cancelarEjecucion();
    for (const cancelar of this.oyentes) cancelar();
  }

  alInvalidar(cancelar: () => void): () => void {
    this.oyentes.add(cancelar);
    return () => this.oyentes.delete(cancelar);
  }

  detener(): void {
    this.revision++;
    this.eventos.unsubscribe();
    this.cambios.unsubscribe();
    this.oyentes.clear();
  }
}
