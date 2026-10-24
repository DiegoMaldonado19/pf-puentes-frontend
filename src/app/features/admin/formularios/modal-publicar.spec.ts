import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { FormularioService } from '../../formulario/formulario.service';
import { FormularioVersionDTO } from '../../formulario/modelos';
import { ModalPublicar } from './modal-publicar';

describe('ModalPublicar', () => {
  let formularioServiceMock: Partial<Record<keyof FormularioService, ReturnType<typeof vi.fn>>>;

  const versionMock: FormularioVersionDTO = {
    id: '0192b000-0000-7000-8000-000000000002',
    codigo: 'V2.0.0',
    estado: 'BORRADOR',
    esquema: { title: 'V2', type: 'object', properties: {} },
    creado_en: '2026-10-23T10:00:00Z',
    actualizado_en: '2026-10-23T10:00:00Z',
  };

  beforeEach(async () => {
    formularioServiceMock = {
      publicar: vi.fn(() => of({ ...versionMock, estado: 'ACTIVA' })),
    };

    await TestBed.configureTestingModule({
      imports: [ModalPublicar],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: FormularioService, useValue: formularioServiceMock },
      ],
    }).compileComponents();
  });

  it('debe renderizar el título con el código de la versión y la advertencia de inmutabilidad (RN-FRM-03)', () => {
    const fixture = TestBed.createComponent(ModalPublicar);
    fixture.componentRef.setInput('version', versionMock);
    fixture.detectChanges();

    const titulo = fixture.nativeElement.querySelector('h3');
    expect(titulo.textContent).toContain('V2.0.0');

    const advertencia = fixture.nativeElement.querySelector('.bg-amber-50');
    expect(advertencia).toBeTruthy();
  });

  it('debe validar que el mapeo sea un JSON válido antes de publicar', () => {
    const fixture = TestBed.createComponent(ModalPublicar);
    fixture.componentRef.setInput('version', versionMock);
    fixture.detectChanges();

    fixture.componentInstance.mapeoJson = '{ json_invalido: ';
    fixture.componentInstance.confirmarPublicacion();
    fixture.detectChanges();

    expect(formularioServiceMock.publicar).not.toHaveBeenCalled();
    expect(fixture.componentInstance.errorFormato).toContain('JSON válido');
  });

  it('debe llamar al servicio publicar y emitir el evento publicado al completarse exitosamente', () => {
    const fixture = TestBed.createComponent(ModalPublicar);
    fixture.componentRef.setInput('version', versionMock);
    fixture.detectChanges();

    const spyEmit = vi.spyOn(fixture.componentInstance.publicado, 'emit');

    fixture.componentInstance.mapeoJson = '{"subestructura.v1": "subestructura.v2"}';
    fixture.componentInstance.confirmarPublicacion();
    fixture.detectChanges();

    expect(formularioServiceMock.publicar).toHaveBeenCalledWith(
      '0192b000-0000-7000-8000-000000000002',
      {
        mapeo: { 'subestructura.v1': 'subestructura.v2' },
      },
    );
    expect(spyEmit).toHaveBeenCalled();
  });
});
