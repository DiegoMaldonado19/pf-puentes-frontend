import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PuenteDTO } from '../features/puentes/modelos';
import { PuentesService } from '../features/puentes/puentes.service';
import { AsignacionP7DTO, AsignacionesP7 } from './asignaciones-p7';
import { SesionOffline } from './sesion-offline';

export interface ReferenciaAsignadaP3 {
  asignaciones: AsignacionP7DTO[];
  puentes: PuenteDTO[];
}

export interface PuertoReferenciaP3 {
  descargar(propietario_id: string): Promise<ReferenciaAsignadaP3>;
}

@Injectable({ providedIn: 'root' })
export class ReferenciaP3 implements PuertoReferenciaP3 {
  private readonly asignaciones = inject(AsignacionesP7);
  private readonly puentes = inject(PuentesService);
  private readonly sesion = inject(SesionOffline);

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
      const asignaciones = await firstValueFrom(this.asignaciones.consultar());
      comprobarIdentidad();
      const puentes: PuenteDTO[] = [];
      // Solo deduplicar las fichas: cada contexto P7 se conserva intacto.
      for (const id of new Set(asignaciones.map((asignacion) => asignacion.puente_id))) {
        puentes.push(await firstValueFrom(this.puentes.detalle(id)));
        comprobarIdentidad();
      }
      if (!(await this.sesion.preparar(propietario_id))) {
        throw new Error('La sesión remota dejó de permitir la descarga de referencia.');
      }
      comprobarIdentidad();
      return { asignaciones, puentes };
    } finally {
      liberar();
    }
  }
}
