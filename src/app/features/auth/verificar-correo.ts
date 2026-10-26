import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TEXTOS } from '../../shared/textos';
import { CuentaService } from './cuenta';
import {
  CLASE_ALERTA,
  CLASE_BOTON,
  CLASE_CAMPO,
  CLASE_ENLACE,
  CLASE_HECHO,
  controlCorreo,
  invalido,
  mensajeDeControl,
  mensajeHttp,
} from './formulario';

@Component({
  selector: 'app-verificar-correo',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './verificar-correo.html',
})
export class VerificarCorreo {
  protected readonly t = TEXTOS.auth.verificar;
  protected readonly campos = TEXTOS.auth.campos;
  protected readonly claseCampo = CLASE_CAMPO;
  protected readonly claseBoton = CLASE_BOTON;
  protected readonly claseEnlace = CLASE_ENLACE;
  protected readonly claseAlerta = CLASE_ALERTA;
  protected readonly claseHecho = CLASE_HECHO;
  protected readonly enviando = signal(false);
  protected readonly reenviando = signal(false);
  protected readonly error = signal('');
  protected readonly hecho = signal(false);
  protected readonly reenviado = signal(false);
  protected readonly form = new FormGroup({ correo: controlCorreo() });

  private readonly cuenta = inject(CuentaService);
  private readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token')?.trim() ?? '';

  constructor() {
    if (!this.token) {
      this.error.set(this.t.faltaToken);
      return;
    }
    this.enviando.set(true);
    this.cuenta
      .verificarCorreo(this.token)
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: () => {
          this.hecho.set(true);
          this.enviando.set(false);
        },
        error: (error: unknown) => {
          this.error.set(mensajeHttp(error));
          this.enviando.set(false);
        },
      });
  }

  protected campoInvalido(): boolean {
    return invalido(this.form.controls.correo);
  }

  protected mensaje(): string {
    return mensajeDeControl(this.form.controls.correo);
  }

  protected async reenviar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.reenviando.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.cuenta.reenviarVerificacion(this.form.controls.correo.value));
      this.reenviado.set(true);
    } catch (error) {
      this.error.set(mensajeHttp(error));
    } finally {
      this.reenviando.set(false);
    }
  }
}
