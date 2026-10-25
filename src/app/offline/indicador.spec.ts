import { TestBed } from '@angular/core/testing';
import { Operacion } from './modelos';
import { IndicadorOffline } from './indicador';

function operacion(
  id: string,
  inspeccion_id: string,
  tipo: Operacion['tipo'],
  entidad_id = id,
  estado: Operacion['estado'] = 'pendiente',
): Operacion {
  return {
    id,
    propietario_id: 'propietario',
    modelo_version: 1,
    inspeccion_id,
    entidad_id,
    tipo,
    version_local: 1,
    payload: null,
    clave: id,
    dependencias: [],
    estado,
    intentos: 0,
    proximo_intento: 0,
    ultimo_intento: null,
    error: null,
    ejecucion: null,
    resultado: null,
  };
}

describe('IndicadorOffline', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('expone en texto accesible entidades pendientes distintas, sin contar confirmadas', async () => {
    await TestBed.configureTestingModule({ imports: [IndicadorOffline] }).compileComponents();
    const fixture = TestBed.createComponent(IndicadorOffline);
    fixture.componentRef.setInput('operaciones', [
      operacion('datos-1', 'inspeccion-a', 'datos'),
      operacion('datos-2', 'inspeccion-a', 'datos'),
      operacion('foto-1', 'inspeccion-a', 'foto', 'archivo-a'),
      operacion('doc-1', 'inspeccion-a', 'documento', 'archivo-a'),
      operacion('foto-2', 'inspeccion-b', 'foto', 'archivo-b'),
      operacion('confirmada', 'inspeccion-c', 'envio', 'envio-c', 'confirmada'),
    ]);
    await fixture.whenStable();
    const estado = fixture.nativeElement.querySelector('[role="status"]') as HTMLElement;
    expect(estado.textContent).toContain('Inspecciones pendientes: 2 · Archivos pendientes: 2');
    expect(estado.getAttribute('aria-live')).toBe('polite');
  });
});
