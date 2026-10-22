import { Component } from '@angular/core';
import { TEXTOS } from '../../shared/textos';

/** Gancho de /perfil. La ficha y el cambio de contraseña se implementan más adelante. */
@Component({
  selector: 'app-perfil',
  template: `
    <section class="mx-auto max-w-6xl p-4">
      <h1 class="text-2xl font-bold">{{ t.titulo }}</h1>
    </section>
  `,
})
export class Perfil {
  protected readonly t = TEXTOS.auth.perfil;
}
