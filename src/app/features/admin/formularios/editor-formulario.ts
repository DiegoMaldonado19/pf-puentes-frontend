import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TEXTOS } from '../../../../shared/textos';
import { FormularioService } from '../../formulario/formulario.service';
import { EsquemaFormulario, FormularioVersionDTO } from '../../formulario/modelos';
import { MotorFormularioComponent } from '../../formulario/motor-formulario/motor-formulario';

@Component({
  selector: 'app-editor-formulario',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MotorFormularioComponent],
  template: `
    <div class="space-y-6 p-4 max-w-7xl mx-auto">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <a routerLink="/admin/formularios" class="text-sm font-medium text-blue-600 hover:underline">
              ← Volver a versiones
            </a>
          </div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {{ esNuevo ? textos.nuevaVersion : (version?.estado === 'BORRADOR' ? textos.editarBorrador : 'Consulta de Esquema') }}: {{ codigo }}
          </h1>
        </div>

        <div class="flex items-center gap-3">
          @if (!esSoloLectura) {
            <button
              type="button"
              (click)="guardar()"
              [disabled]="guardando"
              class="px-5 py-2.5 bg-blue-600 text-white font-semibold text-sm rounded-xl hover:bg-blue-700 shadow-sm disabled:opacity-50 transition-colors">
              {{ guardando ? 'Guardando…' : textos.guardarBorrador }}
            </button>
          }
        </div>
      </div>

      @if (errorGeneral) {
        <div class="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
          {{ errorGeneral }}
        </div>
      }

      <!-- Pestañas de Editor vs Vista Previa -->
      <div class="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <button
          type="button"
          (click)="tabActiva = 'editor'"
          class="px-4 py-2 font-semibold text-sm border-b-2 transition-colors"
          [class.border-blue-600]="tabActiva === 'editor'"
          [class.text-blue-600]="tabActiva === 'editor'"
          [class.border-transparent]="tabActiva !== 'editor'"
          [class.text-gray-500]="tabActiva !== 'editor'">
          Editor JSON Schema
        </button>
        <button
          type="button"
          (click)="actualizarVistaPrevia()"
          class="px-4 py-2 font-semibold text-sm border-b-2 transition-colors"
          [class.border-blue-600]="tabActiva === 'preview'"
          [class.text-blue-600]="tabActiva === 'preview'"
          [class.border-transparent]="tabActiva !== 'preview'"
          [class.text-gray-500]="tabActiva !== 'preview'">
          Vista Previa en Vivo (<app-motor-formulario>)
        </button>
      </div>

      <!-- Contenido del Editor -->
      @if (tabActiva === 'editor') {
        <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">
                {{ textos.codigo }}
              </label>
              <input
                type="text"
                [(ngModel)]="codigo"
                [readOnly]="!esNuevo"
                placeholder="V2.0.0"
                class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                [class.bg-gray-100]="!esNuevo" />
            </div>
          </div>

          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="block text-sm font-semibold text-gray-700 dark:text-gray-200">
                Estructura JSON Schema (Draft 7)
              </label>
              @if (errorSintaxis) {
                <span class="text-xs text-rose-600 font-bold">{{ errorSintaxis }}</span>
              }
            </div>
            <textarea
              [(ngModel)]="esquemaJsonTexto"
              (input)="errorSintaxis = ''"
              [readOnly]="esSoloLectura"
              rows="22"
              class="w-full px-4 py-3 text-xs font-mono rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 font-medium leading-relaxed">
            </textarea>
          </div>
        </div>
      } @else {
        <!-- Vista previa renderizada por el motor dinámico -->
        <div class="space-y-4">
          <div class="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800">
            Esta vista previa se genera dinámicamente con el componente <code>&lt;app-motor-formulario&gt;</code> exactamente igual a como lo visualizan los inspectores en campo.
          </div>
          @if (esquemaCompilado) {
            <app-motor-formulario
              [esquema]="esquemaCompilado"
              [modo]="'edicion'" />
          }
        </div>
      }
    </div>
  `,
})
export class EditorFormulario implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formularioService = inject(FormularioService);

  readonly textos = TEXTOS.formulario.admin;

  esNuevo = true;
  idVersion?: string;
  version?: FormularioVersionDTO;
  codigo = '';
  esquemaJsonTexto = '';
  esquemaCompilado?: EsquemaFormulario;

  tabActiva: 'editor' | 'preview' = 'editor';
  guardando = false;
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
      this.esquemaJsonTexto = JSON.stringify(
        {
          $schema: 'http://json-schema.org/draft-07/schema#',
          title: 'Nuevo Formulario',
          type: 'object',
          properties: {
            seccion_1: {
              type: 'object',
              title: 'Sección 1',
              properties: {
                pregunta_1: {
                  type: 'integer',
                  minimum: 0,
                  maximum: 4,
                  title: 'Calificación de daño preliminar',
                  'x-dano': true,
                },
              },
            },
          },
        },
        null,
        2,
      );
    }
  }

  cargarVersion(id: string): void {
    this.formularioService.detalle(id).subscribe({
      next: (v) => {
        this.version = v;
        this.codigo = v.codigo;
        this.esquemaJsonTexto = JSON.stringify(v.esquema, null, 2);
      },
      error: () => {
        this.errorGeneral = 'No se pudo cargar la versión del formulario.';
      },
    });
  }

  actualizarVistaPrevia(): void {
    try {
      this.esquemaCompilado = JSON.parse(this.esquemaJsonTexto);
      this.errorSintaxis = '';
      this.tabActiva = 'preview';
    } catch {
      this.errorSintaxis = 'Sintaxis JSON inválida. Corrígela antes de abrir la vista previa.';
    }
  }

  guardar(): void {
    let parsed: EsquemaFormulario;
    try {
      parsed = JSON.parse(this.esquemaJsonTexto);
    } catch {
      this.errorSintaxis = 'Sintaxis JSON inválida.';
      return;
    }

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
          },
        });
    }
  }
}
