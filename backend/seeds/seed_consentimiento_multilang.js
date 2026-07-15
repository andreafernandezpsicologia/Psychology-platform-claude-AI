// Seed multi-idioma del consentimiento informado (ES / EN / DA)
// -----------------------------------------------------------------------------
// Lee los textos VALIDADOS de:
//   formaciones/onboarding-pacientes/consentimiento-traducciones/PARA-VALIDAR-{ES,EN,DA}.txt
// les quita la cabecera "==== BORRADOR PARA VALIDACIÓN ... ====" y hace UPSERT
// en documentos_legales por (tipo, idioma), que es el índice único que usa la app.
//
// Revisión julio 2026: cita danesa corregida (Autorisationsloven /
// Journalføringsbekendtgørelse en lugar de Sundhedsloven §43), Sección 9
// (queja y reclamación) restaurada y frases de las secciones 5/6/8 recuperadas.
// Los tres idiomas quedan paralelos y en versión 1.1.
//
// USO (desde la raíz del repo, con el backend/.env que ya tiene las credenciales):
//   node backend/seeds/seed_consentimiento_multilang.js
//
// Dry-run (no escribe en la BD, solo comprueba que lee y limpia los textos):
//   node backend/seeds/seed_consentimiento_multilang.js --dry-run
// -----------------------------------------------------------------------------
const fs = require('fs');
const path = require('path');
// Carga backend/.env por ruta absoluta para que funcione desde cualquier cwd
// (p. ej. `node backend/seeds/seed_consentimiento_multilang.js` desde la raíz del repo).
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DRY_RUN = process.argv.includes('--dry-run');
// Entero monotónico en la columna `version` (antes: 2). OJO: el texto legal se
// autodenomina "Versión 1.1 — Julio 2026"; la correspondencia es v3 (BD) ↔ v1.1
// (texto). Si se revisa el texto, subir AMBOS: este entero y la línea "Versión"
// de los tres .txt. La prueba de qué aceptó cada paciente no depende de esto:
// se guarda snapshot del contenido en aceptaciones_documentos al aceptar.
const VERSION = 3;

const BASE = path.join(
  __dirname, '..', '..',
  'formaciones', 'onboarding-pacientes', 'consentimiento-traducciones'
);

const IDIOMAS = [
  { idioma: 'es', file: 'PARA-VALIDAR-ES.txt', titulo: 'Consentimiento informado para la prestación de servicios de psicología online' },
  { idioma: 'en', file: 'PARA-VALIDAR-EN.txt', titulo: 'Informed consent for the provision of online psychology services' },
  { idioma: 'da', file: 'PARA-VALIDAR-DA.txt', titulo: 'Informeret samtykke til levering af online psykologtjenester' },
];

// Quita el banner superior delimitado por dos líneas de "====" y deja solo el
// texto legal (desde "CONSENTIMIENTO INFORMADO…" / "INFORMED CONSENT…" …).
// Si el banner no está donde se espera, ABORTA: nunca publicar el fichero
// entero (incluiría "BORRADOR PARA VALIDACIÓN" como texto legal del paciente).
function stripBanner(raw, file) {
  const lines = raw.split(/\r?\n/);
  const isRule = (l) => /^={10,}$/.test(l.trim());
  const ruleIdx = lines.map((l, i) => (isRule(l) ? i : -1)).filter((i) => i >= 0);
  if (ruleIdx.length < 2) {
    throw new Error(`${file}: no se encontró el banner delimitado por dos líneas "====". ` +
      'Revisa el formato del fichero; se aborta para no publicar el banner como texto legal.');
  }
  const body = lines.slice(ruleIdx[1] + 1).join('\n').trim();
  if (/BORRADOR|VALIDACIÓN/i.test(body.slice(0, 200))) {
    throw new Error(`${file}: el texto resultante aún empieza con restos del banner; abortando.`);
  }
  return body;
}

async function main() {
  const docs = IDIOMAS.map(({ idioma, file, titulo }) => {
    const raw = fs.readFileSync(path.join(BASE, file), 'utf8');
    const contenido = stripBanner(raw, file);
    return { idioma, titulo, contenido };
  });

  // Comprobación previa: las 9 secciones (encabezados "1." … "9.") deben estar
  // presentes en cada idioma, y la cita danesa errónea no debe reaparecer.
  for (const d of docs) {
    const faltan = [];
    for (let n = 1; n <= 9; n++) {
      if (!new RegExp(`^\\s*${n}\\.\\s+\\S`, 'm').test(d.contenido)) faltan.push(n);
    }
    console.log(`• ${d.idioma}: ${d.contenido.length} chars · secciones 1-9 ${faltan.length ? `FALTAN: ${faltan.join(',')}` : 'OK'}`);
    if (faltan.length) throw new Error(`El texto ${d.idioma} no contiene las secciones ${faltan.join(', ')}; abortando.`);
    // La revisión de jul-2026 eliminó la cita errónea a Sundhedsloven §43;
    // detectar cualquier reintroducción (con o sin símbolo §).
    if (/sundhedsloven/i.test(d.contenido)) throw new Error(`El texto ${d.idioma} vuelve a citar "Sundhedsloven" (cita errónea corregida en jul-2026); abortando.`);
  }

  if (DRY_RUN) {
    console.log('\n[dry-run] Textos leídos y validados correctamente. No se ha escrito en la BD.');
    return;
  }

  const supabase = require('../services/supabaseClient');
  for (const { idioma, titulo, contenido } of docs) {
    const { data, error } = await supabase
      .from('documentos_legales')
      .upsert(
        { titulo, tipo: 'consentimiento_informado', idioma, version: VERSION, contenido },
        { onConflict: 'tipo,idioma' }
      )
      .select('id, tipo, idioma, version')
      .single();
    // Abortar al primer fallo: seguir dejaría un estado parcial entre idiomas
    // con ✅ y una tabla final de aspecto sano que enmascaran el error.
    if (error) throw new Error(`Upsert de "${idioma}" falló: ${error.message}. Estado parcial — revisar y re-ejecutar.`);
    console.log(`✅ ${idioma} → id ${data.id}, v${data.version}`);
  }

  // Estado final: deben quedar exactamente 3 filas (es/en/da) sin idioma NULL.
  const { data: all, error: selErr } = await supabase
    .from('documentos_legales')
    .select('id, tipo, idioma, version')
    .eq('tipo', 'consentimiento_informado')
    .order('idioma');
  if (selErr) throw new Error(`No se pudo verificar el estado final: ${selErr.message}`);
  console.log('\nEstado final (tipo=consentimiento_informado):');
  console.table(all);
  const nulos = all.filter((r) => !r.idioma);
  if (nulos.length) console.warn(`⚠️  Hay ${nulos.length} fila(s) con idioma NULL — revísalas y bórralas si son duplicados antiguos.`);
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
