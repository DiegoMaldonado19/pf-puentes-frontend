import { TestBed } from '@angular/core/testing';
import { TEXTOS } from '../../../shared/textos';
import { EsquemaFormulario } from '../modelos';
import { MotorFormularioComponent } from './motor-formulario';

describe('MotorFormularioComponent', () => {
  it('imprime las ocho secciones del esquema congelado con los mismos campos en lectura', async () => {
    const fixture = TestBed.createComponent(MotorFormularioComponent);
    const properties = Object.fromEntries(
      Array.from({ length: 8 }, (_, i) => [
        `seccion_${i + 1}`,
        {
          type: 'object',
          title: `Sección ${i + 1}: Congelada`,
          properties: {
            valor: { type: 'string', title: `Campo congelado ${i + 1}`, readOnly: true },
          },
        },
      ]),
    );
    fixture.componentRef.setInput('esquema', { title: 'Congelado', type: 'object', properties });
    fixture.componentRef.setInput('modo', 'lectura');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('input').length).toBe(1);
    fixture.componentRef.setInput('impresion', true);
    fixture.detectChanges();
    const campos = Array.from(
      fixture.nativeElement.querySelectorAll('input'),
    ) as HTMLInputElement[];
    expect(campos).toHaveLength(8);
    expect(campos.every((campo) => campo.disabled || campo.readOnly)).toBe(true);
    fixture.componentRef.setInput('impresion', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('input')).toHaveLength(1);
  });
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

    let datosEmitidos: Record<string, Record<string, unknown>> | null = null;
    fixture.componentInstance.datosChange.subscribe(
      (d) => (datosEmitidos = d as Record<string, Record<string, unknown>>),
    );

    // Modificar un campo
    fixture.componentInstance.formGroup.get('subestructura.dano_estribo')?.setValue(1);

    expect(datosEmitidos).toBeTruthy();
    // Aunque codigo esté deshabilitado por readOnly, getRawValue lo preserva
    expect(datosEmitidos?.['identificacion']?.['codigo']).toBe('GT-01-001');
  });

  it('un campo integer rechaza decimales y acepta enteros (RN-FRM-08)', () => {
    const fixture = TestBed.createComponent(MotorFormularioComponent);
    fixture.componentRef.setInput('esquema', esquemaPrueba);
    fixture.detectChanges();

    const control = fixture.componentInstance.formGroup.get('subestructura.dano_estribo');
    control?.setValue(2.5);
    expect(control?.hasError('entero')).toBe(true);
    control?.setValue(3);
    expect(control?.valid).toBe(true);
  });

  it('un campo con enum rechaza valores fuera de la lista y acepta los listados (RN-FRM-08)', () => {
    const fixture = TestBed.createComponent(MotorFormularioComponent);
    fixture.componentRef.setInput('esquema', esquemaPrueba);
    fixture.detectChanges();

    const control = fixture.componentInstance.obtenerFormArray('tramos').at(0).get('tipo_tramo');
    control?.setValue('Voladizo');
    expect(control?.hasError('opcion')).toBe(true);
    control?.setValue('Continuo');
    expect(control?.valid).toBe(true);
  });

  it('muestra el mensaje de entero y de opción en los campos tocados (RN-FRM-08)', () => {
    const fixture = TestBed.createComponent(MotorFormularioComponent);
    fixture.componentRef.setInput('esquema', esquemaPrueba);
    fixture.detectChanges();

    const comp = fixture.componentInstance;
    const dano = comp.obtenerControl('subestructura', 'dano_estribo');
    dano?.setValue(2.5);
    dano?.markAsTouched();
    expect(comp.obtenerError('subestructura', 'dano_estribo')).toBe(
      TEXTOS.formulario.motor.enteroInvalido,
    );

    const tipo = comp.obtenerFormArray('tramos').at(0).get('tipo_tramo');
    tipo?.setValue('Voladizo');
    tipo?.markAsTouched();
    expect(comp.obtenerErrorArray('tramos', 0, 'tipo_tramo')).toBe(
      TEXTOS.formulario.motor.opcionInvalida,
    );
  });
});
