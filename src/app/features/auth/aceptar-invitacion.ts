import { Component } from '@angular/core';
import { TEXTOS } from '../../shared/textos';

/** Gancho de /aceptar-invitacion. El formulario se implementa más adelante. */
@Component({
  selector: 'app-aceptar-invitacion',
  template: `
    <section class="mx-auto max-w-6xl p-4">
      <h1 class="text-2xl font-bold">{{ t.titulo }}</h1>
    </section>
  `,
})
export class AceptarInvitacion {
  protected readonly t = TEXTOS.auth.invitacion;
}
