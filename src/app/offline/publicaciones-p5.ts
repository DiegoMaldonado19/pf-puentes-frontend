import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Json, ReferenciaLocal } from './modelos';
import { PuertoPublicacion } from './preparacion';
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

function uuid(valor: unknown): valor is string {
  return typeof valor === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(valor);
}

function texto(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.trim().length > 0;
}

function fecha(valor: unknown): boolean {
  return texto(valor) && Number.isFinite(Date.parse(valor));
}

function precargaValida(valor: unknown): valor is Record<string, unknown> & {
  datos: Record<string, unknown>;
  origen_inspeccion_id: string | null;
  anio_construccion: number | null;
} {
  return (
    objeto(valor) &&
    json(valor) &&
    Object.hasOwn(valor, 'datos') &&
    objeto(valor['datos']) &&
    Object.hasOwn(valor, 'origen_inspeccion_id') &&
    (valor['origen_inspeccion_id'] === null || uuid(valor['origen_inspeccion_id'])) &&
    Object.hasOwn(valor, 'anio_construccion') &&
    (valor['anio_construccion'] === null ||
      (typeof valor['anio_construccion'] === 'number' &&
        Number.isInteger(valor['anio_construccion'])))
  );
}

function detalleValido(
  valor: unknown,
  puente_id: string,
  inspeccion_id: string,
): valor is Record<string, unknown> & { id: string; puente: Json; formulario: Json } {
  if (!objeto(valor) || !json(valor)) return false;
  const puente = valor['puente'];
  const formulario = valor['formulario'];
  return (
    valor['id'] === inspeccion_id &&
    objeto(puente) &&
    puente['id'] === puente_id &&
    texto(puente['codigo']) &&
    texto(puente['nombre']) &&
    objeto(formulario) &&
    uuid(formulario['id']) &&
    texto(formulario['codigo']) &&
    valor['estado'] === 'PUBLICADA' &&
    typeof valor['version'] === 'number' &&
    Number.isInteger(valor['version']) &&
    valor['version'] >= 0 &&
    fecha(valor['publicada_en']) &&
    uuid(valor['autor_id']) &&
    objeto(valor['datos'])
  );
}

/** Consumidor HTTP P5 de solo lectura; G3 publica el resultado local atómicamente. */
@Injectable({ providedIn: 'root' })
export class PublicacionesP5 implements PuertoPublicacion {
  private readonly http = inject(HttpClient);
  private readonly sesion = inject(SesionOffline);
  private readonly ruta = '/api/v1';

  async consultar(propietario_id: string, puente_id: string): Promise<ReferenciaLocal | null> {
    let invalidada = false;
    const liberar = this.sesion.alInvalidar(() => {
      invalidada = true;
    });
    const comprobar = () => {
      if (invalidada || this.sesion.propietarioActual() !== propietario_id) {
        throw new Error('La sesión cambió durante la descarga de publicaciones P5.');
      }
    };
    const preparar = async (momento: string) => {
      comprobar();
      if (!(await this.sesion.preparar(propietario_id))) {
        throw new Error(`No hay sesión remota habilitada para ${momento} P5.`);
      }
      comprobar();
    };

    try {
      if (!uuid(propietario_id) || !uuid(puente_id)) {
        throw new Error('La publicación P5 requiere identificadores válidos.');
      }
      await preparar('consultar precarga');
      const datosPrecarga: unknown = await firstValueFrom(
        this.http.get<unknown>(
          `${this.ruta}/puentes/${encodeURIComponent(puente_id)}/datos-permanentes`,
        ),
      );
      comprobar();
      if (!precargaValida(datosPrecarga)) {
        throw new Error('La precarga P5 está incompleta o no corresponde a la publicación.');
      }
      const origen = datosPrecarga['origen_inspeccion_id'];
      if (origen === null) return null;

      await preparar('consultar detalle autorizado');
      const detalle: unknown = await firstValueFrom(
        this.http.get<unknown>(`${this.ruta}/inspecciones/${encodeURIComponent(origen)}`),
      );
      comprobar();
      if (!detalleValido(detalle, puente_id, origen)) {
        throw new Error('El detalle autorizado P5 está incompleto o no coincide con la precarga.');
      }
      await preparar('conservar publicación');
      return {
        id: origen,
        propietario_id,
        modelo_version: 1,
        preparada_en: new Date().toISOString(),
        datos: {
          precarga: structuredClone(datosPrecarga) as Json,
          publicacion: structuredClone(detalle) as Json,
        },
      };
    } finally {
      liberar();
    }
  }
}
