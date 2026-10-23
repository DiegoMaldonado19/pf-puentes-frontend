import { Component, inject, signal } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth';
import { TEXTOS } from '../../shared/textos';
import { CuentaService } from './cuenta';
import {
  aplicarErroresDeCampo,
  CLASE_ALERTA,
  CLASE_BOTON,
  CLASE_CAMPO,
  CLASE_ENLACE,
  CLASE_HECHO,
  coincidenContrasenas,
  controlConfirmar,
  controlContrasena,
  invalido,
  mensajeDeControl,
  mensajeHttp,
} from './formulario';

@Component({
  selector: 'app-restablecer-contrasena',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './restablecer-contrasena.html',
})
export class RestablecerContrasena {
  protected readonly t = TEXTOS.auth.restablecer;
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
  protected readonly form = new FormGroup(
    {
      contrasena: controlContrasena(true),
      confirmar: controlConfirmar(),
    },
    { validators: coincidenContrasenas },
  );

  private readonly cuenta = inject(CuentaService);
  private readonly auth = inject(AuthService);
  protected readonly token =
    inject(ActivatedRoute).snapshot.queryParamMap.get('token')?.trim() ?? '';

  constructor() {
    if (!this.token) this.error.set(this.t.faltaToken);
  }

  protected campoInvalido(nombre: 'contrasena' | 'confirmar'): boolean {
    const control = this.form.controls[nombre];
    if (nombre === 'confirmar' && this.form.hasError('confirmarDistinta')) {
      return control.touched || control.dirty;
    }
    return invalido(control);
  }

  protected mensaje(nombre: 'contrasena' | 'confirmar'): string {
    return mensajeDeControl(
      this.form.controls[nombre],
      nombre === 'confirmar' ? this.form : undefined,
    );
  }

  protected async enviar(): Promise<void> {
    if (!this.token) {
      this.error.set(this.t.faltaToken);
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.error.set('');
    try {
      await firstValueFrom(
        this.cuenta.restablecerContrasena(this.token, this.form.controls.contrasena.value),
      );
      this.auth.cerrarSesionLocal();
      this.hecho.set(true);
    } catch (error) {
      this.error.set(mensajeHttp(error));
      aplicarErroresDeCampo(this.form, error);
    } finally {
      this.enviando.set(false);
    }
  }
}
