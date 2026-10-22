import { Component } from '@angular/core';
import { TEXTOS } from '../../../shared/textos';

/** Gancho de /admin/invitaciones. La tabla y el alta se implementan más adelante. */
@Component({
  selector: 'app-invitaciones',
  template: `
    <section class="mx-auto max-w-6xl p-4">
      <h1 class="text-2xl font-bold">{{ t.titulo }}</h1>
    </section>
  `,
})
export class Invitaciones {
  protected readonly t = TEXTOS.admin.invitaciones;
}
