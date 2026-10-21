import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('ofrece un enlace para saltar al contenido y la navegación al inventario y al mapa', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const html = fixture.nativeElement as HTMLElement;

    expect(html.querySelector('a[href="#contenido"]')?.textContent).toContain('Saltar');
    const enlaces = [...html.querySelectorAll('nav a')].map((a) => a.getAttribute('href'));
    expect(enlaces).toEqual(['/', '/puentes', '/puentes/mapa']);
    expect(html.querySelector('main#contenido router-outlet')).not.toBeNull();
  });
});
