import { Routes } from '@angular/router';

export const routes: Routes = [
  // El inventario público es lo primero que ve un visitante sin sesión (RN-USR-10)
  { path: '', pathMatch: 'full', redirectTo: 'puentes' },
  {
    path: 'puentes',
    loadChildren: () => import('./features/puentes/puentes.routes').then((m) => m.RUTAS_PUENTES),
  },
];
