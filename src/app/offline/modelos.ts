export type Json = null | boolean | number | string | Json[] | { [clave: string]: Json };
export interface RegistroLocal {
  id: string;
  propietario_id: string;
  modelo_version: number;
}
export interface ReferenciaLocal extends RegistroLocal {
  datos: Json;
  preparada_en: string;
}
export interface InspeccionLocal extends RegistroLocal {
  puente_id: string;
  formulario_version_id: string;
  respuestas: Json;
  metadatos: Json;
  version_local: number;
  version_confirmada: number;
  creada_en: string;
  modificada_en: string;
  intencion_envio_en: string | null;
  estado_remoto: Json;
}
export interface ArchivoLocal extends RegistroLocal {
  inspeccion_id: string;
  archivo: Blob;
  miniatura?: Blob;
  elemento_ref: string | null;
  latitud: number | null;
  longitud: number | null;
  capturada_en: string;
  mime: string;
  tamano: number;
  confirmado: boolean;
}
export type EstadoOperacion = 'pendiente' | 'en_proceso' | 'confirmada' | 'requiere_intervencion';
export interface Operacion extends RegistroLocal {
  inspeccion_id: string;
  entidad_id: string;
  tipo: 'datos' | 'foto' | 'documento' | 'envio';
  version_local: number;
  payload: Json;
  clave: string;
  dependencias: string[];
  estado: EstadoOperacion;
  intentos: number;
  proximo_intento: number;
  ultimo_intento: number | null;
  error: string | null;
  ejecucion: string | null;
  resultado: Json | null;
}
export interface Bloqueo {
  propietario_id: string;
  token: string;
  vence_en: number;
}
export type ResultadoTransporte =
  | {
      tipo: 'ack';
      propietario_id: string;
      operacion_id: string;
      version_local: number;
      resultado: Json;
    }
  | { tipo: 'transitorio' | 'negocio' | 'sesion'; mensaje: string };
export interface TransporteSync {
  ejecutar(
    operacion: Readonly<Operacion>,
    archivo: ArchivoLocal | undefined,
    signal: AbortSignal,
  ): Promise<ResultadoTransporte>;
}
export interface SesionOffline {
  propietarioActual(): string | null;
  preparar(propietario_id: string): Promise<boolean>;
}
export interface ReferenciaOffline {
  consultar(
    propietario_id: string,
  ): Promise<{ puentes: ReferenciaLocal[]; esquemas_formulario: ReferenciaLocal[] }>;
}
