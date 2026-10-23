import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/auth/auth';
import { TEXTOS } from '../../../shared/textos';
import { estabilizar, proveedoresAuth, sesion } from '../../auth/datos-prueba';
import { invitacionAdmin, paginaAdmin } from '../datos-prueba';
import { Invitaciones } from './invitaciones';

describe('Invitaciones', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [Invitaciones],
      providers: proveedoresAuth(),
    });
    http = TestBed.inject(HttpTestingController);
    const auth = TestBed.inject(AuthService);
    const login = firstValueFrom(auth.iniciarSesion('ana@correo.com', 'Puentes2026ok'));
    http.expectOne('/api/v1/auth/login').flush(sesion('ADMINISTRADOR'));
    await login;
  });

  afterEach(() => {
    try {
      http.verify();
    } finally {
      TestBed.resetTestingModule();
    }
  });

  async function abrir(
    filas = [invitacionAdmin(), invitacionAdmin({ id: 'inv-2', estado: 'ACEPTADA' })],
  ) {
    const fixture = TestBed.createComponent(Invitaciones);
    await estabilizar(fixture);
    http.expectOne((req) => req.url === '/api/v1/invitaciones').flush(paginaAdmin(filas));
    await estabilizar(fixture);
    return { fixture, html: fixture.nativeElement as HTMLElement };
  }

  it('no ofrece ESTUDIANTE ni pinta un token de invitación', async () => {
    const { html } = await abrir();
    const opciones = [...html.querySelectorAll('#rol option')].map((o) => o.getAttribute('value'));
    expect(opciones).toEqual(['PROFESIONAL_EXTERNO', 'CATEDRATICO', 'ADMINISTRADOR']);
    expect(opciones).not.toContain('ESTUDIANTE');
    expect(html.textContent).not.toContain('tok-inv');
    expect(html.querySelector('[data-token]')).toBeNull();
  });

  it('solo deja revocar invitaciones abiertas', async () => {
    const { html } = await abrir();
    const botones = [...html.querySelectorAll('button')].filter((b) =>
      b.textContent?.includes(TEXTOS.admin.invitaciones.revocar),
    );
    expect(botones).toHaveLength(1);
  });
});
