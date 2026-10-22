import { Routes } from '@angular/router';
import { visitanteGuard } from '../../core/auth/visitante.guard';
import { TEXTOS } from '../../shared/textos';

/** Rutas exactas de los correos del backend. Verificar, restablecer y aceptar siguen públicas. */
export const RUTAS_AUTH: Routes = [
  {
    path: 'login',
    title: TEXTOS.auth.login.titulo,
    canActivate: [visitanteGuard],
    loadComponent: () => import('./login').then((m) => m.Login),
  },
  {
    path: 'registro',
    title: TEXTOS.auth.registro.titulo,
    canActivate: [visitanteGuard],
    loadComponent: () => import('./registro').then((m) => m.Registro),
  },
  {
    path: 'verificar-correo',
    title: TEXTOS.auth.verificar.titulo,
    loadComponent: () => import('./verificar-correo').then((m) => m.VerificarCorreo),
  },
  {
    path: 'recuperar-contrasena',
    title: TEXTOS.auth.recuperar.titulo,
    canActivate: [visitanteGuard],
    loadComponent: () => import('./recuperar-contrasena').then((m) => m.RecuperarContrasena),
  },
  {
    path: 'restablecer-contrasena',
    title: TEXTOS.auth.restablecer.titulo,
    loadComponent: () => import('./restablecer-contrasena').then((m) => m.RestablecerContrasena),
  },
  {
    path: 'aceptar-invitacion',
    title: TEXTOS.auth.invitacion.titulo,
    loadComponent: () => import('./aceptar-invitacion').then((m) => m.AceptarInvitacion),
  },
];
