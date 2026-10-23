import { TestBed } from '@angular/core/testing';
import { EsquemaFormulario } from '../modelos';
import { MotorFormularioComponent } from './motor-formulario';

describe('MotorFormularioComponent', () => {
  const esquemaPrueba: EsquemaFormulario = {
    title: 'Esquema de Prueba',
    type: 'object',
    properties: {
      subestructura: {
        type: 'object',
        title: 'Sección 4: Subestructura',
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
          dano_pila: {
            type: 'integer',
            title: 'Daño en pila',
            minimum: 0,
            maximum: 4,
            'x-dano': true,
            'x-grupo': 'pilas',
          },
        },
      },
      tramos: {
        type: 'array',
        title: 'Sección 3: Tramos Individuales',
        items: {
          type: 'object',
          required: ['numero_tramo', 'longitud'],
          properties: {
            numero_tramo: {
              type: 'integer',
              title: 'Número de tramo',
              minimum: 1,
            },
            longitud: {
              type: 'number',
              title: 'Longitud (m)',
              minimum: 0.5,
              'x-unidad': 'm',
            },
            tipo_tramo: {
              type: 'string',
              title: 'Tipo de tramo',
              enum: ['Simplemente Apoyado', 'Continuo'],
            },
          },
        },
      },
      identificacion: {
        type: 'object',
        title: 'Sección 1: Identificación',
        required: ['codigo'],
        properties: {
          codigo: {
            type: 'string',
            title: 'Código del puente',
            readOnly: true,
            'x-permanente': true,
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
    expect(formGroup.get('identificacion')).toBeTruthy();
    expect(formGroup.get('subestructura')).toBeTruthy();
    expect(formGroup.get('tramos')).toBeTruthy();

    const subGroup = formGroup.get('subestructura');
    expect(subGroup?.get('dano_estribo')).toBeTruthy();
  });

  it('debe ordenar las secciones de manera canónica según número de sección', () => {
    const fixture = TestBed.createComponent(MotorFormularioComponent);
    fixture.componentRef.setInput('esquema', esquemaPrueba);
    fixture.detectChanges();

    const secciones = fixture.componentInstance.secciones;
    expect(secciones.length).toBe(3);
    // Debe ordenar identificacion (Sección 1), tramos (Sección 3), subestructura (Sección 4)
    expect(secciones[0].clave).toBe('identificacion');
    expect(secciones[1].clave).toBe('tramos');
    expect(secciones[2].clave).toBe('subestructura');
  });

  it('debe instanciar un FormArray para secciones de tipo array (tramos) e inicializar un tramo', () => {
    const fixture = TestBed.createComponent(MotorFormularioComponent);
    fixture.componentRef.setInput('esquema', esquemaPrueba);
    fixture.detectChanges();

    const formArray = fixture.componentInstance.obtenerFormArray('tramos');
    expect(formArray).toBeTruthy();
    expect(formArray.length).toBe(1);

    const primerTramo = formArray.at(0);
    expect(primerTramo.get('numero_tramo')?.value).toBe(1);
    expect(primerTramo.get('longitud')).toBeTruthy();
    expect(primerTramo.get('tipo_tramo')).toBeTruthy();
  });

  it('debe permitir agregar y eliminar tramos dinámicamente', () => {
    const fixture = TestBed.createComponent(MotorFormularioComponent);
    fixture.componentRef.setInput('esquema', esquemaPrueba);
    fixture.detectChanges();

    const comp = fixture.componentInstance;
    comp.agregarFilaArray('tramos');

    const formArray = comp.obtenerFormArray('tramos');
    expect(formArray.length).toBe(2);
    expect(formArray.at(1).get('numero_tramo')?.value).toBe(2);

    comp.eliminarFilaArray('tramos', 0);
    expect(formArray.length).toBe(1);
    // Tras eliminar el primero, el restante debe renumerarse como tramo 1
    expect(formArray.at(0).get('numero_tramo')?.value).toBe(1);
  });

  it('el botón "Sin daños en este elemento" debe asignar 0 a un grupo específico (RN-INS-11)', () => {
    const fixture = TestBed.createComponent(MotorFormularioComponent);
    fixture.componentRef.setInput('esquema', esquemaPrueba);
    fixture.detectChanges();

    const formGroup = fixture.componentInstance.formGroup;
    formGroup.get('subestructura.dano_estribo')?.setValue(3);
    formGroup.get('subestructura.dano_alero')?.setValue(2);
    formGroup.get('subestructura.dano_pila')?.setValue(4);

    // Marcar solo el grupo "estribos"
    fixture.componentInstance.marcarSinDanos('subestructura', 'estribos');

    expect(formGroup.get('subestructura.dano_estribo')?.value).toBe(0);
    expect(formGroup.get('subestructura.dano_alero')?.value).toBe(0);
    // El grupo "pilas" no debe haberse modificado
    expect(formGroup.get('subestructura.dano_pila')?.value).toBe(4);
  });

  it('en modo lectura los controles deben estar deshabilitados (RN-FRM-05)', () => {
    const fixture = TestBed.createComponent(MotorFormularioComponent);
    fixture.componentRef.setInput('esquema', esquemaPrueba);
    fixture.componentRef.setInput('modo', 'lectura');
    fixture.detectChanges();

    const formGroup = fixture.componentInstance.formGroup;
    expect(formGroup.disabled).toBe(true);
  });

  it('debe emitir datos usando getRawValue para no perder campos de sólo lectura', () => {
    const fixture = TestBed.createComponent(MotorFormularioComponent);
    fixture.componentRef.setInput('esquema', esquemaPrueba);
    fixture.componentRef.setInput('datos', {
      identificacion: { codigo: 'GT-01-001' },
    });
    fixture.detectChanges();

    let datosEmitidos: any = null;
    fixture.componentInstance.datosChange.subscribe((d) => (datosEmitidos = d));

    // Modificar un campo
    fixture.componentInstance.formGroup.get('subestructura.dano_estribo')?.setValue(1);

    expect(datosEmitidos).toBeTruthy();
    // Aunque codigo esté deshabilitado por readOnly, getRawValue lo preserva
    expect(datosEmitidos.identificacion.codigo).toBe('GT-01-001');
  });
});
