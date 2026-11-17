import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { errorMessage } from '../lib/api-error';
import {
  allergenLabel,
  CLAIM_CODE_LENGTH,
  normalizeCodeInput,
  type MyGuardianControls,
} from '../lib/guardianship';
import { createIdempotencyKey } from '../lib/idempotency';
import { formatAmount } from '../lib/money';
import { GeneratedCodeSheet } from './generated-code-sheet';
import { ParentSheet } from './parent-sheet';

/**
 * El alumno en Mi saldo (Expo `SchoolOptionsPage`, rol alumno): conecta su cuenta con su tutor con un código,
 * activa la cuenta que su tutor le abrió y ve sus controles de hoy. Solo sale en una escuela.
 */
export function StudentGuardianCard({ token }: { token: string }) {
  const [isSchool, setIsSchool] = useState(false);
  const [controls, setControls] = useState<MyGuardianControls | null>(null);
  const [sheet, setSheet] = useState<'link' | 'claim' | null>(null);
  const [claimed, setClaimed] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.resolve()
      .then(() => api.getOperationalStatus(token))
      .then(async (status) => {
        if (!active) return;
        const school = status?.modo_escuela === true;
        setIsSchool(school);
        if (!school) return;
        const mine = await api.getMyGuardianControls(token).catch(() => null);
        if (active) setControls(mine);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [token, reloadKey]);

  if (!isSchool) return null;
  const hasTutors = (controls?.tutorNames.length ?? 0) > 0;

  return (
    <section className="alumno-card student-guardian" aria-labelledby="student-guardian-title">
      <h2 id="student-guardian-title">{hasTutors ? 'Quien te cuida en la escuela' : 'Conecta tu cuenta con tu tutor'}</h2>
      <p className="alumno-muted">
        {hasTutors
          ? 'Tu tutor recarga tu saldo y puede apartar tus comidas. Lo bloqueado no se te vende.'
          : 'Saca un código de 6 letras para pasárselo a tu tutor, o usa el código que te dio si él ya te dio de alta.'}
      </p>
      {claimed ? (
        <p className="alumno-banner" role="status">
          Listo, ya es tu cuenta, {claimed}.
        </p>
      ) : null}
      {controls && (controls.tutorNames.length > 0 || controls.dailyLimit || controls.allergens.length > 0) ? (
        <dl className="student-guardian__today">
          <dt>Tus controles hoy</dt>
          {controls.tutorNames.length > 0 ? <dd>{`Tutores: ${controls.tutorNames.join(', ')}`}</dd> : null}
          {controls.dailyLimit ? (
            <dd>
              {`Límite diario: ${formatAmount(controls.dailyLimit)}${
                controls.availableToday ? ` · te quedan ${formatAmount(controls.availableToday)} hoy` : ''
              }`}
            </dd>
          ) : null}
          {controls.allergens.length > 0 ? (
            <dd>{`Alergias: ${controls.allergens.map(allergenLabel).join(', ')}`}</dd>
          ) : null}
        </dl>
      ) : null}
      <div className="student-guardian__actions">
        <button className="alumno-btn alumno-btn--lime" type="button" onClick={() => setSheet('link')}>
          {hasTutors ? 'Que otro tutor me agregue' : 'Que mi tutor me agregue'}
        </button>
        {!hasTutors ? (
          <button className="alumno-btn alumno-btn--ghost" type="button" onClick={() => setSheet('claim')}>
            Mi tutor ya me dio de alta
          </button>
        ) : null}
      </div>
      {sheet === 'link' ? (
        <GeneratedCodeSheet
          id="student-link-title"
          title={hasTutors ? 'Que otro tutor me agregue' : 'Que mi tutor me agregue'}
          lead="Pásale este código a tu tutor. Lo escribe en Mis hijos › Agregar a mi hijo › Con su código."
          load={(key) => api.createStudentLinkCode(token, key)}
          onClosed={() => setSheet(null)}
        />
      ) : null}
      {sheet === 'claim' ? (
        <ClaimAccountSheet
          token={token}
          onClaimed={(name) => {
            setClaimed(name || 'ya puedes pedir');
            setReloadKey((value) => value + 1);
          }}
          onClosed={() => setSheet(null)}
        />
      ) : null}
    </section>
  );
}

function ClaimAccountSheet({
  token,
  onClaimed,
  onClosed,
}: {
  token: string;
  onClaimed: (name: string) => void;
  onClosed: () => void;
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(createIdempotencyKey);
  const ready = code.length === CLAIM_CODE_LENGTH;

  const claim = async (close: () => void) => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      onClaimed(await api.claimStudentAccount(token, code, key));
      close();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ParentSheet
      id="student-claim-title"
      title="Mi tutor ya me dio de alta"
      lead="Escribe el código de 8 letras que sacó tu tutor en tu ficha para quedarte con tu saldo y tus apartados."
      onClosed={onClosed}
    >
      {(close) => (
        <div className="parent-sheet__body">
          <label className="alumno-field">
            Código de tu cuenta
            <input
              value={code}
              onChange={(event) => {
                setCode(normalizeCodeInput(event.target.value, CLAIM_CODE_LENGTH));
                setKey(createIdempotencyKey());
                setError(null);
              }}
              placeholder="ABCD1234"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={CLAIM_CODE_LENGTH}
            />
          </label>
          {error ? (
            <p className="alumno-error" role="alert">
              {error}
            </p>
          ) : null}
          <button className="alumno-btn alumno-btn--lime" type="button" disabled={!ready || busy} onClick={() => void claim(close)}>
            {busy ? 'Activando…' : 'Activar mi cuenta'}
          </button>
        </div>
      )}
    </ParentSheet>
  );
}