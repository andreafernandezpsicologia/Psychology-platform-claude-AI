require('dotenv').config();
const supabase = require('../services/supabaseClient');

const contenido = `CONSENTIMIENTO INFORMADO PARA LA PRESTACIÓN DE SERVICIOS DE PSICOLOGÍA ONLINE
Studio Renacer — Andrea Fernández, Psicóloga (Col. 27327) — Versión 1.0 — Junio 2026

INFORMACIÓN SOBRE LA PROFESIONAL
Nombre: Dña. Andrea Fernández
Titulación: Grado en Psicología; Máster en Psicología General Sanitaria
Número de colegiación: 27327 — Colegio Oficial de Psicólogos de Cataluña
Especialidad: Psicología Clínica; Crisis, emergencias y catástrofes
Correo electrónico: admin@studiorenacer.com

1. NATURALEZA Y PROPÓSITO DEL SERVICIO
La psicoterapia online es un proceso de intervención psicológica que se lleva a cabo a través de medios telemáticos (videollamada). Tiene como objetivo ayudar al paciente/cliente a comprender y manejar sus dificultades emocionales, cognitivas y/o de conducta, promoviendo su bienestar psicológico.

El proceso terapéutico se basa en la relación confidencial entre la psicóloga y el paciente/cliente, y puede incluir diferentes técnicas e intervenciones según el enfoque terapéutico y las necesidades individuales.

IMPORTANTE: La psicoterapia NO es un servicio de urgencias psiquiátricas. En caso de crisis o riesgo vital inmediato, debe llamar al 112 o acudir al servicio de urgencias más cercano.

2. MODALIDAD ONLINE: BENEFICIOS Y LIMITACIONES
Beneficios:
• Accesibilidad desde cualquier lugar con conexión a Internet.
• Flexibilidad horaria y eliminación de barreras geográficas.
• Comodidad del entorno propio del paciente/cliente.
• Continuidad del proceso en situaciones de movilidad o desplazamiento.

Limitaciones y consideraciones:
• Puede no ser la modalidad más adecuada para todos los cuadros clínicos (p. ej., crisis agudas, patología grave, necesidad de exploración física).
• La calidad de la sesión puede verse afectada por problemas técnicos de conectividad.
• La privacidad y la confidencialidad dependen también del entorno físico desde el que se conecte.
• En caso de detectarse que la modalidad online no es la más adecuada, la psicóloga lo comunicará y ofrecerá la derivación oportuna.

3. PROCESO TERAPÉUTICO Y DERECHOS DEL PACIENTE
El proceso terapéutico se iniciará con una evaluación inicial para identificar los objetivos y el plan de trabajo.

El paciente/cliente tiene derecho a:
• Recibir información clara sobre el proceso, los objetivos y las técnicas empleadas.
• Participar activamente en la toma de decisiones sobre su tratamiento.
• Rechazar o poner fin al tratamiento en cualquier momento, sin necesidad de justificación.
• Solicitar la derivación a otro profesional en cualquier momento.

4. HONORARIOS Y CANCELACIONES
Los honorarios son los establecidos en el Contrato de Servicios. El pago se realiza de forma anticipada a través de la Plataforma.

El paciente/cliente puede cancelar o reprogramar una sesión sin coste con al menos 24 horas de antelación. Las ausencias no comunicadas y las cancelaciones con menos de 24 horas podrán suponer la pérdida de la sesión abonada.

5. CONFIDENCIALIDAD Y SUS LÍMITES
Todo lo tratado en las sesiones es estrictamente confidencial. La psicóloga está sujeta al secreto profesional establecido en el Código Deontológico del Psicólogo y en la legislación vigente.

La confidencialidad podrá verse limitada únicamente en estas circunstancias excepcionales:
• Riesgo grave e inminente para la vida del paciente/cliente o de terceras personas.
• Mandato judicial o requerimiento de autoridad competente.
• Supervisión clínica (siempre con datos anonimizados o con consentimiento del interesado).

6. GRABACIÓN DE SESIONES
Las sesiones NO serán grabadas sin consentimiento expreso y por escrito. Queda expresamente prohibido al paciente/cliente grabar, fotografiar o difundir el contenido de las sesiones sin el consentimiento escrito de la psicóloga.

7. PROTECCIÓN DE DATOS PERSONALES Y DE SALUD
Los datos personales y de salud facilitados durante el proceso terapéutico serán tratados conforme al RGPD (UE) 2016/679, la LOPDGDD y, en su caso, la normativa danesa aplicable (Databeskyttelsesloven).

Responsable del tratamiento: Andrea Fernández García · NIF 23816407E · admin@studiorenacer.com

El paciente/cliente consiente de forma específica e informada el tratamiento de sus datos de salud (categoría especial conforme al art. 9 RGPD), necesario para la prestación del servicio. Este consentimiento es voluntario y puede ser retirado en cualquier momento, sin que ello afecte a la licitud del tratamiento realizado con anterioridad.

Plazo de conservación:
— España: mínimo 5 años desde la última consulta (Ley 41/2002).
— Dinamarca / Denmark: mínimo 10 años (Sundhedsloven §43).

Autoridad de control competente para reclamaciones:
— España: Agencia Española de Protección de Datos (www.aepd.es)
— Dinamarca / Denmark: Datatilsynet (www.datatilsynet.dk)
— Otros países UE/EEE: la autoridad nacional correspondiente.

8. SITUACIONES DE EMERGENCIA Y CRISIS
En caso de crisis o emergencia:
• Llamar al 112 (válido en España y Dinamarca).
• Acudir al servicio de urgencias hospitalarias más cercano.
• Contactar con el médico/a de cabecera o psiquiatra de referencia.

La Plataforma NO presta servicio de guardia ni atención inmediata 24/7.

DECLARACIÓN DE CONSENTIMIENTO
Al aceptar este documento, confirmo que:
1. He leído y comprendido la información contenida en este documento.
2. He tenido la oportunidad de formular preguntas.
3. Comprendo la naturaleza voluntaria del proceso terapéutico y mi derecho a retirar este consentimiento en cualquier momento.
4. Consiento de forma expresa e informada el tratamiento de mis datos de salud para la prestación del servicio de psicología online.
5. He sido informado/a de las limitaciones de la modalidad online y de los procedimientos de actuación en situaciones de emergencia.`;

async function seed() {
  const { data, error } = await supabase
    .from('documentos_legales')
    .upsert(
      { titulo: 'Consentimiento informado para la prestación de servicios de psicología online', tipo: 'consentimiento_informado', version: 2, contenido },
      { onConflict: 'tipo' }
    )
    .select()
    .single();

  if (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }

  console.log('✅ Documento insertado correctamente:');
  console.log(`   ID: ${data.id}`);
  console.log(`   Tipo: ${data.tipo}`);
  console.log(`   Versión: ${data.version}`);
}

seed();
