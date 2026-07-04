-- Integración Google Meet: generación automática de enlaces de videollamada.
--
-- google_oauth: fila única con el refresh token de la cuenta de Google de
-- Andrea (OAuth, scope calendar.events). Es una credencial, no dato clínico:
-- vive en Supabase (EU, cifrado en reposo) y nunca se expone al frontend.
--
-- sesiones.google_event_id: id del evento creado en el Google Calendar de
-- Andrea para poder moverlo al reagendar y borrarlo al cancelar. El evento
-- se crea SIN datos del paciente (título neutro, sin invitados): a Google
-- solo le llega fecha, hora y el enlace de Meet (minimización, RGPD 5.1.c).

create table if not exists google_oauth (
  id integer primary key default 1,
  refresh_token text not null,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint google_oauth_singleton check (id = 1)
);

alter table sesiones add column if not exists google_event_id text;

-- El backend accede con el rol service_role (SUPABASE_SERVICE_ROLE_KEY). Las
-- tablas nuevas no heredan esos permisos automáticamente, así que hay que
-- concederlos explícitamente. NUNCA a anon/authenticated: el refresh token no
-- debe poder leerse desde el cliente. RLS activado como defensa en profundidad
-- (service_role la bypassa; anon/authenticated quedan sin acceso al no tener
-- ni GRANT ni policies).
grant select, insert, update, delete on table google_oauth to service_role;
alter table google_oauth enable row level security;
