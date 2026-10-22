import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import { AuthService } from './auth';
import { authInterceptor } from './auth.interceptor';
import { SesionDTO } from './modelos';
import { rolGuard } from './rol.guard';
import { sesionGuard } from './sesion.guard';
import { visitanteGuard } from './visitante.guard';

@Component({ selector: 'app-vacio', template: '' })
class Vacio {}

const sesion = (rol: SesionDTO['usuario']['rol']): SesionDTO => ({
  access_token: 'tok-1',
  token_type: 'Bearer',
  expires_in: 900,
  usuario: { id: 'u1', nombre: 'Ana Pérez', rol },
});

describe('guardias de sesión y rol', () => {
  let auth: AuthService;
  let http: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'login', component: Vacio, canActivate: [visitanteGuard] },
          { path: 'perfil', component: Vacio, canActivate: [sesionGuard] },
          { path: 'admin/usuarios', component: Vacio, canActivate: [rolGuard('ADMINISTRADOR')] },
          { path: 'puentes', component: Vacio },
          {
            path: 'puentes/nuevo',
            component: Vacio,
            canActivate: [rolGuard('ADMINISTRADOR')],
          },
          {
            path: 'puentes/solicitudes',
            component: Vacio,
            canActivate: [rolGuard('ADMINISTRADOR', 'CATEDRATICO')],
          },
        ]),
      ],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    try {
      http.verify();
    } finally {
      TestBed.resetTestingModule();
    }
  });

  async function entrar(rol: SesionDTO['usuario']['rol']): Promise<void> {
    const respuesta = firstValueFrom(auth.iniciarSesion('ana@correo.com', 'Puentes2026ok'));
    http.expectOne('/api/v1/auth/login').flush(sesion(rol));
    await respuesta;
  }

  it('manda al estudiante que entra a /admin/usuarios de vuelta al mapa', async () => {
    await entrar('ESTUDIANTE');
    await router.navigateByUrl('/admin/usuarios');
    expect(router.url).toBe('/puentes');
  });

  it('deja pasar al administrador a /admin/usuarios', async () => {
    await entrar('ADMINISTRADOR');
    await router.navigateByUrl('/admin/usuarios');
    expect(router.url).toBe('/admin/usuarios');
  });

  it('manda al visitante de /perfil a /login', async () => {
    vi.spyOn(auth, 'hidratarAlArrancar').mockReturnValue(of(undefined));
    await router.navigateByUrl('/perfil');
    expect(router.url).toBe('/login');
  });

  it('si ya hay sesión, /login redirige al destino del rol', async () => {
    await entrar('ADMINISTRADOR');
    await router.navigateByUrl('/login');
    expect(router.url).toBe('/admin/usuarios');
  });

  it('manda al estudiante que entra a /puentes/nuevo de vuelta al mapa', async () => {
    await entrar('ESTUDIANTE');
    await router.navigateByUrl('/puentes/nuevo');
    expect(router.url).toBe('/puentes');
  });

  it('deja pasar al administrador a /puentes/nuevo', async () => {
    await entrar('ADMINISTRADOR');
    await router.navigateByUrl('/puentes/nuevo');
    expect(router.url).toBe('/puentes/nuevo');
  });

  it('deja pasar al catedrático a /puentes/solicitudes', async () => {
    await entrar('CATEDRATICO');
    await router.navigateByUrl('/puentes/solicitudes');
    expect(router.url).toBe('/puentes/solicitudes');
  });
});
