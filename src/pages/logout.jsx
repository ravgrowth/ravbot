import { supabase } from '../supabaseClient';

export async function hardLogout() {
  try {
    await supabase.auth.signOut(); // clears local storage + stops refresh
  } catch {}

  // nuke any left auth keys
  try {
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('sb-')) localStorage.removeItem(k);
    });
    sessionStorage.clear();
  } catch {}

  // clear cookies if you used cookie auth
  document.cookie = 'sb-access-token=; Max-Age=0; path=/;';
  document.cookie = 'sb-refresh-token=; Max-Age=0; path=/;';

  // go to login
  window.location.replace('/login');
}
