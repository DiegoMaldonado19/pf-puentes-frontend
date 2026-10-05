import { Routes } from '@angular/router';
export const routes: Routes = [
  { path: 'offline/demo', loadComponent: () => import('./demo').then((m) => m.DemoOffline) },
];
