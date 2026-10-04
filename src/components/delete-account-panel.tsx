import { useState, type FormEvent } from 'react';
import type { MultiFactorResolver, User } from 'firebase/auth';
import { ACCOUNT_DELETION_CONFIRMATION, api } from '../lib/api';
import { firebaseAuthMessage } from '../lib/api-error';
import { completeTotpSignIn, reauthenticateForDeletion, signsInWithGoogle } from '../lib/firebase';

/** Borrado definitivo de la cuenta: se confirma escribiendo la palabra y volviendo a entrar. */
export function DeleteAccountPanel({ user, onDeleted }: { user: User; onDeleted: () => Promise<void> }) {
  const withGoogle = signsInWithGoogle(user);
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [password, setPassword] = useState('');
  const [mfaResolver, setMfaResolver] = useState<MultiFactorResolver | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmed = confirmation.trim().toUpperCase() === ACCOUNT_DELETION_CONFIRMATION;
  const ready = mfaResolver
    ? confirmed && totpCode.length === 6
    : confirmed && (withGoogle || password.length > 0);

  async function freshToken(): Promise<string | null> {
    if (mfaResolver) {
      const reauthenticated = await completeTotpSignIn(mfaResolver, totpCode);
      return reauthenticated.getIdToken(true);
    }
    const result = await reauthenticateForDeletion(user, password);
    if ('mfaResolver' in result) {
      setMfaResolver(result.mfaResolver);
      return null;
    }
    return result.token;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const token = await freshToken();
      if (!token) return;
      await api.deleteIdentity(token);
      await onDeleted();
    } catch (cause) {
      setError(firebaseAuthMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  // Mientras se borra no se puede cerrar: el borrado seguiría aunque el panel desaparezca.
  function toggle() {
    if (busy) return;
    setOpen((value) => !value);
    setError(null);
    setConfirmation('');
    setPassword('');
    setMfaResolver(null);
    setTotpCode('');
  }

  return (
    <>
      <button
        className="alumno-setting alumno-setting--danger"
        type="button"
        aria-expanded={open}
        aria-controls="eliminar-cuenta"
        disabled={busy}
        onClick={toggle}
      >
        Eliminar cuenta
      </button>
      <div id="eliminar-cuenta" className={open ? 'alumno-delete is-open' : 'alumno-delete'} inert={!open}>
        <form className="alumno-delete__inner" onSubmit={(event) => void submit(event)}>
          <p>
            <strong>Esto no se puede deshacer.</strong> Se borran tus datos personales; tus pedidos y pagos se
            conservan sin tu nombre.
          </p>
          <label className="alumno-field">
            Escribe {ACCOUNT_DELETION_CONFIRMATION} para confirmar
            <input
              name="confirmacion"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              disabled={busy}
            />
          </label>
          {mfaResolver ? (
            <label className="alumno-field">
              Código de 6 dígitos de tu autenticador
              <input
                name="totp"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                value={totpCode}
                onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={busy}
              />
            </label>
          ) : withGoogle ? (
            <p className="alumno-muted">Al confirmar se abre Google para comprobar que eres tú.</p>
          ) : (
            <label className="alumno-field">
              Tu contraseña
              <input
                type="password"
                name="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                disabled={busy}
              />
            </label>
          )}
          {error ? (
            <p className="alumno-error" role="alert">
              {error}
            </p>
          ) : null}
          <button className="alumno-btn alumno-btn--danger" type="submit" disabled={!ready || busy}>
            {busy ? 'Eliminando…' : 'Eliminar definitivamente'}
          </button>
          <button className="alumno-link alumno-delete__cancel" type="button" disabled={busy} onClick={toggle}>
            Cancelar
          </button>
        </form>
      </div>
    </>
  );
}
