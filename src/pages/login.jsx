import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useEffect } from 'react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [mode, setMode] = useState('login'); // 'login' or 'signup'

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      // Delay check slightly to allow logout to fully clear
      setTimeout(() => {
        if (session && window.location.pathname === '/login') {
          window.location.href = '/dashboard';
        }
      }, 300); // 300ms delay
    });
  }, []);

  async function handleAuth() {
    if (mode === 'login') {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg(error.message);
      else window.location.href = '/dashboard';
    } else {
      // check if user already exists
      const { data: existingUser, error: lookupError } = await supabase.auth.admin.getUserByEmail(email);
      if (existingUser?.user) {
        setMsg("Email already registered. Try logging in.");
        return;
      }

      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) setMsg(error.message);
      else setMsg('Signup successful! Check your email to confirm.');
    }
  }



  return (
    <div style={{ padding: 40 }}>
      <h2>{mode === 'login' ? 'Login to RavBot' : 'Create a RavBot Account'}</h2>
      <input type="email" placeholder="Email" onChange={(e) => setEmail(e.target.value)} />
      <input type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} />
      <button onClick={handleAuth}>{mode === 'login' ? 'Login' : 'Sign Up'}</button>

      <p>{msg}</p>

      <p>
        {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
        <button onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? 'Sign Up' : 'Login'}
        </button>
      </p>
      <p>
        Forgot your password?{' '}
        <button onClick={async () => {
          const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: 'https://app.ravgrowth.com/reset'
          });
          if (error) setMsg(error.message);
          else setMsg("Reset link sent to your email.");
        }}>
          Reset
        </button>
      </p>
    </div>
  );
}
