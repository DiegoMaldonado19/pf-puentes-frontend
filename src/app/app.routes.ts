import { Routes } from '@angular/router';
import { rolCursosGuard } from './features/cursos/sesion-cursos';

export const routes: Routes = [
  {
    path: 'cursos',
    canActivate: [rolCursosGuard],
    data: { rol: 'CATEDRATICO' },
    loadComponent: () => import('./features/cursos/cursos-lista').then((m) => m.CursosLista),
  },
  {
    path: 'cursos/:cursoId',
    canActivate: [rolCursosGuard],
    data: { rol: 'CATEDRATICO' },
    loadComponent: () => import('./features/cursos/curso-detalle').then((m) => m.CursoDetalle),
  },
  {
    path: 'mis-asignaciones',
    canActivate: [rolCursosGuard],
    data: { rol: 'ESTUDIANTE' },
    loadComponent: () =>
      import('./features/cursos/mis-asignaciones').then((m) => m.MisAsignaciones),
  },
  {
    path: 'acceso-cursos',
    loadComponent: () => import('./features/cursos/acceso-cursos').then((m) => m.AccesoCursos),
  },
];
