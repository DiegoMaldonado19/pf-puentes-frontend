import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { By } from '@angular/platform-browser';
import { ConfirmacionEstado } from '../../shared/confirmacion-estado/confirmacion-estado';
import { AuthService } from '../../core/auth/auth';
import { DetalleRevision } from './detalle-revision';
import {
  DetalleRevision as DatosRevision,
  EstimacionPreliminarIcDTO,
  ObservacionRevision,
  RevisionApi,
} from './revision-api';

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
      archivos: vi.fn(() => of([])),
      icPreliminar: vi.fn(() =>
        of({
          estado_calculado: 'BUENO',
          indice_condicion: 0,
          anulaciones: [],
          version_pesos_id: '',
          preliminar: true,
          rotulo: '',
          advertencia: '',
        } as EstimacionPreliminarIcDTO),
      ),
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

  it('el hijo real permite aprobar el estado calculado sin justificación', async () => {
    const { fixture, componente, api } = await preparar();
    componente.decision.controls.veredicto.setValue('APROBADA');
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    const hijo = fixture.debugElement.query(By.directive(ConfirmacionEstado));
    expect(hijo).not.toBeNull();
    expect((hijo.componentInstance as ConfirmacionEstado).valida()).toBe(true);
    expect(componente.decision.controls.estado.value).toBe('BUENO');
    expect(componente.decision.controls.justificacion.value).toBe('');
    expect(componente.puedeDecidir()).toBe(true);
    expect(
      fixture.nativeElement.querySelector('[data-testid="textarea-justificacion"]'),
    ).toBeNull();
    componente.emitir();
    expect(api.decidir).toHaveBeenCalledWith('ciclo', {
      veredicto: 'APROBADA',
      observacion: '',
      estado_confirmado: 'BUENO',
      justificacion_estado: null,
    });
  });

  it('una discrepancia exige justificación real y propaga la validez del hijo', async () => {
    const { fixture, componente, api } = await preparar();
    componente.decision.controls.veredicto.setValue('APROBADA');
    fixture.detectChanges();
    await fixture.whenStable();
    const selector = fixture.nativeElement.querySelector(
      '[data-testid="select-estado-confirmado"]',
    ) as HTMLSelectElement;
    selector.value = 'MALO';
    selector.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(componente.puedeDecidir()).toBe(false);
    componente.emitir();
    expect(api.decidir).not.toHaveBeenCalled();
    const justificacion = fixture.nativeElement.querySelector(
      '[data-testid="textarea-justificacion"]',
    ) as HTMLTextAreaElement;
    justificacion.value = 'Daño estructural comprobado';
    justificacion.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(componente.puedeDecidir()).toBe(true);
    componente.emitir();
    expect(api.decidir).toHaveBeenCalledWith(
      'ciclo',
      expect.objectContaining({
        estado_confirmado: 'MALO',
        justificacion_estado: 'Daño estructural comprobado',
      }),
    );
  });

  it('representa url_miniatura y no genera enlaces a URL nula', async () => {
    const { fixture, componente } = await preparar();
    componente.archivos.set([
      {
        id: 'foto',
        tipo: 'FOTO',
        url: 'https://archivos.test/foto',
        url_miniatura: 'https://archivos.test/miniatura',
      },
      { id: 'pdf', tipo: 'DOCUMENTO', url: null, url_miniatura: null },
    ]);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('img')?.src).toBe('https://archivos.test/miniatura');
    expect(
      fixture.nativeElement.querySelectorAll('a[href="https://archivos.test/foto"]'),
    ).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain('Archivo no disponible.');
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
