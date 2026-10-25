import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { FormularioService } from '../../formulario/formulario.service';
import { EditorFormulario } from './editor-formulario';

describe('EditorFormulario', () => {
  let formularioServiceMock: Partial<Record<keyof FormularioService, ReturnType<typeof vi.fn>>>;

  beforeEach(async () => {
    formularioServiceMock = {
      obtenerActivo: vi.fn(() =>
        of({
          id: 'v1',
          codigo: 'V1.0.0',
          estado: 'ACTIVA',
          esquema: {
            title: 'SIECA V1.0',
            type: 'object',
            properties: {
              seccion_1: {
                type: 'object',
                title: 'General',
                properties: {
                  codigo: { type: 'string', title: 'Código' },
                  dano: { type: 'integer', title: 'Nivel Daño', 'x-dano': true },
                },
              },
            },
          },
        }),
      ),
      detalle: vi.fn(() => of(undefined)),
      crearBorrador: vi.fn(),
      editarBorrador: vi.fn(),
      publicar: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [EditorFormulario],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: FormularioService, useValue: formularioServiceMock },
      ],
    }).compileComponents();
  });

  it('debe iniciar en la pestaña de editor y permitir cambiar a la vista previa en vivo', () => {
    const fixture = TestBed.createComponent(EditorFormulario);
    fixture.detectChanges();

    expect(fixture.componentInstance.tabActiva).toBe('editor');

    // Cambiar a la vista previa en vivo
    fixture.componentInstance.actualizarVistaPrevia();
    fixture.detectChanges();

    expect(fixture.componentInstance.tabActiva).toBe('preview');

    const appMotor = fixture.nativeElement.querySelector('app-motor-formulario');
    expect(appMotor).toBeTruthy();

    const bannerAviso = fixture.nativeElement.querySelector('.bg-blue-50');
    expect(bannerAviso).toBeTruthy();
    expect(bannerAviso.textContent).toContain('<app-motor-formulario>');
  });

  it('debe tener contraste y clases adecuadas en la pestaña de vista previa', () => {
    const fixture = TestBed.createComponent(EditorFormulario);
    fixture.detectChanges();

    fixture.componentInstance.actualizarVistaPrevia();
    fixture.detectChanges();

    const botonesPestana: HTMLButtonElement[] = fixture.nativeElement.querySelectorAll('button');
    const botonVistaPrevia = Array.from(botonesPestana).find((b) =>
      b.textContent?.includes('Vista Previa en Vivo'),
    );
    expect(botonVistaPrevia).toBeTruthy();
    expect(botonVistaPrevia?.classList.contains('text-blue-600')).toBe(true);
  });

  it('debe validar la sintaxis en tiempo real al escribir JSON inválido sin necesidad de guardar', () => {
    const fixture = TestBed.createComponent(EditorFormulario);
    fixture.detectChanges();

    // Estado inicial válido desde el esquema mock
    expect(fixture.componentInstance.errorSintaxis).toBe('');
    const badgeValidoInicial = fixture.nativeElement.querySelector('.text-emerald-600');
    expect(badgeValidoInicial).toBeTruthy();
    expect(badgeValidoInicial.textContent).toContain('Sintaxis JSON válida');

    // Simular escritura de JSON incompleto/inválido en tiempo real
    const textarea: HTMLTextAreaElement = fixture.nativeElement.querySelector('textarea');
    textarea.value = '{ "title": "Incompleto", ';
    textarea.dispatchEvent(new Event('input'));
    fixture.componentInstance.validarSintaxis(textarea.value);
    fixture.detectChanges();

    // Verificación inmediata de error sintáctico sin presionar guardar
    expect(fixture.componentInstance.errorSintaxis).toBeTruthy();
    expect(fixture.componentInstance.errorSintaxis).toContain('Sintaxis JSON inválida');

    const mensajeError = fixture.nativeElement.querySelector('.text-rose-600');
    expect(mensajeError).toBeTruthy();
    expect(mensajeError.textContent).toContain('Sintaxis JSON inválida');

    // El botón guardar borrador debe quedar deshabilitado
    const botones: HTMLButtonElement[] = fixture.nativeElement.querySelectorAll('button');
    const botonGuardar = Array.from(botones).find((b) =>
      b.textContent?.includes('Guardar borrador'),
    );
    expect(botonGuardar?.disabled).toBe(true);
  });

  it('debe restablecer la validación en tiempo real cuando el JSON se corrige', () => {
    const fixture = TestBed.createComponent(EditorFormulario);
    fixture.detectChanges();

    // Poner primero un error
    fixture.componentInstance.validarSintaxis('{ error de sintaxis ');
    fixture.detectChanges();
    expect(fixture.componentInstance.errorSintaxis).toBeTruthy();

    // Corregir el JSON en tiempo real
    fixture.componentInstance.validarSintaxis(JSON.stringify({ title: 'Válido', type: 'object' }));
    fixture.detectChanges();

    expect(fixture.componentInstance.errorSintaxis).toBe('');
    const badgeValido = fixture.nativeElement.querySelector('.text-emerald-600');
    expect(badgeValido).toBeTruthy();
    expect(badgeValido.textContent).toContain('Sintaxis JSON válida');

    const botones: HTMLButtonElement[] = fixture.nativeElement.querySelectorAll('button');
    const botonGuardar = Array.from(botones).find((b) =>
      b.textContent?.includes('Guardar borrador'),
    );
    expect(botonGuardar?.disabled).toBe(false);
  });
});
