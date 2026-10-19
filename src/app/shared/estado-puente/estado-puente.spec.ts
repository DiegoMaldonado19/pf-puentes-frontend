import { TestBed } from '@angular/core/testing';
import { EstadoCondicion, EstadoPuente } from './estado-puente';

describe('EstadoPuente', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [EstadoPuente] }).compileComponents();
  });

  const casos: [EstadoCondicion | null, string, string][] = [
    ['BUENO', 'Bueno', 'BUENO'],
    ['REGULAR', 'Regular', 'REGULAR'],
    ['MALO', 'Malo', 'MALO'],
    [null, 'Sin evaluar', 'SIN_EVALUAR'],
  ];

  it.each(casos)('muestra %s con texto y su variante de color', (estado, texto, variante) => {
    const fixture = TestBed.createComponent(EstadoPuente);
    fixture.componentRef.setInput('estado', estado);
    fixture.detectChanges();
    const elemento: HTMLElement = fixture.nativeElement.querySelector('.estado');

    expect(elemento.textContent?.trim()).toBe(texto);
    expect(elemento.dataset['estado']).toBe(variante);
    expect(elemento.querySelector('.indicador')?.getAttribute('aria-hidden')).toBe('true');
    expect(elemento.querySelector('button, a, input, [tabindex]')).toBeNull();
  });

  it('actualiza la etiqueta al cambiar el estado y al retirar la evaluación', () => {
    const fixture = TestBed.createComponent(EstadoPuente);
    for (const [estado, texto] of casos) {
      fixture.componentRef.setInput('estado', estado);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent.trim()).toBe(texto);
    }
  });

  it('permite mostrar estados independientes en un listado', () => {
    const bueno = TestBed.createComponent(EstadoPuente);
    const malo = TestBed.createComponent(EstadoPuente);
    bueno.componentRef.setInput('estado', 'BUENO');
    malo.componentRef.setInput('estado', 'MALO');
    bueno.detectChanges();
    malo.detectChanges();

    expect(bueno.nativeElement.textContent.trim()).toBe('Bueno');
    expect(malo.nativeElement.textContent.trim()).toBe('Malo');
  });
});
