import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmacionEstado } from './confirmacion-estado';

describe('ConfirmacionEstado', () => {
  let fixture: ComponentFixture<ConfirmacionEstado>;
  let component: ConfirmacionEstado;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfirmacionEstado],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmacionEstado);
    component = fixture.componentInstance;
  });

  it('inicia coincidiendo con el estado calculado y sin requerir justificación', () => {
    fixture.componentRef.setInput('estadoCalculado', 'BUENO');
    fixture.detectChanges();

    expect(component.estadoConfirmado()).toBe('BUENO');
    expect(component.tieneDiscrepancia()).toBe(false);
    expect(component.valida()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain(
      'El estado confirmado coincide con el cálculo automático',
    );
  });

  it('exige justificación cuando el estado confirmado difiere del calculado (RN-IC-06)', () => {
    fixture.componentRef.setInput('estadoCalculado', 'BUENO');
    fixture.detectChanges();

    component.estadoConfirmado.set('REGULAR');
    fixture.detectChanges();

    expect(component.tieneDiscrepancia()).toBe(true);
    expect(component.justificacionInvalida()).toBe(true);
    expect(component.valida()).toBe(false);

    component.tocado.set(true);
    fixture.detectChanges();

    const errorEl = fixture.nativeElement.querySelector('[data-testid="error-justificacion"]');
    expect(errorEl).not.toBeNull();
    expect(errorEl?.textContent).toContain('Se requiere una justificación por escrito');

    component.justificacion.set('   Deterioro visible en vigas no considerado   ');
    fixture.detectChanges();

    expect(component.justificacionInvalida()).toBe(false);
    expect(component.valida()).toBe(true);
  });

  it('detecta y alerta la elevación de una anulación crítica forzada a Malo', () => {
    fixture.componentRef.setInput('estadoCalculado', 'MALO');
    fixture.componentRef.setInput('anulacion', 'SOCAVACION');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Socavación con exposición de cimentación');

    component.estadoConfirmado.set('BUENO');
    component.justificacion.set('Reforzamiento provisional ejecutado');
    fixture.detectChanges();

    expect(component.esElevacionCritica()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain(
      'Atención: La inspección presenta una condición crítica de anulación',
    );
  });

  it('deshabilita los controles cuando deshabilitado es verdadero', () => {
    fixture.componentRef.setInput('estadoCalculado', 'REGULAR');
    fixture.componentRef.setInput('estadoInicial', 'MALO');
    fixture.componentRef.setInput('deshabilitado', true);
    fixture.detectChanges();

    const select = fixture.nativeElement.querySelector('[data-testid="select-estado-confirmado"]');
    const textarea = fixture.nativeElement.querySelector('[data-testid="textarea-justificacion"]');

    expect(select?.disabled).toBe(true);
    expect(textarea?.disabled).toBe(true);
  });
});
