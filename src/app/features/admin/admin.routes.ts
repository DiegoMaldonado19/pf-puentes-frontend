import { Routes } from '@angular/router';
import { TEXTOS } from '../../shared/textos';

/** Administración P2 y consulta de pesos P8. La guardia Administrador está en el padre. */
export const RUTAS_ADMIN: Routes = [
  {
    path: 'pesos',
    title: TEXTOS.pesos.acceso.titulo,
    loadComponent: () => import('./pesos/acceso-pesos').then((m) => m.AccesoPesos),
  },
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
