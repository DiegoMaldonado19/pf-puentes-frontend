import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { CuentaService } from './cuenta';
import { cuentaRegistrada, invitacionPublica } from './datos-prueba';

describe('CuentaService', () => {
  let cuenta: CuentaService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    cuenta = TestBed.inject(CuentaService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    try {
      http.verify();
    } finally {
      TestBed.resetTestingModule();
    }
  });

  it('registra sin rol y manda el correo en minúsculas', async () => {
    const respuesta = firstValueFrom(
      cuenta.registrar(' Ana Pérez ', 'Ana@Correo.com', 'Puentes2026ok'),
    );
    const peticion = http.expectOne('/api/v1/auth/registro');
    expect(peticion.request.body).toEqual({
      nombre: 'Ana Pérez',
      correo: 'ana@correo.com',
      contrasena: 'Puentes2026ok',
    });
    expect(peticion.request.body).not.toHaveProperty('rol');
    peticion.flush(cuentaRegistrada());
    expect(await respuesta).toEqual(cuentaRegistrada());
  });

  it('consulta y acepta una invitación', async () => {
    const consulta = firstValueFrom(cuenta.consultarInvitacion('tok-inv'));
    http.expectOne('/api/v1/auth/invitaciones/consultar').flush(invitacionPublica());
    expect(await consulta).toEqual(invitacionPublica());

    const aceptacion = firstValueFrom(
      cuenta.aceptarInvitacion({
        token: 'tok-inv',
        nombre: 'Ana Pérez',
        contrasena: 'Puentes2026ok',
      }),
    );
    http
      .expectOne('/api/v1/auth/invitaciones/aceptar')
      .flush(cuentaRegistrada('CATEDRATICO', 'ACTIVO'), { status: 201, statusText: 'Created' });
    expect((await aceptacion).estado).toBe('ACTIVO');
  });

  it('verificar, reenviar, recuperar y restablecer no esperan cuerpo', async () => {
    const verificar = firstValueFrom(cuenta.verificarCorreo('tok'));
    http
      .expectOne('/api/v1/auth/verificar-correo')
      .flush(null, { status: 204, statusText: 'No Content' });
    await verificar;

    const reenviar = firstValueFrom(cuenta.reenviarVerificacion('Ana@Correo.com'));
    const reenvio = http.expectOne('/api/v1/auth/reenviar-verificacion');
    expect(reenvio.request.body).toEqual({ correo: 'ana@correo.com' });
    reenvio.flush(null, { status: 202, statusText: 'Accepted' });
    await reenviar;

    const recuperar = firstValueFrom(cuenta.recuperarContrasena('Ana@Correo.com'));
    http
      .expectOne('/api/v1/auth/recuperar-contrasena')
      .flush(null, { status: 202, statusText: 'Accepted' });
    await recuperar;

    const restablecer = firstValueFrom(cuenta.restablecerContrasena('tok', 'Puentes2027ok'));
    const cambio = http.expectOne('/api/v1/auth/restablecer-contrasena');
    expect(cambio.request.body).toEqual({ token: 'tok', contrasena: 'Puentes2027ok' });
    cambio.flush(null, { status: 204, statusText: 'No Content' });
    await restablecer;
  });
});
