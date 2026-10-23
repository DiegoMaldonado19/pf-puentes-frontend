import { RUTAS_PUENTES } from './puentes.routes';

function ruta(path: string) {
  return RUTAS_PUENTES.find((r) => r.path === path);
}

describe('RUTAS_PUENTES', () => {
  it('deja públicos listado, mapa y ficha', () => {
    expect(ruta('')?.canActivate).toBeUndefined();
    expect(ruta('mapa')?.canActivate).toBeUndefined();
    expect(ruta(':id')?.canActivate).toBeUndefined();
  });

  it('protege alta, edición y solicitudes', () => {
    expect(ruta('nuevo')?.canActivate?.length).toBe(1);
    expect(ruta('solicitudes')?.canActivate?.length).toBe(1);
    expect(ruta('solicitudes/nueva')?.canActivate?.length).toBe(1);
    expect(ruta(':id/editar')?.canActivate?.length).toBe(1);
  });
});
