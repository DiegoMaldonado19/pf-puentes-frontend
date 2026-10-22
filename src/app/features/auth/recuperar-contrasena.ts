import { Component } from '@angular/core';
import { TEXTOS } from '../../shared/textos';

/** Gancho de /recuperar-contrasena. El formulario se implementa más adelante. */
@Component({
  selector: 'app-recuperar-contrasena',
  template: `
    <section class="mx-auto max-w-6xl p-4">
      <h1 class="text-2xl font-bold">{{ t.titulo }}</h1>
    </section>
  `,
})
export class RecuperarContrasena {
  protected readonly t = TEXTOS.auth.recuperar;
}
