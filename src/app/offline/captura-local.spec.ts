import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { v7 } from 'uuid';
import { AccesoLocal } from './acceso-local';
import { BaseLocal } from './base-local';
import { CapturaLocal } from './captura-local';
import { PersistenciaOffline } from './persistencia';
import { Json } from './modelos';

describe('CapturaLocal', () => {
  let db: BaseLocal, local: PersistenciaOffline, id: string;
  const propietario = v7(),
    ajeno = v7(),
    formulario = v7();
  let habilitado: string | null;
  let invalidar: () => void;
  const esquema = {
    title: 'SIECA de prueba',
    type: 'object',
    properties: {
      identificacion: {
        type: 'object',
        title: 'Identificación',
        properties: { nombre: { type: 'string', title: 'Nombre', 'x-permanente': true } },
      },
      datos_generales: {
        type: 'object',
        title: 'Datos generales',
        required: ['inspector'],
        properties: { inspector: { type: 'string', title: 'Inspector' } },
      },
      estructura: {
        type: 'object',
        title: 'Estructura',
        properties: {
          dano: {
            type: 'integer',
            title: 'Daño',
            'x-dano': true,
            'x-grupo': 'estructura',
            'x-elemento-ref': 'estructura.dano',
            minimum: 0,
            maximum: 5,
          },
        },
      },
    },
  };
  const foto = () => ({
    archivo: new Blob(['foto'], { type: 'image/webp' }),
    miniatura: new Blob(['mini'], { type: 'image/webp' }),
    latitud: 14.6,
    longitud: -90.5,
    capturada_en: '2026-10-28T15:00:00Z',
  });
  let crearUrl: PropertyDescriptor | undefined, revocarUrl: PropertyDescriptor | undefined;

  beforeEach(async () => {
    db = new BaseLocal(`captura-${v7()}`);
    local = new PersistenciaOffline(db);
    habilitado = propietario;
    crearUrl = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
    revocarUrl = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:foto'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    id = (
      await local.crear(
        propietario,
        v7(),
        formulario,
        { identificacion: { nombre: 'Puente' } },
        {
          asignacion_id: v7(),
          curso_id: v7(),
          fecha_inspeccion: '2026-10-28',
        },
      )
    ).id;
    await db.esquemas_formulario.put({
      id: formulario,
      propietario_id: propietario,
      modelo_version: 1,
      preparada_en: new Date().toISOString(),
      datos: { esquema } as Json,
    });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: BaseLocal, useValue: db },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map([['id', id]]) } } },
        {
          provide: AccesoLocal,
          useValue: {
            propietarioActual: async () => habilitado,
            consultarPropias: async <T>(p: string, leer: () => Promise<T>) =>
              p === habilitado ? leer() : undefined,
            alInvalidar: (fn: () => void) => {
              invalidar = fn;
              return vi.fn();
            },
          },
        },
      ],
    });
  });
  afterEach(async () => {
    TestBed.resetTestingModule();
    await db.delete();
    if (crearUrl) Object.defineProperty(URL, 'createObjectURL', crearUrl);
    else Reflect.deleteProperty(URL, 'createObjectURL');
    if (revocarUrl) Object.defineProperty(URL, 'revokeObjectURL', revocarUrl);
    else Reflect.deleteProperty(URL, 'revokeObjectURL');
  });
  async function abrir() {
    const fixture = TestBed.createComponent(CapturaLocal);
    await vi.waitFor(() => expect(fixture.componentInstance.inspeccion()?.id).toBe(id));
    fixture.detectChanges();
    return fixture;
  }

  it('conserva edición sucia ante otra pestaña y muestra conflicto sin sobrescribir', async () => {
    const fixture = await abrir();
    const editor = fixture.componentInstance;
    editor.cambiarPermanentes({ identificacion: { nombre: 'Mi edición' } });
    const i = await local.inspeccion(propietario, id);
    await local.editar(
      propietario,
      id,
      { identificacion: { nombre: 'Otra pestaña' } },
      i.version_local,
    );
    await vi.waitFor(() => expect(editor.inspeccion()?.version_local).toBe(2));
    expect(await editor.guardar()).toBe(false);
    expect(editor.error()).toContain('Otra pestaña');
    expect(editor.respuestas()).toMatchObject({ identificacion: { nombre: 'Mi edición' } });
    expect((await local.inspeccion(propietario, id)).respuestas).toEqual({
      identificacion: { nombre: 'Otra pestaña' },
    });
  });

  it('hidrata cambios de otra pestaña cuando el editor está limpio', async () => {
    const fixture = await abrir();
    const i = await local.inspeccion(propietario, id);
    await local.editar(
      propietario,
      id,
      { identificacion: { nombre: 'Actualizado' } },
      i.version_local,
    );
    await vi.waitFor(() =>
      expect(fixture.componentInstance.respuestas()).toEqual({
        identificacion: { nombre: 'Actualizado' },
      }),
    );
    fixture.componentInstance.cambiarPermanentes({ identificacion: { nombre: 'Siguiente' } });
    expect(await fixture.componentInstance.guardar()).toBe(true);
  });

  it('ofrece retirar PDF rechazado aunque el envío bloquee el editor y lo habilita para corregir', async () => {
    const fixture = await abrir();
    const editor = fixture.componentInstance;
    await editor.confirmar();
    const pdf = await local.documento(
      propietario,
      id,
      new Blob(['pdf'], { type: 'application/pdf' }),
    );
    await local.enviar(propietario, id);
    const op = (await local.operaciones(propietario, id)).find((o) => o.entidad_id === pdf.id)!;
    await db.cola_sync.update(op.id, { estado: 'requiere_intervencion' });
    await vi.waitFor(() => expect(editor.rechazados()).toContain(pdf.id));
    fixture.detectChanges();
    expect(editor.bloqueada()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Retirar PDF rechazado para corregir');
    expect(await editor.retirarArchivo(pdf.id)).toBe(true);
    expect(editor.bloqueada()).toBe(false);
    expect(await db.documentos.count()).toBe(0);
  });

  it('bloquea el formulario hasta confirmar y guarda solo permanentes en metadatos con su cola atómica', async () => {
    const fixture = await abrir();
    const editor = fixture.componentInstance;
    expect(fixture.nativeElement.textContent).not.toContain('Formulario SIECA');
    editor.cambiarPermanentes({ identificacion: { nombre: 'Revisado' } });
    expect(await editor.confirmar()).toBe(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Formulario SIECA');
    const guardada = await local.inspeccion(propietario, id);
    expect(guardada.metadatos).toMatchObject({
      fecha_inspeccion: '2026-10-28',
      permanentes: { identificacion: { nombre: 'Revisado' } },
      permanentes_confirmados_en: expect.any(String),
    });
    const operaciones = await local.operaciones(propietario, id);
    expect(operaciones).toHaveLength(2);
    expect(operaciones[1].payload).toMatchObject({ metadatos: guardada.metadatos });
  });

  it('poda vacíos, conserva ceros y nunca encola grupos_sin_danos aunque luego cambie el daño', async () => {
    const fixture = await abrir();
    const editor = fixture.componentInstance;
    await editor.confirmar();
    editor.cambiar({ estructura: { dano: 0 }, vacio: '', nulo: null });
    expect(await editor.guardar()).toBe(true);
    editor.cambiar({ estructura: { dano: 2 } });
    expect(await editor.puedeSalir()).toBe(true);
    const operaciones = await local.operaciones(propietario, id);
    expect(operaciones.at(-2)?.payload).toMatchObject({ respuestas: { estructura: { dano: 0 } } });
    expect(operaciones.at(-1)?.payload).toMatchObject({ respuestas: { estructura: { dano: 2 } } });
    expect(JSON.stringify(operaciones)).not.toContain('grupos_sin_danos');
    expect((await local.inspeccion(propietario, id)).respuestas).toEqual({
      estructura: { dano: 2 },
    });
  });

  it('autoguarda con espera corta y guarda también al salir sin duplicar la misma respuesta', async () => {
    const fixture = await abrir();
    const editor = fixture.componentInstance;
    editor.cambiarPermanentes({ identificacion: { nombre: 'Autoguardado' } });
    await vi.waitFor(async () =>
      expect((await local.inspeccion(propietario, id)).respuestas).toEqual({
        identificacion: { nombre: 'Autoguardado' },
      }),
    );
    const antes = await db.cola_sync.count();
    expect(await editor.puedeSalir()).toBe(true);
    expect(await db.cola_sync.count()).toBe(antes);
  });

  it('requiere permanentes, validez y cuatro fotos; guarda PDF y foto anclada antes del envío', async () => {
    const fixture = await abrir();
    const editor = fixture.componentInstance;
    editor.valido.set(true);
    expect(editor.puedeEnviar()).toBe(false);
    expect(await editor.foto(foto())).toBe(false);
    await editor.confirmar();
    editor.cambiar({
      identificacion: { nombre: 'Puente' },
      datos_generales: { inspector: 'Estudiante' },
    });
    for (let n = 0; n < 3; n++) expect(await editor.foto(foto())).toBe(true);
    await vi.waitFor(() => expect(editor.fotos()).toHaveLength(3));
    expect(editor.puedeEnviar()).toBe(false);
    editor.elemento = 'estructura.dano';
    expect(await editor.foto(foto())).toBe(true);
    await vi.waitFor(() => expect(editor.fotos()).toHaveLength(4));
    const selector = {
      files: [new File(['%PDF'], 'informe.pdf', { type: 'application/pdf' })],
      value: 'informe.pdf',
    } as unknown as HTMLInputElement;
    expect(await editor.documento(selector)).toBe(true);
    expect(selector.value).toBe('');
    editor.valido.set(false);
    expect(editor.puedeEnviar()).toBe(false);
    editor.valido.set(true);
    expect(editor.puedeEnviar()).toBe(true);
    expect(await editor.enviar()).toBe(true);
    expect(editor.estado()).toBe('Enviada: pendiente de subir');
    const operaciones = await local.operaciones(propietario, id);
    expect(operaciones.at(-1)?.tipo).toBe('envio');
    expect(operaciones.at(-1)?.dependencias).toHaveLength(operaciones.length - 1);
    expect(
      (await db.fotos.toArray()).filter((f) => f.elemento_ref === 'estructura.dano'),
    ).toHaveLength(1);
    expect(await db.documentos.count()).toBe(1);
    const antes = await db.cola_sync.count();
    editor.cambiar({ alterado: true });
    expect(await editor.guardar()).toBe(true);
    expect(await db.cola_sync.count()).toBe(antes);
  });

  it('muestra errores de persistencia y no permite abandonar con cambios no guardados', async () => {
    const fixture = await abrir();
    const editor = fixture.componentInstance;
    editor.cambiarPermanentes({ identificacion: { nombre: 'Sin cuota' } });
    const fallar = () => {
      throw new Error('Cuota agotada');
    };
    db.cola_sync.hook('creating', fallar);
    expect(await editor.puedeSalir()).toBe(false);
    expect(editor.error()).toContain('Cuota agotada');
    expect(await db.cola_sync.count()).toBe(1);
    expect((await local.inspeccion(propietario, id)).respuestas).toEqual({
      identificacion: { nombre: 'Puente' },
    });
    db.cola_sync.hook('creating').unsubscribe(fallar);
    expect(await editor.puedeSalir()).toBe(true);
  });

  it('no muestra ni modifica capturas ajenas o revocadas y conserva pendientes', async () => {
    const fixture = await abrir();
    const editor = fixture.componentInstance;
    const antes = await local.operaciones(propietario, id);
    habilitado = ajeno;
    invalidar();
    await vi.waitFor(() => expect(editor.inspeccion()).toBeNull());
    expect(await editor.guardar()).toBe(false);
    expect(await local.operaciones(propietario, id)).toEqual(antes);
    expect(editor.respuestas()).toEqual({});
  });

  it('libera las objectURL al retirar al propietario y al destruir, sin duplicarlas en cada render', async () => {
    const fixture = await abrir();
    const editor = fixture.componentInstance;
    await editor.confirmar();
    await editor.foto(foto());
    await vi.waitFor(() => expect(editor.fotos()).toHaveLength(1));
    const registro = editor.fotos()[0];
    expect(editor.miniatura(registro)).toBe(editor.miniatura(registro));
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    habilitado = null;
    invalidar();
    await vi.waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:foto'));
    fixture.destroy();
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
  });

  it('expone intervención y sincronización sin borrar archivos ni operaciones', async () => {
    const fixture = await abrir();
    const editor = fixture.componentInstance;
    const operacion = (await local.operaciones(propietario, id))[0];
    await db.cola_sync.update(operacion.id, {
      estado: 'requiere_intervencion',
      error: 'Revisar datos',
    });
    await vi.waitFor(() => expect(editor.estado()).toContain('Requiere intervención'));
    await db.cola_sync.update(operacion.id, { estado: 'confirmada' });
    await db.inspecciones.update(id, { estado_remoto: { estado: 'ENVIADA' } });
    await vi.waitFor(() => expect(editor.estado()).toBe('Sincronizada'));
    expect(await db.cola_sync.count()).toBe(1);
  });
});
