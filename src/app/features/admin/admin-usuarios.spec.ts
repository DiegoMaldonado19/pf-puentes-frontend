import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { AdminUsuariosService } from './admin-usuarios';
import { invitacionAdmin, paginaAdmin, usuarioAdmin } from './datos-prueba';

describe('AdminUsuariosService', () => {
  let admin: AdminUsuariosService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    admin = TestBed.inject(AdminUsuariosService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    try {
      http.verify();
    } finally {
      TestBed.resetTestingModule();
    }
  });

  it('lista invitaciones y crea sin ESTUDIANTE en el contrato de alta', async () => {
    const lista = firstValueFrom(admin.listarInvitaciones({ page: 0 }));
    const get = http.expectOne((req) => req.url === '/api/v1/invitaciones');
    expect(get.request.params.get('page')).toBe('0');
    expect(get.request.params.get('size')).toBe('20');
    get.flush(paginaAdmin([invitacionAdmin()]));
    expect((await lista).content.length).toBe(1);

    const alta = firstValueFrom(admin.crearInvitacion('Prof@Correo.com', 'CATEDRATICO'));
    const post = http.expectOne('/api/v1/invitaciones');
    expect(post.request.body).toEqual({ correo: 'prof@correo.com', rol: 'CATEDRATICO' });
    expect(post.request.body.rol).not.toBe('ESTUDIANTE');
    post.flush(invitacionAdmin(), { status: 201, statusText: 'Created' });
    await alta;
  });

  it('da de baja y reactiva con POST, nunca DELETE', async () => {
    const baja = firstValueFrom(admin.darDeBaja('u2', 'Ya no pertenece al curso'));
    const postBaja = http.expectOne('/api/v1/usuarios/u2/baja');
    expect(postBaja.request.method).toBe('POST');
    postBaja.flush({ motivo: 'Ya no pertenece al curso' });
    await baja;

    const alta = firstValueFrom(admin.reactivar('u2'));
    const postAlta = http.expectOne('/api/v1/usuarios/u2/reactivacion');
    expect(postAlta.request.method).toBe('POST');
    postAlta.flush(null, { status: 200, statusText: 'OK' });
    await alta;

    http.expectNone((req) => req.method === 'DELETE');
  });

  it('consulta un usuario y la bitácora', async () => {
    const ficha = firstValueFrom(admin.detalleUsuario('u2'));
    http.expectOne('/api/v1/usuarios/u2').flush(usuarioAdmin());
    expect((await ficha).id).toBe('u2');

    const bitacora = firstValueFrom(admin.listarAuditoria({ accion: 'INVITAR' }));
    const get = http.expectOne((req) => req.url === '/api/v1/auditoria');
    expect(get.request.params.get('accion')).toBe('INVITAR');
    get.flush(paginaAdmin([]));
    await bitacora;
  });
});
