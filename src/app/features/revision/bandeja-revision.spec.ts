import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { AuthService } from '../../core/auth/auth';
import { Rol } from '../../core/auth/modelos';
import { rolGuard } from '../../core/auth/rol.guard';
import { BandejaRevision } from './bandeja-revision';
import { PaginaRevisiones, RevisionAbierta, RevisionApi } from './revision-api';

const fila = {
  inspeccion_id: 'inspeccion',
  autor_nombre: 'Ana',
  curso_nombre: 'Puentes',
  puente_codigo: 'GT-99-9901-0001',
  estado: 'ENVIADA' as const,
  enviada_en: '2026-10-27T12:00:00Z',
  revision_id: null,
};
const pagina: PaginaRevisiones = {
  content: [fila],
  number: 0,
  size: 10,
  total_elements: 1,
  total_pages: 1,
};
const revision: RevisionAbierta = {
  id: 'ciclo',
  inspeccion_id: 'inspeccion',
  revisor_id: 'docente',
  creado_en: '2026-10-27T12:00:00Z',
};

describe('Cliente de revisión', () => {
  it('pagina y filtra por HTTP y abre sin enviar una identidad elegida por el cliente', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(RevisionApi);
    const http = TestBed.inject(HttpTestingController);
    api.pendientes(2, 'ENVIADA').subscribe();
    const lectura = http.expectOne((req) => req.url === '/api/v1/revisiones/pendientes');
    expect(lectura.request.params.get('page')).toBe('2');
    expect(lectura.request.params.get('estado')).toBe('ENVIADA');
    lectura.flush(pagina);
    api.abrir('inspeccion').subscribe();
    const escritura = http.expectOne('/api/v1/inspecciones/inspeccion/revisiones');
    expect(escritura.request.method).toBe('POST');
    expect(escritura.request.body).toEqual({});
    escritura.flush(revision);
    http.verify();
  });
});

describe('Bandeja del catedrático', () => {
  const preparar = async () => {
    const usuario = signal<{ id: string; rol: Rol } | null>({ id: 'docente', rol: 'CATEDRATICO' });
    const auth = {
      usuario,
      rol: computed(() => usuario()?.rol ?? null),
      autenticado: computed(() => usuario() !== null),
      hidratarAlArrancar: () => of(undefined),
    };
    const apertura = new Subject<RevisionAbierta>();
    const api = { pendientes: vi.fn(() => of(pagina)), abrir: vi.fn(() => apertura) };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: RevisionApi, useValue: api },
      ],
    });
    const fixture = TestBed.createComponent(BandejaRevision);
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    await fixture.whenStable();
    return { fixture, api, apertura, usuario };
  };

  it('muestra contexto y bloquea doble apertura; recarga tras confirmar el ciclo', async () => {
    const { fixture, api, apertura } = await preparar();
    expect(fixture.nativeElement.textContent).toContain('Ana');
    expect(fixture.nativeElement.textContent).toContain('Puentes');
    fixture.componentInstance.abrir('inspeccion');
    fixture.componentInstance.abrir('inspeccion');
    expect(api.abrir).toHaveBeenCalledTimes(1);
    apertura.next(revision);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Ciclo de revisión abierto');
    expect(api.pendientes).toHaveBeenCalledTimes(2);
  });

  it('reinicia página al filtrar y descarta respuestas de otra identidad', async () => {
    const { fixture, api, apertura, usuario } = await preparar();
    fixture.componentInstance.filtrar({ target: { value: 'EN_REVISION' } } as unknown as Event);
    expect(api.pendientes).toHaveBeenLastCalledWith(0, 'EN_REVISION');
    fixture.componentInstance.abrir('inspeccion');
    usuario.set(null);
    await fixture.whenStable();
    apertura.next(revision);
    expect(fixture.componentInstance.pagina()).toBeNull();
    expect(fixture.componentInstance.abierta()).toBeNull();
  });

  it('no reintenta automáticamente una apertura con conflicto', async () => {
    const { fixture, apertura, api } = await preparar();
    fixture.componentInstance.abrir('inspeccion');
    apertura.error(new HttpErrorResponse({ status: 409 }));
    expect(api.abrir).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.error()).not.toBe('');
    expect(fixture.componentInstance.abriendo()).toBeNull();
  });

  it.each([401, 403])('un %s final limpia datos y redirige sin repetir el POST', async (status) => {
    const { fixture, apertura, api } = await preparar();
    fixture.componentInstance.abrir('inspeccion');
    apertura.error(new HttpErrorResponse({ status }));
    expect(fixture.componentInstance.pagina()).toBeNull();
    expect(TestBed.inject(Router).navigateByUrl).toHaveBeenLastCalledWith(
      status === 401 ? '/login' : '/puentes',
    );
    expect(api.abrir).toHaveBeenCalledTimes(1);
  });

  it('la guardia permite catedrático y deniega estudiante', async () => {
    const { usuario } = await preparar();
    const guard = rolGuard('CATEDRATICO');
    const ejecutar = () => TestBed.runInInjectionContext(() => (guard as () => unknown)());
    expect(await ejecutar()).toBe(true);
    usuario.set({ id: 'estudiante', rol: 'ESTUDIANTE' });
    expect(String(await ejecutar())).toBe('/puentes');
    expect(TestBed.inject(Router)).toBeTruthy();
  });
});
