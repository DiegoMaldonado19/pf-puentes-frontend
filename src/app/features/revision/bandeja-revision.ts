import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/auth/auth';
import { TEXTOS } from '../../shared/textos';
import { EstadoRevision, PaginaRevisiones, RevisionAbierta, RevisionApi } from './revision-api';

@Component({
  selector: 'app-bandeja-revision',
  imports: [DatePipe],
  templateUrl: './bandeja-revision.html',
})
export class BandejaRevision {
  readonly t = TEXTOS.revision;
  readonly pagina = signal<PaginaRevisiones | null>(null);
  readonly estado = signal<EstadoRevision>('');
  readonly cargando = signal(false);
  readonly abriendo = signal<string | null>(null);
  readonly abierta = signal<RevisionAbierta | null>(null);
  readonly error = signal('');
  private readonly api = inject(RevisionApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destruir = inject(DestroyRef);
  private lectura?: Subscription;
  private generacion = 0;

  constructor() {
    effect(() => {
      const id = this.auth.usuario()?.id;
      const habilitado = this.auth.autenticado() && this.auth.rol() === 'CATEDRATICO';
      this.generacion++;
      this.lectura?.unsubscribe();
      this.pagina.set(null);
      this.abierta.set(null);
      this.abriendo.set(null);
      if (id && habilitado) untracked(() => this.cargar());
      else void this.router.navigateByUrl('/login');
    });
  }

  cargar(numero = 0) {
    this.lectura?.unsubscribe();
    const generacion = ++this.generacion;
    this.cargando.set(true);
    this.error.set('');
    this.pagina.set(null);
    this.lectura = this.api
      .pendientes(numero, this.estado())
      .pipe(takeUntilDestroyed(this.destruir))
      .subscribe({
        next: (pagina) => {
          if (generacion === this.generacion) {
            this.pagina.set(pagina);
            this.cargando.set(false);
          }
        },
        error: (error) => {
          if (generacion === this.generacion) {
            this.cargando.set(false);
            this.fallo(error);
          }
        },
      });
  }

  filtrar(evento: Event) {
    if (this.abriendo()) return;
    this.estado.set((evento.target as HTMLSelectElement).value as EstadoRevision);
    this.abierta.set(null);
    this.cargar();
  }

  abrir(id: string) {
    if (this.abriendo() || this.cargando()) return;
    const generacion = this.generacion;
    this.abriendo.set(id);
    this.abierta.set(null);
    this.error.set('');
    this.api
      .abrir(id)
      .pipe(takeUntilDestroyed(this.destruir))
      .subscribe({
        next: (revision) => {
          if (generacion !== this.generacion) return;
          this.abriendo.set(null);
          this.abierta.set(revision);
          this.cargar(this.pagina()?.number ?? 0);
        },
        error: (error) => {
          if (generacion !== this.generacion) return;
          this.abriendo.set(null);
          this.fallo(error);
        },
      });
  }

  private fallo(error: unknown) {
    if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
      this.pagina.set(null);
      this.abierta.set(null);
      void this.router.navigateByUrl(error.status === 401 ? '/login' : '/puentes');
    }
    this.error.set(
      error instanceof HttpErrorResponse && error.status === 409 ? this.t.conflicto : this.t.error,
    );
  }
}
