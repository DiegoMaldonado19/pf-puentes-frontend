import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { pagina, puente } from './datos-prueba';
import { PuentesService } from './puentes.service';

describe('PuentesService', () => {
  let servicio: PuentesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(PuentesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lista con los filtros presentes y omite los vacíos', async () => {
    const respuesta = firstValueFrom(
      servicio.listar(
        { departamento: '09', municipio: null, estado: 'SIN_EVALUAR', q: '  rosas ' },
        2,
        10,
      ),
    );
    const peticion = http.expectOne((r) => r.url === '/api/v1/puentes');
    expect(peticion.request.params.keys().sort()).toEqual(
      ['departamento', 'estado', 'page', 'q', 'size'].sort(),
    );
    expect(peticion.request.params.get('q')).toBe('rosas');
    expect(peticion.request.params.get('estado')).toBe('SIN_EVALUAR');
    expect(peticion.request.params.get('page')).toBe('2');
    peticion.flush(pagina([puente()]));
    expect((await respuesta).contenido[0].codigo).toBe('GT-09-0901-0001');
  });

  it('el mapa recorre todas las páginas de 100 en orden hasta traer todos los activos', async () => {
    const todos = firstValueFrom(servicio.todosActivos());
    const lote = (n: number, desde: number) =>
      Array.from({ length: n }, (_, i) => puente({ id: `id-${desde + i}` }));

    for (const [numero, cantidad] of [
      [0, 100],
      [1, 100],
      [2, 30],
    ]) {
      const peticion = http.expectOne(`/api/v1/puentes?page=${numero}&size=100`);
      peticion.flush(pagina(lote(cantidad, numero * 100), numero, 230, 100));
    }

    const resultado = await todos;
    expect(resultado).toHaveLength(230);
    expect(resultado[229].id).toBe('id-229');
  });

  it('el mapa sin puentes hace una sola petición', async () => {
    const todos = firstValueFrom(servicio.todosActivos());
    http.expectOne('/api/v1/puentes?page=0&size=100').flush(pagina([], 0, 0, 100));
    expect(await todos).toEqual([]);
  });

  it('usa las rutas y cuerpos del contrato para ficha, alta, edición, baja y cercanos', () => {
    const id = 'a b';
    servicio.detalle(id).subscribe();
    http.expectOne('/api/v1/puentes/a%20b').flush(puente());

    const alta = {
      nombre: 'N',
      departamento_codigo: '09',
      municipio_codigo: '0901',
      ruta: 'R',
      latitud: 14.8,
      longitud: -91.5,
      anio_construccion: null,
      confirmar_duplicado: false,
    };
    servicio.crear(alta).subscribe();
    const crear = http.expectOne('/api/v1/puentes');
    expect(crear.request.method).toBe('POST');
    expect(crear.request.body).toEqual(alta);
    crear.flush(puente());

    const edicion = {
      nombre: 'N',
      ruta: 'R',
      latitud: 14.8,
      longitud: -91.5,
      anio_construccion: 1990,
      confirmar_duplicado: true,
    };
    servicio.editar('x', edicion).subscribe();
    const editar = http.expectOne('/api/v1/puentes/x');
    expect(editar.request.method).toBe('PUT');
    expect(editar.request.body).toEqual(edicion);
    editar.flush(puente());

    servicio.darDeBaja('x', 'Demolido').subscribe();
    const baja = http.expectOne('/api/v1/puentes/x/baja');
    expect(baja.request.method).toBe('POST');
    expect(baja.request.body).toEqual({ motivo: 'Demolido' });
    baja.flush(puente({ activo: false }));

    servicio.cercanos(14.8, -91.5, 'x').subscribe();
    http.expectOne('/api/v1/puentes/cercanos?latitud=14.8&longitud=-91.5&excluir=x').flush([]);
  });
});
