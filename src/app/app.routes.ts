import { Routes } from '@angular/router';
import { entradaCursosGuard, rolCursosGuard } from './features/cursos/sesion-cursos';
import { rolGuard } from './core/auth/rol.guard';
import { sesionGuard } from './core/auth/sesion.guard';
import { TEXTOS } from './shared/textos';

export const routes: Routes = [
  {
    path: 'offline/captura/:id',
    title: 'Captura sin conexión',
    canDeactivate: [
      (componente: { puedeSalir: () => Promise<boolean> }) => componente.puedeSalir(),
    ],
    loadComponent: () => import('./offline/captura-local').then((m) => m.CapturaLocal),
  },
  {
    path: 'mis-revisiones',
    title: TEXTOS.revision.misPendientes,
    canActivate: [rolGuard('ESTUDIANTE')],
    loadComponent: () => import('./features/revision/mis-revisiones').then((m) => m.MisRevisiones),
  },
  {
    path: 'historial-revisiones/:inspeccionId',
    title: TEXTOS.revision.historial,
    canActivate: [sesionGuard],
    loadComponent: () =>
      import('./features/revision/vista-historial-revisiones').then(
        (m) => m.VistaHistorialRevisiones,
      ),
  },
  {
    path: 'revisiones/:revisionId',
    title: TEXTOS.revision.detalle,
    canActivate: [rolGuard('CATEDRATICO')],
    canDeactivate: [(componente: { guardando: () => boolean }) => !componente.guardando()],
    loadComponent: () =>
      import('./features/revision/detalle-revision').then((m) => m.DetalleRevision),
  },
  {
    path: 'revisiones',
    title: TEXTOS.revision.titulo,
    canActivate: [rolGuard('CATEDRATICO')],
    loadComponent: () =>
      import('./features/revision/bandeja-revision').then((m) => m.BandejaRevision),
  },
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
    canActivate: [entradaCursosGuard],
    loadComponent: () => import('./features/cursos/acceso-cursos').then((m) => m.AccesoCursos),
  },
  {
    path: 'offline/local',
    title: TEXTOS.accesoLocal.titulo,
    loadComponent: () => import('./offline/vista-local').then((m) => m.VistaLocal),
  },
  { path: '', pathMatch: 'full', redirectTo: 'puentes' },
  {
    path: 'foro',
    title: TEXTOS.foro.titulo,
    loadComponent: () => import('./features/foro/foros-puentes').then((m) => m.ForosPuentes),
  },
  {
    path: 'puentes/:puenteId/foro',
    loadComponent: () => import('./features/foro/listado-hilos').then((m) => m.ListadoHilos),
  },
  {
    path: 'puentes/:puenteId/foro/:hiloId',
    loadComponent: () => import('./features/foro/detalle-hilo').then((m) => m.DetalleHilo),
  },
  {
    path: 'inspecciones/:inspeccionId/foro',
    loadComponent: () =>
      import('./features/foro/discusion-inspeccion').then((m) => m.DiscusionInspeccion),
  },
  {
    // Después de `inspecciones/:inspeccionId/foro`, que es más específica.
    path: 'inspecciones',
    loadChildren: () =>
      import('./features/inspecciones/inspecciones.routes').then((m) => m.RUTAS_INSPECCIONES),
  },
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
  { path: '**', redirectTo: 'puentes' },
];
