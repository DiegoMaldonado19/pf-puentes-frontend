import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthService } from '../../core/auth/auth';
import { TEXTOS } from '../../shared/textos';
import { cuentaRegistrada, estabilizar, escribir, problema, proveedoresAuth } from './datos-prueba';
import { Registro } from './registro';

describe('Registro', () => {
  let fixture: ComponentFixture<Registro>;
  let html: HTMLElement;
  let http: HttpTestingController;
  let auth: AuthService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [Registro],
      providers: proveedoresAuth(),
    });
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    fixture = TestBed.createComponent(Registro);
    html = fixture.nativeElement as HTMLElement;
    await estabilizar(fixture);
  });

  afterEach(() => {
    try {
      http.verify();
    } finally {
      TestBed.resetTestingModule();
    }
  });

  it('no muestra selector de rol', () => {
    expect(html.querySelector('select')).toBeNull();
    expect(html.querySelector('#rol')).toBeNull();
    expect(html.querySelector('[name="rol"]')).toBeNull();
  });

  it('tras 201 no inicia sesión y ofrece reenviar', async () => {
    escribir(html, 'nombre', 'Ana Pérez');
    escribir(html, 'correo', 'ana@correo.com');
    escribir(html, 'contrasena', 'Puentes2026ok');
    escribir(html, 'confirmar', 'Puentes2026ok');
    await estabilizar(fixture);
    html.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    await estabilizar(fixture);
    const peticion = http.expectOne('/api/v1/auth/registro');
    expect(peticion.request.body).not.toHaveProperty('rol');
    peticion.flush(cuentaRegistrada(), { status: 201, statusText: 'Created' });
    await estabilizar(fixture);
    expect(auth.autenticado()).toBe(false);
    expect(html.textContent).toContain(TEXTOS.auth.registro.hecho);
    expect(html.textContent).toContain(TEXTOS.auth.registro.reenviar);
  });

  it('muestra el mensaje si el correo ya está registrado', async () => {
    escribir(html, 'nombre', 'Ana Pérez');
    escribir(html, 'correo', 'ana@correo.com');
    escribir(html, 'contrasena', 'Puentes2026ok');
    escribir(html, 'confirmar', 'Puentes2026ok');
    await estabilizar(fixture);
    html.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    await estabilizar(fixture);
    http.expectOne('/api/v1/auth/registro').flush(problema('correo-ya-registrado'), {
      status: 409,
      statusText: 'Conflict',
    });
    await estabilizar(fixture);
    expect(html.querySelector('[role="alert"]')?.textContent).toContain(
      TEXTOS.auth.errores['correo-ya-registrado'],
    );
  });
});
