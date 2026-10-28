import { Routes } from '@angular/router';
import { rolGuard } from '../../core/auth/rol.guard';
import { sesionGuard } from '../../core/auth/sesion.guard';
import { TEXTOS } from '../../shared/textos';
import type { CapturaInspeccion } from './captura-inspeccion';

/**
 * El backend sigue siendo la autoridad (403/404); las guardias solo evitan pantallas inútiles.
 * El Administrador no inspecciona: no entra a puentes inspeccionables ni al alta.
 */
const inspectores = rolGuard('ESTUDIANTE', 'PROFESIONAL_EXTERNO', 'CATEDRATICO');

export const RUTAS_INSPECCIONES: Routes = [
  {
    path: '',
    title: TEXTOS.inspecciones.mias.titulo,
    canActivate: [sesionGuard],
    loadComponent: () => import('./mis-inspecciones').then((m) => m.MisInspecciones),
  },
  {
    path: 'puentes',
    title: TEXTOS.inspecciones.puentes.titulo,
    canActivate: [inspectores],
    loadComponent: () => import('./puentes-inspeccionables').then((m) => m.PuentesInspeccionables),
  },
  {
    path: 'nueva/:puenteId',
    title: TEXTOS.inspecciones.nueva.titulo,
    canActivate: [inspectores],
    loadComponent: () => import('./nueva-inspeccion').then((m) => m.NuevaInspeccion),
  },
  {
    path: ':id/permanentes',
    title: TEXTOS.inspecciones.permanentes.titulo,
    canActivate: [sesionGuard],
    loadComponent: () => import('./permanentes-inspeccion').then((m) => m.PermanentesInspeccion),
  },
  {
    path: ':id/historial',
    title: TEXTOS.inspecciones.historial.titulo,
    canActivate: [sesionGuard],
    loadComponent: () => import('./historial-inspeccion').then((m) => m.HistorialInspeccion),
  },
  {
    path: ':id',
    title: TEXTOS.inspecciones.titulo,
    canActivate: [sesionGuard],
    // Guarda lo pendiente antes de salir: nunca se pierde un avance en silencio.
    canDeactivate: [(componente: CapturaInspeccion) => componente.puedeSalir()],
    loadComponent: () => import('./captura-inspeccion').then((m) => m.CapturaInspeccion),
  },
];
