require('dotenv').config();
const supabase = require('../services/supabaseClient');

const plantillaContrato = `CONTRATO DE SERVICIOS PSICOLÓGICOS
Studio Renacer — Andrea Fernández, Psicóloga (Col. 27327)

Fecha: ___________________

DATOS DEL CLIENTE
Nombre y apellidos: ___________________________________________________
DNI/NIE: ___________________
Fecha de nacimiento: ___________________
Correo electrónico: ___________________________________________________
Teléfono: ___________________
Dirección: ___________________________________________________

DATOS DE LA PSICÓLOGA
Nombre: Andrea Fernández García
Nº de colegiación: 27327
Correo: andrea@studiorenacer.com
Web: studiorenacer.com

1. OBJETO DEL CONTRATO
La psicóloga prestará servicios de evaluación y tratamiento psicológico al cliente, de forma telemática (videollamada) o presencial, según se acuerde en cada caso.

2. PACK CONTRATADO
Nº de sesiones: _______
Duración por sesión: 50 minutos
Modalidad: □ Videollamada  □ Presencial  □ Mixta
Precio por sesión: _________ €
Importe total del pack: _________ €

3. FORMA DE PAGO
□ Transferencia bancaria
□ Bizum
□ Efectivo

El pago se realizará: □ Al inicio del pack  □ Por sesión completada  □ Otro: ___________

4. POLÍTICA DE CANCELACIÓN
- Cancelaciones con más de 24 horas de antelación: sin coste.
- Cancelaciones con menos de 24 horas de antelación: se descontará la sesión del pack.
- En caso de ausencia sin aviso: se descontará la sesión del pack.

5. CONFIDENCIALIDAD
La información compartida durante las sesiones es estrictamente confidencial, salvo en los supuestos legalmente previstos (riesgo vital para el cliente u otras personas, obligación legal de denuncia).

6. DURACIÓN Y RESCISIÓN
Este contrato tiene vigencia durante la duración del pack contratado. Cualquiera de las partes podrá rescindirlo con un preaviso de al menos una semana.

7. ACEPTACIÓN
Ambas partes declaran haber leído, comprendido y aceptado las condiciones del presente contrato.

FIRMA DEL CLIENTE                        FIRMA DE LA PSICÓLOGA

___________________________              ___________________________
${' '.repeat(33)}Andrea Fernández García
Fecha: ___________________               Col. 27327`;

async function setup() {
  console.log('\n🚀 Configurando nuevas features...\n');

  // 1. Crear bucket de Storage para contratos
  console.log('📦 Creando bucket "contratos" en Supabase Storage...');
  const { error: bucketError } = await supabase.storage.createBucket('contratos', {
    public: false,
    fileSizeLimit: 10485760, // 10MB
  });
  if (bucketError && !bucketError.message.includes('already exists')) {
    console.log('  ⚠️  Bucket:', bucketError.message);
  } else {
    console.log('  ✅ Bucket "contratos" listo');
  }

  // 2. Seed plantilla del contrato en documentos_legales
  console.log('\n📄 Insertando plantilla de contrato...');
  const { data: contrato, error: contratoError } = await supabase
    .from('documentos_legales')
    // El índice único de documentos_legales es (tipo, idioma) — 'tipo' a secas ya no existe.
    .upsert({ titulo: 'Contrato de servicios psicológicos', tipo: 'contrato_servicios', idioma: 'es', version: 1, contenido: plantillaContrato }, { onConflict: 'tipo,idioma' })
    .select().single();
  if (contratoError) {
    console.log('  ❌ Error:', contratoError.message);
  } else {
    console.log('  ✅ Plantilla insertada, ID:', contrato.id);
  }

  // 3. Instrucciones SQL para Supabase Dashboard
  console.log('\n⚠️  EJECUTA ESTO EN SUPABASE → SQL EDITOR:');
  console.log('═'.repeat(60));
  console.log(`
-- Estado de pago en packs
ALTER TABLE packs ADD COLUMN IF NOT EXISTS estado_pago TEXT DEFAULT 'no_pagado';

-- Seguimiento de contratos en packs
ALTER TABLE packs ADD COLUMN IF NOT EXISTS contrato_estado TEXT DEFAULT 'sin_contrato';
ALTER TABLE packs ADD COLUMN IF NOT EXISTS contrato_path_paciente TEXT;
ALTER TABLE packs ADD COLUMN IF NOT EXISTS contrato_path_admin TEXT;
ALTER TABLE packs ADD COLUMN IF NOT EXISTS contrato_fecha_paciente TIMESTAMPTZ;
ALTER TABLE packs ADD COLUMN IF NOT EXISTS contrato_fecha_admin TIMESTAMPTZ;
  `);
  console.log('═'.repeat(60));
  console.log('\n✅ Seed completado. Ejecuta el SQL de arriba en Supabase para terminar.\n');
}

setup();
