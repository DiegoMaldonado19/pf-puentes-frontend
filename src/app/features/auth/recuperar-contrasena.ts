import { Component, inject, signal } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TEXTOS } from '../../shared/textos';
import { CuentaService } from './cuenta';
import {
  aplicarErroresDeCampo,
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
  selector: 'app-recuperar-contrasena',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './recuperar-contrasena.html',
})
export class RecuperarContrasena {
  protected readonly t = TEXTOS.auth.recuperar;
  protected readonly login = TEXTOS.auth.login;
  protected readonly campos = TEXTOS.auth.campos;
  protected readonly claseCampo = CLASE_CAMPO;
  protected readonly claseBoton = CLASE_BOTON;
  protected readonly claseEnlace = CLASE_ENLACE;
  protected readonly claseAlerta = CLASE_ALERTA;
  protected readonly claseHecho = CLASE_HECHO;
  protected readonly enviando = signal(false);
  protected readonly error = signal('');
  protected readonly hecho = signal(false);
  protected readonly form = new FormGroup({ correo: controlCorreo() });

  private readonly cuenta = inject(CuentaService);

  protected campoInvalido(): boolean {
    return invalido(this.form.controls.correo);
  }

  protected mensaje(): string {
    return mensajeDeControl(this.form.controls.correo);
  }

  protected async enviar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.cuenta.recuperarContrasena(this.form.controls.correo.value));
      this.hecho.set(true);
    } catch (error) {
      this.error.set(mensajeHttp(error));
      aplicarErroresDeCampo(this.form, error);
    } finally {
      this.enviando.set(false);
    }
  }
}
