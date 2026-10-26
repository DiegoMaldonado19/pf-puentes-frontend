import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { liveQuery } from 'dexie';
import { TEXTOS } from '../shared/textos';
import { AccesoLocal } from './acceso-local';
import { BaseLocal } from './base-local';
import { Operacion } from './modelos';

/** Lectura compartida del indicador; el propietario procede siempre de la política G2. */
@Injectable()
export class EstadoLocal {
  readonly propietario = signal<string | null>(null);
  readonly operaciones = signal<Operacion[]>([]);
  readonly error = signal('');

  private readonly db = inject(BaseLocal);
  private readonly acceso = inject(AccesoLocal);
  private readonly revisionDestroy = inject(DestroyRef);
  private revision = 0;
  private suscripcion?: { unsubscribe(): void };
  private readonly liberar: () => void;

  constructor() {
    this.liberar = this.acceso.alInvalidar(() => void this.actualizar());
    this.revisionDestroy.onDestroy(() => {
      this.revision++;
      this.suscripcion?.unsubscribe();
      this.liberar();
      this.limpiar();
    });
    void this.actualizar();
  }

  /** Reconsulta únicamente datos que AccesoLocal confirma como propios y vigentes. */
  async actualizar(): Promise<void> {
    const revision = ++this.revision;
    this.suscripcion?.unsubscribe();
    this.limpiar();
    // AccesoLocal puede tener una revocación durable pendiente de escribir.
    await Promise.resolve();
    try {
      const propietario = await this.acceso.propietarioActual();
      if (!propietario || revision !== this.revision) return;
      const operaciones = await this.acceso.consultarPropias(propietario, () =>
        this.db.cola_sync.where('propietario_id').equals(propietario).sortBy('id'),
      );
      const propietarioVigente = await this.acceso.propietarioActual();
      if (
        revision !== this.revision ||
        operaciones === undefined ||
        propietarioVigente !== propietario
      )
        return;

      this.propietario.set(propietario);
      this.operaciones.set(operaciones);
      this.observar(propietario, revision);
    } catch {
      if (revision === this.revision) this.mostrarError();
    }
  }

  private observar(propietario: string, revision: number): void {
    this.suscripcion = liveQuery(() =>
      this.acceso.consultarPropias(propietario, () =>
        this.db.cola_sync.where('propietario_id').equals(propietario).sortBy('id'),
      ),
    ).subscribe({
      next: (operaciones) => {
        if (revision !== this.revision) return;
        if (operaciones === undefined) {
          this.limpiar();
          this.suscripcion?.unsubscribe();
          return;
        }
        this.operaciones.set(operaciones);
      },
      error: () => {
        if (revision === this.revision) this.mostrarError();
      },
    });
  }

  private limpiar(): void {
    this.propietario.set(null);
    this.operaciones.set([]);
    this.error.set('');
  }

  private mostrarError(): void {
    this.propietario.set(null);
    this.operaciones.set([]);
    this.error.set(TEXTOS.offline.lecturaError);
  }
}
