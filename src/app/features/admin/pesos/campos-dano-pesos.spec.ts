import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/auth/auth';
import { Rol } from '../../../core/auth/modelos';
import { TEXTOS } from '../../../shared/textos';
import { estabilizar } from '../../puentes/datos-prueba';
import { CamposDanoPesos } from './campos-dano-pesos';

describe('Campos reales P4 para preparar pesos', () => {
  const versiones = '/api/v1/formularios?page=0&size=20';
  const a = { id: 'version-a', codigo: 'VERSION-A', estado: 'ACTIVA' };
  const b = { id: 'version-b', codigo: 'VERSION-B', estado: 'RETIRADA' };
  const t = TEXTOS.pesos;
  let fixture: ComponentFixture<CamposDanoPesos>;
  let http: HttpTestingController;
  let auth: AuthService;
  const html = () => fixture.nativeElement as HTMLElement;
  const ruta = (id = a.id, page = 0) =>
    `/api/v1/formularios/${id}/elementos-dano?page=${page}&size=20`;
  const pagina = (contenido = [a, b], pagina = 0, total = contenido.length) => ({
    contenido,
    pagina,
    tamano: 20,
    total_elementos: total,
    total_paginas: Math.ceil(total / 20),
  });
  const campos = (content: string[], page = 0, total = content.length) => ({
    content,
    page,
    size: 20,
    total_elements: total,
    total_pages: Math.ceil(total / 20),
  });
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CamposDanoPesos],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });
  afterEach(() => {
    try {
      http.verify();
    } finally {
      TestBed.resetTestingModule();
    }
  });
  async function crear(rol: Rol | null = 'ADMINISTRADOR') {
    if (rol) {
      const login = firstValueFrom(auth.iniciarSesion('admin@prueba.com', 'SoloPrueba2026'));
      http.expectOne('/api/v1/auth/login').flush({
        access_token: 'prueba',
        token_type: 'Bearer',
        expires_in: 900,
        usuario: { id: 'usuario-prueba', nombre: 'Prueba', rol },
      });
      await login;
    }
    fixture = TestBed.createComponent(CamposDanoPesos);
    await estabilizar(fixture);
  }
  async function elegir(id = a.id) {
    const select = html().querySelector('select')!;
    select.value = id;
    select.dispatchEvent(new Event('change'));
    await estabilizar(fixture);
  }
  function boton(texto: string, region?: string) {
    const contenedor = region ? html().querySelector(`[aria-label="${region}"]`)! : html();
    return Array.from(contenedor.querySelectorAll('button')).find(
      (v) => v.textContent?.trim() === texto,
    )!;
  }
  it('consulta versiones sin pesos y muestra referencias de servidor sin escribir', async () => {
    await crear();
    http.expectOne(versiones).flush(pagina());
    await estabilizar(fixture);
    expect(html().textContent).toContain(a.codigo);
    http.expectNone(ruta());
    await elegir();
    http.expectOne(ruta()).flush(campos(['subestructura.estribo_entrada.socavacion']));
    await estabilizar(fixture);
    expect(html().textContent).toContain('subestructura.estribo_entrada.socavacion');
    expect(html().textContent).toContain(t.campos.aclaracion);
    http.expectNone((r) => r.method !== 'GET');
  });
  it('cancela campos anteriores al cambiar de versión y permite históricos', async () => {
    await crear();
    http.expectOne(versiones).flush(pagina());
    await estabilizar(fixture);
    await elegir();
    const anterior = http.expectOne(ruta());
    await elegir(b.id);
    expect(anterior.cancelled).toBe(true);
    http.expectOne(ruta(b.id)).flush(campos(['historico']));
    await estabilizar(fixture);
    expect(html().textContent).toContain('historico');
  });
  it('cancela lecturas al paginar versiones y retira selección', async () => {
    await crear();
    http.expectOne(versiones).flush(pagina([a], 0, 21));
    await estabilizar(fixture);
    await elegir();
    const anterior = http.expectOne(ruta());
    boton(t.siguiente, t.campos.paginasVersiones).click();
    await estabilizar(fixture);
    expect(anterior.cancelled).toBe(true);
    http.expectOne(versiones.replace('page=0', 'page=1')).flush(pagina([b], 1, 21));
    await estabilizar(fixture);
    expect(html().querySelector('select')!.value).toBe('');
    expect(html().textContent).not.toContain(a.codigo);
  });
  it('pagina campos y conserva la versión elegida', async () => {
    await crear();
    http.expectOne(versiones).flush(pagina());
    await estabilizar(fixture);
    await elegir();
    http.expectOne(ruta()).flush(campos(['primero'], 0, 21));
    await estabilizar(fixture);
    boton(t.siguiente, t.campos.paginasCampos).click();
    await estabilizar(fixture);
    http.expectOne(ruta(a.id, 1)).flush(campos(['ultimo'], 1, 21));
    await estabilizar(fixture);
    expect(html().textContent).toContain('ultimo');
    expect(html().textContent).not.toContain('primero');
    expect(html().querySelector('select')!.value).toBe(a.id);
  });
  it('muestra metadatos incompatibles y permite reintentar sin escribir', async () => {
    await crear();
    http.expectOne(versiones).flush(pagina());
    await estabilizar(fixture);
    await elegir();
    http.expectOne(ruta()).flush({}, { status: 422, statusText: 'Unprocessable Content' });
    await estabilizar(fixture);
    expect(html().textContent).toContain(t.campos.incompatible);
    boton(t.reintentar).click();
    await estabilizar(fixture);
    http.expectOne(ruta()).flush(campos([]));
    await estabilizar(fixture);
    expect(html().textContent).toContain(t.campos.vacia);
  });
  it('distingue catálogo vacío y permite reintentar el catálogo fallido', async () => {
    await crear();
    http.expectOne(versiones).flush({}, { status: 503, statusText: 'Unavailable' });
    await estabilizar(fixture);
    expect(html().textContent).toContain(t.error);
    boton(t.reintentar).click();
    await estabilizar(fixture);
    http.expectOne(versiones).flush(pagina([]));
    await estabilizar(fixture);
    expect(html().textContent).toContain(t.campos.sinVersiones);
  });
  it.each([
    [401, t.sinSesion],
    [403, t.sinPermiso],
    [0, t.sinConexion],
  ] as const)('explica error HTTP %s sin mostrar campos anteriores', async (status, mensaje) => {
    await crear();
    http.expectOne(versiones).flush(pagina());
    await estabilizar(fixture);
    await elegir();
    http.expectOne(ruta()).flush({}, { status, statusText: 'Error' });
    await estabilizar(fixture);
    expect(html().textContent).toContain(mensaje);
    expect(html().querySelector('ul')).toBeNull();
    if (status === 401 || status === 403) expect(html().querySelector('select')).toBeNull();
  });
  it('retira datos y cancela petición pendiente al perder la sesión', async () => {
    await crear();
    http.expectOne(versiones).flush(pagina());
    await estabilizar(fixture);
    await elegir();
    const pendiente = http.expectOne(ruta());
    auth.cerrarSesionLocal();
    await estabilizar(fixture);
    expect(pendiente.cancelled).toBe(true);
    expect(html().querySelector('select')).toBeNull();
    expect(html().textContent).toContain(t.sinPermiso);
  });
  it.each<Rol | null>([null, 'CATEDRATICO', 'ESTUDIANTE', 'PROFESIONAL_EXTERNO'])(
    'no consulta datos para rol %s',
    async (rol) => {
      await crear(rol);
      http.expectNone(versiones);
      expect(html().textContent).toContain(t.sinPermiso);
    },
  );
});
