/// <reference types="node" />

// Dexie captura los tipos intrínsecos al importar. Alinear Blob con structuredClone
// de Node antes de cargarlo: el Blob de jsdom no soporta ese clonador nativo.
vi.hoisted(() => {
  const { Blob } = process.getBuiltinModule('node:buffer');
  vi.stubGlobal('Blob', Blob);
});
afterAll(() => vi.unstubAllGlobals());

import 'fake-indexeddb/auto';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import Dexie from 'dexie';
import { firstValueFrom } from 'rxjs';
import { v7 } from 'uuid';
import { AuthService } from '../core/auth/auth';
import { AccesoLocal } from './acceso-local';
import { ALMACENES_V1, BaseLocal } from './base-local';
import { EsquemasP4 } from './esquemas-p4';
import { ReferenciaLocal } from './modelos';
import { PersistenciaOffline } from './persistencia';
import { PreparacionLocal, ProveedoresPreparacion, ProgresoPreparacion } from './preparacion';
import { ReferenciaAsignadaP3 } from './referencia-p3';
import { SesionOffline } from './sesion-offline';

Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;
const ana = v7(),
  bea = v7(),
  puente = v7(),
  version = v7(),
  publicacionId = v7();
const fecha = '2026-10-05T00:00:00.000Z';
function referencia(owner = ana): ReferenciaAsignadaP3 {
  return {
    asignaciones: ['curso-a', 'curso-b'].map((curso_id) => ({
      id: v7(),
      curso_id,
      inscripcion_id: v7(),
      estudiante_id: owner,
      puente_id: puente,
      curso_nombre: curso_id,
      puente_codigo: 'P1',
      puente_nombre: 'Puente',
      creado_en: fecha,
    })),
    puentes: [
      {
        id: puente,
        codigo: 'P1',
        nombre: 'Puente',
        ruta: 'RN1',
        departamento: { codigo: '01', nombre: 'Departamento' },
        municipio: { codigo: '0101', nombre: 'Municipio', departamento_codigo: '01' },
        latitud: 14,
        longitud: -91,
        utm: { zona: 15, hemisferio: 'N', este: 1, norte: 1 },
        anio_construccion: null,
        activo: true,
        motivo_baja: null,
        estado_actual: null,
        indice_condicion_actual: null,
        fecha_ultima_inspeccion: null,
        creado_en: fecha,
        actualizado_en: fecha,
      },
    ],
  };
}
function esquema(owner = ana, id = version): ReferenciaLocal {
  return {
    id,
    propietario_id: owner,
    modelo_version: 1,
    preparada_en: fecha,
    datos: { version: id, campos: [{ id: 'opaco' }] },
  };
}

function publicacion(owner = ana, id = publicacionId): ReferenciaLocal {
  return {
    id,
    propietario_id: owner,
    modelo_version: 1,
    preparada_en: fecha,
    datos: { inspeccion_id: id, formulario_version_id: 'version-historica', indice: 10 },
  };
}

describe('preparación completa por propietario', () => {
  let db: BaseLocal, acceso: AccesoLocal, sesion: SesionOffline, auth: AuthService;
  let http: HttpTestingController, proveedores: ProveedoresPreparacion;
  let servicio: PreparacionLocal;
  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    auth = TestBed.inject(AuthService);
    sesion = TestBed.inject(SesionOffline);
    http = TestBed.inject(HttpTestingController);
    db = new BaseLocal(`preparacion-${v7()}`);
    acceso = new AccesoLocal(db, auth, sesion);
    proveedores = {
      referencia: { descargar: vi.fn(async (owner) => referencia(owner)) },
      publicacion: { consultar: vi.fn(async (owner) => publicacion(owner)) },
      esquema: { descargar: vi.fn(async (owner) => esquema(owner)) },
    };
    servicio = new PreparacionLocal(db, acceso, sesion, proveedores);
    await entrar();
  });
  afterEach(async () => {
    acceso.detener();
    await db.delete();
    http.verify();
    TestBed.resetTestingModule();
  });
  function respuesta(id: string) {
    return {
      access_token: 'solo-memoria',
      token_type: 'Bearer',
      expires_in: 900,
      usuario: { id, nombre: 'Estudiante', rol: 'ESTUDIANTE' },
    };
  }
  async function entrar(id = ana) {
    const inicio = firstValueFrom(auth.iniciarSesion('prueba@example.test', 'clave'));
    http.expectOne('/api/v1/auth/login').flush(respuesta(id));
    await inicio;
  }
  async function preparar(owner = ana, progreso?: (p: ProgresoPreparacion) => void) {
    // El coordinador G2 conserva la renovación real fuera de IndexedDB.
    const renovar = vi.spyOn(auth, 'renovar').mockImplementation(() => {
      const observable = AuthService.prototype.renovar.call(auth);
      queueMicrotask(() => http.expectOne('/api/v1/auth/renovar').flush(respuesta(owner)));
      return observable;
    });
    try {
      return await servicio.preparar(owner, progreso);
    } finally {
      renovar.mockRestore();
    }
  }
  it('publica referencia, contextos y esquema exacto, con resultado por proveedor y acceso G2', async () => {
    const progreso: ProgresoPreparacion[] = [];
    const resultado = await preparar(ana, (p) => progreso.push(p));
    expect(resultado.completa).toBe(true);
    expect(resultado.proveedores).toEqual({
      referencia: 'completo',
      publicacion: 'completo',
      esquema: 'completo',
    });
    expect(progreso).toEqual([
      { proveedor: 'referencia', estado: 'descargando' },
      { proveedor: 'referencia', estado: 'completo' },
      { proveedor: 'publicacion', estado: 'descargando' },
      { proveedor: 'publicacion', estado: 'completo' },
      { proveedor: 'esquema', estado: 'descargando' },
      { proveedor: 'esquema', estado: 'completo' },
    ]);
    expect(await acceso.propietarioActual()).toBe(ana);
    const lectura = await servicio.consultar(ana);
    expect(lectura.preparacion?.asignaciones.map((a) => a.curso_id)).toEqual([
      'curso-a',
      'curso-b',
    ]);
    expect(lectura.puentes).toHaveLength(1);
    expect(lectura.esquemas_formulario).toEqual([esquema()]);
    expect(lectura.preparacion?.formulario_version_id).toBe(version);
  });
  it('completa sin publicación previa y conserva el esquema activo independiente', async () => {
    proveedores.publicacion!.consultar = async () => null;
    const resultado = await preparar();
    expect(resultado.completa).toBe(true);
    expect(resultado.proveedores.publicacion).toBe('completo');
    expect(await acceso.propietarioActual()).toBe(ana);
    const lectura = await servicio.consultar(ana);
    expect(lectura.esquemas_formulario).toEqual([esquema()]);
    expect(lectura.preparacion).toMatchObject({
      formulario_version_id: version,
      publicaciones: [{ puente_id: puente, publicacion: null }],
    });
  });
  it('consulta cada puente una vez y conserva publicaciones distintas y todos los contextos', async () => {
    const segundo = v7();
    const datos = referencia();
    datos.puentes.push({ ...datos.puentes[0], id: segundo });
    datos.asignaciones.push({ ...datos.asignaciones[0], id: v7(), puente_id: segundo });
    proveedores.referencia!.descargar = async () => datos;
    const primera = publicacion(ana, v7());
    const segunda = { ...publicacion(ana, v7()), datos: { indice: 20 } };
    const consultar = vi.fn(async (_owner: string, id: string) =>
      id === segundo ? segunda : primera,
    );
    proveedores.publicacion!.consultar = consultar;
    expect((await preparar()).completa).toBe(true);
    const lectura = await servicio.consultar(ana);
    expect(lectura.preparacion).toMatchObject({
      formulario_version_id: version,
      publicaciones: [
        { puente_id: puente, publicacion: primera },
        { puente_id: segundo, publicacion: segunda },
      ],
    });
    expect(lectura.preparacion?.asignaciones).toEqual(datos.asignaciones);
    expect(consultar.mock.calls).toEqual([
      [ana, puente],
      [ana, segundo],
    ]);
  });
  it.each(['ausente', 'sin_esquema', 'fallo', 'no_autorizada'] as const)(
    '%s no sustituye la última completa ni habilita una preparación inicial',
    async (caso) => {
      await preparar();
      const anterior = await servicio.consultar(ana);
      if (caso === 'ausente') proveedores.publicacion = undefined;
      if (caso === 'sin_esquema') proveedores.esquema!.descargar = async () => null;
      if (caso === 'fallo')
        proveedores.referencia!.descargar = async () => {
          throw new Error('parcial');
        };
      if (caso === 'no_autorizada')
        proveedores.publicacion!.consultar = async () => {
          throw new Error('403');
        };
      const resultado = await preparar();
      expect(resultado.completa).toBe(false);
      const estado = {
        ausente: 'ausente',
        sin_esquema: 'sin_esquema',
        fallo: 'fallo',
        no_autorizada: 'fallo',
      }[caso];
      expect(Object.values(resultado.proveedores)).toContain(estado);
      expect(await servicio.consultar(ana)).toEqual(anterior);
      await entrar(bea);
      expect((await preparar(bea)).completa).toBe(false);
      expect(await acceso.propietarioActual()).toBeNull();
      expect(await servicio.consultar(bea)).toEqual({ puentes: [], esquemas_formulario: [] });
    },
  );
  it('un fallo en la publicación del segundo puente conserva la última completa', async () => {
    expect((await preparar()).completa).toBe(true);
    const anterior = await servicio.consultar(ana);
    const segundo = v7();
    const datos = referencia();
    datos.puentes.push({ ...datos.puentes[0], id: segundo });
    datos.asignaciones.push({ ...datos.asignaciones[0], id: v7(), puente_id: segundo });
    proveedores.referencia!.descargar = async () => datos;
    const consultar = vi.fn(async (_owner: string, id: string) => {
      if (id === segundo) throw new Error('503');
      return null;
    });
    proveedores.publicacion!.consultar = consultar;
    const resultado = await preparar();
    expect(resultado.completa).toBe(false);
    expect(resultado.proveedores.publicacion).toBe('fallo');
    expect(consultar.mock.calls).toEqual([
      [ana, puente],
      [ana, segundo],
    ]);
    expect(await servicio.consultar(ana)).toEqual(anterior);
    expect(await acceso.propietarioActual()).toBe(ana);
  });
  it('rechaza publicaciones sin versión o de otro propietario', async () => {
    for (const incorrecta of [publicacion(bea), { ...publicacion(), modelo_version: 0 }]) {
      proveedores.publicacion!.consultar = async () => incorrecta;
      const resultado = await preparar();
      expect(resultado.completa).toBe(false);
      expect(resultado.proveedores.publicacion).toBe('fallo');
      expect(await acceso.propietarioActual()).toBeNull();
    }
  });
  it.each(['referencia', 'publicacion', 'esquema'] as const)(
    'no habilita cuando falta el proveedor %s',
    async (proveedor) => {
      proveedores[proveedor] = undefined;
      const resultado = await preparar();
      expect(resultado.completa).toBe(false);
      expect(resultado.proveedores[proveedor]).toBe('ausente');
      expect(await acceso.propietarioActual()).toBeNull();
      expect(await servicio.consultar(ana)).toEqual({ puentes: [], esquemas_formulario: [] });
    },
  );
  it('descarga y renueva fuera de la transacción IndexedDB', async () => {
    proveedores.referencia!.descargar = async () => {
      expect(Dexie.currentTransaction).toBeNull();
      return referencia();
    };
    proveedores.publicacion!.consultar = async () => {
      expect(Dexie.currentTransaction).toBeNull();
      return publicacion();
    };
    proveedores.esquema!.descargar = async () => {
      expect(Dexie.currentTransaction).toBeNull();
      return esquema();
    };
    const renovar = vi.spyOn(sesion, 'preparar').mockImplementation(async () => {
      expect(Dexie.currentTransaction).toBeNull();
      return true;
    });
    expect((await servicio.preparar(ana)).completa).toBe(true);
    renovar.mockRestore();
  });
  it('rechaza esquema sin id/versionado o de otro dueño', async () => {
    for (const incorrecto of [
      esquema(ana, ''),
      { ...esquema(), modelo_version: 0 },
      esquema(bea),
    ]) {
      proveedores.esquema!.descargar = async () => incorrecto;
      expect((await preparar()).completa).toBe(false);
      expect(await acceso.propietarioActual()).toBeNull();
      expect((await servicio.consultar(ana)).preparacion).toBeUndefined();
    }
  });
  it('permite lista vacía completa sin inventar asignaciones', async () => {
    proveedores.referencia!.descargar = async () => ({ asignaciones: [], puentes: [] });
    expect((await preparar()).completa).toBe(true);
    expect((await servicio.consultar(ana)).preparacion?.asignaciones).toEqual([]);
  });
  it('reabre sin red y aísla al dueño sin usar su UUID para desbloquear', async () => {
    await preparar();
    const anterior = await servicio.consultar(ana);
    acceso.detener();
    db.close();
    await db.open();
    auth.accessToken.set(null);
    auth.usuario.set(null);
    acceso = new AccesoLocal(db, auth, sesion);
    servicio = new PreparacionLocal(db, acceso, sesion, {});
    expect(await servicio.consultar(ana)).toEqual(anterior);
    expect(await servicio.consultar(bea)).toEqual({ puentes: [], esquemas_formulario: [] });
    await entrar(bea);
    expect(await servicio.consultar(ana)).toEqual({ puentes: [], esquemas_formulario: [] });
    http.expectNone('/api/v1/auth/renovar');
  });
  it.each(['cierre', 'cambio'] as const)(
    '%s durante descarga impide publicación tardía',
    async (tipo) => {
      proveedores.publicacion!.consultar = async () => {
        if (tipo === 'cierre') auth.cerrarSesionLocal();
        else await entrar(bea);
        return publicacion();
      };
      expect((await preparar()).completa).toBe(false);
      expect(await acceso.propietarioActual()).toBeNull();
      await entrar();
      expect((await servicio.consultar(ana)).preparacion).toBeUndefined();
    },
  );
  it('revoca en la última lectura y no devuelve un snapshot tardío', async () => {
    await preparar();
    const get = db.preparaciones.get.bind(db.preparaciones);
    vi.spyOn(db.preparaciones, 'get').mockImplementation((id) =>
      get(id).then((dato) => {
        auth.cerrarSesionLocal();
        return dato;
      }),
    );
    expect(await servicio.consultar(ana)).toEqual({ puentes: [], esquemas_formulario: [] });
  });
  it('revierte snapshot y referencias si falla la escritura de habilitación', async () => {
    const put = vi.spyOn(db.acceso_local, 'put').mockRejectedValue(new Error('disco'));
    expect((await preparar()).completa).toBe(false);
    put.mockRestore();
    expect(await acceso.propietarioActual()).toBeNull();
    // Tras habilitar G2 por su API previa, no debe aparecer un snapshot huérfano.
    const renovar = vi.spyOn(sesion, 'preparar').mockResolvedValue(true);
    expect(await acceso.habilitarPreparada(ana)).toBe(true);
    renovar.mockRestore();
    expect((await servicio.consultar(ana)).preparacion).toBeUndefined();
    expect(await db.puentes.count()).toBe(0);
    expect(await db.esquemas_formulario.count()).toBe(0);
  });
  it('conserva la preparación anterior tras un fallo atómico de reemplazo', async () => {
    await preparar();
    const anterior = await servicio.consultar(ana);
    const put = vi.spyOn(db.acceso_local, 'put').mockRejectedValue(new Error('disco'));
    expect((await preparar()).completa).toBe(false);
    put.mockRestore();
    expect(await servicio.consultar(ana)).toEqual(anterior);
    expect(await acceso.propietarioActual()).toBe(ana);
  });
  it('cierre durante la publicación revierte todas las escrituras', async () => {
    const put = db.preparaciones.put.bind(db.preparaciones);
    vi.spyOn(db.preparaciones, 'put').mockImplementation((registro) =>
      put(registro).then((id) => {
        auth.cerrarSesionLocal();
        return id;
      }),
    );
    expect((await preparar()).completa).toBe(false);
    expect(await acceso.propietarioActual()).toBeNull();
    expect(await db.puentes.count()).toBe(0);
    expect(await db.esquemas_formulario.count()).toBe(0);
    expect(await db.preparaciones.count()).toBe(0);
  });
  it('conserva esquemas históricos y no cambia un id ya almacenado', async () => {
    await preparar();
    const local = new PersistenciaOffline(db);
    const captura = await local.crear(ana, puente, version);
    const cola = await local.operaciones(ana);
    proveedores.esquema!.descargar = async () => ({ ...esquema(), datos: { alterado: true } });
    expect((await preparar()).completa).toBe(false);
    expect((await servicio.consultar(ana)).esquemas_formulario).toEqual([esquema()]);
    const nueva = v7();
    proveedores.esquema!.descargar = async (owner) => esquema(owner, nueva);
    expect((await preparar()).completa).toBe(true);
    expect(await db.esquemas_formulario.get([ana, version])).toEqual(esquema());
    expect(await local.inspeccion(ana, captura.id)).toEqual(captura);
    expect(await local.operaciones(ana)).toEqual(cola);
  });
  describe('integración HTTP P4 aislada G9.1', () => {
    const dto = {
      id: version,
      codigo: 'V1.0.0',
      estado: 'ACTIVA',
      esquema: { type: 'object', properties: {}, 'x-unidad': 'm' },
      mapeo: { anterior: { campo: 'nuevo' } },
      publicada_en: fecha,
      creado_en: fecha,
      actualizado_en: fecha,
      metadatos_futuros: { conservar: true },
    };
    beforeEach(() => {
      proveedores.esquema = TestBed.inject(EsquemasP4);
    });
    async function conP4(datos: unknown = dto, status = 200) {
      // Aislar la autorización remota; acceso, commit y lecturas G2 siguen siendo reales.
      const permiso = vi.spyOn(sesion, 'preparar').mockResolvedValue(true);
      const descarga = proveedores.esquema!.descargar.bind(proveedores.esquema);
      const spy = vi.spyOn(proveedores.esquema!, 'descargar').mockImplementation(async (owner) => {
        const pendiente = descarga(owner);
        await Promise.resolve();
        http.expectOne('/api/v1/formularios/activo').flush(datos as object, {
          status,
          statusText: status === 200 ? 'OK' : 'Error',
        });
        return pendiente;
      });
      try {
        return await preparar();
      } finally {
        spy.mockRestore();
        permiso.mockRestore();
      }
    }
    it('publica el DTO íntegro en G3 y reabre sin red con aislamiento', async () => {
      expect((await conP4()).completa).toBe(true);
      const lectura = await servicio.consultar(ana);
      expect(lectura.preparacion?.formulario_version_id).toBe(version);
      expect(lectura.esquemas_formulario).toEqual([
        {
          id: version,
          propietario_id: ana,
          modelo_version: 1,
          preparada_en: expect.any(String),
          datos: dto,
        },
      ]);
      expect(await db.esquemas_formulario.get(['sistema', version])).toBeUndefined();
      acceso.detener();
      db.close();
      await db.open();
      auth.accessToken.set(null);
      auth.usuario.set(null);
      acceso = new AccesoLocal(db, auth, sesion);
      servicio = new PreparacionLocal(db, acceso, sesion, {});
      expect(await servicio.consultar(ana)).toEqual(lectura);
      expect(await servicio.consultar(bea)).toEqual({ puentes: [], esquemas_formulario: [] });
    });
    it.each(['404', 'parcial', 'fallo'] as const)(
      'P4 %s conserva snapshot y cola anteriores',
      async (caso) => {
        expect((await conP4()).completa).toBe(true);
        const anterior = await servicio.consultar(ana);
        const local = new PersistenciaOffline(db);
        const captura = await local.crear(ana, puente, version);
        const cola = await local.operaciones(ana);
        const datos =
          caso === '404'
            ? { type: 'https://sgp.cunoc.usac.edu.gt/errores/formulario-activo-no-encontrado' }
            : caso === 'parcial'
              ? { ...dto, esquema: null }
              : {};
        const resultado = await conP4(datos, caso === '404' ? 404 : caso === 'fallo' ? 503 : 200);
        expect(resultado.completa).toBe(false);
        expect(resultado.proveedores.esquema).toBe(caso === '404' ? 'sin_esquema' : 'fallo');
        expect(await servicio.consultar(ana)).toEqual(anterior);
        expect(await local.inspeccion(ana, captura.id)).toEqual(captura);
        expect(await local.operaciones(ana)).toEqual(cola);
      },
    );
    it('P5 ausente no equivale a ausencia válida de publicación ni sustituye la completa', async () => {
      expect((await conP4()).completa).toBe(true);
      const anterior = await servicio.consultar(ana);
      proveedores.publicacion = undefined;
      const resultado = await preparar();
      expect(resultado.completa).toBe(false);
      expect(resultado.proveedores.publicacion).toBe('ausente');
      expect(await servicio.consultar(ana)).toEqual(anterior);
      http.expectNone('/api/v1/formularios/activo');
    });
  });
  it('migra v3 con capturas, blobs, operaciones y referencias intactos sin acreditar preparación', async () => {
    const local = new PersistenciaOffline(db);
    const captura = await local.crear(ana, puente, version, { opaco: 1 });
    const blob = (texto: string, tipo: string) => new Blob([texto], { type: tipo });
    const foto = await local.foto(
      ana,
      captura.id,
      {
        archivo: blob('foto', 'image/jpeg'),
        miniatura: blob('mini', 'image/jpeg'),
        latitud: null,
        longitud: null,
        capturada_en: fecha,
      },
      'elemento',
    );
    const documento = await local.documento(ana, captura.id, blob('pdf', 'application/pdf'));
    await local.enviar(ana, captura.id);
    await local.guardarReferencias(ana, [], [esquema()]);
    const original = await local.inspeccion(ana, captura.id);
    const cola = await local.operaciones(ana);
    const nombre = `v3-${v7()}`;
    const vieja = new Dexie(nombre);
    vieja.version(3).stores({ ...ALMACENES_V1, bloqueos: 'propietario_id', acceso_local: 'id' });
    await vieja.table('inspecciones').add(original);
    await vieja.table('fotos').add(foto);
    await vieja.table('documentos').add(documento);
    await vieja.table('cola_sync').bulkAdd(cola);
    await vieja.table('esquemas_formulario').add(esquema());
    await vieja.table('acceso_local').put({ id: 'ultima', propietario_id: ana, revocados: [] });
    vieja.close();
    const migrada = new BaseLocal(nombre);
    const permiso = new AccesoLocal(migrada, auth, sesion);
    try {
      const datos = new PersistenciaOffline(migrada);
      expect(await datos.inspeccion(ana, captura.id)).toEqual(original);
      expect(await datos.operaciones(ana)).toEqual(cola);
      const fotoMigrada = await migrada.fotos.get(foto.id);
      const documentoMigrado = await migrada.documentos.get(documento.id);
      expect(fotoMigrada).toEqual(foto);
      expect(documentoMigrado).toEqual(documento);
      expect(await fotoMigrada?.archivo.text()).toBe('foto');
      expect(await fotoMigrada?.miniatura?.text()).toBe('mini');
      expect(await documentoMigrado?.archivo.text()).toBe('pdf');
      expect(await migrada.esquemas_formulario.get([ana, version])).toEqual(esquema());
      expect(await permiso.propietarioActual()).toBe(ana);
      expect(await new PreparacionLocal(migrada, permiso, sesion, {}).consultar(ana)).toEqual({
        puentes: [],
        esquemas_formulario: [],
      });
      expect(migrada.verno).toBe(4);
    } finally {
      permiso.detener();
      await migrada.delete();
    }
  });
});
