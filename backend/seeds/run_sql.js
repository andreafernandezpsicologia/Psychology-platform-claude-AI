// Helper para ejecutar SQL via pg directamente
// Necesita: npm install pg
require('dotenv').config();

const sql = `
ALTER TABLE packs ADD COLUMN IF NOT EXISTS estado_pago TEXT DEFAULT 'no_pagado';
ALTER TABLE packs ADD COLUMN IF NOT EXISTS contrato_estado TEXT DEFAULT 'sin_contrato';
ALTER TABLE packs ADD COLUMN IF NOT EXISTS contrato_path_paciente TEXT;
ALTER TABLE packs ADD COLUMN IF NOT EXISTS contrato_path_admin TEXT;
ALTER TABLE packs ADD COLUMN IF NOT EXISTS contrato_fecha_paciente TIMESTAMPTZ;
ALTER TABLE packs ADD COLUMN IF NOT EXISTS contrato_fecha_admin TIMESTAMPTZ;
`;

// Intentamos via fetch a la Management API de Supabase
// (requiere SUPABASE_ACCESS_TOKEN en .env)
async function runSQL() {
  const projectRef = process.env.SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');

  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Error:', err);
    console.log('\nNo se pudo ejecutar automáticamente.');
    console.log('Pega este SQL en Supabase → SQL Editor:');
    console.log('---');
    console.log(sql);
    return;
  }

  const data = await res.json();
  console.log('✅ SQL ejecutado:', data);
}

runSQL();
