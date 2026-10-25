import { Routes } from '@angular/router';
import { rolGuard } from './core/auth/rol.guard';
import { sesionGuard } from './core/auth/sesion.guard';
import { TEXTOS } from './shared/textos';

export const routes: Routes = [
  {
    path: 'offline/local',
    title: TEXTOS.accesoLocal.titulo,
    loadComponent: () => import('./offline/vista-local').then((m) => m.VistaLocal),
  },
  // El inventario público es lo primero que ve un visitante sin sesión (RN-USR-10)
  { path: '', pathMatch: 'full', redirectTo: 'puentes' },
  {
    path: 'puentes',
    loadChildren: () => import('./features/puentes/puentes.routes').then((m) => m.RUTAS_PUENTES),
  },
  {
    path: 'perfil',
    title: TEXTOS.auth.perfil.titulo,
    canActivate: [sesionGuard],
    loadComponent: () => import('./features/perfil/perfil').then((m) => m.Perfil),
  },
  {
    path: 'admin',
    canActivate: [rolGuard('ADMINISTRADOR')],
    loadChildren: () => import('./features/admin/admin.routes').then((m) => m.RUTAS_ADMIN),
  },
  {
    path: '',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.RUTAS_AUTH),
  },
];
