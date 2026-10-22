import { Component, inject, signal } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth';
import { TEXTOS } from '../../shared/textos';
import {
  aplicarErroresDeCampo,
  CLASE_ALERTA,
  CLASE_BOTON,
  CLASE_CAMPO,
  CLASE_ENLACE,
  CLASE_HECHO,
  controlCorreo,
  controlContrasena,
  invalido,
  mensajeDeControl,
  mensajeHttp,
} from './formulario';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
})
export class Login {
  protected readonly t = TEXTOS.auth.login;
  protected readonly campos = TEXTOS.auth.campos;
  protected readonly claseCampo = CLASE_CAMPO;
  protected readonly claseBoton = CLASE_BOTON;
  protected readonly claseEnlace = CLASE_ENLACE;
  protected readonly claseAlerta = CLASE_ALERTA;
  protected readonly claseHecho = CLASE_HECHO;
  protected readonly enviando = signal(false);
  protected readonly error = signal('');
  protected readonly aviso = signal('');
  protected readonly form = new FormGroup({
    correo: controlCorreo(),
    contrasena: controlContrasena(false),
  });

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  constructor() {
    const extra = this.router.currentNavigation()?.extras.state as { aviso?: unknown } | undefined;
    const historial = history.state as { aviso?: unknown } | undefined;
    const aviso = extra?.aviso ?? historial?.aviso;
    if (typeof aviso === 'string' && aviso) this.aviso.set(aviso);
  }

  protected campoInvalido(nombre: 'correo' | 'contrasena'): boolean {
    return invalido(this.form.controls[nombre]);
  }

  protected mensaje(nombre: 'correo' | 'contrasena'): string {
    return mensajeDeControl(this.form.controls[nombre]);
  }

  protected async enviar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.error.set('');
    try {
      await firstValueFrom(
        this.auth.iniciarSesion(
          this.form.controls.correo.value,
          this.form.controls.contrasena.value,
        ),
      );
      await this.router.navigateByUrl(this.auth.destinoTrasLogin());
    } catch (error) {
      this.error.set(mensajeHttp(error));
      aplicarErroresDeCampo(this.form, error);
    } finally {
      this.enviando.set(false);
    }
  }
}
