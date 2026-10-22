import { Routes } from '@angular/router';
import { TEXTOS } from '../../shared/textos';

/** Rutas exactas de los correos del backend. Las guardias se agregan en la fase 1. */
export const RUTAS_AUTH: Routes = [
  {
    path: 'login',
    title: TEXTOS.auth.login.titulo,
    loadComponent: () => import('./login').then((m) => m.Login),
  },
  {
    path: 'registro',
    title: TEXTOS.auth.registro.titulo,
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
