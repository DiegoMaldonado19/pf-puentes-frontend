import { Component, inject, Injectable, signal } from '@angular/core';
import { TEXTOS } from '../textos';

export interface Aviso {
  readonly id: number;
  readonly texto: string;
  readonly tipo: 'ok' | 'error';
}

/** Avisos efímeros de una acción (F1). Los de error permanecen más tiempo. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly avisos = signal<readonly Aviso[]>([]);
  private siguiente = 0;

  ok(texto: string): void {
    this.mostrar(texto, 'ok');
  }

  error(texto: string): void {
    this.mostrar(texto, 'error');
  }

  descartar(id: number): void {
    this.avisos.update((lista) => lista.filter((aviso) => aviso.id !== id));
  }

  private mostrar(texto: string, tipo: 'ok' | 'error'): void {
    const id = ++this.siguiente;
    this.avisos.update((lista) => [...lista, { id, texto, tipo }]);
    setTimeout(() => this.descartar(id), tipo === 'ok' ? 4000 : 8000);
  }
}

/** Contenedor de avisos: se monta una vez en la carcasa de la aplicación. */
@Component({
  selector: 'app-toaster',
  template: `
    <section class="fixed right-4 bottom-4 z-50 grid max-w-sm gap-2" [attr.aria-label]="t.avisos">
      @for (aviso of toast.avisos(); track aviso.id) {
        <div
          role="status"
          class="flex items-start gap-3 rounded border px-4 py-3 shadow-md"
          [class.bg-bueno-tinte]="aviso.tipo === 'ok'"
          [class.bg-malo-tinte]="aviso.tipo === 'error'"
        >
          <p class="m-0 flex-1 text-sm">{{ aviso.texto }}</p>
          <button type="button" class="text-sm underline" (click)="toast.descartar(aviso.id)">
            {{ t.cerrar }}
          </button>
        </div>
      }
    </section>
  `,
})
export class AppToaster {
  protected readonly toast = inject(ToastService);
  protected readonly t = TEXTOS.toast;
}
