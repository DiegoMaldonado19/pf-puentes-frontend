import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TEXTOS } from '../../../shared/textos';
import { EsquemaBaseDTO, FormularioVersionDTO } from '../../formulario/modelos';
import { EditorFormulario } from './editor-formulario';

const t = TEXTOS.constructorFormulario;

const base: EsquemaBaseDTO = {
  esquema: {
    title: 'SIECA',
    type: 'object',
    properties: {
      identificacion: {
        type: 'object',
        title: 'Sección 1: Identificación',
        properties: { codigo: { type: 'string', title: 'Código', 'x-orden': 1 } },
      },
      otros: {
        type: 'object',
        title: 'Sección 8: Otros',
        properties: { senales: { type: 'string', title: 'Señales', 'x-orden': 1 } },
      },
    },
  },
  secciones: [
    { clave: 'identificacion', titulo: 'Sección 1: Identificación', admite_campos_extra: false },
    { clave: 'otros', titulo: 'Sección 8: Otros', admite_campos_extra: true },
  ],
};

const borrador: FormularioVersionDTO = {
  id: 'v-borrador',
  codigo: 'V2.0.0',
  estado: 'BORRADOR',
  esquema: {
    title: 'SIECA',
    type: 'object',
    properties: {
      otros: {
        type: 'object',
        title: 'Sección 8: Otros',
        required: ['estado_drenaje'],
        properties: {
          senales: { type: 'string', title: 'Señales', 'x-orden': 1 },
          estado_drenaje: {
            type: 'string',
            title: 'Estado del drenaje',
            enum: ['Bueno', 'Malo'],
            'x-extra': true,
            'x-orden': 2,
          },
        },
      },
    },
  },
  creado_en: '2026-11-01T00:00:00Z',
  actualizado_en: '2026-11-01T00:00:00Z',
} as FormularioVersionDTO;

async function abrir(ruta: string) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([
        { path: 'admin/formularios/nuevo', component: EditorFormulario },
        { path: 'admin/formularios/:id/editar', component: EditorFormulario },
        { path: 'admin/formularios', component: EditorFormulario },
      ]),
    ],
  });
  const harness = await RouterTestingHarness.create(ruta);
  const http = TestBed.inject(HttpTestingController);
  const elemento = harness.routeNativeElement as HTMLElement;
  const instancia = harness.routeDebugElement?.componentInstance as EditorFormulario;
  return { harness, http, elemento, instancia };
}

function texto(elemento: HTMLElement): string {
  return elemento.textContent ?? '';
}

describe('EditorFormulario (constructor B2)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('muestra la base fija y las secciones que admiten campos', async () => {
    const { http, elemento, harness } = await abrir('/admin/formularios/nuevo');
    http.expectOne('/api/v1/formularios/base').flush(base);
    harness.detectChanges();

    expect(texto(elemento)).toContain(t.tituloNuevo);
    expect(texto(elemento)).toContain('Sección 8: Otros');
    expect(texto(elemento)).toContain(t.bloqueada);
  });

  it('no deja añadir un campo sin título y lo indica junto al formulario', async () => {
    const { http, elemento, harness, instancia } = await abrir('/admin/formularios/nuevo');
    http.expectOne('/api/v1/formularios/base').flush(base);
    harness.detectChanges();

    instancia['actualizarBorrador']({ seccion: 'otros' });
    instancia['agregarCampo']();
    harness.detectChanges();

    expect(texto(elemento)).toContain(t.errorTitulo);
    http.expectNone('/api/v1/formularios/validacion');
  });

  it('valida la lista en el servidor al añadir un campo y muestra sus errores en la fila', async () => {
    const { http, elemento, harness, instancia } = await abrir('/admin/formularios/nuevo');
    http.expectOne('/api/v1/formularios/base').flush(base);
    harness.detectChanges();

    instancia['actualizarBorrador']({ seccion: 'otros', titulo: 'Estado del drenaje' });
    instancia['agregarCampo']();
    http.expectOne('/api/v1/formularios/validacion').flush({
      valido: false,
      errores: [{ campo: 'campos_extra[0].clave', mensaje: 'Ya existe un campo con esa clave.' }],
    });
    harness.detectChanges();

    expect(texto(elemento)).toContain('Estado del drenaje');
    expect(texto(elemento)).toContain('Ya existe un campo con esa clave.');
  });

  it('guarda el borrador nuevo con campos_extra y vuelve al listado', async () => {
    const { http, harness, instancia } = await abrir('/admin/formularios/nuevo');
    http.expectOne('/api/v1/formularios/base').flush(base);
    harness.detectChanges();
    const router = TestBed.inject(Router);
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    instancia['actualizarBorrador']({ seccion: 'otros', titulo: 'Caudal de agua' });
    instancia['agregarCampo']();
    http.expectOne('/api/v1/formularios/validacion').flush({ valido: true, errores: [] });
    instancia['guardar']();

    const peticion = http.expectOne('/api/v1/formularios');
    expect(peticion.request.body.codigo).toBe('V2.0.0');
    expect(peticion.request.body.campos_extra[0]).toMatchObject({
      seccion: 'otros',
      clave: 'caudal_de_agua',
      titulo: 'Caudal de agua',
      tipo: 'texto',
    });
    peticion.flush({ id: 'nuevo' }, { status: 201, statusText: 'Created' });
    expect(navegar).toHaveBeenCalledWith(['/admin/formularios']);
  });

  it('muestra los errores del servidor al guardar y no navega', async () => {
    const { http, elemento, harness, instancia } = await abrir('/admin/formularios/nuevo');
    http.expectOne('/api/v1/formularios/base').flush(base);
    harness.detectChanges();
    instancia['actualizarBorrador']({ seccion: 'otros', titulo: 'Caudal' });
    instancia['agregarCampo']();
    http.expectOne('/api/v1/formularios/validacion').flush({ valido: true, errores: [] });

    instancia['guardar']();
    http.expectOne('/api/v1/formularios').flush(
      {
        errores: [{ campo: 'campos_extra[0].titulo', mensaje: 'Título no válido.' }],
      },
      { status: 422, statusText: 'Unprocessable' },
    );
    harness.detectChanges();

    expect(texto(elemento)).toContain('Título no válido.');
    expect(texto(elemento)).toContain(t.errorGeneral);
  });

  it('reconstruye los campos adicionales de un borrador existente', async () => {
    const { http, elemento, harness } = await abrir('/admin/formularios/v-borrador/editar');
    http.expectOne('/api/v1/formularios/base').flush(base);
    http.expectOne('/api/v1/formularios/v-borrador').flush(borrador);
    harness.detectChanges();

    expect(texto(elemento)).toContain('Estado del drenaje');
    expect(texto(elemento)).toContain(t.obligatorio);
    expect(elemento.querySelector('#codigo-version')).toHaveProperty('readOnly', true);
    expect(texto(elemento)).toContain('Guardar borrador');
  });

  it('una versión activa se muestra solo como lectura', async () => {
    const { http, elemento, harness } = await abrir('/admin/formularios/v-activa/editar');
    http.expectOne('/api/v1/formularios/base').flush(base);
    http
      .expectOne('/api/v1/formularios/v-activa')
      .flush({ ...borrador, id: 'v-activa', estado: 'ACTIVA' });
    harness.detectChanges();

    expect(texto(elemento)).toContain(t.noEditable);
    expect(texto(elemento)).not.toContain('Guardar borrador');
  });
});
