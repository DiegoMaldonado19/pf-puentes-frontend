import { Component, computed, effect, input, OnInit, output, signal } from '@angular/core';
import { AnulacionIc } from '../../features/admin/pesos/modelos';
import { EstadoCondicion, EstadoPuente } from '../estado-puente/estado-puente';
import { TEXTOS } from '../textos';

export interface CambioConfirmacionEstado {
  readonly estadoConfirmado: EstadoCondicion;
  readonly justificacion: string | null;
  readonly valida: boolean;
  readonly tieneDiscrepancia: boolean;
  readonly esElevacionCritica: boolean;
}

/**
 * Componente interactivo para confirmar o modificar el estado de condición por el evaluador (RN-IC-06).
 *
 * <p>Conserva el estado calculado automáticamente y exige justificación no vacía cuando el
 * evaluador elige un estado diferente.
 */
@Component({
  selector: 'app-confirmacion-estado',
  standalone: true,
  imports: [EstadoPuente],
  template: `
    <section class="panel-confirmacion" aria-labelledby="titulo-confirmacion">
      <h3 id="titulo-confirmacion" class="titulo">{{ textos.titulo }}</h3>
      <p class="explicacion">{{ textos.explicacion }}</p>

      <div class="fila-calculado">
        <span class="etiqueta">{{ textos.estadoCalculado }}:</span>
        <app-estado-puente [estado]="estadoCalculado()" />
      </div>

      @if (anulacion()) {
        <div class="alerta alerta-anulacion" role="alert">
          <strong>Condición crítica detectada (RN-IC-05):</strong>
          <span>{{ textoAnulacion(anulacion()!) }}</span>
        </div>
      }

      <div class="control-confirmacion">
        <label for="select-estado-confirmado" class="etiqueta">
          {{ textos.estadoConfirmado }}:
        </label>
        <select
          id="select-estado-confirmado"
          class="selector-estado"
          [disabled]="deshabilitado()"
          [value]="estadoConfirmado()"
          (change)="alSeleccionarEstado($event)"
          data-testid="select-estado-confirmado"
        >
          <option value="BUENO">Bueno</option>
          <option value="REGULAR">Regular</option>
          <option value="MALO">Malo</option>
        </select>
      </div>

      @if (tieneDiscrepancia()) {
        <div class="grupo-justificacion">
          <label for="textarea-justificacion" class="etiqueta obligatoria">
            {{ textos.justificacion }} <span class="requerido" aria-hidden="true">*</span>
          </label>
          <textarea
            id="textarea-justificacion"
            class="campo-texto"
            rows="3"
            [disabled]="deshabilitado()"
            [placeholder]="textos.justificacionPlaceholder"
            [value]="justificacion()"
            (input)="alEscribirJustificacion($event)"
            (blur)="tocado.set(true)"
            [class.invalido]="tocado() && justificacionInvalida()"
            aria-required="true"
            data-testid="textarea-justificacion"
          ></textarea>

          @if (tocado() && justificacionInvalida()) {
            <p class="error-validacion" role="alert" data-testid="error-justificacion">
              {{ textos.justificacionRequerida }}
            </p>
          }

          @if (esElevacionCritica()) {
            <div class="alerta alerta-advertencia" role="alert">
              <span>⚠️ {{ textos.advertenciaElevacion }}</span>
            </div>
          }
        </div>
      } @else {
        <p class="nota-coincide" role="status">✓ {{ textos.coincide }}</p>
      }
    </section>
  `,
  styleUrl: './confirmacion-estado.css',
})
export class ConfirmacionEstado implements OnInit {
  readonly estadoCalculado = input.required<EstadoCondicion>();
  readonly anulacion = input<AnulacionIc | null>(null);
  readonly deshabilitado = input<boolean>(false);
  readonly estadoInicial = input<EstadoCondicion | null>(null);
  readonly justificacionInicial = input<string | null>(null);

  readonly cambio = output<CambioConfirmacionEstado>();

  protected readonly textos = TEXTOS.pesos.confirmacionEstado;
  protected readonly textosAnulacion = TEXTOS.pesos.recalculo.anulaciones;

  readonly estadoConfirmado = signal<EstadoCondicion>('BUENO');
  readonly justificacion = signal<string>('');
  readonly tocado = signal<boolean>(false);

  readonly tieneDiscrepancia = computed(() => this.estadoConfirmado() !== this.estadoCalculado());

  readonly esElevacionCritica = computed(
    () => this.anulacion() != null && this.estadoConfirmado() !== 'MALO',
  );

  readonly justificacionInvalida = computed(
    () => this.tieneDiscrepancia() && this.justificacion().trim().length === 0,
  );

  readonly valida = computed(() => !this.tieneDiscrepancia() || !this.justificacionInvalida());

  constructor() {
    effect(() => {
      this.emitirCambio();
    });
  }

  ngOnInit(): void {
    this.estadoConfirmado.set(this.estadoInicial() ?? this.estadoCalculado());
    this.justificacion.set(this.justificacionInicial() ?? '');
  }

  protected alSeleccionarEstado(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value as EstadoCondicion;
    this.estadoConfirmado.set(valor);
  }

  protected alEscribirJustificacion(evento: Event): void {
    const valor = (evento.target as HTMLTextAreaElement).value;
    this.justificacion.set(valor);
  }

  protected textoAnulacion(causa: AnulacionIc): string {
    return this.textosAnulacion[causa] ?? causa;
  }

  private emitirCambio(): void {
    const just = this.tieneDiscrepancia() ? this.justificacion().trim() : null;
    this.cambio.emit({
      estadoConfirmado: this.estadoConfirmado(),
      justificacion: just && just.length > 0 ? just : null,
      valida: this.valida(),
      tieneDiscrepancia: this.tieneDiscrepancia(),
      esElevacionCritica: this.esElevacionCritica(),
    });
  }
}
