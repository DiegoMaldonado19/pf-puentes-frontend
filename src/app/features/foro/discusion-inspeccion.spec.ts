import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, Subject } from 'rxjs';
import { AuthService } from '../../core/auth/auth';
import { DiscusionInspeccion } from './discusion-inspeccion';
import {
  FORO_INSPECCION_API,
  FORO_INSPECCION_MUTACIONES_API,
  MENCIONES_P2,
  ResultadoMutacionForoInspeccion,
  SESION_P2,
} from './puertos';

const id = '019a0000-0000-7000-8000-000000000001';
const persona = '019a0000-0000-7000-8000-000000000002';

describe('DiscusionInspeccion', () => {
  async function montar(
    cerrado = false,
    conSesion = true,
    rol = 'ESTUDIANTE',
    autor = 'autor',
    creadoEn = new Date().toISOString(),
  ) {
    const mutacion = new Subject<ResultadoMutacionForoInspeccion>();
    const crear = vi.fn(() => mutacion);
    const editar = vi.fn(() => mutacion);
    const borrar = vi.fn(() => mutacion);
    const ocultarComentario = vi.fn(() => mutacion);
    const cerrarHilo = vi.fn(() => mutacion);
    const leer = vi.fn(() =>
      of({
        estado: 'PUBLICADA' as const,
        contexto: { inspeccionId: id, puenteId: 'puente', hiloId: 'hilo', cerrado },
        pagina: {
          comentarios: [{ id: 'comentario', autorId: autor, texto: 'Original', creadoEn }],
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
        {
          provide: AuthService,
          useValue: {
            usuario: signal(conSesion ? { id: 'autor' } : null),
            rol: signal(conSesion ? rol : null),
          },
        },
        { provide: FORO_INSPECCION_API, useValue: { disponible: true, leer } },
        {
          provide: FORO_INSPECCION_MUTACIONES_API,
          useValue: { disponible: true, crear, editar, borrar, ocultarComentario, cerrarHilo },
        },
        {
          provide: SESION_P2,
          useValue: {
            disponible: true,
            usuarioId: signal(conSesion ? 'autor' : null),
            roles: signal([]),
          },
        },
        {
          provide: MENCIONES_P2,
          useValue: {
            disponible: true,
            personas: signal([{ id: persona, etiqueta: 'Ana Pérez' }]),
            cargando: signal(false),
            error: signal(null),
            cargar: vi.fn(),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(DiscusionInspeccion);
    await fixture.whenStable();
    return { fixture, crear, leer, mutacion, editar, borrar, ocultarComentario, cerrarHilo };
  }

  function escribir(elemento: HTMLElement, texto: string) {
    const campo = elemento.querySelector('textarea') as HTMLTextAreaElement;
    campo.value = texto;
    campo.dispatchEvent(new Event('input'));
  }

  function pulsar(elemento: HTMLElement, texto: string) {
    const boton = Array.from(elemento.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === texto,
    );
    expect(boton, texto).toBeDefined();
    boton!.click();
  }

  it('edita y elimina desde la discusión de inspección sin navegación genérica', async () => {
    const { fixture, editar, borrar, mutacion, leer } = await montar();
    const elemento = fixture.nativeElement as HTMLElement;
    pulsar(elemento, 'Editar');
    fixture.detectChanges();
    escribir(elemento, 'Corregido');
    pulsar(elemento, 'Guardar cambios');
    expect(editar).toHaveBeenCalledWith(id, 'comentario', 'Corregido');
    mutacion.next({ estado: 'ERROR', mensaje: 'Reintenta' });
    fixture.detectChanges();
    expect((elemento.querySelector('textarea') as HTMLTextAreaElement).value).toBe('Corregido');
    pulsar(elemento, 'Guardar cambios');
    mutacion.next({ estado: 'OK' });
    fixture.detectChanges();
    expect(leer).toHaveBeenCalledTimes(2);
    pulsar(elemento, 'Eliminar');
    expect(borrar).toHaveBeenCalledWith(id, 'comentario');
  });

  it.each(['CATEDRATICO', 'ADMINISTRADOR'])(
    'modera con motivo obligatorio como %s',
    async (rol) => {
      const { fixture, ocultarComentario, cerrarHilo, mutacion } = await montar(
        false,
        true,
        rol,
        'otro',
      );
      const elemento = fixture.nativeElement as HTMLElement;
      expect(elemento.querySelector('select button')).toBeNull();
      pulsar(elemento, 'Ocultar');
      fixture.detectChanges();
      pulsar(elemento, 'Confirmar');
      expect(ocultarComentario).not.toHaveBeenCalled();
      const dialogo = elemento.querySelector('app-dialogo-moderacion') as HTMLElement;
      escribir(dialogo, 'Motivo justificado');
      pulsar(elemento, 'Confirmar');
      expect(ocultarComentario).toHaveBeenCalledWith(id, 'comentario', 'Motivo justificado');
      mutacion.next({ estado: 'OK' });
      fixture.detectChanges();
      pulsar(elemento, 'Cerrar hilo');
      fixture.detectChanges();
      escribir(
        elemento.querySelector('app-dialogo-moderacion') as HTMLElement,
        'Cierre justificado',
      );
      pulsar(elemento, 'Confirmar');
      expect(cerrarHilo).toHaveBeenCalledWith(id, 'Cierre justificado');
    },
  );

  it('respeta autoría, plazo y rol en las acciones visibles', async () => {
    const { fixture } = await montar(false, true, 'ESTUDIANTE', 'otro', '2020-01-01T00:00:00Z');
    const elemento = fixture.nativeElement as HTMLElement;
    const botones = Array.from(elemento.querySelectorAll('button')).map((b) =>
      b.textContent?.trim(),
    );
    expect(botones).not.toContain('Editar');
    expect(botones).not.toContain('Eliminar');
    expect(botones).not.toContain('Ocultar');
    expect(botones).not.toContain('Cerrar hilo');
  });

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
    expect(crear).toHaveBeenCalledWith(id, {
      texto: 'Revisar @docente',
      elementoRef: 'estribo',
      menciones: [],
    });
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

  it('envía las menciones elegidas con el comentario', async () => {
    const { fixture, crear } = await montar();
    const elemento = fixture.nativeElement as HTMLElement;
    escribir(elemento, 'Revisar');
    const busqueda = elemento.querySelector('#menciones-busqueda') as HTMLInputElement;
    busqueda.value = 'ana';
    busqueda.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (elemento.querySelector('#menciones-opciones button') as HTMLButtonElement).click();
    elemento
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(crear).toHaveBeenCalledWith(id, {
      texto: 'Revisar',
      elementoRef: null,
      menciones: [persona],
    });
  });

  it.each([
    [true, true],
    [false, false],
  ])('no ofrece escribir con cierre=%s y sesión=%s', async (cerrado, sesion) => {
    const { fixture } = await montar(cerrado, sesion);
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });
});
