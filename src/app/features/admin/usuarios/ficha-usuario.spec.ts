import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/auth/auth';
import { TEXTOS } from '../../../shared/textos';
import { estabilizar, proveedoresAuth, sesion } from '../../auth/datos-prueba';
import { usuarioAdmin } from '../datos-prueba';
import { FichaUsuario } from './ficha-usuario';

describe('FichaUsuario', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [FichaUsuario],
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

  async function abrir(id: string, cuenta = usuarioAdmin({ id })) {
    const fixture = TestBed.createComponent(FichaUsuario);
    fixture.componentRef.setInput('id', id);
    await estabilizar(fixture);
    http.expectOne(`/api/v1/usuarios/${id}`).flush(cuenta);
    await estabilizar(fixture);
    return { fixture, html: fixture.nativeElement as HTMLElement };
  }

  it('deshabilita la baja en la ficha propia', async () => {
    const { html } = await abrir('u1', usuarioAdmin({ id: 'u1', rol: 'ADMINISTRADOR' }));
    const baja = [...html.querySelectorAll('button')].find((b) =>
      b.textContent?.includes(TEXTOS.admin.usuarios.baja),
    );
    expect(baja).toBeTruthy();
    expect(baja?.disabled).toBe(true);
    expect(baja?.getAttribute('title')).toBe(TEXTOS.admin.usuarios.bajaPropia);
    expect(html.textContent).toContain(TEXTOS.admin.usuarios.bajaPropia);
  });

  it('oculta colegiado si no es profesional pendiente con número', async () => {
    const { html } = await abrir('u2', usuarioAdmin({ id: 'u2', rol: 'ESTUDIANTE' }));
    expect(html.textContent).not.toContain(TEXTOS.admin.usuarios.aprobarColegiado);
    expect(html.textContent).not.toContain(TEXTOS.admin.usuarios.rechazarColegiado);
  });

  it('muestra aprobar y rechazar colegiado cuando aplica', async () => {
    const { html } = await abrir(
      'u3',
      usuarioAdmin({
        id: 'u3',
        rol: 'PROFESIONAL_EXTERNO',
        estado: 'PENDIENTE',
        numero_colegiado: 'CIG-7788',
      }),
    );
    expect(html.textContent).toContain(TEXTOS.admin.usuarios.aprobarColegiado);
    expect(html.textContent).toContain(TEXTOS.admin.usuarios.rechazarColegiado);
  });
});
