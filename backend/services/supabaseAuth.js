const { createClient } = require('@supabase/supabase-js');

// Cliente con clave pública — solo para signInWithPassword
const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

module.exports = supabaseAuth;
