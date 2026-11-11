import { TestBed } from '@angular/core/testing';
import { EsquemaFormulario } from '../modelos';
import { MotorFormularioComponent } from './motor-formulario';

/** B3: observaciones del revisor junto a su campo, contador por pestaña e «Ir al campo». */
const esquema: EsquemaFormulario = {
  title: 'Observaciones',
  type: 'object',
  properties: {
    identificacion: {
      type: 'object',
      title: 'Sección 1: Identificación',
      properties: { codigo: { type: 'string', title: 'Código del puente' } },
    },
    subestructura: {
      type: 'object',
      title: 'Sección 2: Subestructura',
      properties: {
        pilas_grietas: {
          type: 'number',
          title: 'Grietas en pilas',
          'x-elemento-ref': 'subestructura.pilas.grietas',
        },
      },
    },
  },
};

function montar(): MotorFormularioComponent {
  const fixture = TestBed.createComponent(MotorFormularioComponent);
  fixture.componentRef.setInput('esquema', esquema);
  fixture.componentRef.setInput('observaciones', [
    { referencia: 'subestructura.pilas.grietas', texto: 'Revisar las grietas de la pila 2' },
  ]);
  fixture.detectChanges();
  return fixture.componentInstance;
}

const scrollOriginal = Element.prototype.scrollIntoView;

describe('MotorFormularioComponent: observaciones del revisor (B3)', () => {
  beforeEach(async () => {
    // jsdom no implementa scrollIntoView; el motor lo usa al llevar al campo
    Element.prototype.scrollIntoView = vi.fn();
    await TestBed.configureTestingModule({
      imports: [MotorFormularioComponent],
    }).compileComponents();
  });

  afterEach(() => {
    Element.prototype.scrollIntoView = scrollOriginal;
  });

  it('cuenta las observaciones de cada sección según la referencia de su campo', () => {
    const motor = montar();

    expect(motor.contadorObservaciones('subestructura')).toBe(1);
    expect(motor.contadorObservaciones('identificacion')).toBe(0);
  });

  it('muestra la observación junto a su campo al abrir su pestaña', () => {
    const fixture = TestBed.createComponent(MotorFormularioComponent);
    fixture.componentRef.setInput('esquema', esquema);
    fixture.componentRef.setInput('observaciones', [
      { referencia: 'subestructura.pilas.grietas', texto: 'Revisar las grietas de la pila 2' },
    ]);
    fixture.detectChanges();

    // Se abre la pestaña con un clic, como lo hace quien revisa la captura
    (fixture.nativeElement as HTMLElement)
      .querySelectorAll<HTMLButtonElement>('nav button')[1]
      ?.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Revisar las grietas de la pila 2');
  });

  it('«Ir al campo» cambia de pestaña, da el foco al campo y avisa si no existe', () => {
    const motor = montar();

    expect(motor.enfocarRef('subestructura.pilas.grietas')).toBe(true);
    expect(motor.seccionActiva).toBe(1);
    expect(document.activeElement?.id).toBe('pilas_grietas');
    expect(motor.enfocarRef('otra.seccion.que.no.existe')).toBe(false);
  });

  it('no busca observaciones para un campo sin referencia', () => {
    const motor = montar();

    expect(motor.observacionesDelCampo(undefined)).toEqual([]);
    expect(motor.observacionesDelCampo('subestructura.pilas.grietas')).toHaveLength(1);
  });
});
