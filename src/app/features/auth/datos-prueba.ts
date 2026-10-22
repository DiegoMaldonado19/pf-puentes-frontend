import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { authInterceptor } from '../../core/auth/auth.interceptor';
import {
  CuentaRegistradaDTO,
  EstadoUsuario,
  InvitacionPublicaDTO,
  PerfilDTO,
  Rol,
  SesionDTO,
} from '../../core/auth/modelos';
import { erroresInterceptor } from '../../core/errores/errores.interceptor';

export function sesion(
  rol: SesionDTO['usuario']['rol'] = 'ESTUDIANTE',
  token = 'tok-1',
): SesionDTO {
  return {
    access_token: token,
    token_type: 'Bearer',
    expires_in: 900,
    usuario: { id: 'u1', nombre: 'Ana Pérez', rol },
  };
}

export function problema(type: string, extra: Record<string, unknown> = {}) {
  return { type: `https://sgp.cunoc.usac.edu.gt/errores/${type}`, ...extra };
}

export function cuentaRegistrada(
  rol: Rol = 'ESTUDIANTE',
  estado: EstadoUsuario = 'PENDIENTE',
): CuentaRegistradaDTO {
  return {
    id: 'u1',
    nombre: 'Ana Pérez',
    correo: 'ana@correo.com',
    rol,
    estado,
    correo_verificado: rol === 'ESTUDIANTE' ? false : true,
  };
}

export function perfilDto(rol: Rol = 'ESTUDIANTE'): PerfilDTO {
  return {
    id: 'u1',
    nombre: 'Ana Pérez',
    correo: 'ana@correo.com',
    rol,
    estado: 'ACTIVO',
  };
}

export function invitacionPublica(rol: Rol = 'CATEDRATICO'): InvitacionPublicaDTO {
  return {
    correo: 'invitada@correo.com',
    rol,
    expira_en: '2026-12-31T06:00:00Z',
  };
}

export function rutaConToken(token?: string) {
  const map = convertToParamMap(token ? { token } : {});
  return {
    snapshot: { queryParamMap: map },
    queryParamMap: of(map),
  } as unknown as ActivatedRoute;
}

export function proveedoresAuth(ruta?: ActivatedRoute) {
  return [
    provideHttpClient(withInterceptors([authInterceptor, erroresInterceptor])),
    provideHttpClientTesting(),
    provideRouter([
      { path: 'login', children: [] },
      { path: 'registro', children: [] },
      { path: 'puentes', children: [] },
      { path: 'admin/usuarios', children: [] },
      { path: 'recuperar-contrasena', children: [] },
      { path: 'verificar-correo', children: [] },
      { path: 'perfil', children: [] },
    ]),
    ...(ruta ? [{ provide: ActivatedRoute, useValue: ruta }] : []),
  ];
}

export async function estabilizar(fixture: ComponentFixture<unknown>): Promise<void> {
  TestBed.tick();
  fixture.detectChanges();
  await Promise.resolve();
  TestBed.tick();
  fixture.detectChanges();
}

export function escribir(html: HTMLElement, id: string, valor: string): void {
  const campo = html.querySelector<HTMLInputElement>(`#${id}`);
  if (!campo) throw new Error(`No está el campo ${id}`);
  campo.value = valor;
  campo.dispatchEvent(new Event('input'));
  campo.dispatchEvent(new Event('blur'));
}
