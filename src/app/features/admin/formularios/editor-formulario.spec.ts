import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { FormularioService } from '../../formulario/formulario.service';
import { EditorFormulario } from './editor-formulario';

describe('EditorFormulario', () => {
  let formularioServiceMock: any;

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
});
