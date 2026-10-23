import { TestBed } from '@angular/core/testing';
import { EsquemaFormulario } from '../modelos';
import { MotorFormularioComponent } from './motor-formulario';

describe('MotorFormularioComponent', () => {
  const esquemaPrueba: EsquemaFormulario = {
    title: 'Esquema de Prueba',
    type: 'object',
    properties: {
      identificacion: {
        type: 'object',
        title: 'Identificación',
        required: ['codigo'],
        properties: {
          codigo: {
            type: 'string',
            title: 'Código del puente',
            'x-permanente': true,
          },
        },
      },
      subestructura: {
        type: 'object',
        title: 'Subestructura',
        properties: {
          dano_estribo: {
            type: 'integer',
            title: 'Daño en estribo',
            minimum: 0,
            maximum: 4,
            'x-dano': true,
            'x-grupo': 'estribos',
          },
          dano_alero: {
            type: 'integer',
            title: 'Daño en alero',
            minimum: 0,
            maximum: 4,
            'x-dano': true,
            'x-grupo': 'estribos',
          },
        },
      },
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MotorFormularioComponent],
    }).compileComponents();
  });

  it('debe construir el FormGroup dinámico desde el esquema (DT-FE-07, DT-FE-08)', () => {
    const fixture = TestBed.createComponent(MotorFormularioComponent);
    fixture.componentRef.setInput('esquema', esquemaPrueba);
    fixture.detectChanges();

    const formGroup = fixture.componentInstance.formGroup;
    expect(formGroup.contains('identificacion')).toBe(true);
    expect(formGroup.contains('subestructura')).toBe(true);

    const subGroup = formGroup.get('subestructura');
    expect(subGroup?.get('dano_estribo')).toBeTruthy();
  });

  it('el botón "Sin daños en este elemento" debe asignar 0 a los campos de daño (RN-INS-11)', () => {
    const fixture = TestBed.createComponent(MotorFormularioComponent);
    fixture.componentRef.setInput('esquema', esquemaPrueba);
    fixture.detectChanges();

    const formGroup = fixture.componentInstance.formGroup;
    formGroup.get('subestructura.dano_estribo')?.setValue(3);
    formGroup.get('subestructura.dano_alero')?.setValue(2);

    fixture.componentInstance.marcarSinDanos('subestructura');

    expect(formGroup.get('subestructura.dano_estribo')?.value).toBe(0);
    expect(formGroup.get('subestructura.dano_alero')?.value).toBe(0);
  });

  it('en modo lectura los controles deben estar deshabilitados (RN-FRM-05)', () => {
    const fixture = TestBed.createComponent(MotorFormularioComponent);
    fixture.componentRef.setInput('esquema', esquemaPrueba);
    fixture.componentRef.setInput('modo', 'lectura');
    fixture.detectChanges();

    const formGroup = fixture.componentInstance.formGroup;
    expect(formGroup.disabled).toBe(true);
  });
});
