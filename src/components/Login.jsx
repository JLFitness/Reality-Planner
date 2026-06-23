// Dead-simple email + password gate, shown only when Supabase is configured and
// you're signed out. Mobile-first.
import { useState } from 'react';
import { useSync } from '../store.jsx';
import { Card, Btn, TextInput, Label } from './ui.jsx';

export default function Login() {
  const { signIn, signUp } = useSync();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { type:'error'|'info', text }

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setBusy(true);
    setMsg(null);
    const fn = mode === 'signin' ? signIn : signUp;
    const { error } = await fn(email.trim(), password);
    setBusy(false);
    if (error) {
      setMsg({ type: 'error', text: error.message });
    } else if (mode === 'signup') {
      setMsg({
        type: 'info',
        text: 'Account created. If email confirmation is on, confirm via the email, then sign in.',
      });
      setMode('signin');
    }
    // On successful sign-in the session updates and the app replaces this screen.
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="anim-scale-in w-full max-w-sm p-6">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src="/favicon.png" alt="" className="anim-pop mb-2 h-16 w-16" />
          <h1 className="text-xl font-bold">Reality Planner</h1>
          <p className="text-xs text-slate-400">
            {mode === 'signin' ? 'Sign in to sync your week' : 'Create your account'}
          </p>
        </div>

        <form className="space-y-3" onSubmit={submit}>
          <div>
            <Label>Email</Label>
            <TextInput
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <Label>Password</Label>
            <TextInput
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {msg && (
            <p className={`text-xs ${msg.type === 'error' ? 'text-rose-400' : 'text-emerald-400'}`}>
              {msg.text}
            </p>
          )}

          <Btn type="submit" variant="primary" className="w-full" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </Btn>
        </form>

        <button
          onClick={() => {
            setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
            setMsg(null);
          }}
          className="mt-4 w-full text-center text-xs text-slate-500 underline"
        >
          {mode === 'signin' ? 'Need an account? Create one' : 'Have an account? Sign in'}
        </button>
      </Card>
    </div>
  );
}
