import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [msgColor, setMsgColor] = useState('black');
  const [mode, setMode] = useState('login'); // 'login' or 'signup'

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setTimeout(() => {
        if (session && window.location.pathname === '/login') {
          window.location.href = '/dashboard';
        }
      }, 300);
    });
  }, []);

  async function handleAuth() {
    if (mode === 'login') {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMsg(error.message);
        setMsgColor('red');
      } else {
        window.location.href = '/dashboard';
      }
    } else {
      const { data: existingUser } = await supabase.auth.admin.getUserByEmail(email);
      if (existingUser?.user) {
        setMsg("Email already registered. Try logging in.");
        setMsgColor('red');
        return;
      }

      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setMsg(error.message);
        setMsgColor('red');
      } else {
        setMsg('Signup successful! Check your email to confirm.');
        setMsgColor('cyan');
      }
    }
  }

  return (
    <div style={{ padding: 40 }}>
      <h2>{mode === 'login' ? 'Login to RavBot' : 'Create a RavBot Account'}</h2>
      <input type="email" placeholder="Email" onChange={(e) => setEmail(e.target.value)} />
      <input type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} />
      <button onClick={handleAuth}>{mode === 'login' ? 'Login' : 'Sign Up'}</button>

      <p id="reset-status" style={{ color: msgColor }}>{msg}</p>

      <p>
        {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
        <button onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? 'Sign Up' : 'Login'}
        </button>
      </p>
      <p>
        Forgot your password?{' '}
        <button
          onClick={async () => {
            const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
              redirectTo: "http://localhost:5173/reset"
            });

            if (error) {
              setMsg(error.message);
              setMsgColor('red');
            } else {
              const now = new Date();
              const timestamp = now.toLocaleString();
              setMsg(`Reset link sent to your email. (${timestamp})`);
              setMsgColor('cyan');
            }
          }}
        >
          Reset
        </button>
      </p>
    </div>
  );
}
