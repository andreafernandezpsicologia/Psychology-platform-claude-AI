# Studio Renacer — Landing "Coming Soon"

Landing page profesional para captar inscripciones a la lista de espera de **Studio Renacer**, la consulta online de **Andrea Fernández**.

Stack: **HTML + CSS puro** (sin frameworks) + **una función serverless** en Vercel que envía correos con **Resend**.

---

## 📁 Estructura del proyecto

```
landing/
├── index.html              ← La landing (un solo archivo, ES/EN/DA)
├── api/
│   └── subscribe.js        ← Función serverless: recibe el formulario y envía emails
├── assets/
│   ├── andrea.jpg          ← TU FOTO (añadir manualmente, ver PLACEHOLDER.txt)
│   └── PLACEHOLDER.txt
├── package.json
├── vercel.json             ← Configuración de Vercel + cabeceras de seguridad
├── .env.example            ← Plantilla de variables de entorno
├── .gitignore
└── README.md               ← Este archivo
```

---

## 🚀 Despliegue en Vercel (paso a paso)

### Opción A — Más rápida (sin Git, arrastrar y soltar)

1. Crea cuenta gratis en https://vercel.com (Hobby plan).
2. En tu panel, pulsa **Add New → Project → Deploy a static site (or drag & drop)**.
3. Comprime la carpeta `landing/` en un `.zip` y arrástrala.
4. Vercel detecta automáticamente el proyecto y la función `/api/subscribe`.
5. Antes de hacer "Deploy", abre **Environment Variables** y añade las tres claves (ver más abajo).
6. Pulsa **Deploy**. En ~30 segundos tendrás una URL `https://studio-renacer-xxx.vercel.app`.

### Opción B — Con Git (recomendada para iterar)

1. Sube la carpeta `landing/` a un repo en GitHub.
2. En Vercel: **Add New → Project → Import** tu repo.
3. **Root Directory**: déjalo como `./` (o `landing` si subiste la carpeta padre).
4. Framework Preset: **Other** (es HTML puro).
5. Configura las variables de entorno (siguiente sección).
6. **Deploy**. Cada `git push` redespliega automáticamente.

### Opción C — Desde la terminal (CLI)

```bash
npm i -g vercel             # instalar el CLI
cd landing
vercel login                # primera vez
vercel                      # despliegue de prueba
vercel --prod               # despliegue a producción
```

---

## 🔑 Variables de entorno

En Vercel: **Project Settings → Environment Variables**. Añade:

| Variable              | Valor                                                 | Obligatoria |
|-----------------------|-------------------------------------------------------|-------------|
| `RESEND_API_KEY`      | Tu API key de Resend (empieza por `re_`)              | ✅           |
| `NOTIFY_TO`           | `info@studiorenacer.com`                              | ✅           |
| `FROM_EMAIL`          | `Studio Renacer <hola@studiorenacer.com>`             | ✅           |
| `RESEND_AUDIENCE_ID`  | UUID de tu audiencia en Resend (para guardar leads)   | opcional    |

Aplica las tres a los entornos **Production, Preview y Development**.

---

## ✉️ Configurar Resend

1. Crea cuenta gratis en https://resend.com (3.000 emails/mes en el plan free).
2. En **Domains**, añade `studiorenacer.com` y sigue las instrucciones:
   - Te pedirá añadir registros DNS (SPF, DKIM, DMARC) en tu proveedor de dominio.
   - Una vez verificado, podrás enviar desde cualquier dirección `@studiorenacer.com`.
3. En **API Keys** pulsa **Create API Key** → cópiala y pégala como `RESEND_API_KEY` en Vercel.
4. (Opcional) En **Audiences**, crea una llamada `Waitlist` y copia su ID para `RESEND_AUDIENCE_ID`.

### Mientras Resend verifica tu dominio

Puedes empezar a probar usando el remitente de pruebas `onboarding@resend.dev`:

```
FROM_EMAIL=Studio Renacer <onboarding@resend.dev>
```

Funciona pero los emails llegarán como "de" Resend. En cuanto tu dominio esté verificado, cambia `FROM_EMAIL` a `hola@studiorenacer.com` y redespliega (no hace falta tocar código).

---

## 🌐 Dominio personalizado (studiorenacer.com)

1. En Vercel: **Project → Settings → Domains → Add `studiorenacer.com`**.
2. Vercel te dará los registros DNS a configurar:
   - **A record** apuntando a `76.76.21.21`, o
   - **CNAME** apuntando a `cname.vercel-dns.com` (recomendado para subdominios).
3. Añádelos en tu proveedor de dominio (GoDaddy, Namecheap, IONOS, etc.).
4. La propagación tarda de unos minutos a 24 h. Vercel emite el certificado SSL automáticamente.
5. Repite el proceso para `www.studiorenacer.com` y configúralo para redirigir al dominio raíz.

---

## 🧪 Desarrollo local

```bash
cd landing
npm i -g vercel
cp .env.example .env.local       # rellena tus claves
vercel dev                       # abre http://localhost:3000
```

`vercel dev` simula el entorno serverless, así puedes probar el formulario contra Resend de verdad.

> Si solo quieres ver el diseño (sin probar el formulario), simplemente abre `index.html` en el navegador con `python3 -m http.server 8000` y visita `http://localhost:8000`.

---

## 🖼️ Añadir tu foto

1. Optimiza tu foto en https://squoosh.app (formato WebP o JPG, < 250 KB).
2. Renómbrala como `andrea.jpg`.
3. Cópiala a `landing/assets/andrea.jpg`.
4. Redespliega (`vercel --prod`) o haz `git push`.

Si no la añades, la landing muestra un fallback elegante (gradiente azul con la inicial "A").

---

## 🔒 Cumplimiento RGPD

La landing ya incluye:

- ✅ Checkbox de consentimiento explícito antes de enviar
- ✅ Mensaje claro sobre el uso de los datos
- ✅ Enlace placeholder a `/privacy`, `/cookies` y `/terms` (debes redactarlos)
- ✅ Sin cookies de tracking (solo `localStorage` para recordar el idioma)
- ✅ Cabeceras de seguridad en `vercel.json`

**Pendiente por tu parte:**

- Redactar la política de privacidad y publicarla en `/privacy` (puedes generar una base en https://www.iubenda.com o con un abogado).
- Si en el futuro añades Google Analytics o Meta Pixel, necesitarás un banner de cookies.

---

## 🌍 Idiomas

La landing detecta el idioma del navegador entre `es`, `en`, `da`. El usuario puede cambiarlo con el selector y la elección se guarda en `localStorage`.

Para editar las traducciones, busca el objeto `translations` dentro del `<script>` de `index.html`.

---

## 📊 Métricas (recomendado, opcional)

Una vez en producción, conecta **Vercel Analytics** (gratis en Hobby plan):

1. **Project → Analytics → Enable Web Analytics**.
2. Vercel inyecta el script automáticamente.
3. Verás visitas y conversiones del formulario sin cookies de tracking.

---

## ✅ Checklist antes de lanzar

- [x ] Foto `andrea.jpg` añadida en `assets/`
- [X ] Variables de entorno configuradas en Vercel
- [X ] Dominio `studiorenacer.com` verificado en Resend
- [X ] Dominio apuntando a Vercel y SSL activo
- [ ] Formulario probado de verdad (yo recibí mi email de confirmación)
- [X ] Política de privacidad redactada y enlazada
- [X ] Texto del hero revisado y ajustado a tu voz
- [X ] Foto optimizada (< 250 KB)
- [ ] Test en móvil (Chrome DevTools → modo responsive)

---

## 🆘 Problemas comunes

**El formulario muestra error 500.**
→ Revisa los logs en Vercel → Project → Logs. Casi siempre es `RESEND_API_KEY` ausente o `FROM_EMAIL` con un dominio no verificado.

**Resend rechaza los emails con "domain not verified".**
→ Usa temporalmente `onboarding@resend.dev` como `FROM_EMAIL` hasta que el DNS propague.

**La foto no aparece.**
→ Comprueba que el archivo esté en `assets/andrea.jpg` (exactamente ese nombre, en minúsculas). El fallback se activa solo si la imagen falla.

**El idioma no cambia.**
→ Comprueba la consola del navegador. El selector usa `localStorage`; si tienes el modo privado/incógnito, puede no persistir entre visitas.

---

Hecho con ❤️ para Studio Renacer.
