import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { AsignacionP7DTO, AsignacionesP7 } from './asignaciones-p7';

const asignacion = (id = 'a1', curso_id = 'c1'): AsignacionP7DTO => ({
  id,
  inscripcion_id: `inscripcion-${curso_id}`,
  curso_id,
  estudiante_id: 'ana',
  puente_id: 'p1',
  curso_nombre: curso_id,
  puente_codigo: 'GT-01',
  puente_nombre: 'Puente',
  creado_en: '2026-10-05T12:00:00Z',
});

describe('consumidor P7', () => {
  let servicio: AsignacionesP7;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(AsignacionesP7);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('recorre páginas desde cero sin emitir parciales ni perder dos cursos del mismo puente', () => {
    const emitidos: AsignacionP7DTO[][] = [];
    servicio.consultar().subscribe((valor) => emitidos.push(valor));
    const primera = http.expectOne('/api/v1/mis-asignaciones?page=0&size=20');
    expect(primera.request.method).toBe('GET');
    primera.flush({
      content: [asignacion()],
      number: 0,
      size: 20,
      total_elements: 2,
      total_pages: 2,
    });
    expect(emitidos).toEqual([]);
    http.expectOne('/api/v1/mis-asignaciones?page=1&size=20').flush({
      content: [asignacion('a2', 'c2')],
      number: 1,
      size: 20,
      total_elements: 2,
      total_pages: 2,
    });
    expect(emitidos).toEqual([[asignacion(), asignacion('a2', 'c2')]]);
  });

  it('acepta lista vacía con una sola petición', async () => {
    const resultado = firstValueFrom(servicio.consultar());
    http.expectOne('/api/v1/mis-asignaciones?page=0&size=20').flush({
      content: [],
      number: 0,
      size: 20,
      total_elements: 0,
      total_pages: 0,
    });
    expect(await resultado).toEqual([]);
  });

  it.each([500, 401, 403])('propaga %s intermedio sin publicar una lista parcial', (status) => {
    const siguiente = vi.fn();
    const error = vi.fn();
    servicio.consultar().subscribe({ next: siguiente, error });
    http.expectOne('/api/v1/mis-asignaciones?page=0&size=20').flush({
      content: [asignacion()],
      number: 0,
      size: 20,
      total_elements: 2,
      total_pages: 2,
    });
    http.expectOne('/api/v1/mis-asignaciones?page=1&size=20').flush(null, {
      status,
      statusText: 'Error',
    });
    expect(siguiente).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ status }));
  });
});
