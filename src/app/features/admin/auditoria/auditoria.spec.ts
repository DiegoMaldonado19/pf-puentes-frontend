import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/auth/auth';
import { TEXTOS } from '../../../shared/textos';
import { escribir, estabilizar, proveedoresAuth, sesion } from '../../auth/datos-prueba';
import { eventoAuditoria, paginaAdmin } from '../datos-prueba';
import { Auditoria } from './auditoria';

describe('Auditoria', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [Auditoria],
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

  it('muestra usuario_id, valores colapsables y no permite editar', async () => {
    const fixture = TestBed.createComponent(Auditoria);
    await estabilizar(fixture);
    http
      .expectOne((req) => req.url === '/api/v1/auditoria')
      .flush(paginaAdmin([eventoAuditoria()]));
    await estabilizar(fixture);
    const html = fixture.nativeElement as HTMLElement;
    expect(html.textContent).toContain('u1');
    expect(html.querySelector('details')).not.toBeNull();
    expect(html.textContent).not.toContain('Editar');
    expect(html.textContent).not.toContain('Borrar');
  });

  it('no consulta si el rango de fechas es inválido', async () => {
    const fixture = TestBed.createComponent(Auditoria);
    await estabilizar(fixture);
    http.expectOne((req) => req.url === '/api/v1/auditoria').flush(paginaAdmin([]));
    await estabilizar(fixture);
    const html = fixture.nativeElement as HTMLElement;
    escribir(html, 'desde', '2026-02-01');
    escribir(html, 'hasta', '2026-01-01');
    await estabilizar(fixture);
    html.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    await estabilizar(fixture);
    http.expectNone((req) => req.url === '/api/v1/auditoria' && req.params.has('desde'));
    expect(html.querySelector('[role="alert"]')?.textContent).toContain(
      TEXTOS.auth.errores['rango-invalido'],
    );
  });
});
