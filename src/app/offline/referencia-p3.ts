import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PuenteDTO } from '../features/puentes/modelos';
import { PuentesService } from '../features/puentes/puentes.service';
import { AsignacionP7DTO, AsignacionesP7 } from './asignaciones-p7';
import { SesionOffline } from './sesion-offline';
import { AuthService } from '../core/auth/auth';
import { InspeccionApi } from '../features/inspecciones/inspeccion-api';
import { PuenteInspeccionableDTO } from '../features/inspecciones/modelos';

export interface ReferenciaAsignadaP3 {
  asignaciones: AsignacionP7DTO[];
  puentes: PuenteDTO[];
  inspeccionables?: PuenteInspeccionableDTO[];
}

export interface PuertoReferenciaP3 {
  descargar(propietario_id: string): Promise<ReferenciaAsignadaP3>;
}

@Injectable({ providedIn: 'root' })
export class ReferenciaP3 implements PuertoReferenciaP3 {
  private readonly asignaciones = inject(AsignacionesP7);
  private readonly puentes = inject(PuentesService);
  private readonly sesion = inject(SesionOffline);
  private readonly auth = inject(AuthService);
  private readonly inspecciones = inject(InspeccionApi);

  /** Solo descarga: no persiste ni acredita preparación completa (faltan P4/P5). */
  async descargar(propietario_id: string): Promise<ReferenciaAsignadaP3> {
    let invalidada = false;
    const liberar = this.sesion.alInvalidar(() => {
      invalidada = true;
    });
    const comprobarIdentidad = () => {
      if (invalidada || this.sesion.propietarioActual() !== propietario_id) {
        throw new Error('La sesión cambió durante la descarga de referencia.');
      }
    };
    try {
      if (!(await this.sesion.preparar(propietario_id))) {
        throw new Error('No hay sesión remota habilitada para descargar referencia.');
      }
      comprobarIdentidad();
      const estudiante = this.auth.rol() === 'ESTUDIANTE';
      const asignaciones = estudiante ? await firstValueFrom(this.asignaciones.consultar()) : [];
      const inspeccionables: PuenteInspeccionableDTO[] = [];
      if (!estudiante) {
        let page = 0;
        while (true) {
          const pagina = await firstValueFrom(this.inspecciones.puentesInspeccionables(page, 100));
          comprobarIdentidad();
          inspeccionables.push(...pagina.content);
          if (++page >= pagina.total_pages) break;
        }
      }
      comprobarIdentidad();
      const puentes: PuenteDTO[] = [];
      // Solo deduplicar las fichas: cada contexto P7 se conserva intacto.
      for (const id of new Set([
        ...asignaciones.map((a) => a.puente_id),
        ...inspeccionables.map((p) => p.id),
      ])) {
        puentes.push(await firstValueFrom(this.puentes.detalle(id)));
        comprobarIdentidad();
      }
      if (!(await this.sesion.preparar(propietario_id))) {
        throw new Error('La sesión remota dejó de permitir la descarga de referencia.');
      }
      comprobarIdentidad();
      return estudiante ? { asignaciones, puentes } : { asignaciones, puentes, inspeccionables };
    } finally {
      liberar();
    }
  }
}
