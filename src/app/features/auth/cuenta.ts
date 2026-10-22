import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import {
  AceptarInvitacionDTO,
  CuentaRegistradaDTO,
  InvitacionPublicaDTO,
  RegistroDTO,
} from '../../core/auth/modelos';

const API_AUTH = '/api/v1/auth';

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

  private vacio(url: string, cuerpo: object): Observable<void> {
    return this.http.post(url, cuerpo, { observe: 'response' }).pipe(map(() => undefined));
  }
}
