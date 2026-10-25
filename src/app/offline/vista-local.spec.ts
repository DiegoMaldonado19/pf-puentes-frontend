import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { routes } from '../app.routes';
import { rutaExigeSesion } from '../core/auth/rutas-sesion';
import { AccesoLocal } from './acceso-local';
import { VistaLocal } from './vista-local';

describe('navegación de acceso local', () => {
  afterEach(() => TestBed.resetTestingModule());
  it('ofrece una ruta separada sin guardia de sesión o rol', () => {
    const ruta = routes.find((r) => r.path === 'offline/local');
    expect(ruta?.loadComponent).toBeDefined();
    expect(ruta?.canActivate).toBeUndefined();
    expect(rutaExigeSesion('/offline/local')).toBe(false);
    expect(rutaExigeSesion('/perfil')).toBe(true);
  });
  it('muestra capturas autorizadas y las retira al invalidar sin esperar otra lectura', async () => {
    let invalidar!: () => void;
    const liberar = vi.fn();
    const acceso = {
      alInvalidar: (fn: () => void) => {
        invalidar = fn;
        return liberar;
      },
      inspecciones: async () => [{ id: 'preparada', respuestas: { dato: 'propio' } }],
    };
    TestBed.configureTestingModule({ providers: [{ provide: AccesoLocal, useValue: acceso }] });
    const fixture = TestBed.createComponent(VistaLocal);
    await vi.waitFor(() => expect(fixture.componentInstance.capturas()).toHaveLength(1));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('propio');
    invalidar();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('propio');
    expect(fixture.nativeElement.textContent).toContain('login online');
    fixture.destroy();
    expect(liberar).toHaveBeenCalledOnce();
  });
});
