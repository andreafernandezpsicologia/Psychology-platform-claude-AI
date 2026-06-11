# Studio Renacer - CLAUDE.md

**Plataforma de psicología para Andrea Fernández (colegiada 27327)**  
Email: andreafernandez.psicologia@gmail.com

---

## 🏗️ Arquitectura y Servicios

### Backend → Render
- **Host**: Render (studio-renacer-api.onrender.com, región Frankfurt)
- **Runtime**: Node.js + Express
- **Deploy**: Automático en cada push a `master` via GitHub Actions
- **CLI disponible**: `vercel` (para inspeccionar, aunque backend es en Render)

### Frontend → Vercel
- **Host**: Vercel
- **Framework**: React (Vite)
- **API Proxy**: `/api/*` redirige a `https://studio-renacer-api.onrender.com/api/*`
- **CLI disponible**: `vercel` (para inspeccionar/deploy)

### Base de Datos → Supabase
- **Service**: PostgreSQL managed
- **Credenciales**: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` en backend `.env`
- **Región**: eu-west-3 (París, EU) ✅ Cumple GDPR
- **CLI disponible**: `supabase` (para migrations, backups, etc.)

### Emails → Resend
- **Service**: Email delivery
- **Credencial**: `RESEND_API_KEY` en backend `.env`
- **From**: `Studio Renacer <admin@studiorenacer.com>`
- **Usos**: Password reset, appointment reminders, etc.

### Cron Jobs
- **Orquestador**: GitHub Actions (`.github/workflows/send-reminders.yml`)
- **Secret**: `CRON_SECRET` (debe estar en cron-job.org si se usa servicio externo)
- **Endpoint**: `POST /api/cron` en backend (verifica cabecera `x-cron-secret`)

### Version Control → GitHub
- **CLI disponible**: `gh` (para PRs, issues, secrets, etc.)

---

## 🔐 Cumplimiento GDPR / Protección de Datos

### ⚠️ CRÍTICO: Datos Sensibles de Salud
Este proyecto maneja **datos especiales bajo GDPR Art. 9**:
- Información de sesiones psicológicas
- Diagnósticos o notas de salud mental
- Datos personales de pacientes

**Cualquier cambio debe verificar que no viola:**
- Encriptación en tránsito (HTTPS ✅)
- Encriptación en reposo (Supabase ✅)
- Acceso restringido a datos (autenticación/autorización)
- Auditoría de accesos (logging)

### Requisitos Pendientes
- [ ] **Política de Privacidad formal** (necesaria antes de producción)
- [ ] **Consentimiento informado** (modal al crear cuenta)
- [ ] **Derecho al olvido** (`DELETE /api/pacientes/{id}` con eliminación real)
- [ ] **Derecho de acceso** (exportar datos del paciente en JSON/CSV)
- [ ] **DPA firmado** con Supabase, Render, Resend
- [ ] **Registro de auditoría** (quién accedió a qué, cuándo)
- [ ] **Verificar**: ¿Supabase en región EU? ¿Render en Frankfurt?

### Guía de Decisiones
- **Nunca** almacenar contraseñas en plaintext (usar JWT/hashing) ✅
- **Nunca** exponer IDs de pacientes sin autenticación ✅
- **Siempre** encriptar datos sensibles en tránsito (HTTPS) ✅
- **Antes de** cada feature: verificar si toca datos sensibles → revisar GDPR

---

## 🛠️ CLIs Disponibles

### Vercel CLI
```bash
vercel env list              # ver variables en producción
vercel env pull              # descargar .env.production
vercel logs --tail           # ver logs en tiempo real
vercel deploy                # deploy preview
```

### Supabase CLI
```bash
supabase status              # estado del proyecto
supabase db pull             # sincronizar schema local
supabase migrations list     # ver migraciones
supabase backup list         # ver backups
```

### GitHub CLI
```bash
gh pr create                 # crear PR
gh repo view                 # ver detalles del repo
gh secret set                # guardar secretos
gh workflow run send-reminders.yml  # trigger manual de workflow
```

---

## 📋 Estructura de Datos Crítica

**Tablas principales en Supabase:**
- `usuarios` (psicólogo + pacientes)
- `pacientes` (datos sensibles de salud)
- `sesiones` (notas de sesiones)
- `documentos` (contratos, evaluaciones)

**Nunca borrar sin backup.** Antes de cambios en schema:
```bash
supabase db pull  # guardar estado actual
# hacer cambio
supabase db push  # aplicar
```

---

## 👤 Preferencias de Colaboración

- **Asumir acceso**: Tengo CLIs de Vercel, Supabase, GitHub disponibles. Usarlos sin pedir permisos.
- **GDPR primero**: Cualquier cambio en datos de pacientes debe justificarse con GDPR.
- **Documentación**: Mantener en sync: memoria en `memory/`, archivos en repo, CLAUDE.md actualizado.
- **No duplicar**: Si está documentado en memoria o CLAUDE.md, no pedir que lo repita.

---

## 🔗 Enlaces Útiles

- Supabase Project: https://app.supabase.com (verificar región)
- Render Dashboard: https://dashboard.render.com
- Vercel Dashboard: https://vercel.com
- GitHub Repo: [tu-repo-url]
- Resend: https://resend.com/api-keys
