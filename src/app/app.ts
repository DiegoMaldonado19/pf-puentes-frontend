import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth';
import { TEXTOS } from './shared/textos';

@Component({
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly t = TEXTOS.puentes.nav;
  protected readonly n = TEXTOS.auth.nav;
  protected readonly roles = TEXTOS.auth.roles;
  protected readonly auth = inject(AuthService);

  protected salir(): void {
    this.auth.cerrarSesion().subscribe();
  }
}
