import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import {
  AceptarInvitacionDTO,
  CambiarContrasenaDTO,
  CuentaRegistradaDTO,
  InvitacionPublicaDTO,
  PerfilDTO,
  RegistroDTO,
} from '../../core/auth/modelos';

const API_AUTH = '/api/v1/auth';
const API_USUARIOS = '/api/v1/usuarios';

@Injectable({ providedIn: 'root' })
export class CuentaService {
  private readonly http = inject(HttpClient);

  registrar(nombre: string, correo: string, contrasena: string): Observable<CuentaRegistradaDTO> {
    const cuerpo: RegistroDTO = {
      nombre: nombre.trim(),
      correo: correo.trim().toLowerCase(),
      contrasena,
    };
    return this.http.post<CuentaRegistradaDTO>(`${API_AUTH}/registro`, cuerpo);
  }

  verificarCorreo(token: string): Observable<void> {
    return this.vacio(`${API_AUTH}/verificar-correo`, { token });
  }

  reenviarVerificacion(correo: string): Observable<void> {
    return this.vacio(`${API_AUTH}/reenviar-verificacion`, {
      correo: correo.trim().toLowerCase(),
    });
  }

  consultarInvitacion(token: string): Observable<InvitacionPublicaDTO> {
    return this.http.post<InvitacionPublicaDTO>(`${API_AUTH}/invitaciones/consultar`, { token });
  }

  aceptarInvitacion(datos: AceptarInvitacionDTO): Observable<CuentaRegistradaDTO> {
    return this.http.post<CuentaRegistradaDTO>(`${API_AUTH}/invitaciones/aceptar`, datos);
  }

  recuperarContrasena(correo: string): Observable<void> {
    return this.vacio(`${API_AUTH}/recuperar-contrasena`, {
      correo: correo.trim().toLowerCase(),
    });
  }

  restablecerContrasena(token: string, contrasena: string): Observable<void> {
    return this.vacio(`${API_AUTH}/restablecer-contrasena`, { token, contrasena });
  }

  perfil(): Observable<PerfilDTO> {
    return this.http.get<PerfilDTO>(`${API_USUARIOS}/me`);
  }

  cambiarContrasena(actual: string, nueva: string): Observable<void> {
    const cuerpo: CambiarContrasenaDTO = {
      contrasena_actual: actual,
      contrasena_nueva: nueva,
    };
    return this.http
      .put(`${API_USUARIOS}/me/contrasena`, cuerpo, { observe: 'response' })
      .pipe(map(() => undefined));
  }

  private vacio(url: string, cuerpo: object): Observable<void> {
    return this.http.post(url, cuerpo, { observe: 'response' }).pipe(map(() => undefined));
  }
}
