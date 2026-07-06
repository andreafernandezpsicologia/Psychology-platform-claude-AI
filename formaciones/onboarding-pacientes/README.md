# Dar acceso a la app a pacientes que ya trabajaban en papel

Guía operativa para dar de alta en el área privada (app.studiorenacer.com) a pacientes
con los que Andrea **ya trabaja** y que **ya firmaron la LOPD/consentimiento y el contrato en papel**.

## Qué hay en esta carpeta

- **`guia-area-privada-studio-renacer-ES.pdf`** · **`-EN.pdf`** · **`-DA.pdf`** — Guía de bienvenida
  «Cómo funciona tu área privada» (6 páginas: activar, entrar, pedir cita, videollamada, **reglas de
  la sesión**, bono, contrato, derechos RGPD). Enfoque operativo, no clínico. Fuente reproducible:
  `tools/guias/build-onboarding.mjs`.
- Este `README.md` — el runbook de abajo.

## El email de bienvenida ya adjunta la guía (ES)

Al invitar a un paciente, el email de activación **adjunta automáticamente la versión en español**
de la guía (`sendWelcomeEmail` en `backend/services/emailService.js` lee el PDF de
`backend/assets/guia-area-privada-studio-renacer.pdf`). Para pacientes en **inglés o danés**, envía
tú el PDF correspondiente de esta carpeta (EN/DA) por email o WhatsApp.

## Regenerar los PDF (si cambian textos)

1. Editar `tools/guias/build-onboarding.mjs`.
2. `node tools/guias/build-onboarding.mjs` → genera los 3 HTML en `tools/guias/out/`.
3. Renderizar cada HTML a PDF con Chrome headless (ver gotcha de OneDrive en la memoria
   `landing-deploy-and-guides`): matar Chrome, render a carpeta fuera de OneDrive, `--headless`
   antiguo, rutas con barras normales. Comprobar que cada PDF tiene **5 páginas** (`grep -c /MediaBox`).
4. Copiar los PDF a esta carpeta **y** el ES a `backend/assets/guia-area-privada-studio-renacer.pdf`
   (el que adjunta el email). Commit + push a master → Render redespliega el backend con el PDF nuevo.

## Runbook: por cada paciente que ya viene trabajando

1. **Verificación previa de consentimiento (GDPR).** Antes de invitar, confirmar que el texto del
   consentimiento que muestra la app (documento en Supabase `documentos_legales`, tipos
   `consentimiento_informado`/`rgpd`; sembrado en `backend/seeds/rgpd_consentimiento.sql`) coincide con
   lo que el paciente firmó en papel (`Consentimiento_Informado.docx.pdf`, `Politica_de_Privacidad.docx.pdf`).
   Si difiere en algo sustancial, actualizar el documento en `documentos_legales` **antes** de invitar.
2. **Invitar.** En el panel admin (`/admin`), formulario de invitar paciente: nombre + email. Se envía
   automáticamente el email de activación.
3. **Enviar la guía.** Adjuntar el PDF de bienvenida de esta carpeta en el idioma del paciente.
4. **El paciente activa** (lo hace él): crea contraseña y **re-acepta el consentimiento** en la app.
   Queda un registro digital con fecha en `aceptaciones_documentos`.
5. **Crear el bono.** En la ficha del paciente, crear un bono con el número de **sesiones restantes**
   (convención: no se registran las ya consumidas; el bono refleja lo que le queda).
6. **Subir el contrato firmado en papel.** En la ficha, con el bono en estado «sin contrato», usar
   **«Subir contrato firmado en papel»** para subir el escaneo. El estado pasa a «completado».
7. **Comprobar** en la ficha: bono correcto, contrato «completado» y consentimiento aceptado
   (botón «📄 Descargar documento de aceptación»).

## Notas

- La terapia del paciente no cambia; el área privada solo añade gestión online (citas, videollamada,
  bono, contrato, exportar datos RGPD).
- El paciente puede recuperar su contraseña solo desde «¿Olvidaste tu contraseña?» — no requiere a Andrea.
- Si el enlace de activación caduca, reinvitar desde el panel genera uno nuevo.
