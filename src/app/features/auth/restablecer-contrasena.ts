import { Component } from '@angular/core';
import { TEXTOS } from '../../shared/textos';

/** Gancho de /restablecer-contrasena. El formulario se implementa más adelante. */
@Component({
  selector: 'app-restablecer-contrasena',
  template: `
    <section class="mx-auto max-w-6xl p-4">
      <h1 class="text-2xl font-bold">{{ t.titulo }}</h1>
    </section>
  `,
})
export class RestablecerContrasena {
  protected readonly t = TEXTOS.auth.restablecer;
}
