import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { TEXTOS } from '../../shared/textos';
import { CursosApi } from './cursos-api';
import { CursosLista } from './cursos-lista';

describe('Panel de gestión de cursos', () => {
  it('presenta acceso a crear curso, total del servidor y accesos separados por curso', async () => {
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

    const crear = [...html.querySelectorAll('a')].find((a) =>
      a.textContent?.includes(TEXTOS.cursos.nuevo),
    );
    expect(crear?.getAttribute('href')).toBe('/cursos/nuevo');

    const hrefs = [...html.querySelectorAll('a.accion-enlace')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual([
      '/cursos/curso',
      '/cursos/curso/estudiantes',
      '/cursos/curso/asignaciones',
    ]);

    expect(html.querySelector('app-formulario-curso')).toBeNull();
    expect(html.querySelector('app-paginacion-cursos')).not.toBeNull();
  });
});
