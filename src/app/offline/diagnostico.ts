import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { liveQuery } from 'dexie';
import { CLASE_ALERTA, CLASE_BOTON, CLASE_BOTON_SECUNDARIO } from '../features/auth/formulario';
import { TEXTOS } from '../shared/textos';
import { AccesoLocal } from './acceso-local';
import { BaseLocal } from './base-local';
import { consultarAlmacenamiento, EstadoAlmacenamiento } from './almacenamiento';
import { Operacion } from './modelos';
import { MotorSync } from './motor-sync';
import { IndicadorOffline } from './indicador';

@Component({
  imports: [DatePipe, IndicadorOffline],
  selector: 'app-diagnostico-offline',
  template: `
    <section class="hvc-card mt-6" aria-labelledby="diagnostico-offline-titulo">
      <h2 id="diagnostico-offline-titulo" class="text-lg font-semibold">{{ t.diagnostico }}</h2>
      <div class="text-muted mt-2 grid gap-1">
        <app-indicador-offline [operaciones]="operaciones()" />
        <p role="status" aria-live="polite">{{ estadoSync() }}</p>
        @if (progreso(); as avance) {
          @if (avance.total) {
            <progress
              class="mt-2 block h-3 w-full"
              [attr.aria-label]="t.progreso"
              [value]="avance.confirmadas"
              [max]="avance.total"
            ></progress>
            <p>
              {{ avance.confirmadas }} {{ t.de }} {{ avance.total }}
              {{ t.operacionesConfirmadas }} · {{ avance.porcentaje }} %
            </p>
            <p class="text-xs">{{ t.progresoPorOperaciones }}</p>
          }
        }
        <p role="status" aria-live="polite">
          {{ t.estadoAlmacenamiento }}: {{ almacenamiento().mensaje }}
        </p>
        <p>
          {{ t.ocupacion }}: {{ almacenamiento().uso ?? t.desconocido }} · {{ t.cuota }}:
          {{ almacenamiento().cuota ?? t.desconocido }}
        </p>
        <p>
          {{ t.ultimoIntento }}:
          {{ ultimoIntento() ? (ultimoIntento() | date: 'dd/MM/yyyy HH:mm:ss') : t.ninguna }}
        </p>
        @if (!motor()) {
          <p>{{ t.soloLectura }}</p>
        }
      </div>
      @if (motor(); as motor) {
        @if (propietario()) {
          @if (motor.pausa(); as pausa) {
            <p role="alert" [class]="claseAlerta">{{ pausa }}</p>
          }
          <button type="button" class="mt-3" [class]="claseBoton" (click)="reintentar()">
            {{ t.sincronizarAhora }}
          </button>
        }
      }
      @if (error()) {
        <p role="alert" [class]="claseAlerta">{{ error() }}</p>
      }
      @for (mensaje of errores(); track mensaje) {
        <p role="alert" [class]="claseAlerta">{{ mensaje }}</p>
      }
      <details class="mt-3">
        <summary class="cursor-pointer font-medium">{{ t.detalleSync }}</summary>
        @for (grupo of grupos(); track grupo.id) {
          <h3 class="mt-3 text-sm font-semibold break-all">{{ t.inspeccion }} · {{ grupo.id }}</h3>
          <ol class="mt-2 grid gap-2">
            @for (o of grupo.operaciones; track o.id) {
              <li class="rounded bg-slate-50 p-2 font-mono text-xs break-all text-slate-800">
                {{ t.tiposOperacion[o.tipo] }} · {{ o.entidad_id }} · {{ t.estado }}:
                {{ o.estado }} · {{ t.intentos }}: {{ o.intentos }} · {{ t.siguiente }}:
                {{ o.proximo_intento }} · {{ t.dependencias }}:
                {{ bloqueadas(o) }}
                @if (o.error) {
                  <p class="hvc-error mt-1 font-sans">{{ o.error }}</p>
                }
                @if (motor(); as motor) {
                  @if (propietario() && o.estado !== 'confirmada') {
                    <button
                      type="button"
                      class="mt-2 font-sans"
                      [class]="claseSecundario"
                      [disabled]="o.estado === 'en_proceso'"
                      (click)="reintentar(o.id)"
                    >
                      {{ t.reintentar }}
                    </button>
                  }
                }
              </li>
            }
          </ol>
        }
      </details>
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
  protected readonly claseBoton = CLASE_BOTON;
  protected readonly claseSecundario = CLASE_BOTON_SECUNDARIO;
  protected readonly claseAlerta = CLASE_ALERTA;
  readonly operaciones = signal<Operacion[]>([]);
  private readonly lote = signal<ReadonlySet<string>>(new Set());
  readonly progreso = computed(() => {
    const operaciones = this.operaciones().filter((o) => this.lote().has(o.id));
    const total = operaciones.length;
    const confirmadas = operaciones.filter((o) => o.estado === 'confirmada').length;
    return { total, confirmadas, porcentaje: total ? Math.floor((100 * confirmadas) / total) : 0 };
  });
  readonly estadoSync = computed(() => {
    const pendientes = this.operaciones().filter((o) => o.estado !== 'confirmada');
    if (pendientes.some((o) => o.estado === 'en_proceso')) return this.t.sincronizando;
    if (pendientes.some((o) => o.estado === 'requiere_intervencion')) return this.t.intervencion;
    return pendientes.length ? this.t.pendienteSync : this.t.sinPendientes;
  });
  readonly errores = computed(() => [
    ...new Set(
      this.operaciones()
        .filter((o) => o.estado !== 'confirmada' && o.error)
        .map((o) => o.error!),
    ),
  ]);
  readonly grupos = computed(() => {
    const grupos = new Map<string, Operacion[]>();
    for (const o of this.operaciones()) {
      if (!grupos.has(o.inspeccion_id)) grupos.set(o.inspeccion_id, []);
      grupos.get(o.inspeccion_id)!.push(o);
    }
    return [...grupos].map(([id, operaciones]) => ({ id, operaciones }));
  });
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
      this.lote.set(new Set());
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
          this.actualizarOperaciones(operaciones);
          void this.actualizarAlmacenamiento(revision);
        },
        error: () => {
          if (revision !== this.revision) return;
          this.operaciones.set([]);
          this.lote.set(new Set());
          this.error.set(this.t.lecturaError);
        },
      });
      onCleanup(() => {
        this.liberarRevision(revision);
        sub.unsubscribe();
      });
    });
  }

  private actualizarOperaciones(operaciones: Operacion[]): void {
    const pendientes = operaciones.filter((o) => o.estado !== 'confirmada');
    let lote = this.lote();
    const terminado = this.operaciones()
      .filter((o) => lote.has(o.id))
      .every((o) => o.estado === 'confirmada');
    // Un lote nuevo no hereda el 100 % del historial; los reintentos mantienen sus ids.
    if (terminado && pendientes.some((o) => !lote.has(o.id))) lote = new Set();
    const disponibles = new Set(operaciones.map((o) => o.id));
    this.lote.set(
      new Set([...lote, ...pendientes.map((o) => o.id)].filter((id) => disponibles.has(id))),
    );
    this.operaciones.set(operaciones);
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
