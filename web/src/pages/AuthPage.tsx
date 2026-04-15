import type { FormEvent } from 'react'
import type { AuthFormState } from '../types/state.types'

interface AuthPageProps {
  form: AuthFormState
  error: string
  onSubmit: (event: FormEvent) => void
  onToggleMode: () => void
  onChange: (patch: Partial<AuthFormState>) => void
}

export function AuthPage({ form, error, onSubmit, onToggleMode, onChange }: AuthPageProps) {
  return (
    <div className="auth-page">
      <h1>TP Chat WebSocket</h1>
      <form className="card" onSubmit={onSubmit}>
        <h2>{form.mode === 'login' ? 'Connexion' : 'Inscription'}</h2>
        {form.mode === 'register' && (
          <input
            value={form.username}
            onChange={(event) => onChange({ username: event.target.value })}
            placeholder="Username"
            required
          />
        )}
        <input
          value={form.email}
          onChange={(event) => onChange({ email: event.target.value })}
          type="email"
          placeholder="Email"
          required
        />
        <input
          value={form.password}
          onChange={(event) => onChange({ password: event.target.value })}
          type="password"
          placeholder="Password"
          required
        />
        {error && <p className="error">{error}</p>}
        <button type="submit">{form.mode === 'login' ? 'Se connecter' : "S'inscrire"}</button>
        <button type="button" className="secondary" onClick={onToggleMode}>
          {form.mode === 'login' ? 'Créer un compte' : 'J’ai déjà un compte'}
        </button>
      </form>
    </div>
  )
}
