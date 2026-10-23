import { Routes } from '@angular/router';
import { rolGuard } from '../../core/auth/rol.guard';

/** RN-USR-10: alta, edición y solicitudes piden sesión y rol. El backend igual rechaza 401/403. */
const RUTAS_PRIVADAS: Routes = [
  {
    path: 'nuevo',
    data: { roles: ['ADMINISTRADOR'], modo: 'alta' },
    canActivate: [rolGuard('ADMINISTRADOR')],
    loadComponent: () => import('./formulario-puente').then((m) => m.FormularioPuente),
  },
  {
    path: 'solicitudes',
    data: { roles: ['ADMINISTRADOR', 'CATEDRATICO'] },
    canActivate: [rolGuard('ADMINISTRADOR', 'CATEDRATICO')],
    loadComponent: () => import('./bandeja-solicitudes').then((m) => m.BandejaSolicitudes),
  },
  {
    path: 'solicitudes/nueva',
    data: { roles: ['CATEDRATICO'], modo: 'solicitud' },
    canActivate: [rolGuard('CATEDRATICO')],
    loadComponent: () => import('./formulario-puente').then((m) => m.FormularioPuente),
  },
  {
    path: ':id/editar',
    data: { roles: ['ADMINISTRADOR'], modo: 'edicion' },
    canActivate: [rolGuard('ADMINISTRADOR')],
    loadComponent: () => import('./formulario-puente').then((m) => m.FormularioPuente),
  },
];

/** RN-USR-10: listado, mapa y ficha son públicos. */
export const RUTAS_PUENTES: Routes = [
  {
    path: '',
    title: 'Inventario de puentes',
    loadComponent: () => import('./listado-puentes').then((m) => m.ListadoPuentes),
  },
  {
    path: 'mapa',
    title: 'Mapa de puentes',
    loadComponent: () => import('./mapa/mapa-puentes').then((m) => m.MapaPuentes),
  },
  ...RUTAS_PRIVADAS,
  {
    path: ':id',
    title: 'Ficha del puente',
    loadComponent: () => import('./ficha-puente').then((m) => m.FichaPuente),
  },
];
