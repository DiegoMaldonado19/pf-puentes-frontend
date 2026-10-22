import { Component } from '@angular/core';
import { TEXTOS } from '../../shared/textos';

/** Gancho de /verificar-correo. La consulta del token se implementa más adelante. */
@Component({
  selector: 'app-verificar-correo',
  template: `
    <section class="mx-auto max-w-6xl p-4">
      <h1 class="text-2xl font-bold">{{ t.titulo }}</h1>
    </section>
  `,
})
export class VerificarCorreo {
  protected readonly t = TEXTOS.auth.verificar;
}
