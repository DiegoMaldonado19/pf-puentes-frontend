import { Routes } from '@angular/router';
export const routes: Routes = [
  {
    path: 'offline/demo',
    canMatch: [() => new URLSearchParams(location.search).get('sesion') === '1'],
    loadComponent: () => import('./sesion-demo').then((m) => m.SesionDemo),
  },
  { path: 'offline/demo', loadComponent: () => import('./demo').then((m) => m.DemoOffline) },
];
