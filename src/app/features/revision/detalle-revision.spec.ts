import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { AuthService } from '../../core/auth/auth';
import { DetalleRevision } from './detalle-revision';
import { DetalleRevision as DatosRevision, ObservacionRevision, RevisionApi } from './revision-api';

const datos: DatosRevision = {
  id: 'ciclo',
  inspeccion_id: 'inspeccion',
  estado: 'EN_REVISION',
  veredicto: null,
  observacion: null,
  esquema: {
    title: 'Formulario',
    type: 'object',
    properties: {
      estribo: { type: 'object', properties: { material: { type: 'string', title: 'Material' } } },
    },
  },
  datos: { estribo: { material: 'Acero' } },
  campos: [{ referencia: 'estribo.material', titulo: 'Material', valor: 'Acero' }],
  observaciones: [{ id: 'marca', elemento_ref: 'estribo.material', texto: 'Confirmar material' }],
};

describe('Detalle y veredicto de revisión', () => {
  const preparar = async () => {
    const usuario = signal<{ id: string; rol: string } | null>({
      id: 'docente',
      rol: 'CATEDRATICO',
    });
    const decision = new Subject<DatosRevision>();
    const observacion = new Subject<ObservacionRevision>();
    const api = {
      detalle: vi.fn(() => of(datos)),
      decidir: vi.fn(() => decision),
      observar: vi.fn(() => observacion),
      calificacion: vi.fn(() => of({ calificacion: null })),
      historial: vi.fn(() =>
        of({ content: [], number: 0, size: 10, total_elements: 0, total_pages: 0 }),
      ),
    };
    const paramMap = convertToParamMap({ revisionId: 'ciclo' });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of(paramMap), snapshot: { paramMap } } },
        {
          provide: AuthService,
          useValue: {
            usuario,
            rol: computed(() => usuario()?.rol ?? null),
            autenticado: computed(() => !!usuario()),
          },
        },
        { provide: RevisionApi, useValue: api },
      ],
    });
    const fixture = TestBed.createComponent(DetalleRevision);
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    await fixture.whenStable();
    return { fixture, componente: fixture.componentInstance, api, decision, observacion, usuario };
  };

  it('usa el motor en lectura y el marcador compartido asociado al campo original', async () => {
    const { fixture, componente } = await preparar();
    expect(fixture.nativeElement.querySelector('app-motor-formulario')).not.toBeNull();
    const marcador: HTMLElement = fixture.nativeElement.querySelector('app-marcador-anclado');
    expect(marcador.textContent).toContain('Confirmar material');
    marcador.querySelector('button')?.click();
    await fixture.whenStable();
    expect(componente.seleccion()?.id).toBe('marca');
  });

  it('cambios y rechazo no se envían con observación vacía', async () => {
    const { componente, api } = await preparar();
    componente.decision.patchValue({ veredicto: 'CAMBIOS_SOLICITADOS', observacion: '   ' });
    componente.emitir();
    componente.decision.patchValue({ veredicto: 'RECHAZADA', observacion: '' });
    componente.emitir();
    expect(api.decidir).not.toHaveBeenCalled();
  });

  it('bloquea dobles veredictos y muestra la confirmación sin reenvío automático', async () => {
    const { fixture, componente, api, decision } = await preparar();
    componente.decision.patchValue({ veredicto: 'CAMBIOS_SOLICITADOS', observacion: ' Corregir ' });
    componente.emitir();
    componente.emitir();
    expect(api.decidir).toHaveBeenCalledTimes(1);
    expect(api.decidir).toHaveBeenCalledWith('ciclo', {
      veredicto: 'CAMBIOS_SOLICITADOS',
      observacion: 'Corregir',
      estado_confirmado: null,
      justificacion_estado: null,
    });
    expect(componente.guardando()).toBe(true);
    decision.next({
      ...datos,
      estado: 'BORRADOR',
      veredicto: 'CAMBIOS_SOLICITADOS',
      observacion: 'Corregir',
    });
    await fixture.whenStable();
    expect(componente.guardando()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Veredicto confirmado');
    componente.emitir();
    expect(api.decidir).toHaveBeenCalledTimes(1);
  });

  it('guarda la referencia exacta y actualiza las marcas sin alterar el formulario', async () => {
    const { componente, api, observacion } = await preparar();
    componente.observacion.patchValue({
      referencia: 'estribo.material',
      texto: '  Confirmar foto  ',
    });
    componente.agregar();
    expect(api.observar).toHaveBeenCalledWith('ciclo', 'estribo.material', 'Confirmar foto');
    observacion.next({ id: 'nueva', elemento_ref: 'estribo.material', texto: 'Confirmar foto' });
    expect(componente.marcas('estribo.material')).toHaveLength(2);
    expect(componente.detalle()?.datos).toEqual(datos.datos);
  });

  it('descarta un veredicto tardío después del cierre de sesión', async () => {
    const { fixture, componente, usuario, decision } = await preparar();
    componente.decision.patchValue({ observacion: 'Corregir' });
    componente.emitir();
    usuario.set(null);
    await fixture.whenStable();
    decision.next({ ...datos, veredicto: 'APROBADA', estado: 'PUBLICADA' });
    expect(componente.detalle()).toBeNull();
  });
});
