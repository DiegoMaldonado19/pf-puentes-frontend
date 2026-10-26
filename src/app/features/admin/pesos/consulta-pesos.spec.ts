import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConsultaPesos } from './consulta-pesos';
import { JuegoPesosDTO } from './modelos';
import { TEXTOS } from '../../../shared/textos';

describe('ConsultaPesos', () => {
  const formulario = '019a0019-0000-7000-8000-000000000001';
  const otroFormulario = '019a0019-0000-7000-8000-000000000002';
  const juego: JuegoPesosDTO = {
    id: '019a0019-0000-7000-8000-000000000011',
    formulario_version_id: formulario,
    acta: 'acta-calibracion.pdf',
    // En Guatemala todavía es 18/10; prueba la conversión y no solo la forma del texto.
    vigente_desde: '2026-10-19T01:00:00Z',
  };
  const nuevo: JuegoPesosDTO = { ...juego, id: '019a0019-0000-7000-8000-000000000012', acta: null };
  const listado = `/api/v1/formularios/${formulario}/juegos-pesos?page=0&size=20`;
  const rutaPesos = (id = juego.id, page = 0) =>
    `/api/v1/juegos-pesos/${id}/pesos?page=${page}&size=20`;
  let fixture: ComponentFixture<ConsultaPesos>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ConsultaPesos],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ConsultaPesos);
    fixture.componentRef.setInput('formularioVersionId', formulario);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function texto(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function boton(nombre: string, indice = 0): HTMLButtonElement {
    const botones = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
    const elegido = botones.filter((b) => b.textContent?.trim() === nombre)[indice];
    expect(elegido).toBeDefined();
    return elegido;
  }

  function juegos(content: JuegoPesosDTO[] = [juego], total = content.length, page = 0) {
    http.expectOne(page === 0 ? listado : listado.replace('page=0', `page=${page}`)).flush({
      content,
      page,
      size: 20,
      total_elements: total,
      total_pages: Math.ceil(total / 20),
    });
    fixture.detectChanges();
  }

  function seleccionar(nombre: string = TEXTOS.pesos.ver, indice = 0) {
    boton(nombre, indice).click();
    fixture.detectChanges();
  }

  it('muestra carga, fecha de Guatemala, acta y calibración sin documentar sin seleccionar automáticamente', () => {
    expect(texto()).toContain(TEXTOS.pesos.cargando);
    juegos([juego, nuevo]);
    expect(texto()).toContain('18/10/2026');
    expect(texto()).toContain(juego.acta);
    expect(texto()).toContain(TEXTOS.pesos.sinActa);
    expect(texto()).toContain(TEXTOS.pesos.seleccionar);
    http.expectNone((req) => req.url.endsWith('/pesos'));
  });

  it('selecciona un juego y muestra sus pesos con encabezados y controles accesibles', () => {
    juegos();
    seleccionar();
    expect(texto()).toContain(TEXTOS.pesos.cargandoPesos);
    http.expectOne(rutaPesos()).flush({
      content: [{ id: 'peso-a', elemento_ref: 'elemento-a', peso: 1.25 }],
      page: 0,
      size: 20,
      total_elements: 1,
      total_pages: 1,
    });
    fixture.detectChanges();
    expect(texto()).toContain('elemento-a');
    expect(texto()).toContain('1.25');
    expect(boton(TEXTOS.pesos.seleccionado).getAttribute('aria-pressed')).toBe('true');
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('caption')).toHaveLength(2);
    expect(host.querySelector('th[scope="row"]')?.textContent).toContain('elemento-a');
    boton(TEXTOS.pesos.seleccionado).focus();
    expect(document.activeElement).toBe(boton(TEXTOS.pesos.seleccionado));
    expect(boton(TEXTOS.pesos.anterior, 1).disabled).toBe(true);
    expect(boton(TEXTOS.pesos.siguiente, 1).disabled).toBe(true);
  });

  it('distingue un formulario sin juegos de un fallo de consulta', () => {
    juegos([]);
    expect(texto()).toContain(TEXTOS.pesos.sinJuegos);
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')).toBeNull();
  });

  it('pagina los juegos en el servidor y permite regresar', () => {
    juegos([juego], 21);
    expect(boton(TEXTOS.pesos.anterior).disabled).toBe(true);
    seleccionar(TEXTOS.pesos.siguiente);
    juegos([nuevo], 21, 1);
    expect(texto()).toContain(TEXTOS.pesos.sinActa);
    expect(texto()).not.toContain(juego.acta);
    expect(boton(TEXTOS.pesos.siguiente).disabled).toBe(true);
    seleccionar(TEXTOS.pesos.anterior);
    juegos([juego], 21);
    expect(texto()).toContain(juego.acta);
  });

  it('pagina los elementos sin volver a consultar los juegos', () => {
    juegos();
    seleccionar();
    http.expectOne(rutaPesos()).flush({
      content: [{ id: 'a', elemento_ref: 'primero', peso: 1 }],
      page: 0,
      size: 20,
      total_elements: 21,
      total_pages: 2,
    });
    fixture.detectChanges();
    seleccionar(TEXTOS.pesos.siguiente, 1);
    http.expectOne(rutaPesos(juego.id, 1)).flush({
      content: [{ id: 'b', elemento_ref: 'ultimo', peso: 2 }],
      page: 1,
      size: 20,
      total_elements: 21,
      total_pages: 2,
    });
    fixture.detectChanges();
    expect(texto()).toContain('ultimo');
    expect(texto()).not.toContain('primero');
    expect(boton(TEXTOS.pesos.siguiente, 1).disabled).toBe(true);
  });

  it('retira los datos anteriores y cancela la petición al cambiar de formulario', () => {
    juegos();
    seleccionar();
    const anterior = http.expectOne(rutaPesos());
    fixture.componentRef.setInput('formularioVersionId', otroFormulario);
    fixture.detectChanges();
    expect(anterior.cancelled).toBe(true);
    expect(texto()).not.toContain(juego.acta);
    http
      .expectOne(`/api/v1/formularios/${otroFormulario}/juegos-pesos?page=0&size=20`)
      .flush({ content: [], page: 0, size: 20, total_elements: 0, total_pages: 0 });
    fixture.detectChanges();
    expect(texto()).toContain(TEXTOS.pesos.sinJuegos);
  });

  it('cancela el detalle anterior al seleccionar otro juego', () => {
    juegos([juego, nuevo]);
    seleccionar();
    const anterior = http.expectOne(rutaPesos());
    seleccionar(TEXTOS.pesos.ver);
    expect(anterior.cancelled).toBe(true);
    http.expectOne(rutaPesos(nuevo.id)).flush({
      content: [],
      page: 0,
      size: 20,
      total_elements: 0,
      total_pages: 0,
    });
    fixture.detectChanges();
    expect(texto()).toContain(TEXTOS.pesos.sinPesos);
  });

  it('reinicia la página de juegos al cambiar la versión del formulario', () => {
    juegos([juego], 21);
    seleccionar(TEXTOS.pesos.siguiente);
    const pendiente = http.expectOne(listado.replace('page=0', 'page=1'));
    fixture.componentRef.setInput('formularioVersionId', otroFormulario);
    fixture.detectChanges();
    expect(pendiente.cancelled).toBe(true);
    http
      .expectOne(`/api/v1/formularios/${otroFormulario}/juegos-pesos?page=0&size=20`)
      .flush({ content: [], page: 0, size: 20, total_elements: 0, total_pages: 0 });
    fixture.detectChanges();
    expect(texto()).toContain(TEXTOS.pesos.sinJuegos);
  });

  it('reinicia la página de elementos al elegir otro juego', () => {
    juegos([juego, nuevo]);
    seleccionar();
    http.expectOne(rutaPesos()).flush({
      content: [{ id: 'a', elemento_ref: 'primero', peso: 1 }],
      page: 0,
      size: 20,
      total_elements: 21,
      total_pages: 2,
    });
    fixture.detectChanges();
    seleccionar(TEXTOS.pesos.siguiente, 1);
    const pendiente = http.expectOne(rutaPesos(juego.id, 1));
    seleccionar(TEXTOS.pesos.ver);
    expect(pendiente.cancelled).toBe(true);
    http.expectOne(rutaPesos(nuevo.id)).flush({
      content: [],
      page: 0,
      size: 20,
      total_elements: 0,
      total_pages: 0,
    });
    fixture.detectChanges();
    expect(texto()).toContain(TEXTOS.pesos.sinPesos);
  });

  it.each([
    [401, TEXTOS.pesos.sinSesion],
    [403, TEXTOS.pesos.sinPermiso],
    [404, TEXTOS.pesos.noEncontrado],
    [500, TEXTOS.pesos.error],
  ])('muestra el error %s en español sin convertirlo en listado vacío', (status, mensaje) => {
    http.expectOne(listado).flush(
      { detail: 'Detalle interno no destinado a la vista' },
      {
        status: Number(status),
        statusText: 'Error',
      },
    );
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent,
    ).toContain(mensaje);
    expect(texto()).not.toContain(TEXTOS.pesos.sinJuegos);
    expect(texto()).not.toContain('Detalle interno');
  });

  it('permite reintentar una consulta después de recuperar la conexión', () => {
    http.expectOne(listado).error(new ProgressEvent('error'));
    fixture.detectChanges();
    expect(texto()).toContain(TEXTOS.pesos.sinConexion);
    seleccionar(TEXTOS.pesos.reintentar);
    juegos();
    expect(texto()).not.toContain(TEXTOS.pesos.sinConexion);
    expect(texto()).toContain(juego.acta);
  });

  it('permite reintentar los pesos sin perder la selección', () => {
    juegos();
    seleccionar();
    http.expectOne(rutaPesos()).flush({}, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(texto()).toContain(TEXTOS.pesos.error);
    seleccionar(TEXTOS.pesos.reintentar);
    http.expectOne(rutaPesos()).flush({
      content: [{ id: 'a', elemento_ref: 'recuperado', peso: 3 }],
      page: 0,
      size: 20,
      total_elements: 1,
      total_pages: 1,
    });
    fixture.detectChanges();
    expect(texto()).toContain('recuperado');
  });

  it.each([401, 403])(
    'retira también los metadatos privados si el detalle responde %s',
    (status) => {
      juegos();
      seleccionar();
      http.expectOne(rutaPesos()).flush({}, { status, statusText: 'Error' });
      fixture.detectChanges();
      expect(texto()).not.toContain(juego.acta);
      expect(texto()).toContain(status === 401 ? TEXTOS.pesos.sinSesion : TEXTOS.pesos.sinPermiso);
    },
  );

  it('cancela la consulta pendiente al destruir la vista', () => {
    const pendiente = http.expectOne(listado);
    fixture.destroy();
    expect(pendiente.cancelled).toBe(true);
  });
});
