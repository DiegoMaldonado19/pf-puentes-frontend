import { Component } from '@angular/core';
import { TEXTOS } from '../../shared/textos';

@Component({
  selector: 'app-acceso-cursos',
  template: `<section>
    <h1>{{ textos.acceso }}</h1>
    <p role="status">{{ textos.sesionRequerida }}</p>
    <p>{{ textos.integracionSesion }}</p>
  </section>`,
  styleUrl: './cursos.css',
})
export class AccesoCursos {
  readonly textos = TEXTOS.cursos;
}
