import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth';
import { EstadoPuente } from '../../shared/estado-puente/estado-puente';
import { TEXTOS } from '../../shared/textos';
import { mensajeDeError } from '../puentes/errores';
import { ForoApiService } from './foro-api.service';
import { tieneRolModeracion } from './modelos';

@Component({
  selector: 'app-foros-puentes',
  imports: [RouterLink, EstadoPuente],
  templateUrl: './foros-puentes.html',
})
export class ForosPuentes {
  protected readonly textos = TEXTOS.foro;
  protected readonly auth = inject(AuthService);
  protected readonly termino = signal('');
  protected readonly pagina = signal(0);
  private readonly busqueda = signal('');
  private readonly foro = inject(ForoApiService);
  protected readonly datos = rxResource({
    params: () => ({ pagina: this.pagina(), q: this.busqueda() }),
    stream: ({ params }) => this.foro.listarForos(params.q, params.pagina, 12),
  });
  protected readonly error = computed(() =>
    this.datos.error() ? mensajeDeError(this.datos.error(), this.textos.errorListadoPuentes) : '',
  );
  protected readonly moderador = computed(() => tieneRolModeracion([this.auth.rol() ?? '']));

  protected buscar(evento: SubmitEvent): void {
    evento.preventDefault();
    this.pagina.set(0);
    this.busqueda.set(this.termino().trim());
  }
}
