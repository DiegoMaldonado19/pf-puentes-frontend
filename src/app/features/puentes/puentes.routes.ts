import { Routes } from '@angular/router';

/**
 * Rutas que requieren sesión. Los guards de rol son de P2 (DT-FE-11): cuando entregue el suyo, se
 * agrega aquí `canActivate: [guardRol('ADMINISTRADOR')]` (o el que defina) según `data.roles`. El
 * backend ya rechaza con 401/403 a quien no tenga el rol.
 */
const RUTAS_PRIVADAS: Routes = [
  {
    path: 'nuevo',
    data: { roles: ['ADMINISTRADOR'], modo: 'alta' },
    loadComponent: () => import('./formulario-puente').then((m) => m.FormularioPuente),
  },
  {
    path: 'solicitudes',
    data: { roles: ['ADMINISTRADOR', 'CATEDRATICO'] },
    loadComponent: () => import('./bandeja-solicitudes').then((m) => m.BandejaSolicitudes),
  },
  {
    path: 'solicitudes/nueva',
    data: { roles: ['CATEDRATICO'], modo: 'solicitud' },
    loadComponent: () => import('./formulario-puente').then((m) => m.FormularioPuente),
  },
  {
    path: ':id/editar',
    data: { roles: ['ADMINISTRADOR'], modo: 'edicion' },
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
