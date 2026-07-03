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
