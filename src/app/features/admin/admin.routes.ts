import { Routes } from '@angular/router';
import { TEXTOS } from '../../shared/textos';

/** Rutas de administración de P2. No incluye pesos (P8). Las guardias se agregan en la fase 1. */
export const RUTAS_ADMIN: Routes = [
  {
    path: 'invitaciones',
    title: TEXTOS.admin.invitaciones.titulo,
    loadComponent: () => import('./invitaciones/invitaciones').then((m) => m.Invitaciones),
  },
  {
    path: 'usuarios',
    title: TEXTOS.admin.usuarios.titulo,
    loadComponent: () => import('./usuarios/usuarios').then((m) => m.Usuarios),
  },
  {
    path: 'usuarios/:id',
    title: TEXTOS.admin.usuarios.ficha,
    loadComponent: () => import('./usuarios/ficha-usuario').then((m) => m.FichaUsuario),
  },
  {
    path: 'auditoria',
    title: TEXTOS.admin.auditoria.titulo,
    loadComponent: () => import('./auditoria/auditoria').then((m) => m.Auditoria),
  },
];
