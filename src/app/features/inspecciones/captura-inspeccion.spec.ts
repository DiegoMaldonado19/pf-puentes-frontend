import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { AuthService } from '../../core/auth/auth';
import { Rol } from '../../core/auth/modelos';
import { FormularioService } from '../formulario/formulario.service';
import { FormularioVersionDTO } from '../formulario/modelos';
import { CapturaInspeccion } from './captura-inspeccion';
import { InspeccionApi } from './inspeccion-api';
import { InspeccionDTO } from './modelos';
import { InspeccionStore } from './inspeccion-store';
import { PesosService } from '../admin/pesos/pesos.service';

const pesos = {
  estimarIcPreliminarPorInspeccion: vi.fn(() =>
    of({
      indice_condicion: 90,
      estado_calculado: 'BUENO',
      anulaciones: [],
      preliminar: true,
    }),
  ),
  consultarRecalculos: vi.fn(() => of(null)),
  listarJuegos: vi.fn(() => of({ content: [], page: 0, total_pages: 0 })),
};

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
        title: 'Datos generales',
        properties: { longitud_total: { type: 'number', title: 'Longitud' } },
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

async function montar(
  detalle: InspeccionDTO,
  usuarioId = 'autor',
  rol: Rol = 'ESTUDIANTE',
): Promise<ComponentFixture<CapturaInspeccion>> {
  const usuario = signal({ id: usuarioId, nombre: 'Ana', rol });
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: InspeccionApi,
        useValue: { detalle: () => of(detalle), archivos: () => of([]), guardarAvance: vi.fn() },
      },
      { provide: PesosService, useValue: pesos },
      { provide: FormularioService, useValue: { detalle: () => of(VERSION) } },
      { provide: AuthService, useValue: { usuario, rol: signal(rol) } },
    ],
  });
  const fixture = TestBed.createComponent(CapturaInspeccion);
  fixture.componentRef.setInput('id', detalle.id);
  // La carga es una promesa del store: se espera a que el detalle reemplace el «Cargando».
  await vi.waitFor(() => {
    fixture.detectChanges();
    expect(texto(fixture)).not.toContain('Cargando inspección');
  });
  return fixture;
}

function texto(fixture: ComponentFixture<CapturaInspeccion>): string {
  return (fixture.nativeElement as HTMLElement).textContent ?? '';
}

function botones(fixture: ComponentFixture<CapturaInspeccion>): string[] {
  return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).map(
    (b) => b.textContent?.trim() ?? '',
  );
}

describe('CapturaInspeccion', () => {
  const crearUrlOriginal = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  const revocarUrlOriginal = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => {
    vi.restoreAllMocks();
    if (crearUrlOriginal) Object.defineProperty(URL, 'createObjectURL', crearUrlOriginal);
    else Reflect.deleteProperty(URL, 'createObjectURL');
    if (revocarUrlOriginal) Object.defineProperty(URL, 'revokeObjectURL', revocarUrlOriginal);
    else Reflect.deleteProperty(URL, 'revokeObjectURL');
  });

  it('el guard real espera B tras A y no sale si B no fue aceptado', async () => {
    const fixture = await montar(inspeccion());
    const store = fixture.debugElement.injector.get(InspeccionStore);
    const api = TestBed.inject(InspeccionApi);
    const a = new Subject<InspeccionDTO>();
    const b = new Subject<InspeccionDTO>();
    vi.mocked(api.guardarAvance).mockReturnValueOnce(a).mockReturnValueOnce(b);
    store.alCambiarDatos({ longitud: 10 });
    const guardado = store.guardar();
    store.alCambiarDatos({ longitud: 20 });
    const salida = fixture.componentInstance.puedeSalir();
    a.next(inspeccion({ version: 2 }));
    await vi.waitFor(() => expect(api.guardarAvance).toHaveBeenCalledTimes(2));
    expect(store.sucio()).toBe(true);
    expect(vi.mocked(api.guardarAvance).mock.calls[1][1]).toEqual({
      datos: { longitud: 20 },
      version: 2,
    });
    b.next(inspeccion({ version: 3 }));
    expect(await guardado).toBe(true);
    expect(await salida).toBe(true);
  });

  it('la lectura histórica permite imprimir y exportar el esquema congelado', async () => {
    const fixture = await montar(inspeccion({ estado: 'PUBLICADA' }));
    expect(botones(fixture)).toContain('Imprimir');
    expect(botones(fixture)).toContain('Exportar JSON');
    const imprimir = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const crearUrl = vi.fn<(blob: Blob) => string>().mockReturnValue('blob:exportacion');
    const revocarUrl = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: crearUrl });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revocarUrl });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const elementos = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
    elementos.find((boton) => boton.textContent?.trim() === 'Imprimir')?.click();
    elementos.find((boton) => boton.textContent?.trim() === 'Exportar JSON')?.click();
    expect(imprimir).toHaveBeenCalledOnce();
    const blob = crearUrl.mock.calls[0][0];
    const contenido =
      typeof blob.text === 'function'
        ? await blob.text()
        : await new Promise<string>((resolver) => {
            const lector = new FileReader();
            lector.onload = () => resolver(String(lector.result));
            lector.readAsText(blob);
          });
    expect(JSON.parse(contenido)).toEqual({
      inspeccion: inspeccion({ estado: 'PUBLICADA' }),
      formulario: { id: VERSION.id, codigo: VERSION.codigo, esquema: VERSION.esquema },
    });
    expect(click).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(revocarUrl).toHaveBeenCalledWith('blob:exportacion'));
  });

  it('estima el IC del borrador propio con el componente existente', async () => {
    const fixture = await montar(inspeccion());
    const boton = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((elemento) => elemento.textContent?.trim() === 'Estimar IC');
    boton?.click();
    await fixture.whenStable();
    expect(pesos.estimarIcPreliminarPorInspeccion).toHaveBeenCalledWith('i1');
    expect(fixture.nativeElement.querySelector('app-ic-preliminar')).not.toBeNull();
  });

  it('consulta recálculos para docentes sin listar juegos exclusivos del administrador', async () => {
    const fixture = await montar(inspeccion({ estado: 'PUBLICADA' }), 'docente', 'CATEDRATICO');
    expect(fixture.nativeElement.querySelector('app-recalculo-ic')).not.toBeNull();
    expect(pesos.listarJuegos).not.toHaveBeenCalled();
    expect(pesos.consultarRecalculos).toHaveBeenCalledWith('i1', 0);
  });

  it('el administrador carga juegos compatibles y puede recalcular', async () => {
    const fixture = await montar(inspeccion({ estado: 'PUBLICADA' }), 'admin', 'ADMINISTRADOR');
    expect(pesos.listarJuegos).toHaveBeenCalledWith('f1', 0, 100);
    expect(fixture.nativeElement.querySelector('app-recalculo-ic')).not.toBeNull();
  });
  it('el autor de un borrador edita: ve el motor, la lista previa al envío y «Enviar a revisión» deshabilitado', async () => {
    const fixture = await montar(inspeccion());
    expect(texto(fixture)).toContain('Las Rosas');
    expect(texto(fixture)).toContain('Borrador en edición');
    expect(texto(fixture)).toContain('Datos permanentes');
    expect(texto(fixture)).toContain('Antes de enviar');
    const enviar = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((b) => b.textContent?.includes('Enviar a revisión'));
    expect(enviar?.disabled).toBe(true);
  });

  it('el estudiante nunca ve copy de publicación; el catedrático ve «Enviar y publicar»', async () => {
    const estudiante = await montar(inspeccion(), 'autor', 'ESTUDIANTE');
    expect(botones(estudiante).some((b) => b.includes('Enviar y publicar'))).toBe(false);
    TestBed.resetTestingModule();
    const catedratico = await montar(inspeccion(), 'autor', 'CATEDRATICO');
    expect(botones(catedratico).some((b) => b.includes('Enviar y publicar'))).toBe(true);
  });

  it('un borrador ajeno está en solo lectura y sin acciones de escritura', async () => {
    const fixture = await montar(inspeccion(), 'catedratico', 'CATEDRATICO');
    expect(texto(fixture)).toContain('Este borrador pertenece a otro autor');
    expect(botones(fixture).some((b) => /Guardar|Enviar|Eliminar/.test(b))).toBe(false);
  });

  it('una enviada es de solo lectura y el estudiante ve «Enviada a revisión», no «Publicada»', async () => {
    const fixture = await montar(inspeccion({ estado: 'ENVIADA' }));
    expect(texto(fixture)).toContain('Enviada a revisión');
    expect(texto(fixture)).not.toContain('Publicada. La inspección');
    expect(botones(fixture).some((b) => /Guardar avance|Eliminar/.test(b))).toBe(false);
  });

  it('una publicada muestra el IC y el estado que calculó el servidor, y permite corregir', async () => {
    const fixture = await montar(
      inspeccion({
        estado: 'PUBLICADA',
        indice_condicion: 72.5,
        estado_calculado: 'REGULAR',
        estado_confirmado: 'REGULAR',
      }),
      'otro',
      'PROFESIONAL_EXTERNO',
    );
    expect(texto(fixture)).toContain('72.5');
    expect(texto(fixture)).toContain('REGULAR');
    expect(texto(fixture)).toContain('Corregir esta inspección');
  });

  it('una publicada ya superada no ofrece una segunda corrección', async () => {
    const fixture = await montar(
      inspeccion({ estado: 'PUBLICADA', superada: true, superada_por: 'i2' }),
      'otro',
      'CATEDRATICO',
    );
    expect(texto(fixture)).not.toContain('Corregir esta inspección');
    expect(texto(fixture)).toContain('Superada por la inspección i2');
  });

  it('avisa si el GPS no estuvo disponible o si estaba lejos del puente', async () => {
    const sinGps = await montar(inspeccion({ gps_disponible: false }));
    expect(texto(sinGps)).toContain('GPS no disponible al iniciar');
    TestBed.resetTestingModule();
    const lejos = await montar(
      inspeccion({ advertencia_ubicacion: 'Está lejos del puente.', distancia_a_puente_m: 612 }),
    );
    expect(texto(lejos)).toContain('Está lejos del puente.');
    expect(texto(lejos)).toContain('612');
  });
});
