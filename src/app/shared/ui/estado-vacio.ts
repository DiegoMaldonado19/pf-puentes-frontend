import { Component, input } from '@angular/core';

/** Estado vacío de una lista (F1): un único mensaje que anuncian los lectores de pantalla. */
@Component({
  selector: 'app-estado-vacio',
  template: `<div role="status" class="rounded bg-lienzo p-8 text-center">{{ mensaje() }}</div>`,
})
export class EstadoVacio {
  readonly mensaje = input.required<string>();
}
