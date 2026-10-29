import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TEXTOS } from '../../../shared/textos';
import { FormularioService } from '../../formulario/formulario.service';
import { EsquemaFormulario, FormularioVersionDTO } from '../../formulario/modelos';
import { MotorFormularioComponent } from '../../formulario/motor-formulario/motor-formulario';
import { ModalPublicar } from './modal-publicar';

@Component({
  selector: 'app-editor-formulario',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MotorFormularioComponent, ModalPublicar],
  template: `
    <div class="space-y-6 p-4 max-w-7xl mx-auto">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <a
              routerLink="/admin/formularios"
              class="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              ← Volver a versiones
            </a>
          </div>
          <h1 class="text-h1 dark:text-white mt-1">
            {{
              esNuevo
                ? textos.nuevaVersion
                : version?.estado === 'BORRADOR'
                  ? textos.editarBorrador
                  : 'Consulta de Esquema'
            }}: {{ codigo }}
          </h1>
        </div>

        <div class="flex items-center gap-3">
          @if (!esSoloLectura) {
            <button
              type="button"
              (click)="guardar()"
              [disabled]="guardando || !!errorSintaxis"
              class="btn-hvc-primary"
            >
              {{ guardando ? 'Guardando…' : textos.guardarBorrador }}
            </button>

            @if (!esNuevo && version?.estado === 'BORRADOR') {
              <button
                type="button"
                (click)="abrirPublicar()"
                [disabled]="guardando || !!errorSintaxis"
                class="px-5 py-2.5 bg-emerald-600 text-white font-semibold text-sm rounded-xl hover:bg-emerald-700 shadow-sm disabled:opacity-50 transition-colors"
              >
                {{ textos.publicarBorrador }}
              </button>
            }
          }
        </div>
      </div>

      @if (errorGeneral) {
        <div class="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
          {{ errorGeneral }}
        </div>
      }

      <!-- Pestañas de Editor vs Vista Previa -->
      <div class="flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
        <div class="flex gap-2">
          <button
            type="button"
            (click)="tabActiva = 'editor'"
            class="px-4 py-2 font-semibold text-sm border-b-2 transition-colors cursor-pointer"
            [class.border-blue-600]="tabActiva === 'editor'"
            [class.text-blue-600]="tabActiva === 'editor'"
            [class.dark:text-blue-400]="tabActiva === 'editor'"
            [class.border-transparent]="tabActiva !== 'editor'"
            [class.text-gray-600]="tabActiva !== 'editor'"
            [class.dark:text-gray-400]="tabActiva !== 'editor'"
          >
            Editor JSON Schema
          </button>
          <button
            type="button"
            (click)="actualizarVistaPrevia()"
            class="px-4 py-2 font-semibold text-sm border-b-2 transition-colors cursor-pointer"
            [class.border-blue-600]="tabActiva === 'preview'"
            [class.text-blue-600]="tabActiva === 'preview'"
            [class.dark:text-blue-400]="tabActiva === 'preview'"
            [class.border-transparent]="tabActiva !== 'preview'"
            [class.text-gray-600]="tabActiva !== 'preview'"
            [class.dark:text-gray-400]="tabActiva !== 'preview'"
          >
            Vista Previa en Vivo
          </button>
        </div>

        @if (tabActiva === 'editor' && !esSoloLectura) {
          <button
            type="button"
            (click)="cargarEsquemaActivoComoBase()"
            class="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/40 cursor-pointer"
          >
            ↺ Cargar Esquema Activo Oficial (V1.0.0)
          </button>
        }
      </div>

      <!-- Contenido del Editor -->
      @if (tabActiva === 'editor') {
        <div
          class="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 space-y-4"
        >
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                for="codigo-version-input"
                class="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1"
              >
                {{ textos.codigo }}
              </label>
              <input
                id="codigo-version-input"
                type="text"
                [(ngModel)]="codigo"
                [readOnly]="!esNuevo"
                placeholder="V2.0.0"
                class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                [class.bg-gray-100]="!esNuevo"
              />
            </div>
          </div>

          <div>
            <div class="flex items-center justify-between mb-1">
              <label
                for="esquema-json-editor"
                class="block text-sm font-semibold text-gray-800 dark:text-gray-200"
              >
                Estructura JSON Schema (Draft 7)
              </label>
              @if (errorSintaxis) {
                <span
                  class="text-xs text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1"
                >
                  <svg
                    class="w-3.5 h-3.5 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>{{ errorSintaxis }}</span>
                </span>
              } @else if (esquemaCompilado) {
                <span
                  class="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1"
                >
                  <svg
                    class="w-3.5 h-3.5 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>{{ textos.sintaxisValida }}</span>
                </span>
              }
            </div>
            <textarea
              id="esquema-json-editor"
              [ngModel]="esquemaJsonTexto"
              (ngModelChange)="validarSintaxis($event)"
              [readOnly]="esSoloLectura"
              rows="22"
              class="w-full px-4 py-3 text-xs font-mono rounded-xl border bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white font-medium leading-relaxed transition-colors focus:outline-none"
              [class.border-rose-500]="!!errorSintaxis"
              [class.focus:ring-2]="true"
              [class.focus:ring-rose-500]="!!errorSintaxis"
              [class.border-gray-300]="!errorSintaxis"
              [class.dark:border-gray-600]="!errorSintaxis"
              [class.focus:ring-blue-500]="!errorSintaxis"
            >
            </textarea>
          </div>
        </div>
      } @else {
        <!-- Vista previa renderizada por el motor dinámico -->
        <div class="space-y-4">
          <div
            class="hvc-note bg-blue-50 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-200 flex items-center gap-2"
          >
            <svg
              class="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>
              Esta vista previa se genera dinámicamente con el componente
              <code
                class="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 font-mono text-blue-950 dark:text-blue-200 font-semibold"
                >&lt;app-motor-formulario&gt;</code
              >
              exactamente igual a como lo visualizan los inspectores en campo.
            </span>
          </div>
          @if (esquemaCompilado) {
            <app-motor-formulario [esquema]="esquemaCompilado" [modo]="'edicion'" />
          }
        </div>
      }

      <!-- Modal de publicación si se solicita desde el editor -->
      @if (mostrarModalPublicar && version) {
        <app-modal-publicar
          [version]="version"
          (publicado)="alPublicarExitoso()"
          (cancelar)="mostrarModalPublicar = false"
        />
      }
    </div>
  `,
})
export class EditorFormulario implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formularioService = inject(FormularioService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly textos = TEXTOS.formulario.admin;

  esNuevo = true;
  idVersion?: string;
  version?: FormularioVersionDTO;
  codigo = '';
  esquemaJsonTexto = '';
  esquemaCompilado?: EsquemaFormulario;

  tabActiva: 'editor' | 'preview' = 'editor';
  guardando = false;
  mostrarModalPublicar = false;
  errorSintaxis = '';
  errorGeneral = '';

  get esSoloLectura(): boolean {
    return !this.esNuevo && this.version?.estado !== 'BORRADOR';
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.esNuevo = false;
      this.idVersion = id;
      this.cargarVersion(id);
    } else {
      this.esNuevo = true;
      this.codigo = 'V2.0.0';
      this.cargarEsquemaActivoComoBase();
    }
  }

  validarSintaxis(nuevoTexto?: string): void {
    if (nuevoTexto !== undefined) {
      this.esquemaJsonTexto = nuevoTexto;
    }
    const texto = this.esquemaJsonTexto?.trim() ?? '';
    if (!texto) {
      this.errorSintaxis = this.textos.esquemaVacio;
      this.esquemaCompilado = undefined;
      this.cdr.markForCheck();
      return;
    }
    try {
      const parsed = JSON.parse(texto);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        this.errorSintaxis = this.textos.esquemaRaizObjeto;
        this.esquemaCompilado = undefined;
        this.cdr.markForCheck();
        return;
      }
      this.errorSintaxis = '';
      this.esquemaCompilado = parsed;
    } catch (e: unknown) {
      const detalle = e instanceof Error ? e.message : '';
      this.errorSintaxis = detalle
        ? `${this.textos.errorSintaxis} (${detalle})`
        : this.textos.errorSintaxis;
      this.esquemaCompilado = undefined;
    }
    this.cdr.markForCheck();
  }

  cargarEsquemaActivoComoBase(): void {
    this.formularioService.obtenerActivo().subscribe({
      next: (activa) => {
        if (activa?.esquema) {
          this.esquemaJsonTexto = JSON.stringify(activa.esquema, null, 2);
          this.validarSintaxis();
        } else {
          this.usarPlantillaMinima();
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.usarPlantillaMinima();
        this.cdr.markForCheck();
      },
    });
  }

  private usarPlantillaMinima(): void {
    this.esquemaJsonTexto = JSON.stringify(
      {
        $schema: 'http://json-schema.org/draft-07/schema#',
        title: 'Formulario de Inspección de Puentes',
        type: 'object',
        properties: {
          seccion_1: {
            type: 'object',
            title: 'Sección 1: Datos Generales',
            properties: {
              codigo_puente: {
                type: 'string',
                title: 'Código del Puente',
                'x-permanente': true,
              },
              calificacion_preliminar: {
                type: 'integer',
                minimum: 0,
                maximum: 4,
                title: 'Calificación preliminar de daño',
                'x-dano': true,
              },
            },
          },
        },
      },
      null,
      2,
    );
    this.validarSintaxis();
  }

  cargarVersion(id: string): void {
    this.formularioService.detalle(id).subscribe({
      next: (v) => {
        this.version = v;
        this.codigo = v.codigo;
        this.esquemaJsonTexto = JSON.stringify(v.esquema, null, 2);
        this.validarSintaxis();
        this.cdr.markForCheck();
      },
      error: () => {
        this.errorGeneral = 'No se pudo cargar la versión del formulario.';
        this.cdr.markForCheck();
      },
    });
  }

  actualizarVistaPrevia(): void {
    this.validarSintaxis();
    if (!this.errorSintaxis && this.esquemaCompilado) {
      this.tabActiva = 'preview';
    } else if (!this.errorSintaxis) {
      this.errorSintaxis = this.textos.corregirAntesDePrevia;
    }
    this.cdr.markForCheck();
  }

  abrirPublicar(): void {
    this.mostrarModalPublicar = true;
    this.cdr.markForCheck();
  }

  alPublicarExitoso(): void {
    this.mostrarModalPublicar = false;
    this.router.navigate(['/admin/formularios']);
  }

  guardar(): void {
    this.validarSintaxis();
    if (this.errorSintaxis || !this.esquemaCompilado) {
      return;
    }
    const parsed = this.esquemaCompilado;

    this.guardando = true;
    this.errorGeneral = '';

    if (this.esNuevo) {
      this.formularioService
        .crearBorrador({
          codigo: this.codigo.trim(),
          esquema: parsed,
        })
        .subscribe({
          next: () => {
            this.guardando = false;
            this.router.navigate(['/admin/formularios']);
          },
          error: (err) => {
            this.guardando = false;
            this.errorGeneral = err?.error?.detail || 'Error al guardar el nuevo borrador.';
            this.cdr.markForCheck();
          },
        });
    } else if (this.idVersion) {
      this.formularioService
        .editarBorrador(this.idVersion, {
          esquema: parsed,
        })
        .subscribe({
          next: () => {
            this.guardando = false;
            this.router.navigate(['/admin/formularios']);
          },
          error: (err) => {
            this.guardando = false;
            this.errorGeneral = err?.error?.detail || 'Error al actualizar el borrador.';
            this.cdr.markForCheck();
          },
        });
    }
  }
}
