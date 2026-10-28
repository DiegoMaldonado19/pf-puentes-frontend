import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, Subject } from 'rxjs';
import { AuthService } from '../../core/auth/auth';
import { DiscusionInspeccion } from './discusion-inspeccion';
import {
  FORO_INSPECCION_API,
  FORO_INSPECCION_MUTACIONES_API,
  ResultadoMutacionForoInspeccion,
} from './puertos';

const id = '019a0000-0000-7000-8000-000000000001';

describe('DiscusionInspeccion', () => {
  async function montar(cerrado = false, conSesion = true) {
    const mutacion = new Subject<ResultadoMutacionForoInspeccion>();
    const crear = vi.fn(() => mutacion);
    const leer = vi.fn(() =>
      of({
        estado: 'PUBLICADA' as const,
        contexto: { inspeccionId: id, puenteId: 'puente', hiloId: 'hilo', cerrado },
        pagina: {
          comentarios: [],
          anclajesDisponibles: [{ elementoRef: 'estribo', etiqueta: 'Estribo' }],
        },
      }),
    );
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ inspeccionId: id })) },
        },
        { provide: AuthService, useValue: { usuario: signal(conSesion ? { id: 'autor' } : null) } },
        { provide: FORO_INSPECCION_API, useValue: { disponible: true, leer } },
        { provide: FORO_INSPECCION_MUTACIONES_API, useValue: { disponible: true, crear } },
      ],
    });
    const fixture = TestBed.createComponent(DiscusionInspeccion);
    await fixture.whenStable();
    return { fixture, crear, leer, mutacion };
  }

  function escribir(elemento: HTMLElement, texto: string) {
    const campo = elemento.querySelector('textarea') as HTMLTextAreaElement;
    campo.value = texto;
    campo.dispatchEvent(new Event('input'));
  }

  it('publica desde el formulario con anclaje opcional y bloquea dobles envíos', async () => {
    const { fixture, crear, leer, mutacion } = await montar();
    const elemento = fixture.nativeElement as HTMLElement;
    escribir(elemento, '  Revisar @docente  ');
    const selector = elemento.querySelector('select') as HTMLSelectElement;
    selector.value = 'estribo';
    selector.dispatchEvent(new Event('change'));
    elemento
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    elemento
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(crear).toHaveBeenCalledTimes(1);
    expect(crear).toHaveBeenCalledWith(id, { texto: 'Revisar @docente', elementoRef: 'estribo' });
    mutacion.next({ estado: 'OK' });
    await fixture.whenStable();
    expect(leer).toHaveBeenCalledTimes(2);
    expect((elemento.querySelector('textarea') as HTMLTextAreaElement).value).toBe('');
  });

  it('conserva el comentario y muestra el error si falla la publicación', async () => {
    const { fixture, mutacion } = await montar();
    const elemento = fixture.nativeElement as HTMLElement;
    escribir(elemento, 'No perder este texto');
    elemento
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    mutacion.next({ estado: 'ERROR', mensaje: 'Sin conexión' });
    await fixture.whenStable();
    expect(elemento.textContent).toContain('Sin conexión');
    expect((elemento.querySelector('textarea') as HTMLTextAreaElement).value).toBe(
      'No perder este texto',
    );
  });

  it.each([
    [true, true],
    [false, false],
  ])('no ofrece escribir con cierre=%s y sesión=%s', async (cerrado, sesion) => {
    const { fixture } = await montar(cerrado, sesion);
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });
});
