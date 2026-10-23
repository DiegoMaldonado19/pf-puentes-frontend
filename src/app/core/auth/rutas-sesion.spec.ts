import { rutaExigeSesion } from './rutas-sesion';

describe('rutaExigeSesion', () => {
  it('marca perfil, admin y las rutas privadas de puentes', () => {
    expect(rutaExigeSesion('/perfil')).toBe(true);
    expect(rutaExigeSesion('/admin/usuarios?q=1')).toBe(true);
    expect(rutaExigeSesion('/puentes/nuevo')).toBe(true);
    expect(rutaExigeSesion('/puentes/solicitudes')).toBe(true);
    expect(rutaExigeSesion('/puentes/solicitudes/nueva')).toBe(true);
    expect(rutaExigeSesion('/puentes/abc/editar')).toBe(true);
    expect(rutaExigeSesion('/puentes/abc/mantenimiento?page=1')).toBe(true);
  });

  it('deja públicos inventario, mapa, ficha y la puerta', () => {
    expect(rutaExigeSesion('/puentes')).toBe(false);
    expect(rutaExigeSesion('/puentes/mapa')).toBe(false);
    expect(rutaExigeSesion('/puentes/abc')).toBe(false);
    expect(rutaExigeSesion('/login')).toBe(false);
  });
});
