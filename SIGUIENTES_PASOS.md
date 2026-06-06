# Studio Renacer — Siguientes pasos (hoja de ruta)

_Actualizado: 1 de junio de 2026_

## ✅ Ya está hecho
- Web "Coming Soon" creada y conectada a tu dominio.
- Foto `andrea.jpg` lista e incluida en el paquete de despliegue.
- Páginas legales creadas y enlazadas: `/privacy`, `/terms` (aviso legal), `/cookies`.
- Correos de los 4 documentos legales unificados a **admin@studiorenacer.com**.
- Paquete de despliegue actualizado: `studio-renacer-landing-ACTUALIZADO.zip`.

> Lo que queda depende de tus cuentas (IONOS, Vercel, Resend). Sigue las fases en orden.

---

## FASE A — Dejar la landing 100 % publicada y funcional (prioridad ahora)

### A1. Crear el buzón de correo `admin@studiorenacer.com`
- [X ] En **IONOS → Correo / Email**, crea el buzón `admin@studiorenacer.com` (o un alias que reenvíe a tu Gmail).
- [X ] Compureba que puedes **entrar y leer** ese buzón. Es el correo que aparece en todos los documentos legales y el que recibirá los avisos del formulario.

### A2. Verificar el dominio en Resend (esto es lo que hace que lleguen los emails)
- [X ] Entra en **Resend → Domains → Add Domain** y añade `studiorenacer.com`.
- [X ] Resend te dará 3 registros DNS (SPF, DKIM y, opcionalmente, DMARC).
- [X ] En **IONOS → tu dominio → DNS**, añade esos registros tal cual (copia y pega).
- [X ] Espera a que en Resend el dominio aparezca como **"Verified"** (de minutos a unas horas).

### A3. Configurar las variables de entorno en Vercel
- [X ] En **Vercel → tu proyecto → Settings → Environment Variables**, añade:
  - `RESEND_API_KEY` = tu clave de Resend (empieza por `re_`)
  - `FROM_EMAIL` = `Studio Renacer <admin@studiorenacer.com>`
  - `NOTIFY_TO` = `admin@studiorenacer.com`
- [X ] Marca las tres para **Production, Preview y Development**.
- [ ] (Mientras el dominio no esté verificado, puedes probar con `FROM_EMAIL = onboarding@resend.dev`, pero solo te llegará a tu propio correo de la cuenta de Resend.)

### A4. Redesplegar la web con el paquete actualizado
- [X ] En **Vercel**, sube `studio-renacer-landing-ACTUALIZADO.zip` (Add New → arrastrar el zip) **o**, si usas GitHub, sube los archivos nuevos y haz `git push`.
- [X ] Pulsa **Redeploy** para que tome las variables de entorno nuevas.

### A5. Comprobar la foto
- [X ] Abre la web y verifica que tu foto se ve en la cabecera (hero) y en la sección "Conocer a Andrea".
- [ ] Si sigue sin verse, fuerza recarga (Ctrl/Cmd + Shift + R) para saltar la caché.

### A6. Comprobar las páginas legales
- [X ] Pulsa los enlaces del pie: **Política de privacidad, Política de cookies, Aviso legal**.
- [X ] Comprueba que abren `/privacy`, `/cookies`, `/terms` y se ven bien.
- [X ] Cambia el idioma (ES / EN / DA) y confirma que el enlace del formulario sigue funcionando.

### A7. Probar el formulario de la lista de espera (de principio a fin)
- [X ] Rellena el formulario con un correo tuyo real y envíalo.
- [ X ] Confirma que **llega el email de confirmación** al usuario.
- [ X ] Confirma que **te llega el aviso** a `admin@studiorenacer.com`.
- [ X ] Si algo falla: mira **Resend → Emails** (muestra cada envío y su error) y **Vercel → Logs**.

### A8. Repaso final de la landing
- [ X ] Revisa en **móvil** (o Chrome → modo responsive).
- [ X ] Revisa textos en los 3 idiomas.
- [ X ] Comprueba el título y la descripción que salen al compartir el enlace (SEO/redes).

### A9. (Opcional) Métricas
- [ Ayuda ] Activa **Vercel → Analytics → Web Analytics** (gratis, sin cookies de seguimiento).

---

## FASE B — Cerrar la parte legal

- [X ] Revisa que los datos de los documentos son correctos: **NIF 23816407E**, **colegiación 27327**, dirección y razón social.
- [X ] Decide el correo de contacto público de la web (el pie usa `info@studiorenacer.com`): unifícalo también a `admin@studiorenacer.com` si quieres un único buzón.
- [ ] (Opcional) Pídeme las **versiones .docx editables** de los 4 documentos, ya rellenas y con el correo unificado, por si quieres modificarlos en el futuro.
- [X ] Guarda una copia de seguridad de los 4 PDF finales fuera de OneDrive.

---

## FASE C — Decisiones antes de construir la app (MVP Fase 1)

Antes de programar la plataforma completa, conviene cerrar estas decisiones:
- [X ] **Pasarela de pago**: ¿Stripe? (cobro de sesiones y bonos).
- [ Zoom ] **Videollamada**: ¿servicio propio, Google Meet, Whereby, Zoom…?
- [ X ] **Buzones definitivos**: contacto, avisos, soporte.
- [ X ] **Política de cancelación y tarifas** ya están en los documentos; confirma que coinciden con lo que ofrecerás.
- [ X ] Confirma cuentas ya creadas (según tu guía): Supabase, Resend, Render, GitHub, dominio IONOS.

---

## FASE D — Construir el MVP (resumen del plan que ya tienes)

Detalle completo en `MVP_FASE_1_PASO_A_PASO.md`. Resumen de las 8 semanas:

1. **Semanas 1–2 · Base de datos + backend**: crear tablas en Supabase (usuarios, pacientes, packs, sesiones, documentos legales, aceptaciones) y el esqueleto del backend en Render.
2. **Semanas 3–4 · APIs**: autenticación (admin + paciente), pacientes, sesiones, packs y documentos legales; conectar el envío de emails con Resend.
3. **Semanas 5–6 · Frontend**: login/registro/activación, panel de administración (pacientes, calendario) y panel del paciente (sesiones, cobertura, perfil, aceptación de documentos).
4. **Semanas 7–8 · Despliegue y pruebas**: backend en Render, frontend en Netlify/Vercel, dominio apuntando, y prueba del flujo completo (alta de paciente → activación → aceptar documentos → reservar sesión).

> Cuando quieras empezar, te puedo ayudar paso a paso con la **Tarea 1** (estructura del backend) y la **Tarea 2** (crear las tablas en Supabase).

---

## ⏱️ Resumen rápido (qué hacer primero)
1. Crear buzón `admin@studiorenacer.com` (IONOS).
2. Verificar `studiorenacer.com` en Resend (registros DNS en IONOS).
3. Poner las 3 variables en Vercel.
4. Redesplegar con el zip actualizado.
5. Probar: foto, enlaces legales y formulario (que llegue el email).
