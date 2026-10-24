import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { FormularioService } from '../../formulario/formulario.service';
import { FormularioVersionDTO } from '../../formulario/modelos';
import { ListadoVersiones } from './listado-versiones';

describe('ListadoVersiones', () => {
  let formularioServiceMock: any;

  const versionesMock: FormularioVersionDTO[] = [
    {
      id: '0192b000-0000-7000-8000-000000000001',
      codigo: 'V1.0.0',
      estado: 'ACTIVA',
      esquema: { title: 'V1', type: 'object', properties: {} },
      publicada_en: '2026-10-23T10:00:00Z',
      creado_en: '2026-10-23T10:00:00Z',
      actualizado_en: '2026-10-23T10:00:00Z',
    },
    {
      id: '0192b000-0000-7000-8000-000000000002',
      codigo: 'V2.0.0-BORRADOR',
      estado: 'BORRADOR',
      esquema: { title: 'V2', type: 'object', properties: {} },
      creado_en: '2026-10-23T11:00:00Z',
      actualizado_en: '2026-10-23T11:00:00Z',
    },
    {
      id: '0192b000-0000-7000-8000-000000000003',
      codigo: 'V0.9.0',
      estado: 'RETIRADA',
      esquema: { title: 'V0.9', type: 'object', properties: {} },
      publicada_en: '2026-10-20T10:00:00Z',
      creado_en: '2026-10-20T10:00:00Z',
      actualizado_en: '2026-10-20T10:00:00Z',
    },
  ];

  beforeEach(async () => {
    formularioServiceMock = {
      listar: vi.fn(() =>
        of({
          contenido: versionesMock,
          pagina: 0,
          tamano: 50,
          total_elementos: 3,
          total_paginas: 1,
        }),
      ),
      publicar: vi.fn(() => of(versionesMock[1])),
    };

    await TestBed.configureTestingModule({
      imports: [ListadoVersiones],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: FormularioService, useValue: formularioServiceMock },
      ],
    }).compileComponents();
  });

  it('debe cargar y renderizar la lista de versiones con sus badges de estado', () => {
    const fixture = TestBed.createComponent(ListadoVersiones);
    fixture.detectChanges();

    expect(formularioServiceMock.listar).toHaveBeenCalled();
    expect(fixture.componentInstance.versiones().length).toBe(3);

    const filas = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(filas.length).toBe(3);

    // Versión activa muestra distintivo "Vigente Oficial"
    expect(filas[0].textContent).toContain('V1.0.0');
    expect(filas[0].textContent).toContain('Vigente Oficial');
    expect(filas[0].textContent).toContain('ACTIVA');

    // Versión borrador muestra estado BORRADOR
    expect(filas[1].textContent).toContain('V2.0.0-BORRADOR');
    expect(filas[1].textContent).toContain('BORRADOR');

    // Versión retirada
    expect(filas[2].textContent).toContain('V0.9.0');
    expect(filas[2].textContent).toContain('RETIRADA');
  });

  it('debe mostrar el botón de publicar solo para versiones en estado BORRADOR', () => {
    const fixture = TestBed.createComponent(ListadoVersiones);
    fixture.detectChanges();

    const filas = fixture.nativeElement.querySelectorAll('tbody tr');

    // Fila 0 (ACTIVA): No debe tener botón Publicar
    const botonPublicarActiva = filas[0].querySelector('button');
    expect(botonPublicarActiva).toBeNull();

    // Fila 1 (BORRADOR): Debe tener botón Publicar
    const botonPublicarBorrador = filas[1].querySelector('button');
    expect(botonPublicarBorrador).toBeTruthy();
    expect(botonPublicarBorrador?.textContent).toContain('Publicar');

    // Fila 2 (RETIRADA): No debe tener botón Publicar
    const botonPublicarRetirada = filas[2].querySelector('button');
    expect(botonPublicarRetirada).toBeNull();
  });

  it('debe abrir el modal de publicación al pulsar Publicar en un borrador', () => {
    const fixture = TestBed.createComponent(ListadoVersiones);
    fixture.detectChanges();

    expect(fixture.componentInstance.versionSeleccionada()).toBeNull();

    // Invocar abrirPublicar
    fixture.componentInstance.abrirPublicar(versionesMock[1]);
    fixture.detectChanges();

    expect(fixture.componentInstance.versionSeleccionada()).toEqual(versionesMock[1]);

    const modal = fixture.nativeElement.querySelector('app-modal-publicar');
    expect(modal).toBeTruthy();
  });
});
