import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

function MessageBanner() {
  const [message, setMessage] = useState(null);
  const [kind, setKind] = useState('info'); // 'info' | 'success' | 'error'

  useEffect(() => {
    // read both hash and search
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const queryParams = new URLSearchParams(window.location.search);

    const msg =
      hashParams.get('message') ||
      queryParams.get('message') ||
      (hashParams.get('emailChange') === 'success'
        ? 'Email updated - check your inbox to reset your password.'
        : null) ||
      (hashParams.get('recovery') === 'sent'
        ? 'Password reset email sent - check your inbox.'
        : null);

    const recoveryType =
      hashParams.get('type') || queryParams.get('type'); // e.g., type=recovery

    if (recoveryType === 'recovery' && !msg) {
      setMessage('Recovery link detected - redirecting you to reset...');
      setKind('info');
      // small delay so user sees the banner flash, then route to /reset
      setTimeout(() => (window.location.href = '/reset'), 300);
      return;
    }

    if (msg) {
      setMessage(decodeURIComponent(msg));
      // Infer banner color
      if (/error|invalid|failed|denied|expired/i.test(msg)) setKind('error');
      else if (/success|updated|sent|welcome|done|reset/i.test(msg)) setKind('success');
      else setKind('info');

      // Clean URL after showing
      const cleanUrl = window.location.pathname;
      window.history.replaceState(null, '', cleanUrl);
    }
  }, []);

  if (!message) return null;

  const styles = {
    container: {
      padding: '12px',
      textAlign: 'center',
      fontWeight: 700,
      marginBottom: 12,
      borderBottom: '2px solid',
      borderColor:
        kind === 'error' ? '#ef4444' : kind === 'success' ? '#22c55e' : '#0ea5e9',
      background:
        kind === 'error' ? '#2a0f10' : kind === 'success' ? '#0f291e' : '#06252b',
      color: kind === 'error' ? '#ef4444' : kind === 'success' ? '#86efac' : '#67e8f9',
      borderRadius: 8,
    },
  };

  return <div style={styles.container}>{message}</div>;
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [msgColor, setMsgColor] = useState('black');
  const [mode, setMode] = useState('login'); // 'login' or 'signup'

  useEffect(() => {
    // If already logged in - bounce to dashboard
    supabase.auth.getSession().then(({ data: { session } }) => {
      setTimeout(() => {
        if (session && window.location.pathname === '/login') {
          window.location.href = '/dashboard';
        }
      }, 300);
    });
  }, []);

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const queryParams = new URLSearchParams(window.location.search);
    const prefill = hashParams.get('prefill') || queryParams.get('prefill');
    if (prefill) {
      console.log('[Login] prefilled email:', prefill);
      setEmail(prefill);
    }
  }, []);

  async function handleAuth() {
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        const time = new Date().toLocaleTimeString();
        setMsg(`${error.message} - ${time}`);
        setMsgColor('red');
      } else {
        window.location.href = '/dashboard';
      }
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        if (error.message?.toLowerCase()?.includes('already')) {
          setMsg('Email already registered. Try logging in.');
          setMsgColor('red');
        } else {
          const time = new Date().toLocaleTimeString();
          setMsg(`${error.message} - ${time}`);
          setMsgColor('red');
        }
      } else {
        const timestamp = new Date().toLocaleString();
        setMsg(`Signup successful! Check your email to confirm. (${timestamp})`);
        setMsgColor('cyan');
      }
    }
  }

  return (
    <div style={{ padding: 40 }}>
      <MessageBanner />

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
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
              redirectTo: `${window.location.origin}/reset`
            });

            if (error) {
              setMsg(error.message);
              setMsgColor('red');
            } else {
              const timestamp = new Date().toLocaleString();
              // Set a visible banner via hash param so it shows even after reload
              window.location.href = `/login#message=${encodeURIComponent(
                `If an account with that email exists, a reset link has been sent. (${timestamp})`
              )}&recovery=sent`;
            }
          }}
        >
          Reset
        </button>
      </p>

      <p>
        Want to change your email?{' '}
        <button onClick={() => (window.location.href = '/change-email')}>
          Change Email
        </button>
      </p>

      <button
        onClick={async () => {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          alert(user?.email ?? 'No user logged in');
        }}
      >
        Who am I?
      </button>
    </div>
  );
}
