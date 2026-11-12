import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth';
import { Rol } from '../../core/auth/modelos';
import { Notificacion, PaginaNotificaciones } from '../../core/notificaciones/modelos';
import { TEXTOS } from '../../shared/textos';
import { accesosDelRol, Inicio } from './inicio';

const t = TEXTOS.inicio;

function aviso(id: string, tipo: string, mensaje: string): Notificacion {
  return {
    id,
    tipo,
    mensaje,
    enlace: `/puentes/${id}/mantenimiento`,
    creado_en: '2026-11-11T12:00:00Z',
    leida_en: null,
  };
}

function pagina(contenido: Notificacion[]): PaginaNotificaciones {
  return { contenido, pagina: 0, tamano: 50, total_elementos: contenido.length, total_paginas: 1 };
}

describe('Inicio', () => {
  let fixture: ComponentFixture<Inicio>;
  let http: HttpTestingController;
  const rol = signal<Rol | null>('ADMINISTRADOR');

  beforeEach(() => {
    rol.set('ADMINISTRADOR');
    TestBed.configureTestingModule({
      imports: [Inicio],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: { rol } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Inicio);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function responder(contenido: Notificacion[]): void {
    http.expectOne((r) => r.url === '/api/v1/notificaciones').flush(pagina(contenido));
    fixture.detectChanges();
  }

  it('muestra solo los avisos de inspección y omite el resto de la campana', () => {
    responder([
      aviso('a1', 'INSPECCION_VENCIDA', 'Puente A sin inspección desde hace 12 meses'),
      aviso('a2', 'PUBLICADA', 'Inspección publicada'),
      aviso('a3', 'RUTINARIO_SIN_PROGRAMAR', 'Rutinario anual sin programar'),
    ]);

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Puente A sin inspección');
    expect(texto).toContain('Rutinario anual sin programar');
    expect(texto).not.toContain('Inspección publicada');
  });

  it('indica cuando no hay alertas pendientes', () => {
    responder([aviso('a2', 'PUBLICADA', 'Inspección publicada')]);

    expect(fixture.nativeElement.querySelector('.hvc-empty')?.textContent).toContain(
      t.alertasVacias,
    );
  });

  it('muestra un aviso de error si no se pueden cargar las alertas', () => {
    http
      .expectOne((r) => r.url === '/api/v1/notificaciones')
      .flush({}, { status: 500, statusText: 'Error' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      t.alertasError,
    );
  });

  it('el administrador revisa las alertas ahora y la lista se recarga', () => {
    responder([]);

    fixture.componentInstance['ejecutarAlertas']();
    http.expectOne('/api/v1/procesos/alertas-inspeccion/ejecucion').flush({});
    responder([aviso('a1', 'INSPECCION_VENCIDA', 'Puente nuevo sin inspección')]);

    expect(fixture.nativeElement.querySelector('[role="status"]')?.textContent).toContain(
      t.ejecutadoOk,
    );
    expect(fixture.nativeElement.textContent).toContain('Puente nuevo sin inspección');
  });

  it('informa que la revisión ya está en curso cuando el servidor responde 409', () => {
    responder([]);

    fixture.componentInstance['ejecutarAlertas']();
    http
      .expectOne('/api/v1/procesos/alertas-inspeccion/ejecucion')
      .flush({}, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="status"]')?.textContent).toContain(
      t.ejecutadoEnCurso,
    );
  });

  it('no ofrece la revisión manual a quien no es administrador', () => {
    responder([]);

    rol.set('CATEDRATICO');
    fixture = TestBed.createComponent(Inicio);
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/api/v1/notificaciones').flush(pagina([]));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });
});

describe('accesos por rol', () => {
  it('el estudiante ve sus revisiones y no la administración', () => {
    const rutas = accesosDelRol('ESTUDIANTE').map((a) => a.ruta);

    expect(rutas).toContain('/mis-revisiones');
    expect(rutas.some((ruta) => ruta.startsWith('/admin'))).toBe(false);
  });

  it('el administrador ve usuarios, formularios y auditoría', () => {
    const rutas = accesosDelRol('ADMINISTRADOR').map((a) => a.ruta);

    expect(rutas).toEqual(
      expect.arrayContaining(['/admin/usuarios', '/admin/formularios', '/admin/auditoria']),
    );
  });

  it('sin rol solo quedan los accesos comunes', () => {
    expect(accesosDelRol(null).map((a) => a.ruta)).toEqual(['/puentes', '/puentes/mapa', '/foro']);
  });
});
