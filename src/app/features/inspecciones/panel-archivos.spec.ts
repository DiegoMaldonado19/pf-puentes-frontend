import { TestBed } from '@angular/core/testing';
import { ArchivoLocal } from './inspeccion-store';
import { PanelArchivos } from './panel-archivos';

const archivos: ArchivoLocal[] = [
  {
    id: 'foto',
    tipo: 'FOTO',
    nombre: 'Foto anterior',
    miniaturaUrl: 'https://archivos.test/miniatura',
    url: 'https://archivos.test/foto',
    elemento_ref: 'estribo',
    estado: 'subida',
    mensaje: '',
  },
  {
    id: 'pdf',
    tipo: 'DOCUMENTO',
    nombre: 'Documento anterior',
    miniaturaUrl: null,
    url: 'https://archivos.test/documento',
    elemento_ref: null,
    estado: 'subida',
    mensaje: '',
  },
  {
    id: 'no-disponible',
    tipo: 'DOCUMENTO',
    nombre: 'Sin URL',
    miniaturaUrl: null,
    url: null,
    elemento_ref: null,
    estado: 'subida',
    mensaje: '',
  },
];

describe('PanelArchivos', () => {
  async function montar(editable: boolean) {
    const fixture = TestBed.createComponent(PanelArchivos);
    fixture.componentRef.setInput('archivos', archivos);
    fixture.componentRef.setInput('editable', editable);
    await fixture.whenStable();
    return fixture;
  }

  it('muestra galería remota y PDF en lectura sin permitir bajas', async () => {
    const fixture = await montar(false);
    const elemento = fixture.nativeElement as HTMLElement;
    expect(elemento.querySelector('img')?.src).toBe('https://archivos.test/miniatura');
    expect(elemento.querySelectorAll('a')).toHaveLength(2);
    expect(elemento.querySelector('a[href="https://archivos.test/documento"]')).not.toBeNull();
    expect(elemento.textContent).toContain('Archivo no disponible.');
    expect(elemento.textContent).not.toContain('solo se ven las de esta sesión');
    expect(elemento.querySelector('button')).toBeNull();
  });

  it('emite el id de un archivo anterior al quitarlo en edición', async () => {
    const fixture = await montar(true);
    const quitar = vi.fn();
    fixture.componentInstance.quitar.subscribe(quitar);
    const primerArchivo = fixture.nativeElement.querySelector('li') as HTMLElement;
    primerArchivo.querySelector('button')?.click();
    expect(quitar).toHaveBeenCalledWith('foto');
  });
});
