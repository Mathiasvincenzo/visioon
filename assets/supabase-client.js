// Supabase client setup. Loaded after the supabase-js UMD script (see <head> of each page).
const SUPABASE_URL = 'https://ukpgjuaaboibywwrmlvb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_HZrIf4rR69nts5mz8WqdSw_UMtqLMoh';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// A second, independent client used ONLY for signUp() when the admin creates a
// new model account — signUp() on the main client would overwrite the admin's
// own logged-in session, since supabase-js persists whichever session it last saw.
function createSignupClient() {
  return supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { storageKey: 'visioon-signup-temp', persistSession: false },
  });
}

// Supabase auth is email-based, but models log in with a plain username.
// This maps a username to a fixed-pattern placeholder email, computed
// entirely client-side — no lookup, nothing new exposed on the database.
const USERNAME_EMAIL_DOMAIN = 'visioon.app';
function usernameToEmail(username) {
  return `${username.trim().toLowerCase().replace(/[^a-z0-9]/g, '')}@${USERNAME_EMAIL_DOMAIN}`;
}
