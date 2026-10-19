import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { INTEGRACION_SESION_CURSOS } from './sesion-cursos';
import { TEXTOS } from '../../shared/textos';

@Component({
  selector: 'app-acceso-cursos',
  imports: [RouterLink],
  template: `<section>
    <h1>{{ textos.acceso }}</h1>
    <p role="status">{{ sinPermiso ? textos.sinPermiso : textos.sesionRequerida }}</p>
    @if (integracion; as sesion) {
      <a [routerLink]="sesion.urlAcceso">{{ textos.irAAcceso }}</a>
    }
  </section>`,
  styleUrl: './cursos.css',
})
export class AccesoCursos {
  readonly textos = TEXTOS.cursos;
  readonly integracion = inject(INTEGRACION_SESION_CURSOS);
  readonly sinPermiso = inject(ActivatedRoute).snapshot.queryParamMap.get('motivo') === 'permiso';
}
