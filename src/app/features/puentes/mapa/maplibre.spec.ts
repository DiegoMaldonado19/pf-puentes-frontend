import { vi } from 'vitest';
import { cargarHojaMapLibre, verificarWorker } from './maplibre';

describe('carga de MapLibre', () => {
  afterEach(() => vi.restoreAllMocks());

  const enlaces = () => document.head.querySelectorAll<HTMLLinkElement>('link[data-maplibre]');

  it('espera a maplibre.css, falla si no carga y lo reintenta en la siguiente pantalla', async () => {
    // Sin la hoja, los marcadores quedan con position: static fuera del lienzo y no se ven
    const fallida = cargarHojaMapLibre();
    expect(enlaces()).toHaveLength(1);
    expect(enlaces()[0].getAttribute('href')).toBe('maplibre.css');
    enlaces()[0].dispatchEvent(new Event('error'));
    await expect(fallida).rejects.toThrow('maplibre.css');
    expect(enlaces()).toHaveLength(0);

    const reintento = cargarHojaMapLibre();
    expect(enlaces()).toHaveLength(1);
    enlaces()[0].dispatchEvent(new Event('load'));
    await expect(reintento).resolves.toBeUndefined();

    await cargarHojaMapLibre();
    expect(enlaces()).toHaveLength(1);
  });

  it.each([
    [404, 'text/html'],
    [200, 'text/html'],
  ])('rechaza un worker que responde %s %s, como el index.html de un 404', async (status, tipo) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status, headers: { 'content-type': tipo } }),
    );
    await expect(verificarWorker('/maplibre/maplibre-gl-worker.mjs')).rejects.toThrow(
      'worker de MapLibre',
    );
  });

  it('acepta el worker servido como JavaScript', async () => {
    const consulta = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(null, { status: 200, headers: { 'content-type': 'application/javascript' } }),
      );
    await expect(verificarWorker('/maplibre/maplibre-gl-worker.mjs')).resolves.toBeUndefined();
    expect(consulta).toHaveBeenCalledWith('/maplibre/maplibre-gl-worker.mjs', { method: 'HEAD' });
  });
});
