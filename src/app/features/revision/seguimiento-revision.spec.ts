import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { AuthService } from '../../core/auth/auth';
import { CalificacionRevision } from './calificacion-revision';
import { HistorialRevisiones } from './historial-revisiones';
import { MisRevisiones } from './mis-revisiones';
import { ObservacionRevision, RevisionApi } from './revision-api';

const vacia = { content: [], number: 0, size: 10, total_elements: 0, total_pages: 0 };
const observacion = {
  id: 'obs',
  texto: 'Confirmar material',
  elemento_ref: 'estribo.material',
  revision_id: 'ciclo',
  inspeccion_id: 'inspeccion',
  estado: 'BORRADOR',
  puente_codigo: 'GT-99-9901-0001',
};
const pagina = { content: [observacion], number: 0, size: 10, total_elements: 1, total_pages: 1 };

function sesion() {
  const usuario = signal<{ id: string; rol: string } | null>({
    id: 'estudiante',
    rol: 'ESTUDIANTE',
  });
  return {
    usuario,
    autenticado: computed(() => !!usuario()),
    rol: computed(() => usuario()?.rol ?? null),
  };
}

describe('Seguimiento académico por HTTP', () => {
  it('resuelve, consulta historial y nota mediante endpoints separados sin enviar identidad', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(RevisionApi);
    const http = TestBed.inject(HttpTestingController);
    api.misPendientes().subscribe();
    http.expectOne((r) => r.url === '/api/v1/revisiones/mis-pendientes').flush(vacia);
    api.misInspecciones().subscribe();
    http.expectOne((r) => r.url === '/api/v1/revisiones/mis-inspecciones').flush(vacia);
    api.resolver('obs').subscribe();
    const resolucion = http.expectOne('/api/v1/observaciones/obs/resolucion');
    expect(resolucion.request.method).toBe('PATCH');
    expect(resolucion.request.body).toEqual({});
    resolucion.flush(observacion);
    api.historial('inspeccion', 2).subscribe();
    const historia = http.expectOne((r) => r.url === '/api/v1/inspecciones/inspeccion/revisiones');
    expect(historia.request.params.get('page')).toBe('2');
    historia.flush(vacia);
    api.calificacion('ciclo').subscribe();
    http.expectOne('/api/v1/revisiones/ciclo/calificacion').flush({ calificacion: 75 });
    api.calificar('ciclo', null).subscribe();
    const nota = http.expectOne('/api/v1/revisiones/ciclo/calificacion');
    expect(nota.request.method).toBe('PUT');
    expect(nota.request.body).toEqual({ calificacion: null });
    nota.flush({ calificacion: null });
    http.verify();
  });
});

describe('Pendientes del estudiante', () => {
  const preparar = async () => {
    const auth = sesion();
    const resolver = new Subject<ObservacionRevision>();
    const api = {
      misPendientes: vi.fn(() => of(pagina)),
      misInspecciones: vi.fn(() =>
        of({
          ...vacia,
          content: [
            { inspeccion_id: 'inspeccion', puente_codigo: 'GT-99-9901-0001', estado: 'BORRADOR' },
          ],
        }),
      ),
      resolver: vi.fn(() => resolver),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: RevisionApi, useValue: api },
      ],
    });
    const fixture = TestBed.createComponent(MisRevisiones);
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    await fixture.whenStable();
    return { fixture, api, auth, resolver };
  };

  it('presenta los pendientes y bloquea resoluciones duplicadas mientras escribe', async () => {
    const { fixture, api, resolver } = await preparar();
    expect(fixture.nativeElement.textContent).toContain('Confirmar material');
    fixture.componentInstance.resolver('obs');
    fixture.componentInstance.resolver('obs');
    expect(api.resolver).toHaveBeenCalledTimes(1);
    resolver.next({ ...observacion, resuelta_en: '2026-10-27T12:30:00Z' });
    expect(api.misPendientes).toHaveBeenCalledTimes(2);
  });

  it('permite abrir el historial aunque ya no queden pendientes', async () => {
    const { fixture, api } = await preparar();
    api.misPendientes.mockReturnValue(
      of({ ...pagina, content: [], total_elements: 0, total_pages: 0 }),
    );
    fixture.componentInstance.cargar();
    await fixture.whenStable();
    expect(
      fixture.nativeElement.querySelector('a[href="/historial-revisiones/inspeccion"]'),
    ).not.toBeNull();
  });

  it('limpia datos y descarta una resolución tardía al cerrar sesión', async () => {
    const { fixture, auth, resolver } = await preparar();
    fixture.componentInstance.resolver('obs');
    auth.usuario.set(null);
    await fixture.whenStable();
    resolver.next({ ...observacion, resuelta_en: '2026-10-27T12:30:00Z' });
    expect(fixture.componentInstance.pagina()).toBeNull();
    expect(fixture.componentInstance.inspecciones()).toBeNull();
  });
});

describe('Calificación privada', () => {
  it('no muestra notas de un ciclo cuyo endpoint privado deniega acceso', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: sesion() },
        {
          provide: RevisionApi,
          useValue: {
            calificacion: () => throwError(() => new HttpErrorResponse({ status: 404 })),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(CalificacionRevision);
    fixture.componentRef.setInput('revisionId', 'ajena');
    await fixture.whenStable();
    expect(fixture.componentInstance.visible()).toBe(false);
    expect(fixture.componentInstance.nota()).toBeNull();
    expect(fixture.nativeElement.querySelector('input')).toBeNull();
  });

  it('valida rango y precisión y permite retirar la calificación con null', async () => {
    const api = {
      calificacion: () => of({ calificacion: 80 }),
      calificar: vi.fn(() => of({ calificacion: null })),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: sesion() },
        { provide: RevisionApi, useValue: api },
      ],
    });
    const fixture = TestBed.createComponent(CalificacionRevision);
    fixture.componentRef.setInput('revisionId', 'ciclo');
    fixture.componentRef.setInput('editable', true);
    await fixture.whenStable();
    fixture.componentInstance.control.setValue(101);
    fixture.componentInstance.guardar();
    fixture.componentInstance.control.setValue(80.123);
    fixture.componentInstance.guardar();
    expect(api.calificar).not.toHaveBeenCalled();
    fixture.componentInstance.control.setValue(null);
    fixture.componentInstance.guardar();
    expect(api.calificar).toHaveBeenCalledWith('ciclo', null);
  });
});

describe('Historial de ciclos', () => {
  it('conserva cada ciclo y muestra la resolución sin exponer notas de consultas generales', async () => {
    const ciclos = [
      {
        id: 'nuevo',
        veredicto: null,
        observacion: null,
        creado_en: '2026-10-27T12:00:00Z',
        emitida_en: null,
        estado: 'EN_REVISION',
        observaciones: [],
      },
      {
        id: 'anterior',
        veredicto: 'CAMBIOS_SOLICITADOS',
        observacion: 'Corregir datos',
        creado_en: '2026-10-26T12:00:00Z',
        emitida_en: '2026-10-26T14:00:00Z',
        estado: 'EN_REVISION',
        observaciones: [{ ...observacion, resuelta_en: '2026-10-27T10:00:00Z' }],
      },
    ];
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: sesion() },
        {
          provide: RevisionApi,
          useValue: {
            historial: () => of({ ...vacia, content: ciclos, total_elements: 2, total_pages: 1 }),
            calificacion: () => of({ calificacion: null }),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(HistorialRevisiones);
    fixture.componentRef.setInput('inspeccionId', 'inspeccion');
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Corregir datos');
    expect(fixture.nativeElement.textContent).toContain('Resuelta');
    expect(fixture.componentInstance.pagina()?.content).toHaveLength(2);
  });
});
