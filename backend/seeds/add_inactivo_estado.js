require('dotenv').config();
const supabase = require('../services/supabaseClient');

async function migrate() {
  // Supabase no expone ALTER TABLE via PostgREST, usamos rpc o la API de management.
  // Lo hacemos via query directa al pg endpoint si está disponible,
  // o mostramos el SQL a ejecutar manualmente.
  console.log('');
  console.log('Ejecuta este SQL en el SQL Editor de Supabase:');
  console.log('------------------------------------------------');
  console.log(`
ALTER TABLE pacientes DROP CONSTRAINT IF EXISTS pacientes_estado_check;
ALTER TABLE pacientes ADD CONSTRAINT pacientes_estado_check
  CHECK (estado IN ('pendiente', 'activo', 'archivado', 'inactivo'));
  `);
  console.log('------------------------------------------------');
  console.log('');

  // Verificamos los estados actuales
  const { data, error } = await supabase
    .from('pacientes')
    .select('estado')
    .limit(5);

  if (error) {
    console.error('Error conectando:', error.message);
  } else {
    console.log('Estados actuales en BD:', data.map(d => d.estado));
  }
}

migrate();
