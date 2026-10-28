import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, of, Subject, throwError } from 'rxjs';
import { AuthService } from '../../core/auth/auth';
import { FormularioService } from '../formulario/formulario.service';
import { FormularioVersionDTO } from '../formulario/modelos';
import { InspeccionApi } from './inspeccion-api';
import { InspeccionStore } from './inspeccion-store';
import { ArchivoDTO, InspeccionDTO } from './modelos';

function fotoRemota(id: string): ArchivoDTO {
  return {
    id,
    tipo: 'FOTO',
    elemento_ref: 'estribo',
    latitud: null,
    longitud: null,
    capturada_en: null,
    tamano: 100,
    url: `https://archivos.test/${id}`,
    url_miniatura: `https://archivos.test/${id}-miniatura`,
  };
}

const VERSION: FormularioVersionDTO = {
  id: 'f1',
  codigo: 'V1.0.0',
  estado: 'ACTIVA',
  creado_en: '2026-10-01T00:00:00Z',
  actualizado_en: '2026-10-01T00:00:00Z',
  esquema: {
    title: 'SIECA',
    type: 'object',
    properties: {
      datos_generales: {
        type: 'object',
        properties: { longitud_total: { type: 'number', 'x-permanente': true } },
      },
      subestructura: {
        type: 'object',
        properties: { estribo: { type: 'number', 'x-dano': true, 'x-grupo': 'estribos' } },
      },
    },
  },
};

function inspeccion(cambios: Partial<InspeccionDTO> = {}): InspeccionDTO {
  return {
    id: 'i1',
    puente: { id: 'p1', codigo: 'GT-1', nombre: 'Las Rosas' },
    formulario: { id: 'f1', codigo: 'V1.0.0' },
    estado: 'BORRADOR',
    version: 1,
    fecha_inspeccion: '2026-10-27',
    autor_id: 'autor',
    creado_en: '2026-10-27T12:00:00Z',
    gps_disponible: true,
    superada: false,
    datos: {},
    ...cambios,
  };
}

function error(status: number, tipo: string, errores?: { campo: string; mensaje: string }[]) {
  return new HttpErrorResponse({
    status,
    error: { type: `https://sgp.cunoc.usac.edu.gt/errores/${tipo}`, status, detail: 'd', errores },
  });
}

function baja(): Observable<never> {
  return throwError(() => error(0, 'x'));
}

describe('InspeccionStore', () => {
  const api = {
    detalle: vi.fn(),
    archivos: vi.fn(),
    guardarAvance: vi.fn(),
    confirmarPermanentes: vi.fn(),
    reemplazarAcompanantes: vi.fn(),
    enviar: vi.fn(),
    eliminar: vi.fn(),
    subirFoto: vi.fn(),
    subirDocumento: vi.fn(),
    eliminarArchivo: vi.fn(),
  };
  const usuario = signal<{ id: string; nombre: string; rol: string } | null>({
    id: 'autor',
    nombre: 'Ana',
    rol: 'ESTUDIANTE',
  });
  let store: InspeccionStore;

  async function iniciar(detalle = inspeccion()): Promise<void> {
    api.detalle.mockReturnValue(of(detalle));
    await store.cargar(detalle.id);
  }

  beforeEach(() => {
    vi.resetAllMocks();
    api.archivos.mockReturnValue(of([]));
    usuario.set({ id: 'autor', nombre: 'Ana', rol: 'ESTUDIANTE' });
    TestBed.configureTestingModule({
      providers: [
        InspeccionStore,
        { provide: InspeccionApi, useValue: api },
        { provide: FormularioService, useValue: { detalle: vi.fn(() => of(VERSION)) } },
        { provide: AuthService, useValue: { usuario } },
      ],
    });
    store = TestBed.inject(InspeccionStore);
  });

  describe('carga y editabilidad', () => {
    it('hidrata fotos y PDF anteriores, cuenta límites y permite borrarlos', async () => {
      api.archivos.mockReturnValue(
        of([
          ...Array.from({ length: 60 }, (_, i) => fotoRemota(`foto-${i}`)),
          { ...fotoRemota('pdf'), tipo: 'DOCUMENTO', url_miniatura: null, url: null },
        ]),
      );
      await iniciar();
      expect(api.archivos).toHaveBeenCalledWith('i1');
      expect(store.fotosSubidas()).toBe(60);
      expect(store.documentosSubidos()).toBe(1);
      expect(store.fotosSuficientes()).toBe(true);
      expect(store.puedeAgregarFoto()).toBe(false);
      expect(store.archivos()[0]).toMatchObject({
        estado: 'subida',
        miniaturaUrl: 'https://archivos.test/foto-0-miniatura',
        url: 'https://archivos.test/foto-0',
      });
      api.eliminarArchivo.mockReturnValue(of(undefined));
      await store.eliminarArchivo('foto-0');
      expect(api.eliminarArchivo).toHaveBeenCalledWith(
        'foto-0',
        expect.objectContaining({ clave: expect.any(String) }),
      );
      expect(store.fotosSubidas()).toBe(59);
      expect(store.puedeAgregarFoto()).toBe(true);
    });

    it('recargar reemplaza el inventario remoto sin duplicar archivos', async () => {
      api.archivos.mockReturnValue(of([fotoRemota('f1')]));
      await iniciar();
      await iniciar();
      expect(store.archivos()).toHaveLength(1);
    });

    it('un fallo del inventario es explícito y nunca habilita envío por fotos desconocidas', async () => {
      api.archivos.mockReturnValue(baja());
      await iniciar();
      expect(store.error()).not.toBe('');
      expect(store.fotosSuficientes()).toBe(false);
    });
    it('pinta la inspección con su versión de formulario congelada, no con la activa', async () => {
      await iniciar();
      const formularios = TestBed.inject(FormularioService) as unknown as {
        detalle: ReturnType<typeof vi.fn>;
      };
      expect(formularios.detalle).toHaveBeenCalledWith('f1');
      expect(store.version()?.codigo).toBe('V1.0.0');
      expect(store.editable()).toBe(true);
    });

    it('un borrador ajeno se ve en solo lectura (el catedrático no edita el de su estudiante)', async () => {
      usuario.set({ id: 'catedratico', nombre: 'Luis', rol: 'CATEDRATICO' });
      await iniciar();
      expect(store.editable()).toBe(false);
      store.alCambiarDatos({ a: 1 });
      expect(store.sucio()).toBe(false);
    });

    it.each(['ENVIADA', 'PUBLICADA', 'RECHAZADA'] as const)(
      'no es editable en %s',
      async (estado) => {
        await iniciar(inspeccion({ estado }));
        expect(store.editable()).toBe(false);
      },
    );

    it('un 404 queda como «no encontrada» sin filtrar detalles', async () => {
      api.detalle.mockReturnValue(throwError(() => error(404, 'inspeccion-no-encontrada')));
      await store.cargar('ajena');
      expect(store.noEncontrada()).toBe(true);
      expect(store.inspeccion()).toBeNull();
    });
  });

  describe('guardado parcial', () => {
    beforeEach(async () => {
      vi.useFakeTimers();
      await iniciar();
    });
    afterEach(() => vi.useRealTimers());

    it('PUT A no limpia B y espera a que el segundo PUT guarde la última edición', async () => {
      const a = new Subject<InspeccionDTO>();
      const b = new Subject<InspeccionDTO>();
      api.guardarAvance.mockReturnValueOnce(a).mockReturnValueOnce(b);
      store.alCambiarDatos({ texto: 'A' });
      const guardado = store.guardar();
      store.alCambiarDatos({ texto: 'B' });
      a.next(inspeccion({ version: 2, datos: { texto: 'A' } }));
      await vi.advanceTimersByTimeAsync(0);
      expect(store.sucio()).toBe(true);
      expect(api.guardarAvance.mock.calls[1][1]).toEqual({ datos: { texto: 'B' }, version: 2 });
      b.next(inspeccion({ version: 3, datos: { texto: 'B' } }));
      expect(await guardado).toBe(true);
      expect(store.sucio()).toBe(false);
    });

    it('guardar para salir durante A no permite salir si falla el guardado de B', async () => {
      const a = new Subject<InspeccionDTO>();
      api.guardarAvance.mockReturnValueOnce(a).mockReturnValueOnce(baja());
      store.alCambiarDatos({ texto: 'A' });
      const autoguardado = store.guardar();
      store.alCambiarDatos({ texto: 'B' });
      const salida = store.guardar();
      a.next(inspeccion({ version: 2 }));
      await vi.advanceTimersByTimeAsync(60);
      expect(await autoguardado).toBe(false);
      expect(await salida).toBe(false);
      expect(store.sucio()).toBe(true);
    });

    it('envía solo lo respondido y toma la nueva versión de la respuesta, sin incrementarla a mano', async () => {
      api.guardarAvance.mockReturnValue(of(inspeccion({ version: 7 })));
      store.alCambiarDatos({ datos_generales: { longitud_total: 12, nota: null }, vacio: null });
      expect(store.sucio()).toBe(true);
      expect(await store.guardar()).toBe(true);
      const [id, cuerpo, opciones] = api.guardarAvance.mock.calls[0];
      expect(id).toBe('i1');
      expect(cuerpo).toEqual({ datos: { datos_generales: { longitud_total: 12 } }, version: 1 });
      expect(opciones.clave).toBeTruthy();
      expect(store.inspeccion()?.version).toBe(7);
      expect(store.sucio()).toBe(false);
    });

    it('el autoguardado se dispara solo tras la pausa y nunca envía la inspección', async () => {
      api.guardarAvance.mockReturnValue(of(inspeccion({ version: 2 })));
      store.alCambiarDatos({ a: 1 });
      expect(api.guardarAvance).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1600);
      expect(api.guardarAvance).toHaveBeenCalledTimes(1);
      expect(api.enviar).not.toHaveBeenCalled();
    });

    it('reintentar el mismo cuerpo tras un corte de red reutiliza la Idempotency-Key', async () => {
      api.guardarAvance
        .mockReturnValueOnce(baja())
        .mockReturnValueOnce(of(inspeccion({ version: 2 })));
      store.alCambiarDatos({ a: 1 });
      expect(await store.guardar()).toBe(false);
      expect(await store.guardar()).toBe(true);
      const [primera, segunda] = api.guardarAvance.mock.calls;
      expect(segunda[2].clave).toBe(primera[2].clave);
    });

    it('un cuerpo distinto lleva una clave nueva', async () => {
      api.guardarAvance.mockReturnValue(baja());
      store.alCambiarDatos({ a: 1 });
      await store.guardar();
      store.alCambiarDatos({ a: 2 });
      await store.guardar();
      const [primera, segunda] = api.guardarAvance.mock.calls;
      expect(segunda[2].clave).not.toBe(primera[2].clave);
    });

    it('los errores 422 por campo quedan para el motor', async () => {
      api.guardarAvance.mockReturnValue(
        throwError(() =>
          error(422, 'datos-invalidos', [{ campo: 'subestructura.estribo', mensaje: 'Máximo 4.' }]),
        ),
      );
      store.alCambiarDatos({ subestructura: { estribo: 9 } });
      expect(await store.guardar()).toBe(false);
      expect(store.erroresMotor()).toEqual({ 'subestructura.estribo': 'Máximo 4.' });
    });

    it('envía los grupos sanos y, si el servidor aún no los conoce, reintenta sin la marca', async () => {
      api.guardarAvance
        .mockReturnValueOnce(throwError(() => error(422, 'grupo-con-danos')))
        .mockReturnValueOnce(of(inspeccion({ version: 2 })));
      store.alMarcarGrupoSano('estribos');
      store.alCambiarDatos({ subestructura: { estribo: 0 } });
      expect(await store.guardar()).toBe(true);
      expect(api.guardarAvance.mock.calls[0][1].grupos_sin_danos).toEqual(['estribos']);
      expect(api.guardarAvance.mock.calls[1][1].grupos_sin_danos).toBeUndefined();
    });

    it('409 version-desactualizada no pisa en silencio: ofrece conservar lo mío o el servidor', async () => {
      api.guardarAvance.mockReturnValueOnce(throwError(() => error(409, 'version-desactualizada')));
      api.detalle.mockReturnValue(of(inspeccion({ version: 5 })));
      store.alCambiarDatos({ a: 1 });
      expect(await store.guardar()).toBe(false);
      expect(store.conflicto()?.version).toBe(5);
      expect(await store.guardar()).toBe(false);

      api.guardarAvance.mockReturnValueOnce(of(inspeccion({ version: 6 })));
      await store.resolverConflicto(true);
      expect(api.guardarAvance.mock.calls.at(-1)?.[1].version).toBe(5);
      expect(store.conflicto()).toBeNull();
    });

    it('409 inspeccion-no-editable recarga el detalle y pasa a solo lectura', async () => {
      api.guardarAvance.mockReturnValue(throwError(() => error(409, 'inspeccion-no-editable')));
      api.detalle.mockReturnValue(of(inspeccion({ estado: 'ENVIADA' })));
      store.alCambiarDatos({ a: 1 });
      await store.guardar();
      expect(store.editable()).toBe(false);
    });
  });

  describe('datos permanentes y envío', () => {
    function cargarFotos(): void {
      store.archivos.set(
        Array.from({ length: 4 }, (_, i) => ({
          id: `f-${i}`,
          tipo: 'FOTO',
          nombre: `Foto ${i}`,
          miniaturaUrl: null,
          elemento_ref: null,
          estado: 'subida',
          mensaje: '',
        })),
      );
    }
    beforeEach(async () => {
      await iniciar();
    });

    it('confirma solo los campos permanentes, nunca un daño (RN-INS-10)', async () => {
      api.confirmarPermanentes.mockReturnValue(
        of(inspeccion({ datos_permanentes_confirmados_en: '2026-10-27T13:00:00Z' })),
      );
      const confirmado = await store.confirmarPermanentes({
        datos_generales: { longitud_total: 30 },
        subestructura: { estribo: 3 },
      });
      expect(confirmado).toBe(true);
      expect(api.confirmarPermanentes.mock.calls[0][1]).toEqual({
        datos: { datos_generales: { longitud_total: 30 } },
      });
      expect(store.permanentesConfirmados()).toBe(true);
    });

    it('no se puede enviar sin confirmar los permanentes', async () => {
      cargarFotos();
      expect(store.puedeEnviar()).toBe(false);
      expect(await store.enviar()).toBe(false);
      expect(api.enviar).not.toHaveBeenCalled();
    });

    it('no se puede enviar sin al menos 4 fotos reales de esta sesión o anteriores', async () => {
      api.confirmarPermanentes.mockReturnValue(
        of(inspeccion({ datos_permanentes_confirmados_en: '2026-10-27T13:00:00Z' })),
      );
      await store.confirmarPermanentes({});
      expect(store.puedeEnviar()).toBe(false);
      cargarFotos();
      expect(store.puedeEnviar()).toBe(true);
    });

    it('envía con la hora del dispositivo y adopta el estado que responde el servidor', async () => {
      api.confirmarPermanentes.mockReturnValue(
        of(inspeccion({ datos_permanentes_confirmados_en: '2026-10-27T13:00:00Z' })),
      );
      await store.confirmarPermanentes({});
      cargarFotos();
      api.enviar.mockReturnValue(
        of(inspeccion({ estado: 'ENVIADA', datos_permanentes_confirmados_en: 'x', version: 3 })),
      );
      expect(await store.enviar()).toBe(true);
      expect(api.enviar.mock.calls[0][1].enviada_en).toMatch(/Z$/);
      expect(store.inspeccion()?.estado).toBe('ENVIADA');
      expect(store.editable()).toBe(false);
    });

    it('un 422 muestra todos los errores juntos y el reintento usa una clave nueva', async () => {
      api.confirmarPermanentes.mockReturnValue(
        of(inspeccion({ datos_permanentes_confirmados_en: '2026-10-27T13:00:00Z' })),
      );
      await store.confirmarPermanentes({});
      cargarFotos();
      api.enviar.mockReturnValue(
        throwError(() =>
          error(422, 'inspeccion-no-publicable', [
            { campo: 'subestructura.estribo', mensaje: 'Obligatorio.' },
            { campo: 'fotos', mensaje: 'Faltan fotos.' },
          ]),
        ),
      );
      expect(await store.enviar()).toBe(false);
      expect(store.errores()).toHaveLength(2);
      expect(store.inspeccion()?.estado).toBe('BORRADOR');
      await store.enviar();
      const [primera, segunda] = api.enviar.mock.calls;
      expect(segunda[2].clave).not.toBe(primera[2].clave);
    });

    it('si el envío falla por red se reintenta con la misma clave', async () => {
      api.confirmarPermanentes.mockReturnValue(
        of(inspeccion({ datos_permanentes_confirmados_en: '2026-10-27T13:00:00Z' })),
      );
      await store.confirmarPermanentes({});
      cargarFotos();
      api.enviar
        .mockReturnValueOnce(baja())
        .mockReturnValueOnce(of(inspeccion({ estado: 'ENVIADA' })));
      await store.enviar();
      await store.enviar();
      expect(api.enviar.mock.calls[1][2].clave).toBe(api.enviar.mock.calls[0][2].clave);
      expect(api.enviar.mock.calls[1][1]).toBe(api.enviar.mock.calls[0][1]);
      expect(api.enviar.mock.calls[1][1].enviada_en).toBe(api.enviar.mock.calls[0][1].enviada_en);
    });
  });

  describe('baja y acompañantes', () => {
    beforeEach(async () => {
      await iniciar();
    });

    it('un segundo borrado (404) cuenta como éxito', async () => {
      api.eliminar.mockReturnValue(throwError(() => error(404, 'inspeccion-no-encontrada')));
      expect(await store.eliminarBorrador()).toBe(true);
    });

    it('un borrado rechazado deja el mensaje y no sale', async () => {
      api.eliminar.mockReturnValue(throwError(() => error(409, 'inspeccion-no-editable')));
      expect(await store.eliminarBorrador()).toBe(false);
      expect(store.error()).not.toBe('');
    });

    it('descarta los nombres en blanco y manda la lista completa', async () => {
      api.reemplazarAcompanantes.mockReturnValue(of(inspeccion({ version: 2 })));
      store.agregarAcompanante();
      store.cambiarAcompanante(0, '  Pedro  ');
      store.agregarAcompanante();
      await store.guardarAcompanantes();
      expect(api.reemplazarAcompanantes.mock.calls[0][1]).toEqual([
        { nombre: 'Pedro', usuario_id: null },
      ]);
    });
  });
});
