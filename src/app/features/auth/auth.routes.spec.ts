import { RUTAS_ADMIN } from '../admin/admin.routes';
import { RUTAS_AUTH } from './auth.routes';

describe('rutas de P2', () => {
  it('conserva las URLs que imprimen los correos del backend', () => {
    expect(RUTAS_AUTH.map((ruta) => ruta.path)).toEqual([
      'login',
      'registro',
      'verificar-correo',
      'recuperar-contrasena',
      'restablecer-contrasena',
      'aceptar-invitacion',
    ]);
  });

  it('declara las rutas de administración junto a pesos, sin sustituirlas', () => {
    expect(RUTAS_ADMIN.map((ruta) => ruta.path)).toEqual([
      'invitaciones',
      'usuarios',
      'usuarios/:id',
      'auditoria',
    ]);
  });
});
