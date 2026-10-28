import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { TEXTOS } from '../../shared/textos';
import { ForoService } from './foro.service';
import { ForoLecturaService } from './foro-lectura.service';
import { Comentario, Hilo } from './modelos';
import { ListadoHilos } from './listado-hilos';
import { DetalleHilo } from './detalle-hilo';
import { MENCIONES_P2, SESION_P2 } from './puertos';

describe('ForoService', () => {
  const usuarioId = '00000000-0000-4000-8000-000000000001';
  let servicio: ForoService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(ForoService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('no envía escrituras sin sesión', async () => {
    expect(
      await servicio.crearHilo('puente-prueba', {
        titulo: 'Consulta ficticia',
        categoria: 'consulta',
      }),
    ).toBeNull();
    http.expectNone(() => true);
  });

  it('habilita moderación solo para los roles autorizados', () => {
    servicio.establecerUsuario(usuarioId, ['ESTUDIANTE']);
    expect(servicio.puedeModerar()).toBe(false);
    servicio.establecerUsuario(usuarioId, ['CATEDRATICO']);
    expect(servicio.puedeModerar()).toBe(true);
    servicio.establecerUsuario(null, ['ADMINISTRADOR']);
    expect(servicio.puedeModerar()).toBe(false);
  });

  it('evita duplicar una publicación mientras está en curso', async () => {
    servicio.establecerUsuario(usuarioId);
    const entrada = { titulo: 'Consulta ficticia', categoria: 'consulta' } as const;
    const pendiente = servicio.crearHilo('puente-prueba', entrada);
    const peticion = http.expectOne('/api/v1/puentes/puente-prueba/hilos');
    expect(servicio.creandoHilo()).toBe(true);
    expect(await servicio.crearHilo('puente-prueba', entrada)).toBeNull();
    http.expectNone(() => true);
    peticion.flush({ id: 'hilo-prueba', ...entrada });
    expect((await pendiente)?.id).toBe('hilo-prueba');
    expect(servicio.creandoHilo()).toBe(false);
  });

  it('cancela una publicación cuando se cierra la sesión', async () => {
    servicio.establecerUsuario(usuarioId);
    const pendiente = servicio.crearHilo('puente-prueba', {
      titulo: 'Consulta ficticia',
      categoria: 'consulta',
    });
    const peticion = http.expectOne('/api/v1/puentes/puente-prueba/hilos');
    servicio.establecerUsuario(null);
    expect(peticion.cancelled).toBe(true);
    expect(await pendiente).toBeNull();
    expect(servicio.creandoHilo()).toBe(false);
    expect(servicio.escriturasEnCurso().size).toBe(0);
  });

  it('invalida la sesión ante una escritura no autorizada', async () => {
    servicio.establecerUsuario(usuarioId);
    const pendiente = servicio.crearHilo('puente-prueba', {
      titulo: 'Consulta ficticia',
      categoria: 'consulta',
    });
    http
      .expectOne('/api/v1/puentes/puente-prueba/hilos')
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(await pendiente).toBeNull();
    expect(servicio.sesionActiva()).toBe(false);
    expect(servicio.errorEscritura()).toBe(TEXTOS.foro.sesionInvalida);
  });

  describe('participación y moderación', () => {
    const hilo: Hilo = {
      id: 'hilo-prueba',
      puente_id: 'puente-prueba',
      titulo: 'Consulta ficticia',
      categoria: 'consulta',
      autor_id: usuarioId,
      autor_nombre: 'Persona de prueba',
      creado_en: '2020-01-01T12:00:00Z',
      cerrado: false,
    };
    const comentario: Comentario = {
      id: 'comentario-prueba',
      hilo_id: hilo.id,
      autor_id: usuarioId,
      autor_nombre: 'Persona de prueba',
      texto: 'Comentario original',
      creado_en: '2020-01-01T12:00:00Z',
      padre_id: null,
      eliminado: false,
    };

    beforeEach(() => {
      const lectura = TestBed.inject(ForoLecturaService);
      lectura.cargarHilo(hilo.id, hilo.puente_id);
      http.expectOne(`/api/v1/hilos/${hilo.id}`).flush(hilo);
      lectura.cargarComentarios(hilo.id);
      http
        .expectOne((r) => r.url === `/api/v1/hilos/${hilo.id}/comentarios`)
        .flush({
          contenido: [comentario],
          pagina: 0,
          tamano: 50,
          total_elementos: 1,
          total_paginas: 1,
        });
    });

    it('no permite comentar ni responder en un hilo cerrado', async () => {
      servicio.establecerUsuario(usuarioId, ['ESTUDIANTE']);
      TestBed.inject(ForoLecturaService).hilo.set({ ...hilo, cerrado: true });
      expect(await servicio.comentar(hilo.id, 'Comentario ficticio')).toBeNull();
      expect(await servicio.responder(hilo.id, comentario.id, 'Respuesta ficticia')).toBeNull();
      http.expectNone(() => true);
    });

    it.each([null, 'ESTUDIANTE'])('impide moderar sin autorización: %s', async (rol) => {
      servicio.establecerUsuario(rol ? usuarioId : null, rol ? [rol] : []);
      expect(await servicio.ocultarComentario(comentario.id, 'Motivo de prueba')).toBe(false);
      expect(await servicio.cerrarHilo(hilo.id, 'Motivo de prueba')).toBe(false);
      http.expectNone(() => true);
    });

    it('exige un motivo aunque el usuario sea administrador', async () => {
      servicio.establecerUsuario(usuarioId, ['ADMINISTRADOR']);
      expect(await servicio.ocultarComentario(comentario.id, '   ')).toBe(false);
      expect(await servicio.cerrarHilo(hilo.id, '   ')).toBe(false);
      http.expectNone(() => true);
    });

    it('muestra el rechazo de edición vencida y recupera el comentario del servidor', async () => {
      servicio.establecerUsuario(usuarioId);
      const pendiente = servicio.editar(comentario.id, 'Edición ficticia');
      http.expectOne(`/api/v1/comentarios/${comentario.id}`).flush(null, {
        status: 409,
        statusText: 'Conflict',
      });
      expect(await pendiente).toBe(false);
      expect(servicio.errorEscritura()).toBe(TEXTOS.foro.edicionVencida);
      http
        .expectOne((r) => r.url === `/api/v1/hilos/${hilo.id}/comentarios`)
        .flush({
          contenido: [comentario],
          pagina: 0,
          tamano: 50,
          total_elementos: 1,
          total_paginas: 1,
        });
      expect(TestBed.inject(ForoLecturaService).comentarios()[0].texto).toBe('Comentario original');
      expect(servicio.escriturasEnCurso().size).toBe(0);
    });
  });
});

describe('Interfaz del foro', () => {
  const puenteId = '00000000-0000-4000-8000-000000000002';
  const hiloId = '00000000-0000-4000-8000-000000000003';
  const autorId = '00000000-0000-4000-8000-000000000004';
  const personaId = '00000000-0000-4000-8000-000000000005';
  const hilo: Hilo = {
    id: hiloId,
    puente_id: puenteId,
    titulo: 'Consulta ficticia',
    categoria: 'consulta',
    autor_id: autorId,
    autor_nombre: 'María de prueba',
    creado_en: '2020-01-01T12:00:00Z',
    cerrado: false,
  };
  const comentario: Comentario = {
    id: 'comentario-prueba',
    hilo_id: hiloId,
    autor_id: autorId,
    autor_nombre: 'Lucía de prueba',
    texto: 'Comentario ficticio',
    creado_en: '2020-01-01T12:00:00Z',
    padre_id: null,
    eliminado: false,
  };
  let http: HttpTestingController;

  beforeEach(() => {
    const parametros = convertToParamMap({ puenteId, hiloId });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(parametros), snapshot: { paramMap: parametros } },
        },
        {
          provide: SESION_P2,
          useValue: { disponible: true, usuarioId: signal(autorId), roles: signal(['ESTUDIANTE']) },
        },
        {
          provide: MENCIONES_P2,
          useValue: {
            disponible: true,
            personas: signal([{ id: personaId, etiqueta: 'Ana Pérez' }]),
            cargando: signal(false),
            error: signal(null),
            cargar: vi.fn(),
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(ForoService).establecerUsuario(autorId, ['ESTUDIANTE']);
  });

  afterEach(() => http.verify());

  function pulsar(html: HTMLElement, texto: string): void {
    const boton = [...html.querySelectorAll('button')].find((b) => b.textContent?.trim() === texto);
    expect(boton, `Botón: ${texto}`).toBeDefined();
    boton!.click();
  }

  function prepararDialogo(html: HTMLElement): HTMLDialogElement {
    const dialogo = html.querySelector('dialog')!;
    expect(dialogo).not.toBeNull();
    dialogo.showModal = vi.fn(() => dialogo.setAttribute('open', ''));
    dialogo.close = vi.fn(() => dialogo.removeAttribute('open'));
    return dialogo;
  }

  it('muestra el nombre del autor y permite abrir y cancelar la creación de un hilo', async () => {
    const fixture = TestBed.createComponent(ListadoHilos);
    await fixture.whenStable();
    http
      .expectOne((r) => r.url === `/api/v1/puentes/${puenteId}/hilos`)
      .flush({
        contenido: [hilo],
        pagina: 0,
        tamano: 20,
        total_elementos: 1,
        total_paginas: 1,
      });
    await fixture.whenStable();
    const html = fixture.nativeElement as HTMLElement;
    expect(html.textContent).toContain(hilo.autor_nombre);
    expect(html.textContent).not.toContain(autorId);
    const dialogo = prepararDialogo(html);
    pulsar(html, TEXTOS.foro.crearHilo);
    await fixture.whenStable();
    expect(dialogo.open).toBe(true);
    pulsar(dialogo, TEXTOS.foro.cancelar);
    await fixture.whenStable();
    expect(dialogo.open).toBe(false);
    http.expectNone((r) => r.method !== 'GET');
  });

  it.each(['comentario', 'respuesta'])(
    'muestra nombres y permite abrir y cancelar un modal de %s',
    async (tipo) => {
      const fixture = TestBed.createComponent(DetalleHilo);
      await fixture.whenStable();
      http.expectOne(`/api/v1/hilos/${hiloId}`).flush(hilo);
      http
        .expectOne((r) => r.url === `/api/v1/hilos/${hiloId}/comentarios`)
        .flush({
          contenido: [comentario],
          pagina: 0,
          tamano: 50,
          total_elementos: 1,
          total_paginas: 1,
        });
      await fixture.whenStable();
      const html = fixture.nativeElement as HTMLElement;
      expect(html.textContent).toContain(hilo.autor_nombre);
      expect(html.textContent).toContain(comentario.autor_nombre);
      expect(html.textContent).not.toContain(autorId);
      const dialogo = prepararDialogo(html);
      pulsar(html, tipo === 'respuesta' ? TEXTOS.foro.responder : TEXTOS.foro.comentar);
      if (tipo === 'respuesta') {
        http
          .expectOne((r) => r.url === `/api/v1/comentarios/${comentario.id}/respuestas`)
          .flush({
            contenido: [],
            pagina: 0,
            tamano: 20,
            total_elementos: 0,
            total_paginas: 0,
          });
      }
      await fixture.whenStable();
      expect(dialogo.open).toBe(true);
      pulsar(dialogo, TEXTOS.foro.cancelar);
      await fixture.whenStable();
      expect(dialogo.open).toBe(false);
      http.expectNone((r) => r.method !== 'GET');
    },
  );

  it('envía las menciones elegidas al final del comentario del hilo', async () => {
    const fixture = TestBed.createComponent(DetalleHilo);
    await fixture.whenStable();
    http.expectOne(`/api/v1/hilos/${hiloId}`).flush(hilo);
    http
      .expectOne((r) => r.url === `/api/v1/hilos/${hiloId}/comentarios`)
      .flush({
        contenido: [comentario],
        pagina: 0,
        tamano: 50,
        total_elementos: 1,
        total_paginas: 1,
      });
    await fixture.whenStable();
    const html = fixture.nativeElement as HTMLElement;
    prepararDialogo(html);
    pulsar(html, TEXTOS.foro.comentar);
    const texto = html.querySelector('#participacion-texto') as HTMLTextAreaElement;
    texto.value = 'Revisar';
    texto.dispatchEvent(new Event('input'));
    const busqueda = html.querySelector('#menciones-busqueda') as HTMLInputElement;
    busqueda.value = 'ana';
    busqueda.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (html.querySelector('#menciones-opciones button') as HTMLButtonElement).click();
    html
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const publicado = await vi.waitFor(() =>
      http.expectOne((r) => r.method === 'POST' && r.url === `/api/v1/hilos/${hiloId}/comentarios`),
    );
    expect(publicado.request.body).toEqual({ texto: `Revisar @${personaId}` });
    publicado.flush(comentario);
    await vi.waitFor(() =>
      http
        .expectOne((r) => r.method === 'GET' && r.url === `/api/v1/hilos/${hiloId}/comentarios`)
        .flush({
          contenido: [comentario],
          pagina: 0,
          tamano: 50,
          total_elementos: 1,
          total_paginas: 1,
        }),
    );
  });
});
