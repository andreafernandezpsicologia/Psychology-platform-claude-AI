-- Seed: Documento de consentimiento informado y RGPD
-- Studio Renacer — Andrea Fernández, Psicóloga (Col. 27327)
-- Ejecutar en Supabase SQL Editor (una sola vez)

INSERT INTO documentos_legales (titulo, tipo, version, contenido)
VALUES (
  'Consentimiento informado y política de privacidad',
  'consentimiento_informado',
  1,
  'CONSENTIMIENTO INFORMADO Y POLÍTICA DE PRIVACIDAD
Studio Renacer — Andrea Fernández, Psicóloga (Col. 27327)

1. INFORMACIÓN DEL RESPONSABLE
Responsable del tratamiento: Andrea Fernández García · NIF 23816407E · Nº de colegiación 27327 · andrea@studiorenacer.com

2. FINALIDAD DEL TRATAMIENTO
Sus datos personales (nombre, correo electrónico e historial de sesiones) se tratan con la finalidad de gestionar la relación terapéutica, programar y registrar las sesiones de psicología y hacer seguimiento del proceso.

3. BASE LEGAL
El tratamiento se basa en su consentimiento explícito (Art. 6.1.a RGPD) y en la ejecución del contrato de servicios psicológicos (Art. 6.1.b RGPD). Los datos de salud se tratan al amparo del Art. 9.2.a RGPD (consentimiento explícito).

4. CONSERVACIÓN DE DATOS
Sus datos se conservarán durante la vigencia de la relación terapéutica y, posteriormente, durante el plazo legalmente exigido (mínimo 5 años conforme a la legislación sanitaria española).

5. DESTINATARIOS
No se ceden datos a terceros salvo obligación legal. Los datos se alojan en servidores seguros con cifrado en tránsito y en reposo (Supabase, infraestructura europea).

6. SUS DERECHOS
Tiene derecho a acceder, rectificar, suprimir, oponerse y limitar el tratamiento de sus datos, así como a la portabilidad. Puede ejercerlos dirigiéndose a andrea@studiorenacer.com. Tiene derecho a presentar reclamación ante la Agencia Española de Protección de Datos (www.aepd.es).

7. CONSENTIMIENTO INFORMADO PARA EL TRATAMIENTO PSICOLÓGICO
El proceso terapéutico es voluntario y confidencial. La información compartida en sesión es estrictamente confidencial, salvo en los casos legalmente previstos (riesgo vital para usted u otras personas). Las sesiones se realizan de forma telemática o presencial según se acuerde. Usted puede interrumpir el proceso terapéutico en cualquier momento comunicándolo a la psicóloga con la debida antelación.

Al aceptar este documento, confirma haber leído y comprendido la información anterior y presta su consentimiento libre, informado y específico para el tratamiento de sus datos personales y de salud con las finalidades descritas.'
)
ON CONFLICT (tipo) DO UPDATE SET
  contenido = EXCLUDED.contenido,
  version = documentos_legales.version + 1,
  updated_at = now();
