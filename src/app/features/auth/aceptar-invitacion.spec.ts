import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TEXTOS } from '../../shared/textos';
import {
  cuentaRegistrada,
  estabilizar,
  escribir,
  invitacionPublica,
  proveedoresAuth,
  rutaConToken,
} from './datos-prueba';
import { AceptarInvitacion } from './aceptar-invitacion';

describe('AceptarInvitacion', () => {
  let http: HttpTestingController | undefined;

  afterEach(() => {
    try {
      http?.verify();
    } finally {
      http = undefined;
      TestBed.resetTestingModule();
    }
  });

  async function crear(rol: 'CATEDRATICO' | 'PROFESIONAL_EXTERNO' = 'CATEDRATICO') {
    TestBed.configureTestingModule({
      imports: [AceptarInvitacion],
      providers: proveedoresAuth(rutaConToken('tok-inv')),
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(AceptarInvitacion);
    http.expectOne('/api/v1/auth/invitaciones/consultar').flush(invitacionPublica(rol));
    await estabilizar(fixture);
    return { fixture, html: fixture.nativeElement as HTMLElement };
  }

  it('el catedrático no ve el campo de colegiado', async () => {
    const { html } = await crear('CATEDRATICO');
    expect(html.querySelector('#numero_colegiado')).toBeNull();
    expect(html.textContent).not.toContain(TEXTOS.auth.campos.colegiado);
  });

  it('el profesional exige colegiado y no acepta sin él', async () => {
    const { fixture, html } = await crear('PROFESIONAL_EXTERNO');
    expect(html.querySelector('#numero_colegiado')).not.toBeNull();
    escribir(html, 'nombre', 'Ana Pérez');
    escribir(html, 'contrasena', 'Puentes2026ok');
    escribir(html, 'confirmar', 'Puentes2026ok');
    await estabilizar(fixture);
    html.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    await estabilizar(fixture);
    http?.expectNone('/api/v1/auth/invitaciones/aceptar');
    expect(html.textContent).toContain(TEXTOS.auth.errores.obligatorio);
  });

  it('un profesional pendiente no va a login como si ya pudiera entrar', async () => {
    const { fixture, html } = await crear('PROFESIONAL_EXTERNO');
    escribir(html, 'nombre', 'Ana Pérez');
    escribir(html, 'contrasena', 'Puentes2026ok');
    escribir(html, 'confirmar', 'Puentes2026ok');
    escribir(html, 'numero_colegiado', 'CIG-7788');
    await estabilizar(fixture);
    html.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    await estabilizar(fixture);
    const peticion = http?.expectOne('/api/v1/auth/invitaciones/aceptar');
    expect(peticion?.request.body.numero_colegiado).toBe('CIG-7788');
    peticion?.flush(cuentaRegistrada('PROFESIONAL_EXTERNO', 'PENDIENTE'), {
      status: 201,
      statusText: 'Created',
    });
    await estabilizar(fixture);
    expect(html.textContent).toContain(TEXTOS.auth.invitacion.pendienteColegiado);
    expect(html.textContent).not.toContain(TEXTOS.auth.invitacion.activa);
  });
});
