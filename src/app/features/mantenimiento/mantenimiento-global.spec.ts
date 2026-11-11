import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TEXTOS } from '../../shared/textos';
import { MantenimientoGlobal, OrdenGlobal, PaginaOrdenesGlobal } from './mantenimiento-global';

const t = TEXTOS.mantenimientoGlobal;

function orden(id: string, descripcion: string): OrdenGlobal {
  return {
    id,
    puente_id: 'p1',
    puente_codigo: 'GT-01-02-0003',
    puente_nombre: 'Puente Río Dulce',
    tipo: 'CORRECTIVO',
    estado: 'PROGRAMADA',
    prioridad: 'ALTA',
    descripcion,
    fecha_programada: '2026-12-01',
    creado_en: '2026-11-10T12:00:00Z',
  };
}

function pagina(contenido: OrdenGlobal[], total = contenido.length): PaginaOrdenesGlobal {
  return {
    content: contenido,
    page: 0,
    size: 20,
    total_elements: total,
    total_pages: total > 0 ? Math.ceil(total / 20) : 0,
  };
}

describe('MantenimientoGlobal', () => {
  let fixture: ComponentFixture<MantenimientoGlobal>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MantenimientoGlobal],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MantenimientoGlobal);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('pide la primera página sin filtros y muestra las órdenes con su puente', () => {
    const peticion = http.expectOne((r) => r.url === '/api/v1/ordenes-mantenimiento');
    expect(peticion.request.params.get('page')).toBe('0');
    expect(peticion.request.params.get('size')).toBe('20');
    expect(peticion.request.params.has('estado')).toBe(false);
    peticion.flush(pagina([orden('o1', 'Reparar junta de dilatación')]));
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Reparar junta de dilatación');
    expect(texto).toContain('GT-01-02-0003');
    expect(fixture.nativeElement.querySelector('table')?.classList).toContain(
      'hvc-tabla-responsiva',
    );
  });

  it('aplica el estado, el tipo, la prioridad y el texto como parámetros de la consulta', () => {
    http.expectOne((r) => r.url === '/api/v1/ordenes-mantenimiento').flush(pagina([]));
    fixture.componentInstance['cambiarEstado']('EN_EJECUCION');
    fixture.componentInstance['cambiarTipo']('EMERGENCIA');
    fixture.componentInstance['cambiarPrioridad']('ALTA');
    fixture.componentInstance['cambiarTexto'](' junta ');
    fixture.componentInstance['aplicar']();

    const peticion = http.expectOne((r) => r.url === '/api/v1/ordenes-mantenimiento');
    expect(peticion.request.params.get('estado')).toBe('EN_EJECUCION');
    expect(peticion.request.params.get('tipo')).toBe('EMERGENCIA');
    expect(peticion.request.params.get('prioridad')).toBe('ALTA');
    expect(peticion.request.params.get('q')).toBe('junta');
    peticion.flush(pagina([]));
  });

  it('indica que no hay órdenes cuando el filtro no coincide con ninguna', () => {
    http.expectOne((r) => r.url === '/api/v1/ordenes-mantenimiento').flush(pagina([]));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.hvc-empty')?.textContent).toContain(t.vacio);
  });

  it('muestra un aviso accesible si la consulta falla', () => {
    http
      .expectOne((r) => r.url === '/api/v1/ordenes-mantenimiento')
      .flush({}, { status: 500, statusText: 'Error' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(t.error);
  });

  it('pasa a la página siguiente conservando los filtros', () => {
    http
      .expectOne((r) => r.url === '/api/v1/ordenes-mantenimiento')
      .flush(pagina([orden('o1', 'Primera')], 45));
    fixture.detectChanges();
    fixture.componentInstance['irA'](1);

    const peticion = http.expectOne((r) => r.url === '/api/v1/ordenes-mantenimiento');
    expect(peticion.request.params.get('page')).toBe('1');
    peticion.flush(pagina([orden('o2', 'Segunda')], 45));
  });
});
