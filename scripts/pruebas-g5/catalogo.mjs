// Inventario de preparación, no runner ni contrato productivo.
export const decisiones = [
  ['revision', 'P5', 'Token de revisión base y ACK', ['V10', 'V14']],
  ['snapshot', 'P5 / #18', 'Contenido completo de la copia', ['V10', 'V15']],
  ['consulta', '#18 / equipo', 'Perfiles y API de lectura de copias', ['V10', 'V15']],
  ['rechazo', 'P5 / P2', 'Código y ProblemDetail por rechazo', ['V15']],
  ['idempotencia', 'P1 / P5 / P6', 'Huella, concurrencia y retención', ['V06', 'V13']],
].map(([id, responsable, pendiente, desbloquea]) => ({
  id,
  responsable,
  pendiente,
  desbloquea,
  valor: null,
}));

const matriz = [
  [
    'V01',
    'Preparación completa',
    'P4/P5 y acción productiva G9',
    'Snapshot íntegro y última completa conservada',
  ],
  [
    'V02',
    'Captura y reapertura',
    'Captura P4/P5 y GPS G9',
    'JSON, cuatro fotos, GPS y acceso local sin autorización remota',
  ],
  [
    'V03',
    'Atomicidad y cuota',
    'Captura integrada G9',
    'UUID previo, rollback y migración con datos reales',
  ],
  [
    'V04',
    'Orden remoto',
    'Transporte y envío P5 G10',
    'Datos, fotos secuenciales y envío al final',
  ],
  [
    'V05',
    'Corte de subida',
    'Multipart real G7/G10 y proxy con bytes observados',
    'Blob remoto íntegro y mismo UUID/clave tras corte',
  ],
  [
    'V06',
    'Respuesta perdida',
    'Idempotencia G7 y confirmación backend observable',
    'Un efecto y replay exacto, incluidos enlaces vencidos',
  ],
  [
    'V07',
    'Red degradada',
    'Flujo remoto G10 y calendario aplicado en red efectiva',
    'Conteos y hashes remotos coincidentes',
  ],
  [
    'V08',
    'Cinco fallos',
    'Transporte y diagnóstico reales G10/G11',
    'Sin sexto intento automático; reintento manual con misma clave',
  ],
  ['V09', 'Renovación', 'Drenaje real G10', 'Renovación previa o pausa sin pérdida ni bucle 401'],
  [
    'V10',
    'Conflictos',
    'P5, revisión, snapshot, #18 e idempotencia G7/G8',
    'Cliente editable prevalece, copia única y rollback atómico',
  ],
  [
    'V11',
    'Indicador',
    'ACK y errores reales G10/G11',
    'Entidades distintas y diagnóstico accesible',
  ],
  [
    'V12',
    'Almacenamiento',
    'Flujo real integrado G9/G11',
    'Cuota y persistencia sin purga ni falso guardado',
  ],
  [
    'V13',
    'Concurrencia remota',
    'Política de idempotencia G7',
    'Un efecto por usuario y rechazo incompatible acordado',
  ],
  [
    'V14',
    'Coordinación',
    'Transporte e interceptor G10/G11',
    'Una operación por versión y ACK sin limpiar edición nueva',
  ],
  [
    'V15',
    'Permisos',
    'P5, #18 y transporte real G7/G8/G10',
    'Sin efecto ni filtración; captura local conservada',
  ],
  [
    'V16',
    'Formulario y archivos',
    'Motor P4, captura P5 y fotos generales G1/G9',
    'Versión, permanentes confirmados, daños vacíos y límites',
  ],
  [
    'V17',
    'PWA privada',
    'Navegación y caché privada integradas G11',
    'Arranque frío y revocación sin tokens ni fuga entre cuentas',
  ],
  [
    'V18',
    'Jornada física',
    'Flujo real y dispositivo durante ocho horas',
    'Horas reales, reinicio, UUID/conteos/hashes reconciliados',
  ],
  [
    'V19',
    'Navegadores',
    'Flujo real y dispositivos, incluido Safari iOS',
    'Compatibilidad real; WebKit no sustituye Safari',
  ],
  [
    'V20',
    'Calidad integral',
    'Servicios y migraciones G7–G12',
    'CI, cobertura aplicable y diccionario generado',
  ],
  [
    'V21',
    'Documentación y stage',
    'Acuerdos externos y despliegue integrado',
    'ADR aceptados y recorrido HTTPS reproducido',
  ],
];
export const escenarios = matriz.map(([id, escenario, bloqueo, evidencia]) => ({
  id,
  escenario,
  estado: 'no_ejecutable',
  bloqueadores: [bloqueo],
  evidencia: [evidencia],
}));

export const casosConflicto = [
  [
    'divergencia',
    'V10',
    ['revision', 'snapshot'],
    ['Borrador propio editable', 'Copia previa y aplicación cliente atómicas'],
  ],
  [
    'replay',
    'V10',
    ['idempotencia', 'snapshot'],
    ['Misma clave no crea segunda copia', 'Código/cuerpo originales exactos'],
  ],
  ['rollback', 'V10', ['revision', 'snapshot'], ['Fallo no deja copia ni mutación parcial']],
  ['publicada', 'V10', ['rechazo'], ['Publicada intacta', 'Captura y cola local conservadas']],
  ['ajeno', 'V15', ['rechazo'], ['Borrador de B intacto', 'Sin filtración de replay ni copia']],
  ['sin-asignacion', 'V15', ['rechazo'], ['Sin mutación remota', 'Captura local conservada']],
  [
    'asignacion-vencida',
    'V15',
    ['rechazo'],
    ['Revalidar al sincronizar', 'Sin bucle de reintentos'],
  ],
  [
    'lectura-sin-permiso',
    'V15',
    ['consulta', 'snapshot', 'rechazo'],
    ['Sin contenido ni metadatos de copia expuestos'],
  ],
].map(([id, validacion, parametros, invariantes]) => ({
  id,
  validacion,
  parametros,
  invariantes,
  estado: 'no_ejecutable',
}));
