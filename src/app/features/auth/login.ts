import { Component } from '@angular/core';
import { TEXTOS } from '../../shared/textos';

/** Gancho de /login. El formulario se implementa en la fase de flujos públicos. */
@Component({
  selector: 'app-login',
  template: `
    <section class="mx-auto max-w-6xl p-4">
      <h1 class="text-2xl font-bold">{{ t.titulo }}</h1>
    </section>
  `,
})
export class Login {
  protected readonly t = TEXTOS.auth.login;
}
