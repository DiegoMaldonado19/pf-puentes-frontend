import { Component } from '@angular/core';
import { TEXTOS } from '../../../shared/textos';

/** Gancho de /admin/usuarios. El listado se implementa más adelante. */
@Component({
  selector: 'app-usuarios',
  template: `
    <section class="mx-auto max-w-6xl p-4">
      <h1 class="text-2xl font-bold">{{ t.titulo }}</h1>
    </section>
  `,
})
export class Usuarios {
  protected readonly t = TEXTOS.admin.usuarios;
}
