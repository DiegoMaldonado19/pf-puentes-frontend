import { AuditoriaDTO, InvitacionDTO, PaginaDTO, UsuarioAdminDTO } from '../../core/auth/modelos';

export function paginaAdmin<T>(content: T[], number = 0, size = 20): PaginaDTO<T> {
  return {
    content,
    number,
    size,
    total_elements: content.length,
    total_pages: content.length ? 1 : 0,
  };
}

export function invitacionAdmin(cambios: Partial<InvitacionDTO> = {}): InvitacionDTO {
  return {
    id: 'inv-1',
    correo: 'catedra@correo.com',
    rol: 'CATEDRATICO',
    estado: 'ABIERTA',
    expira_en: '2026-12-31T06:00:00Z',
    creado_en: '2026-10-22T15:00:00Z',
    administrador_id: 'u1',
    administrador_nombre: 'Ana Pérez',
    usuario_id: null,
    ...cambios,
  };
}

export function usuarioAdmin(cambios: Partial<UsuarioAdminDTO> = {}): UsuarioAdminDTO {
  return {
    id: 'u2',
    nombre: 'Luis Soto',
    correo: 'luis@correo.com',
    rol: 'ESTUDIANTE',
    estado: 'ACTIVO',
    correo_verificado: true,
    numero_colegiado: null,
    colegiado_verificado_en: null,
    desactivado_en: null,
    motivo_baja: null,
    creado_en: '2026-10-01T15:00:00Z',
    ...cambios,
  };
}

export function eventoAuditoria(cambios: Partial<AuditoriaDTO> = {}): AuditoriaDTO {
  return {
    id: 'aud-1',
    usuario_id: 'u1',
    accion: 'INVITAR',
    entidad: 'Invitacion',
    entidad_id: 'inv-1',
    valor_anterior: null,
    valor_nuevo: { correo: 'c***@correo.com' },
    motivo: null,
    origen_ip: '190.0.0.1',
    correlacion_id: 'corr-1',
    creado_en: '2026-10-22T15:00:00Z',
    ...cambios,
  };
}
