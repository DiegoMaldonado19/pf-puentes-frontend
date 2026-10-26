import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IcPreliminar } from './ic-preliminar';

describe('IcPreliminar', () => {
  let fixture: ComponentFixture<IcPreliminar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IcPreliminar],
    }).compileComponents();

    fixture = TestBed.createComponent(IcPreliminar);
  });

  it('muestra rótulo preliminar y advertencia de no oficialidad por defecto (RN-IC-07)', () => {
    fixture.componentRef.setInput('indice', 85.5);
    fixture.componentRef.setInput('estado', 'BUENO');
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('IC preliminar');
    expect(texto).toContain('85.50');
    expect(texto).toContain('Bueno');
    expect(texto).toContain('No oficial: no altera el inventario ni el mapa');
  });

  it('muestra advertencia cuando faltan datos de daño para estimar', () => {
    fixture.componentRef.setInput('datosIncompletos', true);
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('Faltan datos de daño en el formulario');
  });

  it('muestra causas de anulación crítica y advertencia de estado Malo (RN-IC-05)', () => {
    fixture.componentRef.setInput('indice', 90.0);
    fixture.componentRef.setInput('estado', 'MALO');
    fixture.componentRef.setInput('anulaciones', ['SOCAVACION', 'PERDIDA_SECCION']);
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('Estado forzado a Malo por condición crítica estructural');
    expect(texto).toContain('Socavación con exposición de cimentación');
    expect(texto).toContain('Elemento portante cortado');
  });

  it('distingue resultado oficial publicado cuando esPreliminar es falso', () => {
    fixture.componentRef.setInput('indice', 70.0);
    fixture.componentRef.setInput('estado', 'REGULAR');
    fixture.componentRef.setInput('esPreliminar', false);
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('IC Oficial');
    expect(texto).toContain('Resultado publicado oficial');
    expect(texto).not.toContain('No oficial: no altera el inventario');
  });
});
