import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { FotoCapturada } from '../../shared/captura-foto/captura-foto';
import { recortarClave } from './dispositivo';
import {
  AcompananteDTO,
  ArchivoDTO,
  ConfirmarDatosPermanentesDTO,
  CrearInspeccionDTO,
  DatosPermanentesDTO,
  EnviarInspeccionDTO,
  FiltrosInspecciones,
  GuardarAvanceDTO,
  HistorialTransicionDTO,
  InspeccionDTO,
  InspeccionResumenDTO,
  PaginaInspecciones,
  PuenteInspeccionableDTO,
} from './modelos';

/** DT-BE-08: el backend corta cualquier tamaño de página por encima de 100. */
export const TAMANO_PAGINA = 20;

const API = '/api/v1';

/** Opciones de escritura: `Idempotency-Key` opcional; `X-Sgp-Sync` solo lo manda la cola (P6). */
export interface OpcionesEscritura {
  readonly clave?: string;
  readonly sync?: boolean;
}

function encabezados(opciones?: OpcionesEscritura): HttpHeaders | undefined {
  let headers = new HttpHeaders();
  if (opciones?.clave) headers = headers.set('Idempotency-Key', recortarClave(opciones.clave));
  if (opciones?.sync) headers = headers.set('X-Sgp-Sync', 'true');
  return headers.keys().length ? headers : undefined;
}

function paginar(page: number, size: number, sort?: string): HttpParams {
  let params = new HttpParams().set('page', page).set('size', size);
  if (sort) params = params.set('sort', sort);
  return params;
}

/** Matriz HTTP de P5 (analisis §2.1) más los archivos de P1 que la captura necesita. */
@Injectable({ providedIn: 'root' })
export class InspeccionApi {
  private readonly http = inject(HttpClient);

  puentesInspeccionables(
    page = 0,
    size = TAMANO_PAGINA,
  ): Observable<PaginaInspecciones<PuenteInspeccionableDTO>> {
    return this.http.get<PaginaInspecciones<PuenteInspeccionableDTO>>(
      `${API}/puentes-inspeccionables`,
      { params: paginar(page, size) },
    );
  }

  crear(cuerpo: CrearInspeccionDTO, opciones?: OpcionesEscritura): Observable<InspeccionDTO> {
    return this.http.post<InspeccionDTO>(`${API}/inspecciones`, cuerpo, {
      headers: encabezados(opciones),
    });
  }

  listar(
    filtros: FiltrosInspecciones,
    page = 0,
    size = TAMANO_PAGINA,
  ): Observable<PaginaInspecciones<InspeccionResumenDTO>> {
    let params = paginar(page, size, 'fechaInspeccion,desc');
    for (const [clave, valor] of Object.entries(filtros)) {
      if (valor) params = params.set(clave, valor);
    }
    return this.http.get<PaginaInspecciones<InspeccionResumenDTO>>(`${API}/inspecciones`, {
      params,
    });
  }

  detalle(id: string): Observable<InspeccionDTO> {
    return this.http.get<InspeccionDTO>(`${API}/inspecciones/${encodeURIComponent(id)}`);
  }

  archivos(id: string): Observable<ArchivoDTO[]> {
    return this.http.get<ArchivoDTO[]>(`${API}/inspecciones/${encodeURIComponent(id)}/archivos`);
  }

  guardarAvance(
    id: string,
    cuerpo: GuardarAvanceDTO,
    opciones?: OpcionesEscritura,
  ): Observable<InspeccionDTO> {
    return this.http.put<InspeccionDTO>(`${API}/inspecciones/${encodeURIComponent(id)}`, cuerpo, {
      headers: encabezados(opciones),
    });
  }

  /** 204 sin cuerpo: no se parsea JSON. */
  eliminar(id: string, opciones?: OpcionesEscritura): Observable<void> {
    return this.http.delete<void>(`${API}/inspecciones/${encodeURIComponent(id)}`, {
      headers: encabezados(opciones),
    });
  }

  historial(id: string): Observable<HistorialTransicionDTO[]> {
    return this.http.get<HistorialTransicionDTO[]>(
      `${API}/inspecciones/${encodeURIComponent(id)}/historial`,
    );
  }

  datosPermanentes(id: string): Observable<DatosPermanentesDTO> {
    return this.http.get<DatosPermanentesDTO>(
      `${API}/inspecciones/${encodeURIComponent(id)}/datos-permanentes`,
    );
  }

  datosPermanentesDePuente(puenteId: string): Observable<DatosPermanentesDTO> {
    return this.http.get<DatosPermanentesDTO>(
      `${API}/puentes/${encodeURIComponent(puenteId)}/datos-permanentes`,
    );
  }

  confirmarPermanentes(
    id: string,
    cuerpo: ConfirmarDatosPermanentesDTO,
    opciones?: OpcionesEscritura,
  ): Observable<InspeccionDTO> {
    return this.http.post<InspeccionDTO>(
      `${API}/inspecciones/${encodeURIComponent(id)}/confirmacion-datos-permanentes`,
      cuerpo,
      { headers: encabezados(opciones) },
    );
  }

  /** PUT reemplaza la lista completa. */
  reemplazarAcompanantes(
    id: string,
    acompanantes: readonly AcompananteDTO[],
    opciones?: OpcionesEscritura,
  ): Observable<InspeccionDTO> {
    return this.http.put<InspeccionDTO>(
      `${API}/inspecciones/${encodeURIComponent(id)}/acompanantes`,
      { acompanantes },
      { headers: encabezados(opciones) },
    );
  }

  /** Cuerpo opcional; `indice_condicion` y `estado_calculado` los ignora el servidor. */
  enviar(
    id: string,
    cuerpo: EnviarInspeccionDTO = {},
    opciones?: OpcionesEscritura,
  ): Observable<InspeccionDTO> {
    return this.http.post<InspeccionDTO>(
      `${API}/inspecciones/${encodeURIComponent(id)}/envio`,
      cuerpo,
      { headers: encabezados(opciones) },
    );
  }

  deUnPuente(
    puenteId: string,
    page = 0,
    size = TAMANO_PAGINA,
  ): Observable<PaginaInspecciones<InspeccionResumenDTO>> {
    return this.http.get<PaginaInspecciones<InspeccionResumenDTO>>(
      `${API}/puentes/${encodeURIComponent(puenteId)}/inspecciones`,
      { params: paginar(page, size, 'fechaInspeccion,desc') },
    );
  }

  /** Contrato 9 de P1: el `id` (UUID v7) lo genera el cliente antes de subir. */
  subirFoto(
    inspeccionId: string,
    fotoId: string,
    foto: FotoCapturada,
    elementoRef: string | null,
    opciones?: OpcionesEscritura,
  ): Observable<ArchivoDTO> {
    const datos = new FormData();
    datos.append('id', fotoId);
    datos.append('foto', foto.archivo, `${fotoId}.${extension(foto.archivo)}`);
    datos.append('miniatura', foto.miniatura, `${fotoId}-miniatura.${extension(foto.miniatura)}`);
    if (elementoRef) datos.append('elemento_ref', elementoRef);
    if (foto.latitud !== null) datos.append('latitud', String(foto.latitud));
    if (foto.longitud !== null) datos.append('longitud', String(foto.longitud));
    datos.append('capturada_en', foto.capturada_en);
    return this.http.post<ArchivoDTO>(
      `${API}/inspecciones/${encodeURIComponent(inspeccionId)}/fotos`,
      datos,
      { headers: encabezados(opciones) },
    );
  }

  subirDocumento(
    inspeccionId: string,
    documentoId: string,
    pdf: File,
    opciones?: OpcionesEscritura,
  ): Observable<ArchivoDTO> {
    const datos = new FormData();
    datos.append('id', documentoId);
    datos.append('pdf', pdf, `${documentoId}.pdf`);
    return this.http.post<ArchivoDTO>(
      `${API}/inspecciones/${encodeURIComponent(inspeccionId)}/documentos`,
      datos,
      { headers: encabezados(opciones) },
    );
  }

  eliminarArchivo(archivoId: string, opciones?: OpcionesEscritura): Observable<void> {
    return this.http.delete<void>(`${API}/archivos/${encodeURIComponent(archivoId)}`, {
      headers: encabezados(opciones),
    });
  }
}

function extension(blob: Blob): string {
  return blob.type === 'image/webp' ? 'webp' : 'jpg';
}
