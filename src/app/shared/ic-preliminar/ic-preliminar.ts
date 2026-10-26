import { Component, computed, input } from '@angular/core';
import { AnulacionIc } from '../../features/admin/pesos/modelos';
import { EstadoCondicion, EstadoPuente } from '../estado-puente/estado-puente';
import { TEXTOS } from '../textos';

/**
 * Distingue explícitamente el IC preliminar en borradores de inspección (RN-IC-07, DT-ARQ-06).
 *
 * <p>Muestra el rótulo preliminar, el valor numérico, el estado y las condiciones críticas,
 * aclarando que no constituye un resultado oficial ni actualiza el inventario de puentes.
 */
@Component({
  selector: 'app-ic-preliminar',
  standalone: true,
  imports: [EstadoPuente],
  template: `
    <div
      class="panel-ic-preliminar"
      role="region"
      [attr.aria-label]="textos.rotulo"
      [class.preliminar]="esPreliminar()"
      [class.incompleto]="datosIncompletos()"
    >
      <div class="cabecera">
        <span class="insignia" [class.insignia-preliminar]="esPreliminar()">
          {{ rotulo() }}
        </span>
        <span class="nota-oficialidad">
          {{ esPreliminar() ? textos.avisoBorrador : 'Resultado publicado oficial' }}
        </span>
      </div>

      @if (datosIncompletos()) {
        <div class="alerta alerta-incompleto" role="status">
          <span class="icono" aria-hidden="true">⚠️</span>
          <span>{{ textos.datosIncompletos }}</span>
        </div>
      } @else {
        <div class="cuerpo">
          <div class="valor-ic">
            <span class="etiqueta">Índice estimado:</span>
            <span class="numero" data-testid="valor-ic">{{ textoIndice() }}</span>
            <span class="escala">/ 100</span>
          </div>
          <div class="estado-ic">
            <span class="etiqueta">Condición:</span>
            <app-estado-puente [estado]="estado()" />
          </div>
        </div>

        @if (tieneAnulaciones()) {
          <div class="alerta alerta-anulacion" role="alert">
            <strong>{{ textos.advertenciaAnulacion }}</strong>
            <ul class="lista-anulaciones">
              @for (causa of anulaciones(); track causa) {
                <li>{{ textoCausa(causa) }}</li>
              }
            </ul>
          </div>
        }
      }
    </div>
  `,
  styleUrl: './ic-preliminar.css',
})
export class IcPreliminar {
  readonly indice = input<number | null>(null);
  readonly estado = input<EstadoCondicion | null>(null);
  readonly anulaciones = input<readonly AnulacionIc[]>([]);
  readonly esPreliminar = input<boolean>(true);
  readonly datosIncompletos = input<boolean>(false);

  protected readonly textos = TEXTOS.pesos.icPreliminar;

  protected readonly rotulo = computed(() =>
    this.esPreliminar() ? this.textos.rotulo : 'IC Oficial',
  );

  protected readonly textoIndice = computed(() =>
    this.indice() != null ? this.indice()!.toFixed(2) : '--',
  );

  protected readonly tieneAnulaciones = computed(() => this.anulaciones().length > 0);

  protected textoCausa(causa: AnulacionIc): string {
    return this.textos.anulaciones[causa] ?? causa;
  }
}

