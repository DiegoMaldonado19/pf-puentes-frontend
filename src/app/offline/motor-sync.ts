import { v7 } from 'uuid';
import { signal } from '@angular/core';
import { TEXTOS } from '../shared/textos';
import { BaseLocal } from './base-local';
import { Operacion, ResultadoTransporte, SesionOffline, TransporteSync } from './modelos';

export const BACKOFF = [2000, 4000, 8000, 16000] as const;
export const LEASE_MS = 15000;
export class MotorSync {
  private activo: Promise<void> | null = null;
  private controlador: AbortController | null = null;
  private generacion = 0;
  private temporizador: ReturnType<typeof setInterval> | null = null;
  private readonly online = () => {
    void this.drenar().catch(this.alError);
  };
  readonly pausa = signal<string | null>(null);
  constructor(
    readonly db: BaseLocal,
    private readonly sesion: SesionOffline,
    private readonly transporte?: TransporteSync,
    private readonly reloj = () => Date.now(),
    private readonly conectado = () => navigator.onLine,
    private readonly alError: (error: unknown) => void = console.error,
  ) {}
  iniciar() {
    if (this.temporizador) return;
    window.addEventListener('online', this.online);
    this.temporizador = setInterval(this.online, 1000);
    this.online();
  }
  detener() {
    this.generacion++;
    if (this.temporizador) clearInterval(this.temporizador);
    this.temporizador = null;
    window.removeEventListener('online', this.online);
    this.controlador?.abort();
  }
  async reintentar(propietario_id: string, operacion_id?: string) {
    if (propietario_id !== this.sesion.propietarioActual()) return;
    await this.db.transaction('rw', this.db.cola_sync, async () => {
      await this.db.cola_sync
        .where('propietario_id')
        .equals(propietario_id)
        .filter(
          (o) =>
            o.estado !== 'confirmada' &&
            o.estado !== 'en_proceso' &&
            (!operacion_id || o.id === operacion_id),
        )
        .modify({ estado: 'pendiente', intentos: 0, proximo_intento: 0, error: null });
    });
    this.pausa.set(null);
    await this.drenar();
  }
  drenar(): Promise<void> {
    if (this.activo) return this.activo;
    const propietario = this.sesion.propietarioActual();
    if (!propietario || !this.transporte || !this.conectado() || this.pausa())
      return Promise.resolve();
    this.activo = this.procesar(propietario, this.generacion).finally(() => {
      this.activo = null;
    });
    return this.activo;
  }
  private async procesar(propietario_id: string, generacion: number) {
    const token = v7();
    const adquirido = await this.db.transaction(
      'rw',
      this.db.bloqueos,
      this.db.cola_sync,
      async () => {
        const anterior = await this.db.bloqueos.get(propietario_id);
        if (anterior && anterior.vence_en > this.reloj()) return false;
        await this.db.bloqueos.put({ propietario_id, token, vence_en: this.reloj() + LEASE_MS });
        await this.db.cola_sync
          .where('propietario_id')
          .equals(propietario_id)
          .filter((o) => o.estado === 'en_proceso')
          .modify({ estado: 'pendiente', ejecucion: null });
        return true;
      },
    );
    if (!adquirido) return;
    const controlador = new AbortController();
    if (generacion !== this.generacion) controlador.abort();
    this.controlador = controlador;
    const renovar = setInterval(() => {
      void this.db
        .transaction('rw', this.db.bloqueos, async () => {
          if (!(await this.posee(propietario_id, token))) {
            controlador.abort();
            return;
          }
          await this.db.bloqueos.update(propietario_id, { vence_en: this.reloj() + LEASE_MS });
        })
        .catch(() => controlador.abort());
    }, 3000);
    try {
      if (controlador.signal.aborted) return;
      const preparada = await Promise.resolve()
        .then(() => this.sesion.preparar(propietario_id))
        .catch(() => false);
      if (!preparada) {
        this.pausa.set(TEXTOS.offline.pausa);
        return;
      }
      while (
        !controlador.signal.aborted &&
        this.conectado() &&
        this.sesion.propietarioActual() === propietario_id
      ) {
        const operacion = await this.reclamar(propietario_id, token);
        if (!operacion) break;
        let resultado: ResultadoTransporte;
        try {
          const archivo =
            operacion.tipo === 'foto'
              ? await this.db.fotos.get(operacion.entidad_id)
              : operacion.tipo === 'documento'
                ? await this.db.documentos.get(operacion.entidad_id)
                : undefined;
          if (
            (operacion.tipo === 'foto' || operacion.tipo === 'documento') &&
            (!archivo || archivo.propietario_id !== propietario_id)
          ) {
            resultado = { tipo: 'negocio', mensaje: TEXTOS.offline.noDisponible };
          } else {
            resultado = await this.transporte!.ejecutar(
              structuredClone(operacion),
              archivo,
              controlador.signal,
            );
          }
        } catch (e) {
          if (controlador.signal.aborted) break;
          resultado = {
            tipo: 'transitorio',
            mensaje: e instanceof Error ? e.message : TEXTOS.offline.errorTransporte,
          };
        }
        if (controlador.signal.aborted) break;
        await this.aplicar(operacion, token, resultado);
        if (resultado.tipo === 'sesion') {
          this.pausa.set(resultado.mensaje);
          break;
        }
      }
    } finally {
      clearInterval(renovar);
      this.controlador = null;
      await this.db.transaction('rw', this.db.bloqueos, this.db.cola_sync, async () => {
        if ((await this.db.bloqueos.get(propietario_id))?.token !== token) return;
        await this.db.cola_sync
          .where('propietario_id')
          .equals(propietario_id)
          .filter((o) => o.estado === 'en_proceso' && o.ejecucion === token)
          .modify({ estado: 'pendiente', ejecucion: null });
        await this.db.bloqueos.delete(propietario_id);
      });
    }
  }
  private async posee(propietario: string, token: string) {
    const bloqueo = await this.db.bloqueos.get(propietario);
    return bloqueo?.token === token && bloqueo.vence_en > this.reloj();
  }
  private reclamar(propietario: string, token: string) {
    return this.db.transaction('rw', this.db.bloqueos, this.db.cola_sync, async () => {
      if (!(await this.posee(propietario, token))) return undefined;
      const operaciones = await this.db.cola_sync
        .where('propietario_id')
        .equals(propietario)
        .sortBy('id');
      const confirmadas = new Set(
        operaciones.filter((o) => o.estado === 'confirmada').map((o) => o.id),
      );
      const siguiente = operaciones.find(
        (o) =>
          o.estado === 'pendiente' &&
          o.proximo_intento <= this.reloj() &&
          o.dependencias.every((d) => confirmadas.has(d)),
      );
      if (!siguiente) return undefined;
      siguiente.estado = 'en_proceso';
      siguiente.ejecucion = token;
      siguiente.ultimo_intento = this.reloj();
      await this.db.cola_sync.put(siguiente);
      return siguiente;
    });
  }
  private async aplicar(o: Operacion, token: string, resultado: ResultadoTransporte) {
    await this.db.transaction(
      'rw',
      [
        this.db.bloqueos,
        this.db.cola_sync,
        this.db.inspecciones,
        this.db.fotos,
        this.db.documentos,
      ],
      async () => {
        if (!(await this.posee(o.propietario_id, token))) return;
        const actual = await this.db.cola_sync.get(o.id);
        if (actual?.ejecucion !== token || actual.estado !== 'en_proceso') return;
        if (
          resultado.tipo === 'ack' &&
          (resultado.operacion_id !== o.id ||
            resultado.propietario_id !== o.propietario_id ||
            resultado.version_local !== o.version_local)
        )
          resultado = { tipo: 'negocio', mensaje: TEXTOS.offline.ackInvalido };
        if (resultado.tipo === 'ack') {
          await this.db.cola_sync.update(o.id, {
            estado: 'confirmada',
            resultado: structuredClone(resultado.resultado),
            intentos: 0,
            error: null,
            ejecucion: null,
          });
          if (o.tipo === 'foto' || o.tipo === 'documento') {
            await (o.tipo === 'foto' ? this.db.fotos : this.db.documentos).update(o.entidad_id, {
              confirmado: true,
            });
          }
          const i = await this.db.inspecciones.get(o.inspeccion_id);
          if (i?.propietario_id !== o.propietario_id) return;
          await this.db.inspecciones.update(i.id, {
            version_confirmada: Math.max(i.version_confirmada, o.version_local),
          });
          if (o.tipo === 'envio' && i.version_local === o.version_local)
            await this.db.inspecciones.update(i.id, { estado_remoto: resultado.resultado });
        } else {
          const intentos = actual.intentos + (resultado.tipo === 'sesion' ? 0 : 1);
          await this.db.cola_sync.update(o.id, {
            intentos,
            error: resultado.mensaje,
            ejecucion: null,
            estado:
              resultado.tipo === 'negocio' || intentos >= 5 ? 'requiere_intervencion' : 'pendiente',
            proximo_intento:
              resultado.tipo === 'transitorio' && intentos < 5
                ? this.reloj() + BACKOFF[intentos - 1]
                : 0,
          });
        }
      },
    );
  }
}
