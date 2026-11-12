import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TEXTOS } from '../../shared/textos';
import {
  campoDeReferencia,
  CicloRevision,
  ObservacionCorreccion,
  PanelCorrecciones,
  ultimoCicloConCorrecciones,
} from './panel-correcciones';

const t = TEXTOS.correcciones;

function observacion(id: string, resuelta: string | null = null): ObservacionCorreccion {
  return {
    id,
    elemento_ref: 'subestructura.estribo_entrada',
    texto: `Revisar ${id}`,
    resuelta_en: resuelta,
  };
}

function ciclo(
  id: string,
  veredicto: string,
  emitida: string,
  obs: ObservacionCorreccion[] = [],
): CicloRevision {
  return {
    id,
    veredicto,
    observacion: 'Corrija lo marcado',
    emitida_en: emitida,
    creado_en: emitida,
    observaciones: obs,
  };
}

describe('ultimoCicloConCorrecciones', () => {
  it('elige el ciclo más reciente que pidió cambios y no los de aprobación', () => {
    const ciclos = [
      ciclo('a', 'CAMBIOS_SOLICITADOS', '2026-10-01T10:00:00Z'),
      ciclo('b', 'APROBADA', '2026-10-05T10:00:00Z'),
      ciclo('c', 'CAMBIOS_SOLICITADOS', '2026-10-03T10:00:00Z'),
    ];

    expect(ultimoCicloConCorrecciones(ciclos)?.id).toBe('c');
    expect(ultimoCicloConCorrecciones([ciclo('b', 'APROBADA', '2026-10-05T10:00:00Z')])).toBeNull();
  });

  it('muestra solo el último segmento del campo', () => {
    expect(campoDeReferencia('subestructura.estribo_entrada')).toBe('estribo_entrada');
    expect(campoDeReferencia(null)).toBe('');
  });
});

describe('PanelCorrecciones', () => {
  let fixture: ComponentFixture<PanelCorrecciones>;
  let http: HttpTestingController;

  function crear(): void {
    fixture = TestBed.createComponent(PanelCorrecciones);
    fixture.componentRef.setInput('inspeccionId', 'insp-1');
    fixture.componentRef.setInput('editable', true);
    fixture.detectChanges();
    http
      .expectOne((r) => r.url === '/api/v1/inspecciones/insp-1/revisiones')
      .flush({
        content: [
          ciclo('c1', 'CAMBIOS_SOLICITADOS', '2026-10-03T10:00:00Z', [
            observacion('o1'),
            observacion('o2', '2026-10-04T00:00:00Z'),
          ]),
        ],
        number: 0,
        size: 50,
        total_elements: 1,
        total_pages: 1,
      });
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PanelCorrecciones],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lista las observaciones con su cuenta de pendientes', () => {
    crear();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain(t.titulo);
    expect(texto).toContain('Revisar o1');
    expect(texto).toContain('1 ' + t.pendientes);
    expect(texto).toContain(t.resuelta);
  });

  it('marca una observación como resuelta y actualiza su estado', () => {
    crear();

    fixture.componentInstance['marcarResuelta'](observacion('o1'));
    http
      .expectOne('/api/v1/observaciones/o1/resolucion')
      .flush(observacion('o1', '2026-11-11T12:00:00Z'));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(t.todasResueltas);
  });

  it('informa cuando el servidor ya no permite cambios (409)', () => {
    crear();

    fixture.componentInstance['marcarResuelta'](observacion('o1'));
    http
      .expectOne('/api/v1/observaciones/o1/resolucion')
      .flush({}, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      t.noEditable,
    );
  });

  it('no aparece si la inspección no tiene correcciones pendientes de ningún ciclo', () => {
    fixture = TestBed.createComponent(PanelCorrecciones);
    fixture.componentRef.setInput('inspeccionId', 'insp-2');
    fixture.detectChanges();
    http
      .expectOne((r) => r.url === '/api/v1/inspecciones/insp-2/revisiones')
      .flush({
        content: [ciclo('a', 'APROBADA', '2026-10-01T10:00:00Z')],
        number: 0,
        size: 50,
        total_elements: 1,
        total_pages: 1,
      });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('section')).toBeNull();
  });
});
