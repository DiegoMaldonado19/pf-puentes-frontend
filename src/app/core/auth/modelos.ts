/** Contratos de P2; nombres iguales al JSON del backend (snake_case). */

export type Rol = 'ESTUDIANTE' | 'PROFESIONAL_EXTERNO' | 'CATEDRATICO' | 'ADMINISTRADOR';
export type RolInvitable = Exclude<Rol, 'ESTUDIANTE'>;
export type EstadoUsuario = 'PENDIENTE' | 'ACTIVO' | 'INACTIVO';
export type EstadoInvitacion = 'ABIERTA' | 'ACEPTADA' | 'REVOCADA' | 'VENCIDA';
export type AccionAuditoria =
  | 'CREAR'
  | 'MODIFICAR'
  | 'CAMBIAR_ESTADO'
  | 'DAR_DE_BAJA'
  | 'REACTIVAR'
  | 'MODERAR'
  | 'INVITAR'
  | 'REVOCAR_INVITACION'
  | 'VERIFICAR_COLEGIADO'
  | 'BLOQUEAR_CUENTA';

/** DT-BE-08: el backend no devuelve más de 100 por página. */
export const TAMANO_MAXIMO_PAGINA = 100;

/** Forma de página de usuario/, invitaciones y bitácora. No reutilizar la de puentes. */
export interface PaginaDTO<T> {
  readonly content: readonly T[];
  readonly number: number;
  readonly size: number;
  readonly total_elements: number;
  readonly total_pages: number;
}

export interface UsuarioSesionDTO {
  readonly id: string;
  readonly nombre: string;
  readonly rol: Rol;
}

export interface SesionDTO {
  readonly access_token: string;
  readonly token_type: 'Bearer';
  readonly expires_in: number;
  readonly usuario: UsuarioSesionDTO;
}

export interface LoginDTO {
  readonly correo: string;
  readonly contrasena: string;
}

export interface RegistroDTO {
  readonly nombre: string;
  readonly correo: string;
  readonly contrasena: string;
}

export interface CuentaRegistradaDTO {
  readonly id: string;
  readonly nombre: string;
  readonly correo: string;
  readonly rol: Rol;
  readonly estado: EstadoUsuario;
  readonly correo_verificado: boolean;
}

export interface TokenDTO {
  readonly token: string;
}

export interface CorreoDTO {
  readonly correo: string;
}

export interface InvitacionPublicaDTO {
  readonly correo: string;
  readonly rol: Rol;
  readonly expira_en: string;
}

export interface AceptarInvitacionDTO {
  readonly token: string;
  readonly nombre: string;
  readonly contrasena: string;
  readonly numero_colegiado?: string;
}

export interface RestablecerContrasenaDTO {
  readonly token: string;
  readonly contrasena: string;
}

export interface PerfilDTO {
  readonly id: string;
  readonly nombre: string;
  readonly correo: string;
  readonly rol: Rol;
  readonly estado: EstadoUsuario;
}

export interface CambiarContrasenaDTO {
  readonly contrasena_actual: string;
  readonly contrasena_nueva: string;
}

export interface CrearInvitacionDTO {
  readonly correo: string;
  readonly rol: RolInvitable;
}

export interface InvitacionDTO {
  readonly id: string;
  readonly correo: string;
  readonly rol: Rol;
  readonly estado: EstadoInvitacion;
  readonly expira_en: string;
  readonly creado_en: string;
  readonly administrador_id: string;
  readonly administrador_nombre: string;
  readonly usuario_id: string | null;
}

export interface UsuarioAdminDTO {
  readonly id: string;
  readonly nombre: string;
  readonly correo: string;
  readonly rol: Rol;
  readonly estado: EstadoUsuario;
  readonly correo_verificado: boolean;
  readonly numero_colegiado: string | null;
  readonly colegiado_verificado_en: string | null;
  readonly desactivado_en: string | null;
  readonly motivo_baja: string | null;
  readonly creado_en: string;
}

export interface MotivoDTO {
  readonly motivo: string;
}

export interface AuditoriaDTO {
  readonly id: string;
  readonly usuario_id: string | null;
  readonly accion: string;
  readonly entidad: string;
  readonly entidad_id: string;
  readonly valor_anterior: Record<string, unknown> | null;
  readonly valor_nuevo: Record<string, unknown> | null;
  readonly motivo: string | null;
  readonly origen_ip: string | null;
  readonly correlacion_id: string;
  readonly creado_en: string;
}
