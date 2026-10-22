import { Component } from '@angular/core';
import { TEXTOS } from '../../../shared/textos';

/** Gancho de /admin/usuarios/:id. La ficha se implementa más adelante. */
@Component({
  selector: 'app-ficha-usuario',
  template: `
    <section class="mx-auto max-w-6xl p-4">
      <h1 class="text-2xl font-bold">{{ t.ficha }}</h1>
    </section>
  `,
})
export class FichaUsuario {
  protected readonly t = TEXTOS.admin.usuarios;
}
