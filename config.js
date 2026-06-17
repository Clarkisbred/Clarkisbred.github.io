// ============================================================
//  config.js  —  DO NOT put real values here. Commit this file.
//  Copy this file to config.local.js, fill in your real values,
//  and add config.local.js to your .gitignore
// ============================================================

// Load config.local.js first (contains real secrets, never committed)
// If it doesn't exist, fall back to placeholders so the site doesn't crash
if (typeof window.BREDUCK_CONFIG === 'undefined') {
  console.warn('[BreDuck] config.local.js not found. Using placeholder config. Site features will be limited.');
  window.BREDUCK_CONFIG = {
    SUPABASE_URL : '',
    SUPABASE_KEY : '',
    GROQ_KEY     : '',
    ADMIN_PW     : '',
  };
}
