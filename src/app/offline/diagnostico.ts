import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { liveQuery } from 'dexie';
import { TEXTOS } from '../shared/textos';
import { AccesoLocal } from './acceso-local';
import { BaseLocal } from './base-local';
import { consultarAlmacenamiento, EstadoAlmacenamiento } from './almacenamiento';
import { Operacion } from './modelos';
import { MotorSync } from './motor-sync';
import { IndicadorOffline } from './indicador';

@Component({
  imports: [IndicadorOffline],
  selector: 'app-diagnostico-offline',
  template: `
    <section aria-labelledby="diagnostico-offline-titulo">
      <h2 id="diagnostico-offline-titulo">{{ t.diagnostico }}</h2>
      <app-indicador-offline [operaciones]="operaciones()" />
      <p role="status" aria-live="polite">
        {{ t.estadoAlmacenamiento }}: {{ almacenamiento().mensaje }}
      </p>
      <p>
        {{ t.ocupacion }}: {{ almacenamiento().uso ?? t.desconocido }} · {{ t.cuota }}:
        {{ almacenamiento().cuota ?? t.desconocido }}
      </p>
      <p>{{ t.ultimoIntento }}: {{ ultimoIntento() ?? t.ninguna }}</p>
      @if (!motor()) {
        <p>{{ t.soloLectura }}</p>
      }
      @if (motor(); as motor) {
        @if (propietario()) {
          @if (motor.pausa(); as pausa) {
            <p role="alert">{{ pausa }}</p>
          }
          <button type="button" (click)="reintentar()">Sincronizar ahora</button>
        }
      }
      @if (error()) {
        <p role="alert">{{ error() }}</p>
      }
      <ul>
        @for (o of operaciones(); track o.id) {
          <li>
            {{ o.tipo }} · {{ o.entidad_id }} · {{ t.estado }}: {{ o.estado }} · {{ t.intentos }}:
            {{ o.intentos }} · {{ t.siguiente }}: {{ o.proximo_intento }} · {{ t.dependencias }}:
            {{ bloqueadas(o) }}
            @if (o.error) {
              <p role="alert">{{ o.error }}</p>
            }
            @if (motor(); as motor) {
              @if (propietario() && o.estado !== 'confirmada') {
                <button
                  type="button"
                  [disabled]="o.estado === 'en_proceso'"
                  (click)="reintentar(o.id)"
                >
                  {{ t.reintentar }}
                </button>
              }
            }
          </li>
        }
      </ul>
    </section>
  `,
})
export class DiagnosticoOffline {
  readonly db = input.required<BaseLocal>();
  readonly propietario = input<string | null>(null);
  /** El mismo diagnóstico acepta el motor real y el del harness aislado. */
  readonly motor = input<MotorSync>();
  readonly aislado = input(false);
  readonly t = TEXTOS.offline;
  readonly operaciones = signal<Operacion[]>([]);
  readonly error = signal('');
  readonly almacenamiento = signal<EstadoAlmacenamiento>({
    mensaje: this.t.sinApi,
    uso: null,
    cuota: null,
  });
  readonly ultimoIntento = computed(
    () => Math.max(0, ...this.operaciones().map((o) => o.ultimo_intento ?? 0)) || null,
  );
  private readonly acceso = inject(AccesoLocal);
  private revision = 0;

  constructor() {
    effect((onCleanup) => {
      const db = this.db();
      const propietario = this.propietario();
      const aislado = this.aislado();
      const revision = ++this.revision;
      this.operaciones.set([]);
      this.error.set('');
      if (!propietario) {
        void this.actualizarAlmacenamiento(revision);
        onCleanup(() => this.liberarRevision(revision));
        return;
      }
      const sub = liveQuery(async () => {
        const leer = () => db.cola_sync.where('propietario_id').equals(propietario).sortBy('id');
        // El demo aislado conserva su identidad libre; producción pasa por la política durable G2.
        return aislado ? leer() : ((await this.acceso.consultarPropias(propietario, leer)) ?? []);
      }).subscribe({
        next: (operaciones) => {
          if (revision !== this.revision) return;
          this.operaciones.set(operaciones);
          void this.actualizarAlmacenamiento(revision);
        },
        error: () => {
          if (revision !== this.revision) return;
          this.operaciones.set([]);
          this.error.set(this.t.lecturaError);
        },
      });
      onCleanup(() => {
        this.liberarRevision(revision);
        sub.unsubscribe();
      });
    });
  }

  private async actualizarAlmacenamiento(revision: number): Promise<void> {
    try {
      const estado = await consultarAlmacenamiento();
      if (revision === this.revision) this.almacenamiento.set(estado);
    } catch {
      if (revision === this.revision) this.error.set(this.t.lecturaError);
    }
  }

  private liberarRevision(revision: number): void {
    if (revision === this.revision) this.revision++;
  }

  bloqueadas(o: Operacion): number {
    const confirmadas = new Set(
      this.operaciones()
        .filter((op) => op.estado === 'confirmada')
        .map((op) => op.id),
    );
    return o.dependencias.filter((d) => !confirmadas.has(d)).length;
  }

  async reintentar(id?: string): Promise<void> {
    const motor = this.motor();
    const propietario = this.propietario();
    if (!motor || !propietario) return;
    try {
      if (!this.aislado() && !(await this.acceso.consultarPropias(propietario, async () => true)))
        return;
      await motor.reintentar(propietario, id);
    } catch {
      this.error.set(this.t.escrituraError);
    }
  }
}
