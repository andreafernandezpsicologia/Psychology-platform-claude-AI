require('dotenv').config();
const supabase = require('../services/supabaseClient');

async function fix() {
  // Intentar llamar a una función RPC que ejecute el ALTER TABLE
  // Si no existe la función, la creamos primero

  // Paso 1: crear función helper que ejecute SQL dinámico
  // Supabase service role puede crear funciones via rpc si existe pg_execute

  // Intentamos directamente con rpc para ver qué funciones hay disponibles
  const { data, error } = await supabase.rpc('version');
  if (error) {
    console.log('RPC error:', error.message);
  } else {
    console.log('Postgres version:', data);
  }

  // Intentamos con exec_sql
  const { data: d2, error: e2 } = await supabase.rpc('exec_sql', {
    sql_query: `ALTER TABLE pacientes DROP CONSTRAINT IF EXISTS pacientes_estado_check;
ALTER TABLE pacientes ADD CONSTRAINT pacientes_estado_check CHECK (estado IN ('pendiente', 'activo', 'archivado', 'inactivo'));`
  });

  if (e2) {
    console.log('exec_sql no disponible:', e2.message);
    console.log('\n⚠️  Ejecuta esto manualmente en Supabase > SQL Editor:');
    console.log('-------------------------------------------------------');
    console.log(`ALTER TABLE pacientes DROP CONSTRAINT IF EXISTS pacientes_estado_check;`);
    console.log(`ALTER TABLE pacientes ADD CONSTRAINT pacientes_estado_check CHECK (estado IN ('pendiente', 'activo', 'archivado', 'inactivo'));`);
    console.log('-------------------------------------------------------\n');
  } else {
    console.log('✅ Constraint actualizado:', d2);
  }
}

fix();
