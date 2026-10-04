import { TestBed } from '@angular/core/testing';
import { CapturaFoto, FotoCapturada } from './captura-foto';

describe('CapturaFoto', () => {
  const tamanos: number[][] = [];

  beforeEach(async () => {
    tamanos.length = 0;
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({ width: 4000, height: 3000, close: vi.fn() }),
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (listo: PositionCallback) =>
          listo({ coords: { latitude: 14.83, longitude: -91.52 } } as GeolocationPosition),
      },
    });
    await TestBed.configureTestingModule({ imports: [CapturaFoto] }).compileComponents();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    Reflect.deleteProperty(navigator, 'geolocation');
  });

  function codificarComo(tipoDevuelto: (pedido: string) => string): void {
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      listo: BlobCallback,
      pedido = 'image/png',
    ) {
      tamanos.push([this.width, this.height]);
      listo(new Blob([], { type: tipoDevuelto(pedido) }));
    });
  }

  function elegirFoto(): Promise<FotoCapturada> {
    const fixture = TestBed.createComponent(CapturaFoto);
    const emitida = new Promise<FotoCapturada>((listo) =>
      fixture.componentInstance.capturada.subscribe(listo),
    );
    const selector: HTMLInputElement = fixture.nativeElement.querySelector('input[type=file]');
    const foto = new File([''], 'foto.jpg', { lastModified: Date.UTC(2026, 9, 4, 15, 30) });
    Object.defineProperty(selector, 'files', { value: [foto] });
    selector.dispatchEvent(new Event('change'));
    return emitida;
  }

  it('emite la foto de 1600 px, la miniatura de 300 px, la ubicación y la hora de captura', async () => {
    codificarComo((pedido) => pedido);

    const foto = await elegirFoto();

    expect(tamanos).toEqual([
      [1600, 1200],
      [300, 225],
    ]);
    expect(foto.archivo.type).toBe('image/webp');
    expect(foto.miniatura.type).toBe('image/webp');
    expect(foto).toMatchObject({
      latitud: 14.83,
      longitud: -91.52,
      capturada_en: '2026-10-04T15:30:00.000Z',
    });
  });

  it('usa JPEG cuando el navegador no codifica WebP, como Safari', async () => {
    codificarComo((pedido) => (pedido === 'image/webp' ? 'image/png' : pedido));

    const foto = await elegirFoto();

    expect(foto.archivo.type).toBe('image/jpeg');
    expect(foto.miniatura.type).toBe('image/jpeg');
  });
});
