import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from '../../core/auth/auth';
import { UsuarioSesionDTO } from '../../core/auth/modelos';
import { crearSesionCursosAuth } from './sesion-cursos-auth';

describe('Adaptador de autenticación para Cursos', () => {
  it('delega hidratación y sigue identidad, token y cierre sin persistir sesión', async () => {
    const usuario = signal<UsuarioSesionDTO | null>(null);
    const accessToken = signal<string | null>(null);
    const hidratarAlArrancar = vi.fn(() => of(undefined));
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: { usuario, accessToken, hidratarAlArrancar } }],
    });
    const sesion = TestBed.runInInjectionContext(crearSesionCursosAuth);
    expect(sesion.actual()).toBeNull();
    expect(sesion.urlAcceso).toBe('/login');
    await sesion.preparar();
    expect(hidratarAlArrancar).toHaveBeenCalledOnce();
    usuario.set({ id: 'docente', nombre: 'Docente', rol: 'CATEDRATICO' });
    expect(sesion.actual()).toBeNull();
    accessToken.set('acceso');
    expect(sesion.actual()).toEqual({ id: 'docente', rol: 'CATEDRATICO', token: 'acceso' });
    accessToken.set('renovado');
    expect(sesion.actual()?.token).toBe('renovado');
    usuario.set({ id: 'estudiante', nombre: 'Estudiante', rol: 'ESTUDIANTE' });
    expect(sesion.actual()?.id).toBe('estudiante');
    accessToken.set(null);
    usuario.set(null);
    expect(sesion.actual()).toBeNull();
  });
});
