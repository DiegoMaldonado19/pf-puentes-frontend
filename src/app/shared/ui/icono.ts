import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Trazos SVG en línea (contorno de 24 px). Sin imágenes externas ni fuentes de iconos. */
export const TRAZOS_ICONO = {
  inicio: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  puente: 'M3 17c3-6 6-6 9 0s6 6 9 0M3 9h18M7 9v8M17 9v8',
  mapa: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14',
  foro: 'M4 5h16v11H9l-5 4z',
  local: 'M4 7h16v12H4zM8 7V4h8v3',
  inspeccion: 'M9 4h6v3H9zM6 6h12v15H6zM9 12h6M9 16h6',
  revision: 'M5 12l4 4 10-10',
  curso: 'M3 7l9-4 9 4-9 4zM7 9.5V14c0 1.7 2.2 3 5 3s5-1.3 5-3V9.5',
  mantenimiento: 'M14 6a4 4 0 0 0 4.9 5.4L10 20.3a2 2 0 0 1-2.8-2.8L16.2 8.6A4 4 0 0 0 14 6z',
  usuarios: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-6 8-6s8 2 8 6',
  invitacion: 'M3 6h18v12H3zM3 6l9 7 9-7',
  auditoria: 'M6 3h9l3 3v15H6zM14 3v4h4M9 12h6M9 16h6',
  formulario: 'M7 3h7l4 4v14H7zM10 12h4M10 16h4',
  pesos: 'M12 3v18M5 7h14M7 7l-3 6h6zM17 7l-3 6h6z',
  cuenta: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-6 8-6s8 2 8 6',
} as const;

export type NombreIcono = keyof typeof TRAZOS_ICONO;

/** Icono decorativo: se oculta a los lectores de pantalla; el texto del enlace da el nombre. */
@Component({
  selector: 'app-icono',
  template: `
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path [attr.d]="trazo()" />
    </svg>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'hvc-icono', 'aria-hidden': 'true' },
})
export class Icono {
  readonly nombre = input.required<NombreIcono>();
  protected readonly trazo = computed(() => TRAZOS_ICONO[this.nombre()]);
}
