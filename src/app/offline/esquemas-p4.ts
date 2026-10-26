import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Json, ReferenciaLocal } from './modelos';
import { PuertoEsquema } from './preparacion';
import { SesionOffline } from './sesion-offline';

function objeto(valor: unknown): valor is Record<string, unknown> {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
}
function json(valor: unknown): valor is Json {
  if (valor === null || typeof valor === 'string' || typeof valor === 'boolean') return true;
  if (typeof valor === 'number') return Number.isFinite(valor);
  if (Array.isArray(valor)) return valor.every(json);
  return objeto(valor) && Object.values(valor).every(json);
}
function texto(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.trim().length > 0;
}
function fecha(valor: unknown): boolean {
  return texto(valor) && Number.isFinite(Date.parse(valor));
}

/** Consumidor HTTP P4 sin escrituras: G3 es el único dueño de la publicación local. */
@Injectable({ providedIn: 'root' })
export class EsquemasP4 implements PuertoEsquema {
  private readonly http = inject(HttpClient);
  private readonly sesion = inject(SesionOffline);
  private readonly ruta = '/api/v1/formularios';

  descargar(propietario_id: string): Promise<ReferenciaLocal | null> {
    return this.consultar(propietario_id, `${this.ruta}/activo`, 'activo');
  }

  async porCodigo(propietario_id: string, codigo: string): Promise<ReferenciaLocal> {
    return (await this.consultar(
      propietario_id,
      `${this.ruta}/versiones/${encodeURIComponent(codigo)}`,
      'codigo',
      codigo,
    ))!;
  }

  async porId(propietario_id: string, id: string): Promise<ReferenciaLocal> {
    return (await this.consultar(
      propietario_id,
      `${this.ruta}/${encodeURIComponent(id)}`,
      'id',
      id,
    ))!;
  }

  private async consultar(
    propietario_id: string,
    url: string,
    tipo: 'activo' | 'codigo' | 'id',
    exacto?: string,
  ): Promise<ReferenciaLocal | null> {
    let invalidada = false;
    const liberar = this.sesion.alInvalidar(() => {
      invalidada = true;
    });
    const comprobar = () => {
      if (invalidada || this.sesion.propietarioActual() !== propietario_id) {
        throw new Error('La sesión cambió durante la descarga del esquema P4.');
      }
    };
    try {
      comprobar();
      if (!(await this.sesion.preparar(propietario_id))) {
        throw new Error('No hay sesión remota habilitada para descargar el esquema P4.');
      }
      comprobar();
      let datos: unknown;
      try {
        datos = await firstValueFrom(this.http.get<unknown>(url));
      } catch (error) {
        comprobar();
        if (
          tipo === 'activo' &&
          error instanceof HttpErrorResponse &&
          error.status === 404 &&
          objeto(error.error) &&
          error.error['type'] ===
            'https://sgp.cunoc.usac.edu.gt/errores/formulario-activo-no-encontrado'
        ) {
          return null;
        }
        throw error;
      }
      comprobar();
      if (
        !objeto(datos) ||
        !json(datos) ||
        !texto(datos['id']) ||
        !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(datos['id']) ||
        !texto(datos['codigo']) ||
        !objeto(datos['esquema']) ||
        Object.keys(datos['esquema']).length === 0 ||
        !(datos['mapeo'] === null || objeto(datos['mapeo'])) ||
        !['ACTIVA', 'BORRADOR', 'RETIRADA'].includes(String(datos['estado'])) ||
        !(datos['publicada_en'] === null || fecha(datos['publicada_en'])) ||
        !fecha(datos['creado_en']) ||
        !fecha(datos['actualizado_en']) ||
        (tipo === 'activo' && (datos['estado'] !== 'ACTIVA' || !fecha(datos['publicada_en']))) ||
        (tipo === 'id' && datos['id'] !== exacto) ||
        (tipo === 'codigo' && datos['codigo'] !== exacto)
      ) {
        throw new Error(
          'La versión de formulario P4 está incompleta o no coincide con la solicitada.',
        );
      }
      if (!(await this.sesion.preparar(propietario_id))) {
        throw new Error('La sesión remota dejó de permitir la descarga del esquema P4.');
      }
      comprobar();
      return {
        id: datos['id'],
        propietario_id,
        modelo_version: 1,
        preparada_en: new Date().toISOString(),
        datos: structuredClone(datos),
      };
    } finally {
      liberar();
    }
  }
}
