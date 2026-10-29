import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { finalize, Observable } from 'rxjs';
import { mensajeAdjuntado } from '../core/errores/errores.interceptor';
import { detalleDeProblema, tipoDeProblema } from '../core/errores/problema';
import { TEXTOS } from '../shared/textos';
import { hoyGuatemala, idDispositivo } from '../features/inspecciones/dispositivo';
import { BaseLocal } from './base-local';
import { ArchivoLocal, Json, Operacion, ResultadoTransporte, TransporteSync } from './modelos';

const API = '/api/v1/inspecciones';
const TRANSITORIOS = new Set([0, 408, 429]);
const EXTENSIONES: Readonly<Record<string, string>> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'application/pdf': 'pdf',
};

/** Lo que la captura de P5 guarda en `metadatos`; el servidor lo pide al crear o guardar (ADR 0033). */
export interface MetadatosInspeccion {
  fecha_inspeccion?: string;
  asignacion_id?: string;
  curso_id?: string;
  latitud?: number;
  longitud?: number;
  grupos_sin_danos?: string[];
  supersede_a_id?: string;
  motivo_correccion?: string;
  permanentes_confirmados_en?: string;
  permanentes?: Json;
}

interface PayloadDatos {
  respuestas: Json;
  puente_id: string;
  metadatos: MetadatosInspeccion | null;
  creada_en: string;
}

/** P1 (docs/base-offline.md): lleva cada operación de la cola a la API con su clave y su UUID. */
@Injectable({ providedIn: 'root' })
export class TransporteHttp implements TransporteSync {
  private readonly http = inject(HttpClient);
  private readonly db = inject(BaseLocal);

  async ejecutar(
    operacion: Readonly<Operacion>,
    archivo: ArchivoLocal | undefined,
    signal: AbortSignal,
  ): Promise<ResultadoTransporte> {
    if ((operacion.tipo === 'foto' || operacion.tipo === 'documento') && !archivo) {
      return { tipo: 'negocio', mensaje: TEXTOS.offline.noDisponible };
    }
    try {
      const resultado = await this.enviar(operacion, archivo as ArchivoLocal, signal);
      return {
        tipo: 'ack',
        propietario_id: operacion.propietario_id,
        operacion_id: operacion.id,
        version_local: operacion.version_local,
        resultado,
      };
    } catch (error) {
      if (signal.aborted) throw error;
      return rechazo(error);
    }
  }

  private enviar(o: Readonly<Operacion>, archivo: ArchivoLocal, signal: AbortSignal) {
    const ruta = `${API}/${o.inspeccion_id}`;
    switch (o.tipo) {
      case 'datos':
        return this.guardar(o, signal);
      case 'envio': {
        const { intencion_envio_en } = o.payload as { intencion_envio_en: string };
        const cuerpo = { enviada_en: intencion_envio_en };
        const headers = encabezados(o);
        return this.peticion(this.http.post<Json>(`${ruta}/envio`, cuerpo, { headers }), signal);
      }
      case 'foto':
        return this.peticion(
          this.http.post<Json>(`${ruta}/fotos`, formularioFoto(archivo)),
          signal,
        );
      case 'documento':
        return this.peticion(
          this.http.post<Json>(`${ruta}/documentos`, formularioDocumento(archivo)),
          signal,
        );
    }
  }

  private async guardar(o: Readonly<Operacion>, signal: AbortSignal): Promise<Json> {
    const payload = o.payload as unknown as PayloadDatos;
    const metadatos = payload.metadatos ?? {};
    const cuerpo = {
      datos: payload.respuestas,
      version: await this.versionConfirmada(o),
      fecha_inspeccion: metadatos.fecha_inspeccion,
      grupos_sin_danos: metadatos.grupos_sin_danos,
    };
    const headers = encabezados(o);
    const guardar = () =>
      this.peticion(this.http.put<Json>(`${API}/${o.inspeccion_id}`, cuerpo, { headers }), signal);
    let resultado: Json;
    try {
      resultado = await guardar();
    } catch (error) {
      if (!(error instanceof HttpErrorResponse) || error.status !== 404) throw error;
      // Un 404 de una inspección ya confirmada no autoriza a revivir su UUID.
      if (await this.tieneConfirmacionRemota(o)) throw new BorradorRemotoNoDisponible();
      // El borrador nació sin conexión: el alta es idempotente por su UUID v7 (DT-OFF-05).
      await this.peticion(this.http.post<Json>(API, this.alta(o, payload, metadatos)), signal);
      resultado = await guardar();
    }
    const confirmados =
      resultado &&
      typeof resultado === 'object' &&
      !Array.isArray(resultado) &&
      resultado['datos_permanentes_confirmados_en'];
    if (metadatos.permanentes_confirmados_en && !confirmados) {
      return this.peticion(
        this.http.post<Json>(
          `${API}/${o.inspeccion_id}/confirmacion-datos-permanentes`,
          { datos: metadatos.permanentes ?? {} },
          { headers: headers.set('Idempotency-Key', `${o.clave}:permanentes`) },
        ),
        signal,
      );
    }
    return resultado;
  }

  /** Huella del PUT = DTO completo: la versión sale de lo confirmado y no cambia al reintentar. */
  private async versionConfirmada(o: Readonly<Operacion>): Promise<number> {
    const previas = await this.db.cola_sync
      .where('[propietario_id+inspeccion_id]')
      .equals([o.propietario_id, o.inspeccion_id])
      .sortBy('id');
    let version = 0;
    for (const previa of previas) {
      const resultado = previa.resultado;
      const confirmada =
        resultado && typeof resultado === 'object' && !Array.isArray(resultado)
          ? resultado['version']
          : undefined;
      if (previa.id < o.id && previa.estado === 'confirmada' && typeof confirmada === 'number') {
        version = confirmada;
      }
    }
    return version;
  }

  private async tieneConfirmacionRemota(o: Readonly<Operacion>): Promise<boolean> {
    const inspeccion = await this.db.inspecciones.get(o.inspeccion_id);
    if (inspeccion?.propietario_id === o.propietario_id && inspeccion.version_confirmada > 0)
      return true;
    return (
      (await this.db.cola_sync
        .where('[propietario_id+inspeccion_id]')
        .equals([o.propietario_id, o.inspeccion_id])
        .filter((previa) => previa.estado === 'confirmada')
        .count()) > 0
    );
  }

  private alta(o: Readonly<Operacion>, payload: PayloadDatos, metadatos: MetadatosInspeccion) {
    return {
      id: o.inspeccion_id,
      puente_id: payload.puente_id,
      asignacion_id: metadatos.asignacion_id,
      curso_id: metadatos.curso_id,
      fecha_inspeccion: metadatos.fecha_inspeccion ?? hoyGuatemala(new Date(payload.creada_en)),
      dispositivo_id: idDispositivo(),
      latitud: metadatos.latitud,
      longitud: metadatos.longitud,
      creada_en_dispositivo: payload.creada_en,
      supersede_a_id: metadatos.supersede_a_id,
      motivo_correccion: metadatos.motivo_correccion,
    };
  }

  /** Si el motor aborta (cambio de propietario o cierre), la petición en vuelo se cancela. */
  private peticion<T>(peticion: Observable<T>, signal: AbortSignal): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (signal.aborted) {
        reject(abortado());
        return;
      }
      const cancelar = () => {
        suscripcion.unsubscribe();
        reject(abortado());
      };
      signal.addEventListener('abort', cancelar, { once: true });
      const suscripcion = peticion
        .pipe(finalize(() => signal.removeEventListener('abort', cancelar)))
        .subscribe({ next: resolve, error: reject });
    });
  }
}

function encabezados(o: Readonly<Operacion>): HttpHeaders {
  return new HttpHeaders({ 'Idempotency-Key': o.clave, 'X-Sgp-Sync': 'true' });
}

function nombre(id: string, archivo: Blob, sufijo = ''): string {
  return `${id}${sufijo}.${EXTENSIONES[archivo.type] ?? 'bin'}`;
}

/** Contrato 9 tal como lo pide SubirFotoDTO; el id local hace que un reintento no duplique. */
function formularioFoto(archivo: ArchivoLocal): FormData {
  const datos = new FormData();
  datos.append('id', archivo.id);
  datos.append('foto', archivo.archivo, nombre(archivo.id, archivo.archivo));
  if (archivo.miniatura) {
    datos.append(
      'miniatura',
      archivo.miniatura,
      nombre(archivo.id, archivo.miniatura, '-miniatura'),
    );
  }
  if (archivo.elemento_ref) datos.append('elemento_ref', archivo.elemento_ref);
  if (archivo.latitud !== null) datos.append('latitud', String(archivo.latitud));
  if (archivo.longitud !== null) datos.append('longitud', String(archivo.longitud));
  datos.append('capturada_en', archivo.capturada_en);
  return datos;
}

function formularioDocumento(archivo: ArchivoLocal): FormData {
  const datos = new FormData();
  datos.append('id', archivo.id);
  datos.append('pdf', archivo.archivo, nombre(archivo.id, archivo.archivo));
  return datos;
}

/** 409 operacion-en-proceso se reintenta con la misma clave; el resto de rechazos es de negocio. */
function rechazo(error: unknown): ResultadoTransporte {
  if (error instanceof BorradorRemotoNoDisponible)
    return { tipo: 'negocio', mensaje: TEXTOS.offline.remotoNoDisponible };
  if (!(error instanceof HttpErrorResponse)) {
    const mensaje = error instanceof Error ? error.message : TEXTOS.offline.errorTransporte;
    return { tipo: 'transitorio', mensaje };
  }
  let tipo: 'transitorio' | 'negocio' | 'sesion' = 'negocio';
  if (error.status === 401) tipo = 'sesion';
  else if (TRANSITORIOS.has(error.status) || error.status >= 500) tipo = 'transitorio';
  else if (tipoDeProblema(error) === 'operacion-en-proceso') tipo = 'transitorio';
  const mensaje = mensajeAdjuntado.get(error) ?? detalleDeProblema(error) ?? TEXTOS.offline[tipo];
  return { tipo, mensaje };
}

class BorradorRemotoNoDisponible extends Error {}

function abortado(): DOMException {
  return new DOMException('Abort', 'AbortError');
}
