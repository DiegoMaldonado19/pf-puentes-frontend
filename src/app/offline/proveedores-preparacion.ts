import { inject, Provider } from '@angular/core';
import { AccesoLocal } from './acceso-local';
import { BaseLocal } from './base-local';
import { EsquemasP4 } from './esquemas-p4';
import { PreparacionLocal } from './preparacion';
import { PublicacionesP5 } from './publicaciones-p5';
import { ReferenciaP3 } from './referencia-p3';
import { SesionOffline } from './sesion-offline';

export function crearPreparacionLocal(): PreparacionLocal {
  return new PreparacionLocal(inject(BaseLocal), inject(AccesoLocal), inject(SesionOffline), {
    referencia: inject(ReferenciaP3),
    publicacion: inject(PublicacionesP5),
    esquema: inject(EsquemasP4),
  });
}

export const proveerPreparacionLocal: Provider = {
  provide: PreparacionLocal,
  useFactory: crearPreparacionLocal,
};
