# 0035. Detalle, veredictos y marcadores de revisión

- Fecha: 27/10/2026.
- Estado: aceptado.
- Reglas: RN-REV-03/04/05/06.

La ruta diferida `/revisiones/:revisionId` reutiliza guardia e interceptores compartidos. El formulario original se muestra mediante `MotorFormularioComponent` en lectura. Cada campo autorizado por backend tiene valor y referencia junto a `MarcadorAnclado`, sin modificar el componente de Foro ni inventar un marcador alternativo.

Los formularios de observación y veredicto bloquean doble envío y navegación durante escritura; el backend autoriza y valida nuevamente. No se reintenta un POST por errores funcionales o de red. El ciclo confirmado se presenta en lectura, y el cambio de sesión descarta los datos y respuestas tardías.

Aprobar conserva el estado calculado por defecto. Una selección explícita exige justificación en UI; el backend aplica la validación definitiva frente al cálculo. No se muestra un IC estimado ficticio ni se modifica el inventario desde el cliente. El componente de estimación/confirmación de estado compartido podrá integrarse al disponer del recorrido completo de evidencia y cálculo.

Los arreglos se marcan como campo completo; no se prometen marcas de filas sin identidad estable. Archivos, calificación, historial, pendientes del estudiante y alertas quedan fuera de este incremento.
