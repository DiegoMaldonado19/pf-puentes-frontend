import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/auth/auth';
import { TEXTOS } from '../../../shared/textos';
import { estabilizar, proveedoresAuth, sesion } from '../../auth/datos-prueba';
import { paginaAdmin, usuarioAdmin } from '../datos-prueba';
import { Usuarios } from './usuarios';

describe('Usuarios', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [Usuarios],
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

  it('lista cuentas y enlaza a la ficha, con búsqueda limitada a 120', async () => {
    const fixture = TestBed.createComponent(Usuarios);
    await estabilizar(fixture);
    http
      .expectOne((req) => req.url === '/api/v1/usuarios')
      .flush(paginaAdmin([usuarioAdmin({ id: 'u2' })]));
    await estabilizar(fixture);
    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('a[href="/admin/usuarios/u2"]')).not.toBeNull();
    expect(html.querySelector('#filtro-q')?.getAttribute('maxlength')).toBe('120');
    expect(html.textContent).not.toContain('Activar estudiante');
  });

  it('guardar un alta incompleta marca los campos y no envía nada', async () => {
    const fixture = TestBed.createComponent(Usuarios);
    await estabilizar(fixture);
    http.expectOne((req) => req.url === '/api/v1/usuarios').flush(paginaAdmin([]));
    await estabilizar(fixture);

    const html = fixture.nativeElement as HTMLElement;
    const nuevo = Array.from(html.querySelectorAll('button')).find((b) =>
      b.textContent?.includes(TEXTOS.admin.usuarios.gestion.nuevo),
    );
    nuevo?.click();
    await estabilizar(fixture);
    fixture.componentInstance['guardar']();
    await estabilizar(fixture);

    http.expectNone((req) => req.url === '/api/v1/usuarios' && req.method === 'POST');
    expect(html.querySelector('#error-usuario-nombre')).not.toBeNull();
    expect(html.querySelector('#error-usuario-correo')).not.toBeNull();
  });

  it('el alta envía nombre, correo y rol al API y recarga la lista', async () => {
    const fixture = TestBed.createComponent(Usuarios);
    await estabilizar(fixture);
    http.expectOne((req) => req.url === '/api/v1/usuarios').flush(paginaAdmin([]));
    await estabilizar(fixture);

    fixture.componentInstance['abrirAlta']();
    fixture.componentInstance['form'].setValue({
      nombre: '  Ana Pérez ',
      correo: ' ANA@usac.edu.gt ',
      rol: 'CATEDRATICO',
    });
    const guardado = fixture.componentInstance['guardar']();
    await estabilizar(fixture);
    const alta = http.expectOne({ method: 'POST', url: '/api/v1/usuarios' });
    expect(alta.request.body).toEqual({
      nombre: 'Ana Pérez',
      correo: 'ANA@usac.edu.gt',
      rol: 'CATEDRATICO',
    });
    alta.flush(usuarioAdmin({ id: 'nueva', estado: 'ACTIVO' }));
    await guardado;
    await estabilizar(fixture);
    http.expectOne((req) => req.url === '/api/v1/usuarios').flush(paginaAdmin([]));
    await estabilizar(fixture);
  });
});
