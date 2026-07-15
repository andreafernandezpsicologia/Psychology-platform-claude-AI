# Revisión legal — Consentimiento informado (traducciones DA / EN)

**Documentos revisados:** `PARA-VALIDAR-DA.txt`, `PARA-VALIDAR-EN.txt`
**Fuente comparada:** `Consentimiento_Informado.docx.pdf` (ES, v1.0)
**Fecha:** julio 2026 · Revisión para validación previa a invitar pacientes en EN/DA

> **✅ ESTADO: correcciones aplicadas y 3 idiomas alineados** (julio 2026). `PARA-VALIDAR-ES/EN/DA.txt` quedan idénticos en estructura (9 secciones), con cita danesa corregida, Sección 9 restaurada, frases de las secc. 5/6/8 recuperadas y versión unificada **1.1 — julio 2026**. Descubierto de paso: el ES que había en la BD (`seed_rgpd.js`, v2) arrastraba los mismos fallos; se marca obsoleto.
>
> **Carga en la BD:** preparado `backend/seeds/seed_consentimiento_multilang.js` (sube ES/EN/DA por `tipo,idioma`). Ejecutar desde tu máquina: `node backend/seeds/seed_consentimiento_multilang.js`. No se pudo ejecutar automáticamente (el entorno de trabajo no tiene red ni credenciales de Supabase).
>
> **Pendiente:** (1) tu visto bueno legal final; (2) confirmación de un jurista danés sobre la base de conservación y la vía de queja; (3) ejecutar el seed.

---

## Veredicto

Las dos traducciones son **fieles entre sí** (misma estructura, mismos datos, mismas cifras) y de **alta calidad lingüística**. La mayoría de las citas legales son correctas. Pero **no son una traducción "pura"**: al preparar los borradores se **añadieron citas legales** que no están en el ES y se **omitió una sección entera** del original. Hay **1 error legal** que corregir y **varias omisiones**. No apto para aprobar tal cual; corregir los puntos de abajo primero.

---

## 🔴 Corregir antes de aprobar

**1. Cita legal danesa incorrecta (sección 7 — conservación).**
Ambos textos citan `Sundhedsloven §43` para el plazo de 10 años. Ese artículo regula la **comunicación** de datos de salud a terceros (con consentimiento), **no la conservación**. La cifra de 10 años sí es correcta en 2026 (ver nota), pero la base legal está mal.

- **DA — antes:** `Danmark: mindst 10 år (sundhedsloven §43).`
- **DA — después:** `Danmark: mindst 10 år fra seneste optegnelse (journalføringspligt efter autorisationsloven).`
- **EN — antes:** `Denmark: minimum 10 years (Sundhedsloven §43).`
- **EN — después:** `Denmark: minimum 10 years from the last entry (record-keeping duty under the Danish Authorisation Act).`

> **Nota sobre los 10 años (verificado):** para psicólogos autorizados en Dinamarca el plazo era **5 años** hasta el 31-dic-2025; desde el **1-ene-2026** es **10 años** y en formato electrónico (la llevanza pasó de la Psykologloven a la Autorisationsloven). El documento está actualizado — solo hay que arreglar la cita, no la cifra. Confírmalo un jurista danés, sobre todo si **no** tienes autorización danesa (en ese caso "normativa danesa aplicable" es la fórmula prudente que ya usa el ES).

## 🟠 Omisiones respecto al original español

**2. Falta la Sección 9 «Proceso de queja y reclamación» — completa.**
El ES la incluye (quejar a la psicóloga, al Colegio de Psicólogos, formulario de la Plataforma, organismos de consumo/juzgados). En EN y DA **no existe**. Se salta de la sección 8 a la declaración de consentimiento. Recomendado: añadir una Sección 9 traducida. (Parcialmente mitigado: EN/DA sí añaden la autoridad de control de datos —AEPD/Datatilsynet— en la sección 7, pero eso no cubre la vía de queja profesional/consumo.)

**3. Falta frase final de la Sección 5 (confidencialidad).**
ES: «la psicóloga informará al paciente en la medida de lo posible antes de proceder a cualquier comunicación a terceros». No está en EN/DA. Es una cláusula protectora del paciente; conviene incluirla.

**4. Falta frase de la Sección 6 (grabación).**
ES: «Si en algún momento se considerase útil para el proceso terapéutico (p. ej., revisión de ejercicios), se solicitará autorización específica y por separado». Omitida en EN/DA.

**5. Falta frase de la Sección 8 (emergencias).**
ES: «La psicóloga elaborará, si fuera necesario, un plan de seguridad personalizado con recursos de emergencia adaptados». Omitida en EN/DA.

## 🟡 Menor

**6. Fecha de versión inconsistente.**
ES: «v1.0 — **Mayo** 2026». EN/DA: «v1.0 — **June/juni** 2026». Unifica la fecha de versión en los tres idiomas (misma versión = misma fecha).

---

## ✅ Correcto (verificado, no tocar)

- Coherencia DA ↔ EN: estructura, apartados y cifras coinciden.
- RGPD (UE) 2016/679, categoría especial **art. 9**, LOPDGDD, Databeskyttelsesloven → correctos.
- **España: 5 años desde la última consulta (Ley 41/2002)** → correcto (art. 17). *Nota: por tu colegiación en Cataluña, revisa si aplica plazo autonómico mayor; el baseline estatal es defendible.*
- **112** como emergencias en España y Dinamarca → correcto.
- Autoridades de control **AEPD (aepd.es)** y **Datatilsynet (datatilsynet.dk)** → correctas.
- Identidad del responsable con **NIF** en sección 7 → buena práctica RGPD (mejora respecto al ES).
- Email `admin@studiorenacer.com` coherente en ambos.

---

## Fuentes de verificación legal

- Sundhedsloven §43 (comunicación de datos, no conservación): danskelove.dk/sundhedsloven/43
- Conservación historiales 10 años / Journalføringsbekendtgørelse: gdprhub.eu
- Cambio 5→10 años psicólogos autorizados (vigente 1-ene-2026): Dansk Psykolog Forening — dp.dk/raadgivning/lovgivning/journalpligt-opbevaringspligt-og-notatpligt
- Bekendtgørelse om autoriserede psykologers pligt til at føre ordnede optegnelser: retsinformation.dk/eli/lta/2017/567
