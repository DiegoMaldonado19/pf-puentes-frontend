import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TEXTOS } from '../../../shared/textos';
import { ComparacionRecalculoIcDTO, JuegoPesosDTO, RecalculoIcDTO } from './modelos';
import { RecalculoIc } from './recalculo-ic';

describe('RecalculoIc', () => {
  const inspeccionId = '019a0040-0000-7000-8000-000000000021';
  const formularioId = '019a0018-0000-7000-8000-000000000001';
  const juegoOriginalId = '019a0040-0000-7000-8000-000000000011';
  const juegoNuevoId = '019a0040-0000-7000-8000-000000000015';

  const juegosDisponibles: readonly JuegoPesosDTO[] = [
    {
      id: juegoNuevoId,
      formulario_version_id: formularioId,
      acta: 'Acta calibrada v2',
      vigente_desde: '2026-10-20T12:00:00Z',
    },
  ];

  const recalculoMock: RecalculoIcDTO = {
    id: '019a0040-0000-7000-8000-000000000050',
    inspeccion_id: inspeccionId,
    version_pesos_id: juegoNuevoId,
    formulario_version_id: formularioId,
    acta: 'Acta calibrada v2',
    vigente_desde: '2026-10-20T12:00:00Z',
    indice_condicion: 66.67,
    estado_calculado: 'REGULAR',
    anulacion: null,
    creado_en: '2026-10-25T18:00:00Z',
  };

  const comparacionBase: ComparacionRecalculoIcDTO = {
    original: {
      inspeccion_id: inspeccionId,
      puente_id: '019a0040-0000-7000-8000-000000000001',
      formulario_version_id: formularioId,
      version_pesos_id: juegoOriginalId,
      acta: 'Acta inicial',
      vigente_desde: '2026-10-01T12:00:00Z',
      indice_condicion: 80.0,
      estado_calculado: 'BUENO',
      anulacion: null,
      estado_confirmado: 'BUENO',
      justificacion_estado: null,
      publicada_en: '2026-10-02T15:00:00Z',
    },
    recalculos: {
      content: [recalculoMock],
      page: 0,
      size: 20,
      total_elements: 1,
      total_pages: 1,
    },
  };

  let fixture: ComponentFixture<RecalculoIc>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecalculoIc],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(RecalculoIc);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('muestra el resultado publicado original inmutable y la tabla de recálculos fechados', () => {
    fixture.componentRef.setInput('inspeccionId', inspeccionId);
    fixture.detectChanges();

    const peticion = http.expectOne(
      `/api/v1/inspecciones/${inspeccionId}/recalculos-ic?page=0&size=20`,
    );
    peticion.flush(comparacionBase);
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain(TEXTOS.pesos.recalculo.original);
    expect(texto).toContain('Acta inicial');
    expect(texto).toContain('80.00');
    expect(texto).toContain('Acta calibrada v2');
    expect(texto).toContain('66.67');
    expect(texto).toContain('-13.33');
  });

  it('solicita un recálculo cuando tiene permiso, emite el resultado y recarga la comparación', () => {
    fixture.componentRef.setInput('inspeccionId', inspeccionId);
    fixture.componentRef.setInput('puedeRecalcular', true);
    fixture.componentRef.setInput('juegosDisponibles', juegosDisponibles);
    const emitidos: RecalculoIcDTO[] = [];
    fixture.componentInstance.recalculado.subscribe((item) => emitidos.push(item));
    fixture.detectChanges();

    http
      .expectOne(`/api/v1/inspecciones/${inspeccionId}/recalculos-ic?page=0&size=20`)
      .flush({ ...comparacionBase, recalculos: { ...comparacionBase.recalculos, content: [] } });
    fixture.detectChanges();

    const selector = fixture.nativeElement.querySelector(
      '#selector-juego-recalculo',
    ) as HTMLSelectElement;
    selector.value = juegoNuevoId;
    selector.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const formulario = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    formulario.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(fixture.componentInstance.operacionPendiente()).toBe(true);

    const post = http.expectOne(`/api/v1/inspecciones/${inspeccionId}/recalculos-ic`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ version_pesos_id: juegoNuevoId });
    post.flush(recalculoMock);
    fixture.detectChanges();

    const recarga = http.expectOne(
      `/api/v1/inspecciones/${inspeccionId}/recalculos-ic?page=0&size=20`,
    );
    recarga.flush(comparacionBase);
    fixture.detectChanges();

    expect(fixture.componentInstance.operacionPendiente()).toBe(false);
    expect(emitidos).toEqual([recalculoMock]);
    expect(fixture.nativeElement.textContent).toContain(TEXTOS.pesos.recalculo.confirmado);
  });

  it.each([
    [401, TEXTOS.pesos.sinSesion],
    [403, TEXTOS.pesos.sinPermiso],
    [404, TEXTOS.pesos.recalculo.noEncontrada],
    [409, TEXTOS.pesos.recalculo.noPublicada],
  ])('muestra el mensaje correspondiente cuando la consulta responde %s', (status, mensaje) => {
    fixture.componentRef.setInput('inspeccionId', inspeccionId);
    fixture.detectChanges();

    http
      .expectOne(`/api/v1/inspecciones/${inspeccionId}/recalculos-ic?page=0&size=20`)
      .flush({ detail: 'Error' }, { status, statusText: 'Error' });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(mensaje);
  });

  it('retira los datos privados si el POST recibe 401 o 403 y traduce errores 409 y 422', () => {
    fixture.componentRef.setInput('inspeccionId', inspeccionId);
    fixture.componentRef.setInput('puedeRecalcular', true);
    fixture.componentRef.setInput('juegosDisponibles', juegosDisponibles);
    fixture.detectChanges();

    http
      .expectOne(`/api/v1/inspecciones/${inspeccionId}/recalculos-ic?page=0&size=20`)
      .flush(comparacionBase);
    fixture.detectChanges();

    const selector = fixture.nativeElement.querySelector(
      '#selector-juego-recalculo',
    ) as HTMLSelectElement;
    selector.value = juegoNuevoId;
    selector.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const formulario = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    formulario.dispatchEvent(new Event('submit'));
    http
      .expectOne(`/api/v1/inspecciones/${inspeccionId}/recalculos-ic`)
      .flush({ detail: 'Incompatible' }, { status: 422, statusText: 'Unprocessable' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(TEXTOS.pesos.recalculo.incompatible);

    formulario.dispatchEvent(new Event('submit'));
    http
      .expectOne(`/api/v1/inspecciones/${inspeccionId}/recalculos-ic`)
      .flush({ detail: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(TEXTOS.pesos.sinPermiso);
    expect(fixture.nativeElement.textContent).not.toContain('Acta inicial');
  });

  it('muestra anulaciones críticas, variaciones positivas y permite paginar y actualizar', () => {
    fixture.componentRef.setInput('inspeccionId', inspeccionId);
    fixture.componentRef.setInput('puedeRecalcular', true);
    fixture.componentRef.setInput('juegosDisponibles', juegosDisponibles);
    fixture.detectChanges();

    http.expectOne(`/api/v1/inspecciones/${inspeccionId}/recalculos-ic?page=0&size=20`).flush({
      original: {
        ...comparacionBase.original,
        indice_condicion: 60.0,
        anulacion: 'SOCAVACION',
      },
      recalculos: {
        content: [
          {
            ...recalculoMock,
            indice_condicion: 75.5,
            estado_calculado: 'MALO',
            anulacion: 'SOCAVACION',
          },
        ],
        page: 0,
        size: 1,
        total_elements: 2,
        total_pages: 2,
      },
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      TEXTOS.pesos.recalculo.anulaciones.SOCAVACION,
    );
    expect(fixture.nativeElement.textContent).toContain('+15.50');

    // No envía POST si no se ha elegido juego de pesos
    const formulario = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    formulario.dispatchEvent(new Event('submit'));
    http.expectNone(`/api/v1/inspecciones/${inspeccionId}/recalculos-ic`);

    // Paginar a la siguiente página
    const botonesNav = fixture.nativeElement.querySelectorAll('nav button');
    (botonesNav[1] as HTMLButtonElement).click();
    fixture.detectChanges();

    http
      .expectOne(`/api/v1/inspecciones/${inspeccionId}/recalculos-ic?page=1&size=20`)
      .flush({ ...comparacionBase, recalculos: { ...comparacionBase.recalculos, page: 1 } });
    fixture.detectChanges();

    // Botón actualizar
    const botonActualizar = fixture.nativeElement.querySelector(
      'header button',
    ) as HTMLButtonElement;
    botonActualizar.click();
    fixture.detectChanges();

    http
      .expectOne(`/api/v1/inspecciones/${inspeccionId}/recalculos-ic?page=1&size=20`)
      .flush(comparacionBase);
    fixture.detectChanges();
  });
});
