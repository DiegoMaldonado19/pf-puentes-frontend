import { TestBed } from '@angular/core/testing';
import { EstadoOrden } from './modelos';
import { LineaEstadosOrden, TRANSICIONES_ORDEN } from './linea-estados-orden';

describe('TRANSICIONES_ORDEN (B9)', () => {
  it('coincide con las transiciones válidas del backend', () => {
    expect(TRANSICIONES_ORDEN.PROPUESTA).toEqual(['PROGRAMADA', 'DESCARTADA']);
    expect(TRANSICIONES_ORDEN.PROGRAMADA).toEqual(['EN_EJECUCION', 'CANCELADA']);
    expect(TRANSICIONES_ORDEN.EN_EJECUCION).toEqual(['EJECUTADA']);
    expect(TRANSICIONES_ORDEN.EJECUTADA).toEqual([]);
    expect(TRANSICIONES_ORDEN.DESCARTADA).toEqual([]);
    expect(TRANSICIONES_ORDEN.CANCELADA).toEqual([]);
  });
});

describe('LineaEstadosOrden (B9)', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [LineaEstadosOrden] }).compileComponents();
  });

  function montar(estado: EstadoOrden): HTMLElement {
    const fixture = TestBed.createComponent(LineaEstadosOrden);
    fixture.componentRef.setInput('estado', estado);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('marca el paso actual y lista solo los pasos válidos desde él', () => {
    const elemento = montar('PROGRAMADA');
    const pasos = elemento.querySelectorAll<HTMLElement>('li');

    expect(pasos[1]?.getAttribute('aria-current')).toBe('step');
    expect(pasos[0]?.getAttribute('aria-current')).toBeNull();
    expect(elemento.textContent).toContain('En ejecución, Cancelada');
  });

  it('una orden cerrada no ofrece pasos y su salida lateral se nombra', () => {
    const elemento = montar('DESCARTADA');

    expect(elemento.textContent).toContain('Ninguno: la orden está cerrada.');
    expect(elemento.querySelectorAll('[aria-current]')).toHaveLength(0);
    expect(elemento.querySelector('p.font-semibold')?.textContent?.trim()).toBe('Descartada');
  });
});
