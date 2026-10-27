import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { TEXTOS } from '../../shared/textos';
import { CursosApi } from './cursos-api';
import { CursosLista } from './cursos-lista';

describe('Panel de gestión de cursos', () => {
  it('presenta creación, total del servidor y acceso al detalle con su vigencia', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: CursosApi,
          useValue: {
            listar: () =>
              of({
                content: [
                  { id: 'curso', nombre: 'Estructuras', anio: 2026, semestre: 2, vigente: false },
                ],
                total_elements: 23,
                total_pages: 2,
                number: 0,
              }),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(CursosLista);
    await fixture.whenStable();
    const html: HTMLElement = fixture.nativeElement;
    expect(html.querySelector('.resumen-cursos')?.textContent).toContain('23');
    expect(html.querySelector('.insignia')?.textContent).toContain(TEXTOS.cursos.cerrado);
    expect(html.querySelector('a.accion-enlace')?.getAttribute('href')).toBe('/cursos/curso');
    expect(html.querySelector('app-formulario-curso')).not.toBeNull();
    expect(html.querySelector('app-paginacion-cursos')).not.toBeNull();
  });
});
