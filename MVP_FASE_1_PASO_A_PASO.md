# 🚀 MVP FASE 1 - GUÍA PASO A PASO COMPLETA
## App de Gestión de Consulta Psicológica

**Fecha inicio:** Mayo 2026  
**Duración estimada:** 3-4 meses  
**Estado:** Pendiente iniciar

---

## 📋 CHECKLIST PRE-INICIO

Ya completado:
- ✅ Supabase creada
- ✅ Resend creada (API Key guardada)
- ✅ Render creada (cuenta)
- ✅ GitHub repo creado
- ✅ Dominio IONOS + Domain Guard

---

## 🏗️ ARQUITECTURA FINAL

```
www.tudominio.com (Netlify/Vercel)
├── / → Home pública
├── /login → Login (ambos usuarios)
├── /register → Registro admin
├── /activate → Activación paciente
├── /admin/* → Dashboard admin (protegido)
└── /paciente/* → Dashboard paciente (protegido)

API Backend (Render)
└── https://[service].onrender.com/api/*

Base de datos (Supabase PostgreSQL)
└── Tablas: users, pacientes, sesiones, packs, documentos_legales, etc.

Email Service (Resend)
└── Envío de invitaciones, confirmaciones, recordatorios
```

---

## 📅 FASES DE TRABAJO RECOMENDADAS

### Semanas 1-2: Backend + Base de datos

**Tarea 1:** Configurar estructura backend en Render + Supabase
- [ ] Clonar repo localmente: `git clone [tu-repo]`
- [ ] Crear rama `develop` y trabajar ahí
- [ ] Crear carpeta `/backend` en raíz
- [ ] Inicializar Node: `npm init -y`
- [ ] Instalar dependencias:
  ```bash
  npm install express cors dotenv @supabase/supabase-js jsonwebtoken bcrypt
  npm install --save-dev nodemon
  ```
- [ ] Crear estructura:
  ```
  backend/
  ├── app.js
  ├── routes/
  │   ├── auth.js
  │   ├── pacientes.js
  │   ├── sesiones.js
  │   ├── packs.js
  │   ├── documentos.js
  │   └── contacto.js
  ├── middleware/
  │   ├── auth.js
  │   └── errorHandler.js
  ├── services/
  │   ├── emailService.js
  │   └── supabaseClient.js
  ├── .env
  └── package.json
  ```
- [ ] Crear `.env`:
  ```
  SUPABASE_URL=https://[tu-proyecto].supabase.co
  SUPABASE_SERVICE_ROLE_KEY=[tu-key]
  RESEND_API_KEY=[tu-key]
  JWT_SECRET=[genera-32-caracteres-aleatorios]
  NODE_ENV=development
  PORT=3000
  ```
- [ ] Crear `app.js` básico y probar: `npm run dev` (si nodemon está en package.json)
- [ ] Hacer commit y push a GitHub

**Tarea 2:** Diseñar schema de base de datos en Supabase
- [ ] Ir a Supabase → SQL Editor
- [ ] Crear tablas (copia los SQLs de abajo):

```sql
-- 1. USERS (Supabase Auth + tabla custom)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'paciente')),
  nombre_completo TEXT,
  telefono TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. PACIENTES
CREATE TABLE pacientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  estado TEXT DEFAULT 'activo' CHECK (estado IN ('activo', 'archivado')),
  notas_admin TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. PACKS
CREATE TABLE packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID REFERENCES pacientes(id) ON DELETE CASCADE,
  num_sesiones_total INT NOT NULL DEFAULT 10,
  num_sesiones_usadas INT NOT NULL DEFAULT 0,
  estado TEXT DEFAULT 'activo' CHECK (estado IN ('activo', 'completado')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. SESIONES
CREATE TABLE sesiones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID REFERENCES pacientes(id) ON DELETE CASCADE,
  pack_id UUID REFERENCES packs(id),
  fecha_hora TIMESTAMP NOT NULL,
  duracion_minutos INT DEFAULT 50,
  tipo TEXT NOT NULL CHECK (tipo IN ('presencial', 'videollamada')),
  estado TEXT DEFAULT 'programada' CHECK (estado IN ('programada', 'completada', 'cancelada')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. DOCUMENTOS LEGALES
CREATE TABLE documentos_legales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  contenido TEXT NOT NULL,
  tipo TEXT NOT NULL UNIQUE,
  version INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 6. ACEPTACIONES DOCUMENTOS
CREATE TABLE aceptaciones_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID REFERENCES pacientes(id) ON DELETE CASCADE,
  documento_id UUID REFERENCES documentos_legales(id),
  aceptado BOOLEAN DEFAULT FALSE,
  fecha_aceptacion TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 7. RECORDATORIOS ENVIADOS
CREATE TABLE recordatorios_enviados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sesion_id UUID REFERENCES sesiones(id),
  paciente_id UUID REFERENCES pacientes(id),
  tipo_recordatorio TEXT CHECK (tipo_recordatorio IN ('sesion', 'pago')),
  fecha_envio TIMESTAMP NOT NULL,
  canal TEXT CHECK (canal IN ('email', 'push')),
  estado TEXT DEFAULT 'enviado' CHECK (estado IN ('enviado', 'fallido')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Crear índices para performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_pacientes_user_id ON pacientes(user_id);
CREATE INDEX idx_packs_paciente_id ON packs(paciente_id);
CREATE INDEX idx_sesiones_paciente_id ON sesiones(paciente_id);
CREATE INDEX idx_sesiones_fecha ON sesiones(fecha_hora);
CREATE INDEX idx_aceptaciones_paciente ON aceptaciones_documentos(paciente_id);
```

- [ ] Ejecutar en SQL Editor
- [ ] Verificar en "Table Editor" que están creadas
- [ ] Habilitar RLS (Row Level Security) en tablas sensibles:
  - En cada tabla → "Authentication" → Habilitar RLS
  - Agregar política: Users solo ven sus propios datos
  
- [ ] En Supabase → Settings → API → Copiar:
  - Project URL
  - Service Role Key (secret - NO compartir)
  - Anon Public Key

---

### Semanas 3-4: APIs Backend

**Tarea 3:** Implementar autenticación
- [ ] Crear `backend/services/supabaseClient.js`:
  ```javascript
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  module.exports = supabase;
  ```

- [ ] Crear `backend/middleware/auth.js` (verificar JWT):
  ```javascript
  const jwt = require('jsonwebtoken');
  const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Sin token' });
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ error: 'Token inválido' });
    }
  };
  module.exports = { verifyToken };
  ```

- [ ] Crear `backend/routes/auth.js`:
  ```javascript
  const express = require('express');
  const supabase = require('../services/supabaseClient');
  const jwt = require('jsonwebtoken');
  const router = express.Router();
  
  // Admin Register
  router.post('/admin-register', async (req, res) => {
    const { email, password, nombre } = req.body;
    try {
      // Crear en auth
      const { data, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });
      if (authError) return res.status(400).json({ error: authError.message });
      
      // Crear en tabla users
      const { error: dbError } = await supabase
        .from('users')
        .insert({
          id: data.user.id,
          email,
          role: 'admin',
          nombre_completo: nombre
        });
      if (dbError) return res.status(400).json({ error: dbError.message });
      
      // Generar JWT
      const token = jwt.sign({ id: data.user.id, email, role: 'admin' }, process.env.JWT_SECRET);
      res.json({ token, user: { id: data.user.id, email, role: 'admin' } });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Login
  router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return res.status(400).json({ error: error.message });
      
      // Obtener role
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', data.user.id)
        .single();
      
      const token = jwt.sign({ id: data.user.id, email, role: userData.role }, process.env.JWT_SECRET);
      res.json({ token, user: { id: data.user.id, email, role: userData.role } });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Invitar paciente
  router.post('/invitar-paciente', async (req, res) => {
    const { email, nombre } = req.body;
    try {
      // Generar token temporal
      const activationToken = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '7d' });
      
      // Crear usuario en auth (sin contraseña)
      const { data, error: authError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: false
      });
      if (authError) return res.status(400).json({ error: authError.message });
      
      // Crear en tabla users
      const { error: dbError } = await supabase
        .from('users')
        .insert({
          id: data.user.id,
          email,
          role: 'paciente',
          nombre_completo: nombre
        });
      
      // Crear perfil paciente
      await supabase
        .from('pacientes')
        .insert({ user_id: data.user.id });
      
      // Enviar email (ver servicio email)
      // await sendWelcomeEmail(email, nombre, activationToken);
      
      res.json({ message: 'Invitación enviada', email });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  module.exports = router;
  ```

- [ ] Crear `backend/services/emailService.js`:
  ```javascript
  const { Resend } = require('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);
  
  const sendWelcomeEmail = async (email, nombre, activationToken) => {
    const activationLink = `${process.env.FRONTEND_URL}/activate?token=${activationToken}`;
    const htmlContent = `
      <h2>Bienvenido, ${nombre}</h2>
      <p>Tu cuenta ha sido creada. Haz clic en el botón para establecer tu contraseña:</p>
      <a href="${activationLink}" style="background: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
        Activar mi cuenta
      </a>
      <p>El enlace expira en 7 días.</p>
    `;
    
    await resend.emails.send({
      from: 'noreply@[tudominio].com',
      to: email,
      subject: 'Bienvenido a Psicología Digital',
      html: htmlContent
    });
  };
  
  module.exports = { sendWelcomeEmail };
  ```

- [ ] En `app.js`, agregar rutas:
  ```javascript
  const express = require('express');
  const cors = require('cors');
  require('dotenv').config();
  
  const authRoutes = require('./routes/auth');
  
  const app = express();
  app.use(cors());
  app.use(express.json());
  
  app.use('/api/auth', authRoutes);
  
  app.listen(process.env.PORT || 3000, () => {
    console.log('Backend running on port 3000');
  });
  ```

- [ ] Probar con `curl` o Postman:
  ```bash
  curl -X POST http://localhost:3000/api/auth/admin-register \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@test.com","password":"Test123!","nombre":"Tu Nombre"}'
  ```

**Tarea 4:** Crear APIs de pacientes
- [ ] Crear `backend/routes/pacientes.js`:
  ```javascript
  const express = require('express');
  const supabase = require('../services/supabaseClient');
  const { verifyToken } = require('../middleware/auth');
  
  const router = express.Router();
  
  // Admin: listar pacientes
  router.get('/', verifyToken, async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          id, email, nombre_completo,
          pacientes (
            id, estado,
            packs (id, num_sesiones_total, num_sesiones_usadas, estado)
          )
        `)
        .eq('role', 'paciente');
      
      if (error) return res.status(400).json({ error: error.message });
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Paciente: su perfil
  router.get('/perfil', verifyToken, async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', req.user.id)
        .single();
      
      if (error) return res.status(400).json({ error: error.message });
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  module.exports = router;
  ```

- [ ] En `app.js`, agregar: `app.use('/api/pacientes', require('./routes/pacientes'))`

**Tarea 5:** Crear APIs de sesiones y packs
- [ ] Similar a pacientes, crear:
  - `backend/routes/sesiones.js` (POST, GET, PUT /completar, etc)
  - `backend/routes/packs.js` (POST crear pack, GET historial)
  - Ver detalles en tareas 5-6 del documento de tareas

**Tarea 6:** Crear APIs de documentos legales
- [ ] `backend/routes/documentos.js`
- [ ] GET /documentos (lista pública)
- [ ] GET /documentos/:id (contenido)
- [ ] POST /aceptar (registra aceptación)
- [ ] Ver detalles en tarea 7

---

### Semanas 5-6: Frontend Setup

**Tarea 7:** Crear estructura React
- [ ] Crear proyecto: `npm create vite@latest frontend -- --template react`
- [ ] `cd frontend && npm install`
- [ ] Instalar librerías:
  ```bash
  npm install react-router-dom @supabase/supabase-js axios zustand tailwindcss date-fns
  npm install -D tailwindcss postcss autoprefixer
  npx tailwindcss init -p
  ```

- [ ] Estructura de carpetas:
  ```
  frontend/src/
  ├── components/
  │   ├── common/
  │   │   ├── Header.jsx
  │   │   └── Navigation.jsx
  │   ├── auth/
  │   │   ├── LoginForm.jsx
  │   │   └── ProtectedRoute.jsx
  │   └── ...
  ├── pages/
  │   ├── public/
  │   │   └── Home.jsx
  │   ├── auth/
  │   │   ├── Login.jsx
  │   │   ├── Register.jsx
  │   │   └── Activate.jsx
  │   ├── admin/
  │   │   ├── Dashboard.jsx
  │   │   ├── Pacientes.jsx
  │   │   └── Calendario.jsx
  │   └── paciente/
  │       ├── Dashboard.jsx
  │       ├── Sesiones.jsx
  │       └── Perfil.jsx
  ├── hooks/
  │   └── useAuth.js
  ├── context/
  │   └── AuthContext.jsx
  ├── utils/
  │   ├── api.js
  │   └── dates.js
  ├── App.jsx
  └── main.jsx
  ```

- [ ] Crear `.env.local`:
  ```
  VITE_API_BASE_URL=http://localhost:3000/api
  VITE_SUPABASE_URL=https://[tu-proyecto].supabase.co
  VITE_SUPABASE_ANON_KEY=[tu-key]
  ```

- [ ] Crear `src/utils/api.js`:
  ```javascript
  import axios from 'axios';
  
  const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL
  });
  
  api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
  
  export default api;
  ```

- [ ] Crear `src/context/AuthContext.jsx` y `src/hooks/useAuth.js`
- [ ] Crear `src/components/auth/ProtectedRoute.jsx` para proteger rutas admin/paciente

**Tarea 8:** Crear Login y Register
- [ ] `src/pages/auth/Login.jsx`
- [ ] `src/pages/auth/Register.jsx`
- [ ] `src/pages/auth/Activate.jsx`
- [ ] Formularios con validaciones básicas
- [ ] Guardar token en localStorage
- [ ] Redireccionamiento según role

**Tarea 9:** Dashboard Admin
- [ ] `src/pages/admin/Dashboard.jsx` (vista principal)
- [ ] `src/pages/admin/Pacientes.jsx` (tabla + agregar)
- [ ] `src/pages/admin/Calendario.jsx` (calendario)
- [ ] Componentes de sidebar, header
- [ ] Usar Tailwind para estilos

**Tarea 10:** Dashboard Paciente
- [ ] `src/pages/paciente/Dashboard.jsx`
- [ ] `src/pages/paciente/Sesiones.jsx`
- [ ] `src/pages/paciente/Cobertura.jsx`
- [ ] `src/pages/paciente/Perfil.jsx`
- [ ] Onboarding de documentos

**Tarea 11:** Home pública
- [ ] `src/pages/public/Home.jsx`
- [ ] Hero section
- [ ] Características
- [ ] Contacto
- [ ] Footer

---

### Semanas 7-8: Deployment

**Tarea 12:** Deploy backend en Render
- [ ] En GitHub: `git push origin develop`
- [ ] Merge a `main` (o crear rama `main` si no existe)
- [ ] En Render:
  - New Web Service
  - Conectar repo
  - Build: `npm install`
  - Start: `node backend/app.js`
  - Agregar .env variables
  - Deploy

**Tarea 13:** Deploy frontend en Netlify
- [ ] En Netlify:
  - New site from Git
  - Conectar repo
  - Build: `npm run build` (en carpeta frontend)
  - Publish: `frontend/dist`
  - Env: `VITE_API_BASE_URL=[url-render]`
  - Deploy

**Tarea 14:** Configurar dominio
- [ ] En IONOS:
  - Nameservers → Cambiar a los de Netlify
  - Esperar propagación (15-30 min)
  
- [ ] En Netlify:
  - Domain Management → Add domain
  - Verificar
  - HTTPS automático

**Tarea 15:** Testing
- [ ] Probar flujo completo en producción
- [ ] Admin register → Login → Crear paciente
- [ ] Paciente activación → Aceptar documentos → Dashboard
- [ ] Crear sesión → Ver en calendario
- [ ] Crear pack → Ver en cobertura paciente

---

## 🎯 CHECKLIST FINAL MVP

- [ ] Backend running en Render
- [ ] Frontend deployed en Netlify
- [ ] Dominio apuntando correctamente
- [ ] Autenticación completa (admin + paciente)
- [ ] CRUD de pacientes
- [ ] Calendario funcional
- [ ] Packs de sesiones
- [ ] Documentos legales
- [ ] Onboarding RGPD
- [ ] Email service conectado
- [ ] Testing manual completado
- [ ] README.md documentado
- [ ] Variables de entorno seguras

---

## 🔐 CONSIDERACIONES RGPD FASE 1

✅ Implementadas:
- Documentos legales con aceptación explícita
- Datos en EU (Supabase)
- HTTPS en todo
- JWT para autenticación

⏳ Implementar en Fase 2+:
- RLS completo en Supabase
- Derecho al olvido (eliminar datos)
- Exportación de datos personales
- DPAs con proveedores

---

## 💡 TIPS Y BUENAS PRÁCTICAS

1. **Versionamiento:**
   - Usa ramas: `develop` para desarrollo, `main` para producción
   - Haz commits pequeños y descriptivos

2. **Testing:**
   - Antes de mergear a main, prueba todo en develop
   - Usa credenciales de test en desarrollo

3. **Seguridad:**
   - NUNCA commits .env o credenciales
   - Usa `.gitignore` para archivos sensibles
   - Cambia JWT_SECRET en producción

4. **Performance:**
   - Agregaíndices en PostgreSQL (ya incluidos)
   - Lazy load componentes React si es necesario
   - Comprime imágenes

5. **UX:**
   - Muestra loading states
   - Manejo claro de errores
   - Responsive design en móvil

---

## 📞 SOPORTE Y RECURSOS

- Supabase docs: https://supabase.com/docs
- React docs: https://react.dev
- Express docs: https://expressjs.com
- Tailwind docs: https://tailwindcss.com
- JWT info: https://jwt.io

---

**¿Listo para empezar? Abre la lista de tareas y comienza con Tarea #1 esta semana.**

