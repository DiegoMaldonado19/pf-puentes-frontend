import 'fake-indexeddb/auto';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { v7 } from 'uuid';
import { appConfig } from '../app.config';
import { AuthService } from '../core/auth/auth';
import { PuenteDTO } from '../features/puentes/modelos';
import { AccesoLocal, crearAccesoLocal } from './acceso-local';
import { BaseLocal } from './base-local';
import { EsquemasP4 } from './esquemas-p4';
import { PreparacionLocal } from './preparacion';
import { proveerPreparacionLocal } from './proveedores-preparacion';
import { PublicacionesP5 } from './publicaciones-p5';
import { ReferenciaAsignadaP3, ReferenciaP3 } from './referencia-p3';
import { SesionOffline } from './sesion-offline';

describe('composición productiva de preparación offline', () => {
  let db: BaseLocal;
  afterEach(async () => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    await db?.delete();
  });

  it('registra en appConfig el proveedor que compone PreparacionLocal', () => {
    expect(appConfig.providers).toContain(proveerPreparacionLocal);
  });

  it('inyecta los proveedores P3/P4/P5 reales y publica una preparación completa', async () => {
    db = new BaseLocal(`proveedores-preparacion-${v7()}`);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: BaseLocal, useValue: db },
        { provide: AccesoLocal, useFactory: crearAccesoLocal },
        proveerPreparacionLocal,
      ],
    });
    const auth = TestBed.inject(AuthService);
    const propietario = v7();
    auth.accessToken.set('token de prueba');
    auth.usuario.set({ id: propietario, nombre: 'Estudiante', rol: 'ESTUDIANTE' });
    const sesion = TestBed.inject(SesionOffline);
    vi.spyOn(sesion, 'preparar').mockResolvedValue(true);

    const puenteId = v7();
    const asignaciones: ReferenciaAsignadaP3 = {
      asignaciones: [
        {
          id: v7(),
          curso_id: v7(),
          inscripcion_id: v7(),
          estudiante_id: propietario,
          puente_id: puenteId,
          curso_nombre: 'Curso',
          puente_codigo: 'P1',
          puente_nombre: 'Puente',
          creado_en: '2026-10-05T00:00:00.000Z',
        },
      ],
      puentes: [{ id: puenteId } as PuenteDTO],
    };
    const referencia = vi
      .spyOn(TestBed.inject(ReferenciaP3), 'descargar')
      .mockResolvedValue(asignaciones);
    const publicacion = vi
      .spyOn(TestBed.inject(PublicacionesP5), 'consultar')
      .mockResolvedValue(null);
    const esquemaId = v7();
    const esquema = vi.spyOn(TestBed.inject(EsquemasP4), 'descargar').mockResolvedValue({
      id: esquemaId,
      propietario_id: propietario,
      modelo_version: 1,
      preparada_en: '2026-10-05T00:00:00.000Z',
      datos: { version: esquemaId },
    });

    const preparacion = TestBed.inject(PreparacionLocal);
    const resultado = await preparacion.preparar(propietario);

    expect(resultado.completa).toBe(true);
    expect(referencia).toHaveBeenCalledWith(propietario);
    expect(publicacion).toHaveBeenCalledWith(propietario, puenteId);
    expect(esquema).toHaveBeenCalledWith(propietario);
    expect((await preparacion.consultar(propietario)).preparacion?.formulario_version_id).toBe(
      esquemaId,
    );
  });
});
