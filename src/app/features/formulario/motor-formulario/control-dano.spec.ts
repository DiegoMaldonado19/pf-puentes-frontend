import { TestBed } from '@angular/core/testing';
import { ControlDanoComponent } from './control-dano';

describe('ControlDanoComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ControlDanoComponent],
    }).compileComponents();
  });

  it('debe renderizar 5 botones táctiles de 0 a 4', () => {
    const fixture = TestBed.createComponent(ControlDanoComponent);
    fixture.detectChanges();

    const botones: HTMLButtonElement[] = fixture.nativeElement.querySelectorAll('button');
    expect(botones.length).toBe(5);
    expect(botones[0]?.textContent?.trim()).toBe('0');
    expect(botones[4]?.textContent?.trim()).toBe('4');
  });

  it('los botones deben cumplir el tamaño táctil mínimo de 44x44 px (DT-FE-09)', () => {
    const fixture = TestBed.createComponent(ControlDanoComponent);
    fixture.detectChanges();

    const botones: HTMLButtonElement[] = fixture.nativeElement.querySelectorAll('button');
    for (const boton of botones) {
      expect(boton.classList.contains('min-w-[44px]')).toBe(true);
      expect(boton.classList.contains('min-h-[44px]')).toBe(true);
    }
  });

  it('al pulsar un botón debe seleccionarse el valor correspondiente', () => {
    const fixture = TestBed.createComponent(ControlDanoComponent);
    fixture.detectChanges();

    const botones: HTMLButtonElement[] = fixture.nativeElement.querySelectorAll('button');
    botones[2]?.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.valorSeleccionado).toBe(2);
    expect(botones[2]?.getAttribute('aria-checked')).toBe('true');
  });

  it('cuando está deshabilitado no debe cambiar el valor al hacer click', () => {
    const fixture = TestBed.createComponent(ControlDanoComponent);
    fixture.componentInstance.deshabilitado = true;
    fixture.detectChanges();

    const botones: HTMLButtonElement[] = fixture.nativeElement.querySelectorAll('button');
    botones[3]?.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.valorSeleccionado).toBeNull();
  });
});
