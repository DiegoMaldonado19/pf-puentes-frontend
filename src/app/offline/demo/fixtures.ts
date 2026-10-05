import { BaseLocal } from '../base-local';
export const PROPIETARIOS = [
  '019a0000-0000-7000-8000-000000000001',
  '019a0000-0000-7000-8000-000000000002',
];
export const PUENTE = '019a0000-0000-7000-8000-000000000003';
export const FORMULARIO = '019a0000-0000-7000-8000-000000000004';
export async function prepararFixtures(db: BaseLocal) {
  if (db.name !== 'puentes-offline-demo') throw new Error('Fixtures solo en la base demo');
  await db.transaction('rw', db.puentes, db.esquemas_formulario, async () => {
    for (const propietario_id of PROPIETARIOS) {
      await db.puentes.put({
        id: PUENTE,
        propietario_id,
        modelo_version: 1,
        preparada_en: '2026-10-05T00:00:00Z',
        datos: { nombre: 'Puente ficticio', fixture: true },
      });
      await db.esquemas_formulario.put({
        id: FORMULARIO,
        propietario_id,
        modelo_version: 1,
        preparada_en: '2026-10-05T00:00:00Z',
        datos: { fixture: true, version: 1 },
      });
    }
  });
}
