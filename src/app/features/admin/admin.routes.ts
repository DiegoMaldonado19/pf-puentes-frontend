import { Routes } from '@angular/router';
import { TEXTOS } from '../../shared/textos';

/** Rutas de administración de P2. No incluye pesos (P8). La guardia de rol está en el padre. */
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
  {
    path: 'formularios',
    title: TEXTOS.formulario.admin.titulo,
    loadComponent: () =>
      import('./formularios/listado-versiones').then((m) => m.ListadoVersiones),
  },
  {
    path: 'formularios/nuevo',
    title: TEXTOS.formulario.admin.nuevaVersion,
    loadComponent: () =>
      import('./formularios/editor-formulario').then((m) => m.EditorFormulario),
  },
  {
    path: 'formularios/:id/editar',
    title: TEXTOS.formulario.admin.editarBorrador,
    loadComponent: () =>
      import('./formularios/editor-formulario').then((m) => m.EditorFormulario),
  },
];
