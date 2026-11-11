import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TEXTOS } from '../../shared/textos';
import { FormularioOrden } from './formulario-orden';
import { OrdenMantenimientoDTO } from './modelos';

const t = TEXTOS.formularioOrden;

function orden(): OrdenMantenimientoDTO {
  return {
    id: 'o1',
    puente_id: 'p1',
    tipo: 'CORRECTIVO',
    estado: 'PROGRAMADA',
    prioridad: 'ALTA',
    descripcion: 'Reparar junta',
  } as OrdenMantenimientoDTO;
}

describe('FormularioOrden', () => {
  let fixture: ComponentFixture<FormularioOrden>;
  let http: HttpTestingController;

  function crear(entrada?: OrdenMantenimientoDTO): void {
    fixture = TestBed.createComponent(FormularioOrden);
    fixture.componentRef.setInput('puenteId', 'p1');
    fixture.componentRef.setInput('orden', entrada ?? null);
    fixture.detectChanges();
  }

  function enviar(): void {
    (fixture.nativeElement as HTMLElement)
      .querySelector('form')
      ?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  function escribirDescripcion(valor: string): void {
    const area = (fixture.nativeElement as HTMLElement).querySelector(
      '#orden-descripcion',
    ) as HTMLTextAreaElement;
    area.value = valor;
    area.dispatchEvent(new Event('input'));
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FormularioOrden],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('alta: crea la orden como propuesta con tipo, prioridad y descripción', () => {
    crear();
    escribirDescripcion('  Sustituir apoyo de neopreno  ');
    fixture.componentRef.setInput('orden', null);
    enviar();

    const peticion = http.expectOne('/api/v1/puentes/p1/ordenes-mantenimiento');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({
      tipo: 'CORRECTIVO',
      descripcion: 'Sustituir apoyo de neopreno',
      elemento_ref: null,
      prioridad: 'MEDIA',
    });
    peticion.flush(orden());
  });

  it('no envía nada sin descripción y muestra el error junto al campo', () => {
    crear();
    enviar();

    http.expectNone('/api/v1/puentes/p1/ordenes-mantenimiento');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(t.errorDescripcion);
  });

  it('no envía una descripción formada solo por espacios', () => {
    crear();
    escribirDescripcion('    ');
    enviar();

    http.expectNone('/api/v1/puentes/p1/ordenes-mantenimiento');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(t.errorDescripcion);
  });

  it('edición: envía solo el tipo y la descripción, con PATCH a la orden', () => {
    crear(orden());
    escribirDescripcion('Reparar junta de dilatación');
    enviar();

    const peticion = http.expectOne('/api/v1/puentes/p1/ordenes-mantenimiento/o1');
    expect(peticion.request.method).toBe('PATCH');
    expect(peticion.request.body).toEqual({
      tipo: 'CORRECTIVO',
      descripcion: 'Reparar junta de dilatación',
    });
    peticion.flush(orden());
  });

  it('informa de un fallo del servidor sin perder lo escrito', () => {
    crear();
    escribirDescripcion('Limpiar cauce');
    enviar();

    http
      .expectOne('/api/v1/puentes/p1/ordenes-mantenimiento')
      .flush({}, { status: 422, statusText: 'Unprocessable' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      t.errorGuardar,
    );
    expect(
      (fixture.nativeElement.querySelector('#orden-descripcion') as HTMLTextAreaElement).value,
    ).toBe('Limpiar cauce');
  });
});
