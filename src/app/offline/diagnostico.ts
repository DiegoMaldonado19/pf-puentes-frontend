import { Component, computed, effect, input, signal } from '@angular/core';
import { liveQuery } from 'dexie';
import { TEXTOS } from '../shared/textos';
import { BaseLocal } from './base-local';
import { consultarAlmacenamiento, EstadoAlmacenamiento } from './almacenamiento';
import { Operacion } from './modelos';
import { MotorSync } from './motor-sync';
import { IndicadorOffline } from './indicador';

@Component({
  imports: [IndicadorOffline],
  selector: 'app-diagnostico-offline',
  template: `
    <section aria-label="{{ t.lista }}">
      <app-indicador-offline [operaciones]="operaciones()" />
      <p>{{ almacenamiento().mensaje }}</p>
      <p>
        {{ t.ocupacion }}: {{ almacenamiento().uso ?? t.desconocido }} · {{ t.cuota }}:
        {{ almacenamiento().cuota ?? t.desconocido }}
      </p>
      <p>{{ t.ultimoIntento }}: {{ ultimoIntento() ?? t.ninguna }}</p>
      @if (motor().pausa()) {
        <p role="alert">{{ motor().pausa() }}</p>
      }
      @if (error()) {
        <p role="alert">{{ error() }}</p>
      }
      <button type="button" (click)="reintentar()">{{ t.sincronizar }}</button>
      <ul>
        @for (o of operaciones(); track o.id) {
          <li>
            {{ o.tipo }} · {{ o.entidad_id }} · {{ t.estado }}: {{ o.estado }} · {{ t.intentos }}:
            {{ o.intentos }} · {{ t.siguiente }}: {{ o.proximo_intento }} · {{ t.dependencias }}:
            {{ bloqueadas(o) }}
            @if (o.error) {
              <p role="alert">{{ o.error }}</p>
            }
            @if (o.estado !== 'confirmada') {
              <button
                type="button"
                [disabled]="o.estado === 'en_proceso'"
                (click)="reintentar(o.id)"
              >
                {{ t.reintentar }}
              </button>
            }
          </li>
        }
      </ul>
    </section>
  `,
})
export class DiagnosticoOffline {
  readonly db = input.required<BaseLocal>();
  readonly propietario = input.required<string>();
  readonly motor = input.required<MotorSync>();
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
  constructor() {
    effect((onCleanup) => {
      const db = this.db(),
        propietario = this.propietario();
      this.operaciones.set([]);
      const sub = liveQuery(() =>
        db.cola_sync.where('propietario_id').equals(propietario).sortBy('id'),
      ).subscribe({
        next: (ops) => {
          this.operaciones.set(ops);
          void consultarAlmacenamiento().then((e) => this.almacenamiento.set(e));
        },
        error: () => this.error.set(this.t.escrituraError),
      });
      onCleanup(() => sub.unsubscribe());
    });
  }
  bloqueadas(o: Operacion) {
    const confirmadas = new Set(
      this.operaciones()
        .filter((op) => op.estado === 'confirmada')
        .map((op) => op.id),
    );
    return o.dependencias.filter((d) => !confirmadas.has(d)).length;
  }
  async reintentar(id?: string) {
    try {
      await this.motor().reintentar(this.propietario(), id);
    } catch {
      this.error.set(this.t.escrituraError);
    }
  }
}
