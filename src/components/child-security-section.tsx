import { useState } from 'react';
import { api } from '../lib/api';
import { errorMessage } from '../lib/api-error';
import {
  firstName,
  REFUND_METHOD_LABEL,
  type ChildGuardian,
  type Dependent,
  type RefundMethod,
  type StudentRequest,
} from '../lib/guardianship';
import { createIdempotencyKey } from '../lib/idempotency';
import { formatAmount } from '../lib/money';
import { GeneratedCodeSheet } from './generated-code-sheet';
import { ParentSheet } from './parent-sheet';

type Sheet = 'pin' | 'guardian-code' | 'own-account' | 'refund' | 'baja' | null;
type Pending =
  | { kind: 'block' }
  | { kind: 'remove'; guardian: ChildGuardian }
  | { kind: 'promote'; guardian: ChildGuardian }
  | null;

/**
 * Seguridad y tutores del hijo (Expo `ChildSecurityPage`): PIN en Caja, bloquear su credencial, los tutores
 * (hacer principal, quitar, invitar a otro), pasarlo a su propia cuenta y las solicitudes a la escuela.
 */
export function ChildSecuritySection({
  token,
  child,
  balance,
  requests,
  onChildChanged,
  onRequestsChanged,
  onNotice,
}: {
  token: string;
  child: Dependent;
  balance: string;
  requests: StudentRequest[];
  onChildChanged: (child: Dependent) => void;
  onRequestsChanged: (requests: StudentRequest[]) => void;
  onNotice: (message: string) => void;
}) {
  const first = firstName(child.name);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const principalName = !child.isPrincipal ? child.guardians.find((guardian) => guardian.isPrincipal)?.name : null;
  const hasBalance = Number(balance) > 0;
  const latest = (kind: StudentRequest['kind']) => requests.find((request) => request.kind === kind) ?? null;
  const refund = latest('devolucion');
  const removal = latest('baja_datos');

  const confirmPending = async () => {
    if (!pending || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (pending.kind === 'block') {
        const blocked = await api.blockDependentCredentials(token, child.userId, createIdempotencyKey());
        onChildChanged({ ...child, hasCredential: false });
        onNotice(blocked > 0 ? `Listo, la credencial de ${first} ya no sirve. En Caja le dan otra.` : 'No tenía credenciales activas.');
      } else {
        const updated =
          pending.kind === 'remove'
            ? await api.removeGuardian(token, child.userId, pending.guardian.id, createIdempotencyKey())
            : await api.makePrincipalGuardian(token, child.userId, pending.guardian.id, createIdempotencyKey());
        if (updated) onChildChanged(updated);
        onNotice(
          pending.kind === 'remove'
            ? `${pending.guardian.name} ya no es tutor de ${first}.`
            : `Ahora ${pending.guardian.name} pone los controles de ${first}.`,
        );
      }
      setPending(null);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const pendingText =
    pending?.kind === 'block'
      ? { title: `¿Bloquear la credencial de ${first}?`, text: 'Su QR y su tarjeta dejan de servir. En Caja le dan otra.', ok: 'Bloquear' }
      : pending?.kind === 'remove'
        ? { title: `¿Quitar a ${pending.guardian.name}?`, text: `Deja de ver la cuenta de ${first}.`, ok: 'Quitar' }
        : pending?.kind === 'promote'
          ? {
              title: `¿Pasar controles a ${pending.guardian.name}?`,
              text: `${pending.guardian.name} pondrá el límite, los bloqueos y las alergias de ${first}. Tú seguirás viendo, recargando y apartando.`,
              ok: 'Pasar controles',
            }
          : null;

  return (
    <section className="alumno-card parent-mode__security" aria-labelledby="child-security-title">
      <h2 className="alumno-section-label" id="child-security-title">
        Seguridad y tutores
      </h2>

      {child.isPrincipal ? (
        <div className="parent-mode__rows">
          <h3>Cómo compra</h3>
          <div className="parent-mode__row">
            <span>
              <strong>PIN en Caja</strong>
              <span className="alumno-muted">
                {child.hasPin ? 'Caja se lo pide antes de cobrarle con su saldo' : 'Sin PIN le cobran con su nombre o su credencial'}
              </span>
            </span>
            <button className="alumno-btn alumno-btn--ghost" type="button" onClick={() => setSheet('pin')}>
              {child.hasPin ? 'Cambiar' : 'Ponerle'}
            </button>
          </div>
          {child.hasCredential ? (
            <div className="parent-mode__row">
              <span>
                <strong>Bloquear su credencial</strong>
                <span className="alumno-muted">Si la perdió, su QR y su tarjeta dejan de servir. En Caja le dan otra.</span>
              </span>
              <button className="alumno-btn alumno-btn--ghost" type="button" onClick={() => setPending({ kind: 'block' })}>
                Bloquear
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="parent-mode__rows">
        <h3>Tutores</h3>
        <ul className="parent-mode__guardians">
          {child.guardians.map((guardian) => (
            <li key={guardian.id} className="parent-mode__row">
              <span>
                <strong>{guardian.name || 'Tutor'}</strong>
                <span className="alumno-muted">
                  {[guardian.isPrincipal ? 'Principal' : null, guardian.isYou ? 'Tú' : null].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className="parent-mode__row-actions">
                {child.isPrincipal && !guardian.isPrincipal ? (
                  <button className="alumno-link" type="button" onClick={() => setPending({ kind: 'promote', guardian })}>
                    Hacer principal
                  </button>
                ) : null}
                {(child.isPrincipal || guardian.isYou) && !guardian.isPrincipal ? (
                  <button className="alumno-link parent-sheet__danger-link" type="button" onClick={() => setPending({ kind: 'remove', guardian })}>
                    Quitar
                  </button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
        {child.isPrincipal ? (
          <button className="parent-mode__row parent-mode__row--action" type="button" onClick={() => setSheet('guardian-code')}>
            <span>
              <strong>Invitar a otro tutor</strong>
              <span className="alumno-muted">Ve, recarga y aparta; los controles los sigues poniendo tú</span>
            </span>
            <span aria-hidden="true">›</span>
          </button>
        ) : null}
        {principalName ? (
          <p className="alumno-muted">{`${principalName} pone el límite, los bloqueos y las alergias. Tú ves, recargas y apartas.`}</p>
        ) : null}
      </div>

      {!child.hasOwnAccount || child.isPrincipal ? (
        <div className="parent-mode__rows">
          <h3>Cuando crezca o se vaya</h3>
          {!child.hasOwnAccount ? (
            <button className="parent-mode__row parent-mode__row--action" type="button" onClick={() => setSheet('own-account')}>
              <span>
                <strong>Pasar a su propia cuenta</strong>
                <span className="alumno-muted">Cuando tenga teléfono, entra con su cuenta y sigue con todo lo suyo</span>
              </span>
              <span aria-hidden="true">›</span>
            </button>
          ) : null}
          {child.isPrincipal ? (
            <>
              <button
                className="parent-mode__row parent-mode__row--action"
                type="button"
                disabled={refund?.status === 'pendiente'}
                onClick={() => setSheet('refund')}
              >
                <span>
                  <strong>Devolver su saldo</strong>
                  <span className="alumno-muted">
                    {refund?.status === 'pendiente'
                      ? 'Esperando que la escuela entregue la devolución'
                      : refund?.status === 'rechazada'
                        ? `Rechazada: ${refund.rejectionReason ?? 'revisa en Caja'}`
                        : `Pide que te regresen los ${formatAmount(balance, 'always')} que le quedan`}
                  </span>
                </span>
                <span aria-hidden="true">›</span>
              </button>
              <button
                className="parent-mode__row parent-mode__row--action"
                type="button"
                disabled={hasBalance || removal?.status === 'pendiente'}
                onClick={() => setSheet('baja')}
              >
                <span>
                  <strong>Pedir que borren sus datos</strong>
                  <span className="alumno-muted">
                    {removal?.status === 'pendiente'
                      ? 'Esperando que la escuela dé de baja la cuenta'
                      : hasBalance
                        ? 'Primero pide que te devuelvan su saldo'
                        : 'La escuela deja de tenerlo en su lista y borra lo que lo identifica'}
                  </span>
                </span>
                <span aria-hidden="true">›</span>
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {pending && pendingText ? (
        <div className="parent-sheet__confirm" role="alertdialog" aria-label={pendingText.title}>
          <p>
            <strong>{pendingText.title}</strong> {pendingText.text}
          </p>
          <button className="alumno-btn alumno-btn--danger" type="button" disabled={busy} onClick={() => void confirmPending()}>
            {busy ? 'Un momento…' : pendingText.ok}
          </button>
          <button className="alumno-btn alumno-btn--ghost" type="button" disabled={busy} onClick={() => setPending(null)}>
            Cancelar
          </button>
        </div>
      ) : null}
      {error && !sheet ? (
        <p className="alumno-error" role="alert">
          {error}
        </p>
      ) : null}

      {sheet === 'pin' ? (
        <PinSheet
          token={token}
          child={child}
          onSaved={(hasPin) => {
            onChildChanged({ ...child, hasPin });
            onNotice(hasPin ? `Listo, ${first} ya tiene PIN.` : `Le quitaste el PIN a ${first}.`);
          }}
          onClosed={() => setSheet(null)}
        />
      ) : null}
      {sheet === 'guardian-code' ? (
        <GeneratedCodeSheet
          id="guardian-code-title"
          title={`Invitar a otro tutor de ${first}`}
          lead="Dale este código. Lo escribe en Mis hijos › Agregar a mi hijo › Con su código."
          load={(key) => api.createGuardianInviteCode(token, child.userId, key)}
          onClosed={() => setSheet(null)}
        />
      ) : null}
      {sheet === 'own-account' ? (
        <GeneratedCodeSheet
          id="own-account-title"
          title={`Pasar a ${first} a su propia cuenta`}
          lead="Que entre con su cuenta y escriba este código en Mi saldo › Mi tutor ya me dio de alta. Conserva su saldo y sus apartados."
          load={(key) => api.createOwnAccountCode(token, child.userId, key)}
          onClosed={() => setSheet(null)}
        />
      ) : null}
      {sheet === 'refund' || sheet === 'baja' ? (
        <RequestSheet
          token={token}
          child={child}
          kind={sheet === 'refund' ? 'devolucion' : 'baja_datos'}
          onSent={(created) => {
            onRequestsChanged([created, ...requests]);
            onNotice(created.kind === 'devolucion' ? 'Devolución pedida a la escuela.' : 'Solicitud de baja enviada.');
          }}
          onClosed={() => setSheet(null)}
        />
      ) : null}
    </section>
  );
}

function PinSheet({
  token,
  child,
  onSaved,
  onClosed,
}: {
  token: string;
  child: Dependent;
  onSaved: (hasPin: boolean) => void;
  onClosed: () => void;
}) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (next: string | null, close: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await api.setDependentPin(token, child.userId, next, createIdempotencyKey());
      onSaved(next !== null);
      close();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ParentSheet
      id="child-pin-title"
      title={`PIN de ${firstName(child.name)}`}
      lead="Caja le pide estos 4 números antes de cobrar con su saldo."
      onClosed={onClosed}
    >
      {(close) => (
        <div className="parent-sheet__body">
          <label className="alumno-field">
            PIN de 4 dígitos
            <input
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="1234"
            />
          </label>
          {error ? (
            <p className="alumno-error" role="alert">
              {error}
            </p>
          ) : null}
          <button className="alumno-btn alumno-btn--lime" type="button" disabled={pin.length !== 4 || busy} onClick={() => void save(pin, close)}>
            {busy ? 'Guardando…' : 'Guardar PIN'}
          </button>
          {child.hasPin ? (
            <button className="alumno-link parent-sheet__danger-link" type="button" disabled={busy} onClick={() => void save(null, close)}>
              Quitar PIN
            </button>
          ) : null}
        </div>
      )}
    </ParentSheet>
  );
}

function RequestSheet({
  token,
  child,
  kind,
  onSent,
  onClosed,
}: {
  token: string;
  child: Dependent;
  kind: StudentRequest['kind'];
  onSent: (request: StudentRequest) => void;
  onClosed: () => void;
}) {
  const [method, setMethod] = useState<RefundMethod>('efectivo');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key] = useState(createIdempotencyKey);
  const refund = kind === 'devolucion';

  const send = async (close: () => void) => {
    setBusy(true);
    setError(null);
    try {
      const created = await api.createStudentRequest(
        token,
        child.userId,
        { kind, refundMethod: refund ? method : null, note: note.trim() || null },
        key,
      );
      if (created) onSent(created);
      close();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ParentSheet
      id="child-request-title"
      title={refund ? 'Devolver su saldo' : 'Pedir baja de cuenta y datos'}
      lead={refund ? 'La escuela te entrega lo que le queda.' : 'La escuela revisa y borra su ficha cuando la confirme.'}
      onClosed={onClosed}
    >
      {(close) => (
        <div className="parent-sheet__body">
          {refund ? (
            <div className="alumno-chips parent-sheet__wrap" role="radiogroup" aria-label="Cómo te lo devuelven">
              {(Object.keys(REFUND_METHOD_LABEL) as RefundMethod[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={method === value}
                  className={`alumno-chip${method === value ? ' is-on' : ''}`}
                  onClick={() => setMethod(value)}
                >
                  {REFUND_METHOD_LABEL[value]}
                </button>
              ))}
            </div>
          ) : null}
          <label className="alumno-field">
            {refund ? 'Nota (opcional)' : 'Motivo (opcional)'}
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={refund ? 'Ej. Cambio de escuela' : 'Ej. Ya salió de la escuela'}
              autoComplete="off"
            />
          </label>
          {error ? (
            <p className="alumno-error" role="alert">
              {error}
            </p>
          ) : null}
          <button className="alumno-btn alumno-btn--lime" type="button" disabled={busy} onClick={() => void send(close)}>
            {busy ? 'Enviando…' : refund ? 'Pedir devolución' : 'Enviar solicitud de baja'}
          </button>
        </div>
      )}
    </ParentSheet>
  );
}