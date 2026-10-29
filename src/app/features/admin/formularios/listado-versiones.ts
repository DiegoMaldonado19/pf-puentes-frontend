import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TEXTOS } from '../../../shared/textos';
import { FormularioService } from '../../formulario/formulario.service';
import { FormularioVersionDTO } from '../../formulario/modelos';
import { ModalPublicar } from './modal-publicar';

@Component({
  selector: 'app-listado-versiones',
  standalone: true,
  imports: [CommonModule, RouterLink, ModalPublicar],
  template: `
    <div class="space-y-6 p-4 max-w-6xl mx-auto">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-h1 dark:text-white">
            {{ textos.titulo }}
          </h1>
          <p class="text-sm text-gray-600 dark:text-gray-300 mt-1">
            Control de inmutabilidad y publicación del formulario de inspección SIECA (RN-FRM-01 a
            RN-FRM-06).
          </p>
        </div>

        <a
          routerLink="nuevo"
          class="btn-hvc-primary self-start sm:self-auto flex items-center gap-2"
        >
          <span>+</span> {{ textos.nuevaVersion }}
        </a>
      </div>

      @if (error()) {
        <div class="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
          {{ error() }}
        </div>
      }

      <!-- Tabla de versiones -->
      <div
        class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
      >
        @if (cargando()) {
          <div class="p-8 text-center text-gray-600 dark:text-gray-300">
            Cargando versiones del formulario…
          </div>
        } @else if (versiones().length === 0) {
          <div class="p-8 text-center text-gray-600 dark:text-gray-300">
            No se han registrado versiones del formulario.
          </div>
        } @else {
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr
                  class="border-b border-gray-100 dark:border-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300 bg-gray-50/50 dark:bg-gray-900/50"
                >
                  <th class="p-4">{{ textos.codigo }}</th>
                  <th class="p-4">{{ textos.estado }}</th>
                  <th class="p-4">{{ textos.publicadaEn }}</th>
                  <th class="p-4 text-right">{{ textos.acciones }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                @for (v of versiones(); track v.id) {
                  <tr class="hover:bg-gray-50/50 dark:hover:bg-gray-750 transition-colors">
                    <td class="p-4 font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      {{ v.codigo }}
                      @if (v.estado === 'ACTIVA') {
                        <span
                          class="text-xs bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 rounded-full font-semibold"
                        >
                          Vigente Oficial
                        </span>
                      }
                    </td>
                    <td class="p-4">
                      <span
                        class="text-xs font-semibold px-2.5 py-1 rounded-full inline-block"
                        [ngClass]="{
                          'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200':
                            v.estado === 'ACTIVA',
                          'bg-amber-100 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200':
                            v.estado === 'BORRADOR',
                          'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200':
                            v.estado === 'RETIRADA',
                        }"
                      >
                        {{ v.estado }}
                      </span>
                    </td>
                    <td class="p-4 text-gray-600 dark:text-gray-300 text-xs">
                      {{ v.publicada_en ? (v.publicada_en | date: 'dd/MM/yyyy HH:mm') : '—' }}
                    </td>
                    <td class="p-4 text-right space-x-2">
                      <a
                        [routerLink]="[v.id, 'editar']"
                        class="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
                      >
                        {{ v.estado === 'BORRADOR' ? textos.editarBorrador : textos.verEsquema }}
                      </a>

                      @if (v.estado === 'BORRADOR') {
                        <button
                          type="button"
                          (click)="abrirPublicar(v)"
                          class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                        >
                          {{ textos.publicarBorrador }}
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>

      <!-- Modal de publicación -->
      @if (versionSeleccionada(); as versionSel) {
        <app-modal-publicar
          [version]="versionSel"
          (publicado)="alPublicarExitoso()"
          (cancelar)="versionSeleccionada.set(null)"
        />
      }
    </div>
  `,
})
export class ListadoVersiones implements OnInit {
  private readonly formularioService = inject(FormularioService);
  private readonly cdr = inject(ChangeDetectorRef);
  readonly textos = TEXTOS.formulario.admin;

  readonly versiones = signal<FormularioVersionDTO[]>([]);
  readonly cargando = signal(true);
  readonly error = signal('');
  readonly versionSeleccionada = signal<FormularioVersionDTO | null>(null);

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set('');
    this.formularioService.listar(0, 50).subscribe({
      next: (res) => {
        this.versiones.set(res?.contenido ?? []);
        this.cargando.set(false);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error.set(err?.error?.detail || 'No se pudieron cargar las versiones del formulario.');
        this.cargando.set(false);
        this.cdr.markForCheck();
      },
    });
  }

  abrirPublicar(version: FormularioVersionDTO): void {
    this.versionSeleccionada.set(version);
    this.cdr.markForCheck();
  }

  alPublicarExitoso(): void {
    this.versionSeleccionada.set(null);
    this.cargar();
  }
}
