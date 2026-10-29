import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { liveQuery } from 'dexie';
import { EsquemaFormulario } from '../features/formulario/modelos';
import { MotorFormularioComponent } from '../features/formulario/motor-formulario/motor-formulario';
import {
  esquemaSoloPermanentes,
  extraerPermanentes,
  fusionarProfundo,
  podarVacios,
  referenciasDeElemento,
} from '../features/inspecciones/esquema';
import {
  CLASE_ALERTA,
  CLASE_BOTON,
  CLASE_BOTON_PELIGRO,
  CLASE_BOTON_SECUNDARIO,
  CLASE_CAMPO,
  CLASE_ENLACE,
} from '../features/auth/formulario';
import { CapturaFoto, FotoCapturada } from '../shared/captura-foto/captura-foto';
import { AccesoLocal } from './acceso-local';
import { BaseLocal } from './base-local';
import { DiagnosticoOffline } from './diagnostico';
import { ArchivoLocal, estadoCaptura, InspeccionLocal, Json } from './modelos';
import { MotorSync } from './motor-sync';
import { PersistenciaOffline } from './persistencia';

@Component({
  selector: 'app-captura-local',
  imports: [RouterLink, MotorFormularioComponent, CapturaFoto, DiagnosticoOffline],
  template: `
    <div class="mx-auto max-w-6xl p-4">
      <a routerLink="/offline/local" [class]="claseEnlace">← Capturas locales</a>
      <h1 class="mt-2 text-2xl font-bold">Captura sin conexión</h1>
      @if (error()) {
        <p role="alert" [class]="claseAlerta">{{ error() }}</p>
      }
      @if (inspeccion(); as i) {
        <p
          role="status"
          class="mt-2 inline-block rounded-full border border-slate-400 px-3 py-1 text-sm font-medium"
        >
          {{ estado() }}
        </p>
        @if (avisoUbicacion(); as aviso) {
          <p
            role="status"
            class="mt-3 rounded border border-amber-600 bg-amber-50 p-3 text-amber-900"
          >
            {{ aviso }}
          </p>
        }
        @if (esquema(); as esquema) {
          @if (!confirmados()) {
            <h2 class="mt-6 text-lg font-semibold">Datos permanentes</h2>
            <p class="text-sm text-slate-700">Revisa y confirma estos datos antes de continuar.</p>
            <app-motor-formulario
              [esquema]="soloPermanentes()!"
              [datos]="datosFormulario()"
              [modo]="transicion() ? 'lectura' : 'edicion'"
              (datosChange)="cambiarPermanentes($event)"
            />
            <button
              type="button"
              class="mt-4"
              [class]="claseBoton"
              [disabled]="ocupado()"
              (click)="confirmar()"
            >
              Confirmar datos permanentes
            </button>
          } @else {
            <h2 class="mt-6 text-lg font-semibold">Formulario SIECA</h2>
            <app-motor-formulario
              [esquema]="esquema"
              [datos]="datosFormulario()"
              [modo]="bloqueada() || transicion() ? 'lectura' : 'edicion'"
              (datosChange)="cambiar($event)"
              (validoChange)="valido.set($event)"
            />
            <section class="mt-6 rounded border border-slate-300 p-4">
              @if (!bloqueada()) {
                <button
                  type="button"
                  [class]="claseSecundario"
                  [disabled]="ocupado()"
                  (click)="guardar()"
                >
                  Guardar localmente
                </button>
                <h2 class="mt-4 text-lg font-semibold">Fotografías</h2>
                <label for="elemento-local" class="mt-2 block text-sm font-medium"
                  >Elemento de la foto (opcional)</label
                >
                <select
                  id="elemento-local"
                  class="mt-1 w-full max-w-md"
                  [class]="claseCampo"
                  [value]="elemento"
                  (change)="elemento = $any($event.target).value"
                >
                  <option value="">Foto general</option>
                  @for (ref of referencias(); track ref) {
                    <option [value]="ref">{{ ref }}</option>
                  }
                </select>
                <div class="mt-3 flex flex-wrap items-center gap-3">
                  <app-captura-foto (capturada)="foto($event)" />
                  <label
                    for="pdf-local"
                    class="inline-flex min-h-11 cursor-pointer items-center rounded border border-blue-700 px-4 py-2 font-medium text-blue-800"
                    >Adjuntar PDF (máximo 20 MB)</label
                  >
                  <input
                    id="pdf-local"
                    type="file"
                    accept="application/pdf"
                    class="sr-only"
                    [disabled]="ocupado()"
                    (change)="documento($any($event.target))"
                  />
                </div>
              }
              <p class="mt-3 text-sm font-medium">
                Fotos guardadas: {{ fotos().length }} (mínimo 4 para enviar)
              </p>
              <div class="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                @for (foto of fotos(); track foto.id) {
                  <figure class="rounded border border-slate-300 p-2">
                    <img
                      [src]="miniatura(foto)"
                      width="150"
                      class="h-28 w-full rounded object-cover"
                      alt="Foto guardada localmente"
                    />
                    <figcaption class="mt-1 text-xs break-all text-slate-600">
                      {{ foto.elemento_ref || 'General' }}
                    </figcaption>
                    @if (rechazados().includes(foto.id)) {
                      <button
                        type="button"
                        class="mt-2"
                        [class]="clasePeligro"
                        [disabled]="ocupado()"
                        (click)="retirarArchivo(foto.id)"
                      >
                        Retirar foto rechazada para corregir
                      </button>
                    }
                  </figure>
                }
              </div>
              <p class="mt-3 text-sm font-medium">
                Documentos PDF guardados: {{ documentos().length }}
              </p>
              @for (documento of documentos(); track documento.id) {
                @if (rechazados().includes(documento.id)) {
                  <button
                    type="button"
                    class="mt-2"
                    [class]="clasePeligro"
                    [disabled]="ocupado()"
                    (click)="retirarArchivo(documento.id)"
                  >
                    Retirar PDF rechazado para corregir
                  </button>
                }
              }
              <button
                type="button"
                class="mt-4 block"
                [class]="claseBoton"
                [disabled]="!puedeEnviar()"
                (click)="enviar()"
              >
                Encolar envío
              </button>
            </section>
          }
        }
        <a href="#diagnostico-local" class="mt-4 block w-fit" [class]="claseEnlace"
          >Ver pendientes y diagnóstico</a
        >
        <div id="diagnostico-local">
          <app-diagnostico-offline [db]="db" [propietario]="i.propietario_id" [motor]="motor" />
        </div>
      }
    </div>
  `,
})
export class CapturaLocal implements OnDestroy {
  protected readonly claseBoton = CLASE_BOTON;
  protected readonly claseSecundario = CLASE_BOTON_SECUNDARIO;
  protected readonly clasePeligro = CLASE_BOTON_PELIGRO;
  protected readonly claseCampo = CLASE_CAMPO;
  protected readonly claseEnlace = CLASE_ENLACE;
  protected readonly claseAlerta = CLASE_ALERTA;
  readonly db = inject(BaseLocal);
  readonly motor = inject(MotorSync, { optional: true }) ?? undefined;
  private readonly acceso = inject(AccesoLocal);
  private readonly local = new PersistenciaOffline(this.db);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id')!;
  readonly inspeccion = signal<InspeccionLocal | null>(null);
  readonly esquema = signal<EsquemaFormulario | null>(null);
  readonly soloPermanentes = computed(() =>
    this.esquema() ? esquemaSoloPermanentes(this.esquema()!) : null,
  );
  readonly referencias = computed(() =>
    this.esquema() ? referenciasDeElemento(this.esquema()!) : [],
  );
  readonly respuestas = signal<Record<string, unknown>>({});
  readonly datosFormulario = signal<Record<string, unknown>>({});
  readonly fotos = signal<ArchivoLocal[]>([]);
  readonly documentos = signal<ArchivoLocal[]>([]);
  readonly rechazados = signal<string[]>([]);
  readonly error = signal('');
  readonly ocupado = signal(false);
  readonly transicion = signal(false);
  readonly valido = signal(false);
  readonly confirmados = computed(() => !!this.metadatos()['permanentes_confirmados_en']);
  readonly avisoUbicacion = computed(() => this.metadatos()['aviso_ubicacion']);
  readonly bloqueada = computed(
    () => !!this.inspeccion()?.intencion_envio_en || !!this.inspeccion()?.estado_remoto,
  );
  readonly puedeEnviar = computed(
    () =>
      this.confirmados() &&
      this.valido() &&
      this.fotos().length >= 4 &&
      !this.ocupado() &&
      !this.bloqueada(),
  );
  readonly intervencion = signal(false);
  readonly estado = computed(() =>
    this.intervencion()
      ? 'Requiere intervención: consulta el diagnóstico.'
      : estadoCaptura(this.inspeccion()),
  );
  elemento = '';
  private ultimoGuardado = '';
  private versionEdicion = 0;
  private temporizador?: ReturnType<typeof setTimeout>;
  private escrituras: Promise<void> = Promise.resolve();
  private destruida = false;
  private readonly alCerrar = (evento: BeforeUnloadEvent) => {
    if (this.ocupado() || JSON.stringify(podarVacios(this.respuestas())) !== this.ultimoGuardado) {
      evento.preventDefault();
      evento.returnValue = '';
    }
  };
  private readonly urls = new Map<string, string>();
  private readonly liberar = this.acceso.alInvalidar(() => {
    void this.comprobarAcceso().catch(() => this.retirar());
  });
  private readonly cambios = liveQuery(async () => {
    const propietario = await this.acceso.propietarioActual();
    if (!propietario)
      throw new Error('No hay acceso local habilitado. Inicia sesión y prepara una salida.');
    return this.acceso.consultarPropias(propietario, async () => ({
      i: await this.local.inspeccion(propietario, this.id),
      referencia: await this.db.esquemas_formulario
        .where('propietario_id')
        .equals(propietario)
        .toArray(),
      fotos: await this.db.fotos
        .where('[propietario_id+inspeccion_id]')
        .equals([propietario, this.id])
        .toArray(),
      documentos: await this.db.documentos
        .where('[propietario_id+inspeccion_id]')
        .equals([propietario, this.id])
        .toArray(),
      operaciones: await this.local.operaciones(propietario, this.id),
    }));
  }).subscribe({
    next: (datos) => {
      if (this.destruida) return;
      if (!datos) {
        this.retirar();
        return;
      }
      const referencia = datos.referencia.find(
        (r) =>
          r.propietario_id === datos.i.propietario_id && r.id === datos.i.formulario_version_id,
      );
      const esquema = (referencia?.datos as { esquema?: EsquemaFormulario } | undefined)?.esquema;
      if (!esquema?.properties) {
        this.retirar(
          'No está disponible la versión exacta del formulario. No se eliminó la captura.',
        );
        return;
      }
      if (
        !this.inspeccion() ||
        (!this.ocupado() && JSON.stringify(podarVacios(this.respuestas())) === this.ultimoGuardado)
      ) {
        this.respuestas.set(datos.i.respuestas as Record<string, unknown>);
        this.datosFormulario.set(datos.i.respuestas as Record<string, unknown>);
        this.ultimoGuardado = JSON.stringify(podarVacios(this.respuestas()));
        this.versionEdicion = datos.i.version_local;
        this.esquema.set(esquema);
      }
      this.inspeccion.set(datos.i);
      this.fotos.set(datos.fotos);
      this.documentos.set(datos.documentos);
      this.rechazados.set(
        datos.operaciones
          .filter(
            (o) =>
              o.estado === 'requiere_intervencion' && (o.tipo === 'foto' || o.tipo === 'documento'),
          )
          .map((o) => o.entidad_id),
      );
      this.intervencion.set(datos.operaciones.some((o) => o.estado === 'requiere_intervencion'));
    },
    error: (error: unknown) =>
      this.retirar(error instanceof Error ? error.message : 'No se pudo leer la captura local.'),
  });

  constructor() {
    window.addEventListener('beforeunload', this.alCerrar);
  }

  private metadatos(): Record<string, Json> {
    return (this.inspeccion()?.metadatos ?? {}) as Record<string, Json>;
  }
  private retirar(mensaje = 'El propietario ya no tiene acceso local habilitado.'): void {
    this.inspeccion.set(null);
    this.esquema.set(null);
    this.respuestas.set({});
    this.datosFormulario.set({});
    this.fotos.set([]);
    this.documentos.set([]);
    this.revocarUrls();
    this.error.set(mensaje);
  }
  private async comprobarAcceso(): Promise<InspeccionLocal> {
    const i = this.inspeccion();
    const propietario = await this.acceso.propietarioActual();
    if (
      this.destruida ||
      !i ||
      propietario !== i.propietario_id ||
      this.inspeccion()?.propietario_id !== propietario
    )
      throw new Error('No hay acceso a esta captura local. Los pendientes se conservan.');
    return i;
  }
  cambiarPermanentes(datos: Record<string, unknown>): void {
    if (this.bloqueada() || this.transicion()) return;
    this.respuestas.update((previas) => fusionarProfundo(previas, datos));
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => void this.guardar(), 350);
  }
  cambiar(datos: Record<string, unknown>): void {
    if (this.bloqueada() || this.transicion()) return;
    this.respuestas.set(datos);
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => void this.guardar(), 350);
  }
  private ejecutar(tarea: () => Promise<void>): Promise<boolean> {
    this.ocupado.set(true);
    const siguiente = this.escrituras.catch(() => undefined).then(tarea);
    this.escrituras = siguiente;
    return siguiente
      .then(
        () => {
          if (!this.destruida) this.error.set('');
          return true;
        },
        (causa: unknown) => {
          if (!this.destruida)
            this.error.set(
              causa instanceof Error
                ? causa.message
                : 'No se pudo guardar localmente. Reintenta antes de salir.',
            );
          return false;
        },
      )
      .finally(() => {
        if (this.escrituras === siguiente) this.ocupado.set(false);
      });
  }
  private async persistir(
    datos: Record<string, unknown>,
    metadatos?: Record<string, Json>,
  ): Promise<void> {
    const i = await this.comprobarAcceso();
    if (this.bloqueada()) return;
    const podadas = podarVacios(datos);
    const huella = JSON.stringify(podadas);
    if (!metadatos && huella === this.ultimoGuardado) return;
    const guardada = await this.local.editar(
      i.propietario_id,
      i.id,
      podadas as Json,
      this.versionEdicion,
      metadatos,
    );
    this.versionEdicion = guardada.version_local;
    this.ultimoGuardado = huella;
    await this.comprobarAcceso();
    this.inspeccion.set(guardada);
  }
  guardar(): Promise<boolean> {
    clearTimeout(this.temporizador);
    const datos = structuredClone(this.respuestas());
    return this.ejecutar(() => this.persistir(datos));
  }
  confirmar(): Promise<boolean> {
    if (!this.esquema() || this.ocupado() || this.confirmados()) return Promise.resolve(false);
    clearTimeout(this.temporizador);
    const datos = structuredClone(this.respuestas());
    const permanentes = extraerPermanentes(podarVacios(datos), this.esquema()!);
    this.datosFormulario.set(datos);
    this.transicion.set(true);
    return this.ejecutar(() =>
      this.persistir(datos, {
        permanentes_confirmados_en: new Date().toISOString(),
        permanentes: permanentes as Json,
      }),
    ).finally(() => this.transicion.set(false));
  }
  foto(foto: FotoCapturada): Promise<boolean> {
    const elemento = this.elemento;
    const datos = structuredClone(this.respuestas());
    return this.ejecutar(async () => {
      const i = await this.comprobarAcceso();
      if (!this.confirmados() || this.bloqueada() || this.transicion())
        throw new Error('La captura no admite archivos ahora.');
      if (elemento && !this.referencias().includes(elemento))
        throw new Error('Elemento de foto no válido.');
      await this.persistir(datos);
      await this.local.foto(
        i.propietario_id,
        i.id,
        foto,
        elemento ? { origen: 'grupo_dano', elemento_ref: elemento } : { origen: 'general' },
      );
      this.versionEdicion = (await this.local.inspeccion(i.propietario_id, i.id)).version_local;
    });
  }
  documento(selector: HTMLInputElement): Promise<boolean> {
    const archivo = selector.files?.[0];
    selector.value = '';
    if (!archivo) return Promise.resolve(false);
    const datos = structuredClone(this.respuestas());
    return this.ejecutar(async () => {
      const i = await this.comprobarAcceso();
      if (!this.confirmados() || this.bloqueada() || this.transicion())
        throw new Error('La captura no admite archivos ahora.');
      await this.persistir(datos);
      await this.local.documento(i.propietario_id, i.id, archivo);
      this.versionEdicion = (await this.local.inspeccion(i.propietario_id, i.id)).version_local;
    });
  }
  enviar(): Promise<boolean> {
    if (!this.puedeEnviar()) return Promise.resolve(false);
    clearTimeout(this.temporizador);
    const datos = structuredClone(this.respuestas());
    this.transicion.set(true);
    return this.ejecutar(async () => {
      await this.persistir(datos);
      const i = await this.comprobarAcceso();
      if (
        !this.valido() ||
        !this.confirmados() ||
        (await this.db.fotos
          .where('[propietario_id+inspeccion_id]')
          .equals([i.propietario_id, i.id])
          .count()) < 4
      )
        throw new Error(
          'Confirma los permanentes, completa el formulario y guarda al menos cuatro fotos.',
        );
      await this.local.enviar(i.propietario_id, i.id);
      this.inspeccion.set(await this.local.inspeccion(i.propietario_id, i.id));
    }).finally(() => this.transicion.set(false));
  }
  retirarArchivo(id: string): Promise<boolean> {
    return this.ejecutar(async () => {
      const i = await this.comprobarAcceso();
      const guardada = await this.local.retirarArchivo(i.propietario_id, i.id, id);
      this.inspeccion.set(guardada);
      // Si había edición sin guardar, conservar su versión para detectar conflictos.
      if (JSON.stringify(podarVacios(this.respuestas())) === this.ultimoGuardado)
        this.versionEdicion = guardada.version_local;
    });
  }
  async puedeSalir(): Promise<boolean> {
    if (!this.inspeccion()) return true;
    return this.guardar();
  }
  miniatura(foto: ArchivoLocal): string {
    let url = this.urls.get(foto.id);
    if (!url) {
      url = URL.createObjectURL(foto.miniatura ?? foto.archivo);
      this.urls.set(foto.id, url);
    }
    return url;
  }
  private revocarUrls(): void {
    for (const url of this.urls.values()) URL.revokeObjectURL(url);
    this.urls.clear();
  }
  ngOnDestroy(): void {
    this.destruida = true;
    clearTimeout(this.temporizador);
    this.cambios.unsubscribe();
    window.removeEventListener('beforeunload', this.alCerrar);
    this.liberar();
    this.revocarUrls();
  }
}
