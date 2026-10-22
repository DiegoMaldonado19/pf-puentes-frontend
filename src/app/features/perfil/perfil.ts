import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth';
import { PerfilDTO } from '../../core/auth/modelos';
import { tipoDeProblema } from '../../core/errores/problema';
import { TEXTOS } from '../../shared/textos';
import { CuentaService } from '../auth/cuenta';
import {
  aplicarErroresDeCampo,
  CLASE_ALERTA,
  CLASE_BOTON,
  CLASE_CAMPO,
  coincidenCon,
  controlConfirmar,
  controlContrasena,
  invalido,
  mensajeDeControl,
  mensajeHttp,
} from '../auth/formulario';

@Component({
  selector: 'app-perfil',
  imports: [ReactiveFormsModule],
  templateUrl: './perfil.html',
})
export class Perfil {
  protected readonly t = TEXTOS.auth.perfil;
  protected readonly campos = TEXTOS.auth.campos;
  protected readonly roles = TEXTOS.auth.roles;
  protected readonly estados = TEXTOS.auth.estados;
  protected readonly errores = TEXTOS.auth.errores;
  protected readonly claseCampo = CLASE_CAMPO;
  protected readonly claseBoton = CLASE_BOTON;
  protected readonly claseAlerta = CLASE_ALERTA;
  protected readonly cargando = signal(true);
  protected readonly enviando = signal(false);
  protected readonly error = signal('');
  protected readonly perfil = signal<PerfilDTO | null>(null);
  protected readonly form = new FormGroup(
    {
      contrasena_actual: controlContrasena(false),
      contrasena_nueva: controlContrasena(true),
      confirmar: controlConfirmar(),
    },
    { validators: coincidenCon('contrasena_nueva') },
  );

  private readonly cuenta = inject(CuentaService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  constructor() {
    this.cuenta
      .perfil()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (perfil) => {
          this.perfil.set(perfil);
          this.cargando.set(false);
        },
        error: (error: unknown) => {
          this.error.set(mensajeHttp(error));
          this.cargando.set(false);
        },
      });
  }

  protected campoInvalido(nombre: 'contrasena_actual' | 'contrasena_nueva' | 'confirmar'): boolean {
    const control = this.form.controls[nombre];
    if (nombre === 'confirmar' && this.form.hasError('confirmarDistinta')) {
      return control.touched || control.dirty;
    }
    return invalido(control);
  }

  protected mensaje(nombre: 'contrasena_actual' | 'contrasena_nueva' | 'confirmar'): string {
    return mensajeDeControl(
      this.form.controls[nombre],
      nombre === 'confirmar' ? this.form : undefined,
    );
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
        this.cuenta.cambiarContrasena(
          this.form.controls.contrasena_actual.value,
          this.form.controls.contrasena_nueva.value,
        ),
      );
      this.auth.cerrarSesionLocal();
      await this.router.navigateByUrl('/login', { state: { aviso: this.t.hecho } });
    } catch (error) {
      this.error.set(mensajeHttp(error));
      this.marcarCampos(error);
    } finally {
      this.enviando.set(false);
    }
  }

  private marcarCampos(error: unknown): void {
    aplicarErroresDeCampo(this.form, error);
    const tipo = tipoDeProblema(error);
    if (tipo === 'contrasena-actual-incorrecta') {
      this.form.controls.contrasena_actual.setErrors({
        servidor: this.errores['contrasena-actual-incorrecta'],
      });
      this.form.controls.contrasena_actual.markAsTouched();
    }
    if (tipo === 'contrasena-repetida') {
      this.form.controls.contrasena_nueva.setErrors({
        servidor: this.errores['contrasena-repetida'],
      });
      this.form.controls.contrasena_nueva.markAsTouched();
    }
  }
}
