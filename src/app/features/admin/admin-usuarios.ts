import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import {
  AccionAuditoria,
  AuditoriaDTO,
  CrearInvitacionDTO,
  EstadoInvitacion,
  EstadoUsuario,
  InvitacionDTO,
  PaginaDTO,
  Rol,
  RolInvitable,
  TAMANO_MAXIMO_PAGINA,
  UsuarioAdminDTO,
} from '../../core/auth/modelos';

const API = '/api/v1';
export const TAMANO_PAGINA_ADMIN = 20;

@Injectable({ providedIn: 'root' })
export class AdminUsuariosService {
  private readonly http = inject(HttpClient);

  listarInvitaciones(
    filtros: { estado?: EstadoInvitacion | ''; page?: number; size?: number } = {},
  ): Observable<PaginaDTO<InvitacionDTO>> {
    return this.http.get<PaginaDTO<InvitacionDTO>>(`${API}/invitaciones`, {
      params: this.params({
        estado: filtros.estado,
        page: filtros.page ?? 0,
        size: this.tamano(filtros.size),
      }),
    });
  }

  crearInvitacion(correo: string, rol: RolInvitable): Observable<InvitacionDTO> {
    const cuerpo: CrearInvitacionDTO = { correo: correo.trim().toLowerCase(), rol };
    return this.http.post<InvitacionDTO>(`${API}/invitaciones`, cuerpo);
  }

  revocarInvitacion(id: string): Observable<InvitacionDTO> {
    return this.http.post<InvitacionDTO>(`${API}/invitaciones/${id}/revocacion`, {});
  }

  listarUsuarios(
    filtros: {
      rol?: Rol | '';
      estado?: EstadoUsuario | '';
      q?: string;
      page?: number;
      size?: number;
    } = {},
  ): Observable<PaginaDTO<UsuarioAdminDTO>> {
    return this.http.get<PaginaDTO<UsuarioAdminDTO>>(`${API}/usuarios`, {
      params: this.params({
        rol: filtros.rol,
        estado: filtros.estado,
        q: filtros.q?.trim(),
        page: filtros.page ?? 0,
        size: this.tamano(filtros.size),
      }),
    });
  }

  detalleUsuario(id: string): Observable<UsuarioAdminDTO> {
    return this.http.get<UsuarioAdminDTO>(`${API}/usuarios/${id}`);
  }

  darDeBaja(id: string, motivo: string): Observable<void> {
    return this.http
      .post(`${API}/usuarios/${id}/baja`, { motivo: motivo.trim() })
      .pipe(map(() => undefined));
  }

  reactivar(id: string): Observable<void> {
    return this.vacio(`${API}/usuarios/${id}/reactivacion`);
  }

  aprobarColegiado(id: string): Observable<void> {
    return this.vacio(`${API}/usuarios/${id}/colegiado/verificacion`);
  }

  rechazarColegiado(id: string, motivo: string): Observable<void> {
    return this.http
      .post(`${API}/usuarios/${id}/colegiado/rechazo`, { motivo: motivo.trim() })
      .pipe(map(() => undefined));
  }

  listarAuditoria(
    filtros: {
      entidad?: string;
      entidad_id?: string;
      usuario_id?: string;
      accion?: AccionAuditoria | '';
      desde?: string;
      hasta?: string;
      page?: number;
      size?: number;
    } = {},
  ): Observable<PaginaDTO<AuditoriaDTO>> {
    return this.http.get<PaginaDTO<AuditoriaDTO>>(`${API}/auditoria`, {
      params: this.params({
        entidad: filtros.entidad?.trim(),
        entidad_id: filtros.entidad_id?.trim(),
        usuario_id: filtros.usuario_id?.trim(),
        accion: filtros.accion,
        desde: filtros.desde,
        hasta: filtros.hasta,
        page: filtros.page ?? 0,
        size: this.tamano(filtros.size),
      }),
    });
  }

  private vacio(url: string): Observable<void> {
    return this.http.post(url, {}, { observe: 'response' }).pipe(map(() => undefined));
  }

  private tamano(size?: number): number {
    return Math.min(size ?? TAMANO_PAGINA_ADMIN, TAMANO_MAXIMO_PAGINA);
  }

  private params(valores: Record<string, string | number | undefined | null>): HttpParams {
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(valores)) {
      if (valor === undefined || valor === null || valor === '') continue;
      params = params.set(clave, String(valor));
    }
    return params;
  }
}
