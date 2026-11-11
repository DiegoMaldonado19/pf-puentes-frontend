import { TestBed } from '@angular/core/testing';
import { EsquemaFormulario } from '../modelos';
import { MotorFormularioComponent } from './motor-formulario';

/** B7: al enviar con campos incompletos, el motor marca, lista y lleva al primer error. */
const esquema: EsquemaFormulario = {
  title: 'Envío con errores',
  type: 'object',
  properties: {
    identificacion: {
      type: 'object',
      title: 'Sección 1: Identificación',
      properties: { codigo: { type: 'string', title: 'Código del puente' } },
    },
    datos_generales: {
      type: 'object',
      title: 'Sección 2: Datos generales',
      required: ['longitud_total'],
      properties: {
        longitud_total: { type: 'number', title: 'Longitud total del puente (m)' },
        ancho: { type: 'number', title: 'Ancho de rodadura (m)' },
      },
    },
  },
};

describe('MotorFormularioComponent: envío con campos incompletos (B7)', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MotorFormularioComponent],
    }).compileComponents();
  });

  it('lista los obligatorios vacíos con el título con que se muestran', () => {
    const fixture = TestBed.createComponent(MotorFormularioComponent);
    fixture.componentRef.setInput('esquema', esquema);
    fixture.detectChanges();

    expect(fixture.componentInstance.camposConError()).toEqual([
      {
        seccion: 'datos_generales',
        campo: 'longitud_total',
        titulo: 'Longitud total del puente (m)',
      },
    ]);
  });

  it('marcarTodoComoTocado hace visibles los errores de los campos', () => {
    const fixture = TestBed.createComponent(MotorFormularioComponent);
    fixture.componentRef.setInput('esquema', esquema);
    fixture.detectChanges();

    fixture.componentInstance.marcarTodoComoTocado();

    expect(fixture.componentInstance.formGroup.get('datos_generales.longitud_total')?.touched).toBe(
      true,
    );
  });

  it('enfocarPrimerError muestra la sección del primer error y su campo', () => {
    const fixture = TestBed.createComponent(MotorFormularioComponent);
    fixture.componentRef.setInput('esquema', esquema);
    fixture.detectChanges();
    const motor = fixture.componentInstance;
    motor.cambiarSeccion(0);

    motor.enfocarPrimerError();
    fixture.detectChanges();

    expect(motor.secciones[motor.seccionActiva].clave).toBe('datos_generales');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[id="longitud_total"]'),
    ).not.toBeNull();
  });
});
