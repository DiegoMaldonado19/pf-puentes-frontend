import { DestroyRef, computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth';
import { ErrorDeCampo, erroresDeCampo } from '../../core/errores/problema';
import { FotoCapturada } from '../../shared/captura-foto/captura-foto';
import { FormularioVersionDTO } from '../formulario/modelos';
import { FormularioService } from '../formulario/formulario.service';
import { nuevaClave, nuevoId } from './dispositivo';
import { erroresParaMotor, extraerPermanentes, podarVacios } from './esquema';
import { estadoHttp, exigeRecarga, mensajeInspeccion, tipoDeError } from './errores';
import { InspeccionApi } from './inspeccion-api';
import {
  AcompananteDTO,
  esEditable,
  InspeccionDTO,
  MAXIMO_DOCUMENTOS,
  MAXIMO_FOTOS,
  MINIMO_FOTOS_ENVIO,
  TipoArchivo,
} from './modelos';

const ESPERA_AUTOGUARDADO_MS = 1500;

export type EstadoArchivoLocal = 'subiendo' | 'subida' | 'error';

/** El detalle no incrusta archivos y no hay GET de fotos: el inventario es de la sesión. */
export interface ArchivoLocal {
  readonly id: string;
  readonly tipo: TipoArchivo;
  readonly nombre: string;
  readonly miniaturaUrl: string | null;
  readonly elemento_ref: string | null;
  readonly estado: EstadoArchivoLocal;
  readonly mensaje: string;
}

type Datos = Record<string, unknown>;

/**
 * Estado de una sesión de captura (analisis Fase 3). Se provee por componente, no en root:
 * cada pantalla de captura tiene su propio borrador y su propia concurrencia.
 * Tras cada respuesta del servidor se reemplaza la inspección completa: `version` nunca se
 * incrementa a mano.
 */
@Injectable()
export class InspeccionStore {
  private readonly api = inject(InspeccionApi);
  private readonly formularios = inject(FormularioService);
  private readonly auth = inject(AuthService);

  readonly inspeccion = signal<InspeccionDTO | null>(null);
  readonly version = signal<FormularioVersionDTO | null>(null);
  /** Valor inicial del motor: no se refresca tras guardar para no reconstruir los controles. */
  readonly datosIniciales = signal<Datos>({});
  readonly acompanantes = signal<AcompananteDTO[]>([]);
  readonly archivos = signal<ArchivoLocal[]>([]);

  readonly cargando = signal(false);
  readonly noEncontrada = signal(false);
  readonly guardando = signal(false);
  readonly confirmando = signal(false);
  readonly enviando = signal(false);
  readonly sucio = signal(false);
  readonly guardadoEn = signal<Date | null>(null);
  readonly formularioValido = signal(true);
  readonly fotosPrevias = signal(false);
  readonly error = signal('');
  readonly errores = signal<readonly ErrorDeCampo[]>([]);
  /** Última versión del servidor cuando otra pestaña guardó antes (409 version-desactualizada). */
  readonly conflicto = signal<InspeccionDTO | null>(null);

  readonly editable = computed(() => {
    const inspeccion = this.inspeccion();
    return inspeccion !== null && esEditable(inspeccion, this.auth.usuario()?.id ?? null);
  });
  readonly permanentesConfirmados = computed(
    () => this.inspeccion()?.datos_permanentes_confirmados_en !== undefined,
  );
  readonly erroresMotor = computed(() => erroresParaMotor(this.errores()));
  readonly fotosSubidas = computed(
    () => this.archivos().filter((a) => a.tipo === 'FOTO' && a.estado === 'subida').length,
  );
  readonly documentosSubidos = computed(
    () => this.archivos().filter((a) => a.tipo === 'DOCUMENTO' && a.estado === 'subida').length,
  );
  readonly puedeAgregarFoto = computed(
    () => this.archivos().filter((a) => a.tipo === 'FOTO').length < MAXIMO_FOTOS,
  );
  readonly puedeAgregarDocumento = computed(
    () => this.archivos().filter((a) => a.tipo === 'DOCUMENTO').length < MAXIMO_DOCUMENTOS,
  );
  readonly fotosSuficientes = computed(
    () => this.fotosSubidas() >= MINIMO_FOTOS_ENVIO || this.fotosPrevias(),
  );
  readonly ocupado = computed(
    () => this.guardando() || this.confirmando() || this.enviando() || this.subiendo(),
  );
  readonly puedeEnviar = computed(
    () =>
      this.editable() &&
      this.permanentesConfirmados() &&
      this.fotosSuficientes() &&
      !this.ocupado() &&
      this.conflicto() === null,
  );

  private datosActuales: Datos = {};
  private gruposSanos = new Set<string>();
  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private guardadoPendiente = false;
  private firmaGuardado: string | null = null;
  private claveGuardado = nuevaClave();
  private claveEnvio: string | null = null;
  private readonly clavesArchivo = new Map<string, string>();
  private readonly originales = new Map<string, FotoCapturada | File>();
  private generacion = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.liberar());
  }

  private readonly subiendo = computed(() => this.archivos().some((a) => a.estado === 'subiendo'));

  // ---------------------------------------------------------------- carga

  async cargar(id: string): Promise<void> {
    const generacion = ++this.generacion;
    this.cargando.set(true);
    this.noEncontrada.set(false);
    this.error.set('');
    try {
      const inspeccion = await firstValueFrom(this.api.detalle(id));
      // RN-FRM-05: la inspección se pinta con SU versión congelada, no con la activa.
      const version = await firstValueFrom(this.formularios.detalle(inspeccion.formulario.id));
      if (generacion !== this.generacion) return;
      this.aplicarServidor(inspeccion);
      this.version.set(version);
      this.reiniciarDatos(inspeccion);
    } catch (error) {
      if (generacion !== this.generacion) return;
      this.noEncontrada.set(estadoHttp(error) === 404);
      this.error.set(mensajeInspeccion(error));
    } finally {
      if (generacion === this.generacion) this.cargando.set(false);
    }
  }

  private aplicarServidor(inspeccion: InspeccionDTO): void {
    this.inspeccion.set(inspeccion);
    this.acompanantes.set([...(inspeccion.acompanantes ?? [])]);
  }

  private reiniciarDatos(inspeccion: InspeccionDTO): void {
    this.datosActuales = inspeccion.datos ?? {};
    this.datosIniciales.set(this.datosActuales);
    this.gruposSanos.clear();
    this.sucio.set(false);
    this.conflicto.set(null);
  }

  // ---------------------------------------------------------- captura

  /** Cambio del motor. El autoguardado nunca dispara el envío (analisis Fase 3, D.4). */
  alCambiarDatos(datos: Datos): void {
    if (!this.editable()) return;
    this.datosActuales = datos;
    this.sucio.set(true);
    this.programarGuardado();
  }

  alMarcarGrupoSano(grupo: string): void {
    this.gruposSanos.add(grupo);
  }

  private programarGuardado(): void {
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => void this.guardar(), ESPERA_AUTOGUARDADO_MS);
  }

  /** PUT parcial. Devuelve true si el servidor lo aceptó; false deja `error`/`errores`. */
  async guardar(): Promise<boolean> {
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = null;
    const inspeccion = this.inspeccion();
    if (!inspeccion || !this.editable() || this.conflicto()) return false;
    if (this.guardando()) {
      this.guardadoPendiente = true;
      return false;
    }
    this.guardando.set(true);
    this.error.set('');
    try {
      const respuesta = await this.putAvance(inspeccion);
      this.aplicarRespuestaGuardado(respuesta);
      this.errores.set([]);
      return true;
    } catch (error) {
      await this.alFallarEscritura(error);
      return false;
    } finally {
      this.guardando.set(false);
      if (this.guardadoPendiente && this.sucio()) {
        this.guardadoPendiente = false;
        void this.guardar();
      }
    }
  }

  private async putAvance(inspeccion: InspeccionDTO): Promise<InspeccionDTO> {
    const datos = podarVacios(this.datosActuales);
    const grupos = [...this.gruposSanos];
    const cuerpo = {
      datos,
      version: inspeccion.version,
      ...(grupos.length ? { grupos_sin_danos: grupos } : {}),
    };
    // Mismo cuerpo → misma clave (reintento de red); cuerpo distinto → clave nueva.
    const firma = JSON.stringify(cuerpo);
    if (firma !== this.firmaGuardado) {
      this.firmaGuardado = firma;
      this.claveGuardado = nuevaClave();
    }
    try {
      return await firstValueFrom(
        this.api.guardarAvance(inspeccion.id, cuerpo, { clave: this.claveGuardado }),
      );
    } catch (error) {
      // Los ceros ya van en `datos`; si el servidor aún no conoce el grupo, se guarda sin la marca.
      if (grupos.length && tipoDeError(error) === 'grupo-con-danos') {
        this.gruposSanos.clear();
        const sinGrupos = { datos, version: inspeccion.version };
        this.firmaGuardado = JSON.stringify(sinGrupos);
        this.claveGuardado = nuevaClave();
        return firstValueFrom(
          this.api.guardarAvance(inspeccion.id, sinGrupos, { clave: this.claveGuardado }),
        );
      }
      throw error;
    }
  }

  private aplicarRespuestaGuardado(respuesta: InspeccionDTO): void {
    this.inspeccion.set(respuesta);
    this.firmaGuardado = null;
    this.gruposSanos.clear();
    this.guardadoEn.set(new Date());
    // Si el usuario siguió escribiendo durante el PUT, `sucio` se mantiene vía alCambiarDatos.
    if (!this.guardadoPendiente) this.sucio.set(false);
  }

  private async alFallarEscritura(error: unknown): Promise<void> {
    this.errores.set(erroresDeCampo(error));
    this.error.set(mensajeInspeccion(error));
    const id = this.inspeccion()?.id;
    if (!id) return;
    if (tipoDeError(error) === 'version-desactualizada') {
      try {
        this.conflicto.set(await firstValueFrom(this.api.detalle(id)));
      } catch {
        /* el mensaje ya explica el conflicto; el usuario puede recargar */
      }
    } else if (exigeRecarga(error)) {
      await this.cargar(id);
    }
  }

  /** 409 version-desactualizada: gana lo que el usuario elija, nunca se pisa en silencio. */
  async resolverConflicto(conservarMio: boolean): Promise<void> {
    const servidor = this.conflicto();
    if (!servidor) return;
    this.conflicto.set(null);
    this.error.set('');
    if (conservarMio) {
      this.inspeccion.set(servidor);
      this.acompanantes.set([...(servidor.acompanantes ?? [])]);
      this.sucio.set(true);
      await this.guardar();
    } else {
      await this.cargar(servidor.id);
    }
  }

  // --------------------------------------------------- permanentes

  async confirmarPermanentes(datos: Datos): Promise<boolean> {
    const inspeccion = this.inspeccion();
    const esquema = this.version()?.esquema;
    if (!inspeccion || !esquema || this.confirmando()) return false;
    this.confirmando.set(true);
    this.error.set('');
    this.errores.set([]);
    try {
      const permanentes = extraerPermanentes(podarVacios(datos), esquema);
      const respuesta = await firstValueFrom(
        this.api.confirmarPermanentes(
          inspeccion.id,
          { datos: permanentes },
          { clave: nuevaClave() },
        ),
      );
      this.aplicarServidor(respuesta);
      return true;
    } catch (error) {
      await this.alFallarEscritura(error);
      return false;
    } finally {
      this.confirmando.set(false);
    }
  }

  // ---------------------------------------------------- acompañantes

  agregarAcompanante(): void {
    this.acompanantes.update((lista) => [...lista, { nombre: '', usuario_id: null }]);
  }

  cambiarAcompanante(indice: number, nombre: string): void {
    this.acompanantes.update((lista) => lista.map((a, i) => (i === indice ? { ...a, nombre } : a)));
  }

  quitarAcompanante(indice: number): void {
    this.acompanantes.update((lista) => lista.filter((_, i) => i !== indice));
  }

  /** El PUT reemplaza la lista entera; los nombres en blanco se descartan antes de enviarla. */
  async guardarAcompanantes(): Promise<boolean> {
    const inspeccion = this.inspeccion();
    if (!inspeccion || !this.editable()) return false;
    const lista = this.acompanantes()
      .map((a) => ({ ...a, nombre: a.nombre.trim() }))
      .filter((a) => a.nombre !== '');
    this.error.set('');
    try {
      const respuesta = await firstValueFrom(
        this.api.reemplazarAcompanantes(inspeccion.id, lista, { clave: nuevaClave() }),
      );
      this.aplicarServidor(respuesta);
      return true;
    } catch (error) {
      await this.alFallarEscritura(error);
      return false;
    }
  }

  // ---------------------------------------------------------- archivos

  async subirFoto(foto: FotoCapturada, elementoRef: string | null): Promise<void> {
    if (!this.editable() || !this.puedeAgregarFoto()) return;
    const id = nuevoId();
    this.originales.set(id, foto);
    this.clavesArchivo.set(id, nuevaClave());
    this.agregarArchivo({
      id,
      tipo: 'FOTO',
      nombre: id.slice(0, 8),
      miniaturaUrl: URL.createObjectURL(foto.miniatura),
      elemento_ref: elementoRef,
      estado: 'subiendo',
      mensaje: '',
    });
    await this.transferir(id);
  }

  async subirDocumento(pdf: File): Promise<void> {
    if (!this.editable() || !this.puedeAgregarDocumento()) return;
    const id = nuevoId();
    this.originales.set(id, pdf);
    this.clavesArchivo.set(id, nuevaClave());
    this.agregarArchivo({
      id,
      tipo: 'DOCUMENTO',
      nombre: pdf.name,
      miniaturaUrl: null,
      elemento_ref: null,
      estado: 'subiendo',
      mensaje: '',
    });
    await this.transferir(id);
  }

  /** Reintento con el mismo id y la misma clave: el servidor no duplica. */
  async reintentarArchivo(id: string): Promise<void> {
    this.actualizarArchivo(id, { estado: 'subiendo', mensaje: '' });
    await this.transferir(id);
  }

  private async transferir(id: string): Promise<void> {
    const inspeccion = this.inspeccion();
    const original = this.originales.get(id);
    const archivo = this.archivos().find((a) => a.id === id);
    if (!inspeccion || !original || !archivo) return;
    const opciones = { clave: this.clavesArchivo.get(id) };
    try {
      await firstValueFrom(
        original instanceof File
          ? this.api.subirDocumento(inspeccion.id, id, original, opciones)
          : this.api.subirFoto(inspeccion.id, id, original, archivo.elemento_ref, opciones),
      );
      this.actualizarArchivo(id, { estado: 'subida', mensaje: '' });
      this.originales.delete(id);
    } catch (error) {
      this.actualizarArchivo(id, { estado: 'error', mensaje: mensajeInspeccion(error) });
      if (exigeRecarga(error)) await this.cargar(inspeccion.id);
    }
  }

  async eliminarArchivo(id: string): Promise<void> {
    const archivo = this.archivos().find((a) => a.id === id);
    if (!archivo || !this.editable()) return;
    if (archivo.estado === 'subida') {
      try {
        await firstValueFrom(this.api.eliminarArchivo(id, { clave: nuevaClave() }));
      } catch (error) {
        // Un segundo borrado responde 404: el archivo ya no existe, es un éxito idempotente.
        if (estadoHttp(error) !== 404) {
          this.error.set(mensajeInspeccion(error));
          return;
        }
      }
    }
    this.quitarArchivoLocal(id);
  }

  private agregarArchivo(archivo: ArchivoLocal): void {
    this.archivos.update((lista) => [...lista, archivo]);
  }

  private actualizarArchivo(id: string, cambios: Partial<ArchivoLocal>): void {
    this.archivos.update((lista) => lista.map((a) => (a.id === id ? { ...a, ...cambios } : a)));
  }

  private quitarArchivoLocal(id: string): void {
    const archivo = this.archivos().find((a) => a.id === id);
    if (archivo?.miniaturaUrl) URL.revokeObjectURL(archivo.miniaturaUrl);
    this.originales.delete(id);
    this.clavesArchivo.delete(id);
    this.archivos.update((lista) => lista.filter((a) => a.id !== id));
  }

  // -------------------------------------------------- envío / baja

  /**
   * Guarda lo pendiente y envía. En 422 no se cambia de pantalla: `errores` conserva la lista
   * completa y el siguiente intento usa una `Idempotency-Key` nueva (el 422 queda cacheado).
   */
  async enviar(): Promise<boolean> {
    const inspeccion = this.inspeccion();
    if (!inspeccion || !this.puedeEnviar()) return false;
    this.enviando.set(true);
    this.error.set('');
    this.errores.set([]);
    try {
      if (this.sucio() && !(await this.guardarAntesDeEnviar())) return false;
      const actual = this.inspeccion() ?? inspeccion;
      this.claveEnvio ??= nuevaClave();
      const respuesta = await firstValueFrom(
        this.api.enviar(
          actual.id,
          { enviada_en: new Date().toISOString() },
          { clave: this.claveEnvio },
        ),
      );
      this.claveEnvio = null;
      this.aplicarServidor(respuesta);
      return true;
    } catch (error) {
      if (estadoHttp(error) === 422) this.claveEnvio = null;
      await this.alFallarEscritura(error);
      return false;
    } finally {
      this.enviando.set(false);
    }
  }

  private async guardarAntesDeEnviar(): Promise<boolean> {
    // `guardando` solo lo apaga guardar(); esperamos a que termine el PUT en vuelo si lo hay.
    while (this.guardando()) await new Promise((r) => setTimeout(r, 50));
    return this.sucio() ? this.guardar() : true;
  }

  /** Baja lógica. Un segundo borrado (404) cuenta como éxito. */
  async eliminarBorrador(): Promise<boolean> {
    const inspeccion = this.inspeccion();
    if (!inspeccion || !this.editable()) return false;
    this.error.set('');
    try {
      await firstValueFrom(this.api.eliminar(inspeccion.id, { clave: nuevaClave() }));
      return true;
    } catch (error) {
      if (estadoHttp(error) === 404) return true;
      this.error.set(mensajeInspeccion(error));
      return false;
    }
  }

  private liberar(): void {
    this.generacion++;
    if (this.temporizador) clearTimeout(this.temporizador);
    for (const archivo of this.archivos()) {
      if (archivo.miniaturaUrl) URL.revokeObjectURL(archivo.miniaturaUrl);
    }
  }
}
