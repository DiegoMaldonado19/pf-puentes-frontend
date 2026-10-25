import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { v7 } from 'uuid';
import { AccesoLocal } from './acceso-local';
import { BaseLocal } from './base-local';
import { EstadoLocal } from './estado-local';
import { PersistenciaOffline } from './persistencia';

const ana = '019a0000-0000-7000-8000-000000000001';
const bea = '019a0000-0000-7000-8000-000000000002';

describe('EstadoLocal', () => {
  let db: BaseLocal;
  let propietario: string | null;
  let invalidar!: () => void;
  let liberar: () => void;
  let acceso: {
    propietarioActual(): Promise<string | null>;
    consultarPropias<T>(id: string, leer: () => Promise<T>): Promise<T | undefined>;
    alInvalidar(fn: () => void): () => void;
  };

  function configurarAcceso() {
    acceso = {
      propietarioActual: async () => propietario,
      consultarPropias: async (id, leer) => (id === propietario ? leer() : undefined),
      alInvalidar: (fn) => {
        invalidar = fn;
        return liberar;
      },
    };
    TestBed.configureTestingModule({
      providers: [
        EstadoLocal,
        { provide: BaseLocal, useValue: db },
        { provide: AccesoLocal, useValue: acceso },
      ],
    });
  }

  beforeEach(() => {
    propietario = ana;
    liberar = vi.fn();
    db = new BaseLocal(`estado-local-${v7()}`);
  });

  afterEach(async () => {
    TestBed.resetTestingModule();
    await db.delete();
  });

  it('lee solo la cola del propietario habilitado, actualiza al cambiar y conserva los datos', async () => {
    const persistencia = new PersistenciaOffline(db);
    await persistencia.crear(ana, v7(), v7());
    await persistencia.crear(bea, v7(), v7());
    configurarAcceso();
    const estado = TestBed.inject(EstadoLocal);
    await vi.waitFor(() => expect(estado.operaciones()).toHaveLength(1));
    expect(estado.propietario()).toBe(ana);
    const colaAna = await persistencia.operaciones(ana);

    propietario = bea;
    invalidar();
    expect(estado.operaciones()).toEqual([]);
    expect(estado.propietario()).toBeNull();
    await vi.waitFor(() => expect(estado.operaciones()[0]?.propietario_id).toBe(bea));
    expect(await persistencia.operaciones(ana)).toEqual(colaAna);
    expect(await persistencia.operaciones(bea)).toHaveLength(1);
  });

  it('descarta emisiones liveQuery tardías tras revocación y no elimina la cola', async () => {
    const persistencia = new PersistenciaOffline(db);
    const captura = await persistencia.crear(ana, v7(), v7());
    let bloquearLectura = false;
    let liberarLectura!: () => void;
    let iniciarLectura!: () => void;
    let terminarLectura!: () => void;
    const iniciada = new Promise<void>((resolve) => (iniciarLectura = resolve));
    const suspendida = new Promise<void>((resolve) => (liberarLectura = resolve));
    const terminada = new Promise<void>((resolve) => (terminarLectura = resolve));
    const lecturaOriginal = async <T>(id: string, leer: () => Promise<T>): Promise<T> => {
      const resultado = await leer();
      if (bloquearLectura && id === ana && propietario === ana) {
        iniciarLectura();
        await suspendida;
        terminarLectura();
      }
      // Simula un resultado que ya estaba en vuelo cuando cambió la autorización.
      return resultado;
    };
    acceso = {
      propietarioActual: async () => propietario,
      consultarPropias: async <T>(id: string, leer: () => Promise<T>) =>
        id === propietario ? lecturaOriginal(id, leer) : undefined,
      alInvalidar: (fn) => {
        invalidar = fn;
        return liberar;
      },
    };
    TestBed.configureTestingModule({
      providers: [
        EstadoLocal,
        { provide: BaseLocal, useValue: db },
        { provide: AccesoLocal, useValue: acceso },
      ],
    });
    const estado = TestBed.inject(EstadoLocal);
    await vi.waitFor(() => expect(estado.operaciones()).toHaveLength(1));
    bloquearLectura = true;
    await persistencia.editar(ana, captura.id, { tardia: true });
    await iniciada;
    propietario = null;
    invalidar();
    expect(estado.operaciones()).toEqual([]);
    liberarLectura();
    await terminada;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(estado.operaciones()).toEqual([]);
    expect(await persistencia.operaciones(ana)).toHaveLength(2);
  });
});
