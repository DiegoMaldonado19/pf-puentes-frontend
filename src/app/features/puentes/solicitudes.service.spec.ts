import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { pagina, solicitud } from './datos-prueba';
import { SolicitudesService } from './solicitudes.service';

describe('SolicitudesService', () => {
  let servicio: SolicitudesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(SolicitudesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('usa las rutas y cuerpos del contrato de solicitudes', () => {
    servicio.listar('PENDIENTE', 1).subscribe();
    http
      .expectOne('/api/v1/solicitudes-puente?page=1&size=20&estado=PENDIENTE')
      .flush(pagina([solicitud()]));
    servicio.listar(null).subscribe();
    http.expectOne('/api/v1/solicitudes-puente?page=0&size=20').flush(pagina([]));

    const datos = {
      nombre: 'N',
      departamento_codigo: '09',
      municipio_codigo: '0913',
      ruta: 'R',
      latitud: 14.8,
      longitud: -91.5,
      confirmar_duplicado: false,
    };
    servicio.solicitar(datos).subscribe();
    const crear = http.expectOne('/api/v1/solicitudes-puente');
    expect(crear.request.method).toBe('POST');
    expect(crear.request.body).toEqual(datos);
    crear.flush(solicitud());

    servicio.aprobar('s1', true).subscribe();
    const aprobar = http.expectOne('/api/v1/solicitudes-puente/s1/aprobacion');
    expect(aprobar.request.body).toEqual({ confirmar_duplicado: true });
    aprobar.flush(solicitud({ estado: 'APROBADA' }));

    servicio.rechazar('s1', 'Ya existe').subscribe();
    const rechazar = http.expectOne('/api/v1/solicitudes-puente/s1/rechazo');
    expect(rechazar.request.body).toEqual({ motivo: 'Ya existe' });
    rechazar.flush(solicitud({ estado: 'RECHAZADA' }));
  });
});
