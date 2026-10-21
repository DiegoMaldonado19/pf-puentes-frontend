import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PaginaDTO, PuenteDTO, SolicitudPuenteDTO } from './modelos';

/** Datos ficticios para las pruebas del módulo; no se usan en la aplicación. */
export function puente(cambios: Partial<PuenteDTO> = {}): PuenteDTO {
  return {
    id: '019a0050-0000-7000-8000-000000000001',
    codigo: 'GT-09-0901-0001',
    nombre: 'Puente Las Rosas',
    ruta: 'CA-1',
    departamento: { codigo: '09', nombre: 'Quetzaltenango' },
    municipio: { codigo: '0901', nombre: 'Quetzaltenango', departamento_codigo: '09' },
    latitud: 14.8347,
    longitud: -91.518,
    utm: { zona: 15, hemisferio: 'N', este: 659463.36, norte: 1640571.32 },
    anio_construccion: 1985,
    activo: true,
    motivo_baja: null,
    estado_actual: null,
    indice_condicion_actual: null,
    fecha_ultima_inspeccion: null,
    creado_en: '2026-10-20T15:00:00Z',
    actualizado_en: '2026-10-20T15:00:00Z',
    ...cambios,
  };
}

export function pagina<T>(contenido: T[], numero = 0, total = contenido.length, tamano = 20) {
  return {
    contenido,
    pagina: numero,
    tamano,
    total_elementos: total,
    total_paginas: Math.ceil(total / tamano),
  } satisfies PaginaDTO<T>;
}

export function solicitud(cambios: Partial<SolicitudPuenteDTO> = {}): SolicitudPuenteDTO {
  return {
    id: '019a0050-0000-7000-8000-000000000101',
    catedratico_id: '019a0050-0000-7000-8000-000000000201',
    nombre: 'Puente solicitado',
    departamento: { codigo: '09', nombre: 'Quetzaltenango' },
    municipio: { codigo: '0913', nombre: 'Almolonga', departamento_codigo: '09' },
    ruta: 'RN-1',
    latitud: 14.81,
    longitud: -91.49,
    utm: { zona: 15, hemisferio: 'N', este: 662000, norte: 1638000 },
    estado: 'PENDIENTE',
    motivo_rechazo: null,
    administrador_id: null,
    puente_id: null,
    creado_en: '2026-10-19T03:00:00Z',
    actualizado_en: '2026-10-19T03:00:00Z',
    ...cambios,
  };
}

export const PROBLEMA_DUPLICADO = {
  type: 'https://sgp.cunoc.usac.edu.gt/errores/posible-duplicado',
  title: 'Posible puente duplicado',
  status: 409,
  detail: 'Hay 1 puente(s) a menos de 100 m. Confirme para continuar.',
  cercanos: [
    {
      id: '019a0050-0000-7000-8000-000000000009',
      codigo: 'GT-09-0901-0003',
      nombre: 'Puente vecino',
      distancia_metros: 42.5,
    },
  ],
};

/** whenStable() esperaría a las peticiones pendientes: se procesan efectos y vista a mano. */
export async function estabilizar(fixture: ComponentFixture<unknown>): Promise<void> {
  TestBed.tick();
  fixture.detectChanges();
  await Promise.resolve();
  TestBed.tick();
  fixture.detectChanges();
}
