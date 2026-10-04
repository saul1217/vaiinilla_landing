import { useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import { api } from '../lib/api';
import { firebaseAuthMessage } from '../lib/api-error';
import { reauthenticateForDeletion, signsInWithGoogle } from '../lib/firebase';

const CONFIRMATION_WORD = 'ELIMINAR';

/** Borrado definitivo de la cuenta: se confirma escribiendo la palabra y volviendo a entrar. */
export function DeleteAccountPanel({ user, onDeleted }: { user: User; onDeleted: () => Promise<void> }) {
  const withGoogle = signsInWithGoogle(user);
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = confirmation.trim().toUpperCase() === CONFIRMATION_WORD && (withGoogle || password.length > 0);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const token = await reauthenticateForDeletion(user, password);
      await api.deleteIdentity(token);
      await onDeleted();
    } catch (cause) {
      setError(firebaseAuthMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  function toggle() {
    setOpen((value) => !value);
    setError(null);
    setPassword('');
  }

  return (
    <>
      <button
        className="alumno-setting alumno-setting--danger"
        type="button"
        aria-expanded={open}
        aria-controls="eliminar-cuenta"
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
            Escribe {CONFIRMATION_WORD} para confirmar
            <input
              name="confirmacion"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
            />
          </label>
          {withGoogle ? (
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
          <button className="alumno-link alumno-delete__cancel" type="button" onClick={toggle}>
            Cancelar
          </button>
        </form>
      </div>
    </>
  );
}
