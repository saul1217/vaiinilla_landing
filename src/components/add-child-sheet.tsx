import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { errorMessage } from '../lib/api-error';
import {
  addChildFormProblem,
  canViewDependent,
  firstName,
  LINK_CODE_LENGTH,
  normalizeCodeInput,
  type Dependent,
  type PrivacyNotice,
} from '../lib/guardianship';
import { createIdempotencyKey } from '../lib/idempotency';
import { ParentSheet } from './parent-sheet';

type Mode = 'datos' | 'codigo';
const DRAFT_NOTICE = 'El aviso de privacidad todavía es un borrador; aún no se pueden agregar hijos.';

/**
 * Agregar a un hijo (Expo `AddChildFlow`): primero el código de la escuela si hace falta, después sus datos o
 * el código que sacó él o su otro tutor, con el aviso de privacidad aceptado.
 */
export function AddChildSheet({
  token,
  parentUnlocked,
  onUnlocked,
  onAdded,
  onClosed,
}: {
  token: string;
  parentUnlocked: boolean;
  onUnlocked: () => void;
  onAdded: (child: Dependent | null) => void;
  onClosed: () => void;
}) {
  const [step, setStep] = useState<'escuela' | 'hijo' | 'listo'>(parentUnlocked ? 'hijo' : 'escuela');
  const [schoolCode, setSchoolCode] = useState('');
  const [mode, setMode] = useState<Mode>('datos');
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [group, setGroup] = useState('');
  const [linkCode, setLinkCode] = useState('');
  const [notice, setNotice] = useState<PrivacyNotice | null>(null);
  const [noticeState, setNoticeState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [showNotice, setShowNotice] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<Dependent | null>(null);
  // Una llave por intento: si la respuesta se pierde, el reintento con los mismos datos no duplica al hijo.
  const [key, setKey] = useState(createIdempotencyKey);

  const loadNotice = () => {
    setNoticeState('loading');
    api
      .getGuardianPrivacyNotice(token)
      .then((next) => {
        setNotice(next);
        setNoticeState(next ? 'ready' : 'failed');
      })
      .catch(() => setNoticeState('failed'));
  };

  useEffect(loadNotice, [token]);

  const newAttempt = () => {
    setKey(createIdempotencyKey());
    setError(null);
  };

  const validateSchoolCode = async () => {
    const code = schoolCode.trim().toUpperCase();
    if (busy || !code) return;
    setBusy(true);
    setError(null);
    try {
      await api.unlockParent(token, code, key);
      onUnlocked();
      setKey(createIdempotencyKey());
      setStep('hijo');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const submitChild = async () => {
    if (busy) return;
    if (notice?.draft) {
      setError(DRAFT_NOTICE);
      return;
    }
    const problem = addChildFormProblem({
      withCode: mode === 'codigo',
      name,
      studentId,
      code: linkCode,
      consentAccepted: accepted,
      noticeReady: notice !== null,
    });
    if (problem || !notice) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const child =
        mode === 'codigo'
          ? await api.linkDependent(token, normalizeCodeInput(linkCode, LINK_CODE_LENGTH), notice.version, key)
          : await api.addDependent(
              token,
              { name, studentId, group: group.trim() || null, consentVersion: notice.version },
              key,
            );
      setAdded(child);
      onAdded(child);
      setStep('listo');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const titles = { escuela: 'Código de la escuela', hijo: '¿Quién es tu hijo?', listo: 'Listo' } as const;
  const leads = {
    escuela: 'Pide el código en la escuela para ligar a tus hijos y cuidar su alimentación.',
    hijo: 'Agrégalo con sus datos de la escuela o con el código que te dieron.',
    listo: undefined,
  } as const;

  return (
    <ParentSheet id="add-child-title" title={titles[step]} lead={leads[step]} onClosed={onClosed}>
      {(close) => (
        <div className="parent-sheet__body">
          {step === 'escuela' ? (
            <>
              <label className="alumno-field">
                Código de la escuela
                <input
                  value={schoolCode}
                  onChange={(event) => {
                    setSchoolCode(event.target.value.toUpperCase());
                    newAttempt();
                  }}
                  placeholder="ESC123"
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
              {error ? (
                <p className="alumno-error" role="alert">
                  {error}
                </p>
              ) : null}
              <button
                className="alumno-btn alumno-btn--lime"
                type="button"
                disabled={!schoolCode.trim() || busy}
                onClick={() => void validateSchoolCode()}
              >
                {busy ? 'Validando…' : 'Validar código'}
              </button>
            </>
          ) : null}

          {step === 'hijo' ? (
            <>
              <div className="alumno-chips parent-sheet__modes" role="radiogroup" aria-label="Cómo lo agregas">
                {(
                  [
                    ['datos', 'Con sus datos'],
                    ['codigo', 'Con su código'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={mode === value}
                    className={`alumno-chip${mode === value ? ' is-on' : ''}`}
                    onClick={() => {
                      setMode(value);
                      newAttempt();
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {mode === 'codigo' ? (
                <>
                  <label className="alumno-field">
                    Código de tu hijo
                    <input
                      value={linkCode}
                      onChange={(event) => {
                        setLinkCode(normalizeCodeInput(event.target.value, LINK_CODE_LENGTH));
                        newAttempt();
                      }}
                      placeholder="ABC234"
                      autoCapitalize="characters"
                      autoComplete="off"
                      spellCheck={false}
                      maxLength={LINK_CODE_LENGTH}
                    />
                  </label>
                  <p className="alumno-muted">
                    Lo saca en su cuenta, en Mi saldo › Código para mi tutor. Si ya lo cuida otro tutor, él te da uno
                    desde la ficha de tu hijo.
                  </p>
                </>
              ) : (
                <>
                  <label className="alumno-field">
                    Nombre completo
                    <input
                      value={name}
                      onChange={(event) => {
                        setName(event.target.value);
                        newAttempt();
                      }}
                      placeholder="Como lo conoce la escuela"
                      autoComplete="off"
                    />
                  </label>
                  <div className="parent-sheet__pair">
                    <label className="alumno-field">
                      Matrícula
                      <input
                        value={studentId}
                        onChange={(event) => {
                          setStudentId(event.target.value.toUpperCase());
                          newAttempt();
                        }}
                        placeholder="De su credencial"
                        autoCapitalize="characters"
                        autoComplete="off"
                      />
                    </label>
                    <label className="alumno-field">
                      Grupo
                      <input
                        value={group}
                        onChange={(event) => {
                          setGroup(event.target.value.toUpperCase());
                          newAttempt();
                        }}
                        placeholder="Opcional"
                        autoCapitalize="characters"
                        autoComplete="off"
                      />
                    </label>
                  </div>
                </>
              )}

              <div className="parent-sheet__consent">
                {noticeState === 'loading' ? <p className="alumno-muted">Cargando el aviso de privacidad…</p> : null}
                {noticeState === 'failed' ? (
                  <p className="alumno-error">
                    No pudimos cargar el aviso de privacidad.{' '}
                    <button className="alumno-link" type="button" onClick={loadNotice}>
                      Reintentar
                    </button>
                  </p>
                ) : null}
                {notice ? (
                  <>
                    {notice.draft ? (
                      <p className="alumno-muted" role="status">
                        {DRAFT_NOTICE}
                      </p>
                    ) : (
                      <label className="parent-mode__check">
                        <input
                          type="checkbox"
                          checked={accepted}
                          onChange={(event) => {
                            setAccepted(event.target.checked);
                            setError(null);
                          }}
                        />
                        Soy su mamá, papá o tutor y acepto el aviso de privacidad, también para sus alergias.
                      </label>
                    )}
                    <button className="alumno-link" type="button" onClick={() => setShowNotice((value) => !value)}>
                      {showNotice ? 'Ocultar el aviso' : 'Leer el aviso'}
                    </button>
                    {showNotice ? (
                      <div className="parent-mode__notice">
                        <h3>{notice.title}</h3>
                        {notice.paragraphs.map((paragraph, index) => (
                          <p key={index}>{paragraph}</p>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>

              {error ? (
                <p className="alumno-error" role="alert">
                  {error}
                </p>
              ) : null}
              <button
                className="alumno-btn alumno-btn--lime"
                type="button"
                disabled={busy || !notice || notice.draft}
                onClick={() => void submitChild()}
              >
                {busy ? 'Agregando…' : 'Agregar a mi hijo'}
              </button>
            </>
          ) : null}

          {step === 'listo' ? (
            <>
              <p role="status">
                {added && canViewDependent(added)
                  ? `${firstName(added.name)} ya está en tus hijos.`
                  : `Mandamos tu solicitud a la escuela. En cuanto la apruebe verás ${
                      added ? `a ${firstName(added.name)}` : 'a tu hijo'
                    } con su saldo.`}
              </p>
              <button className="alumno-btn alumno-btn--lime" type="button" onClick={close}>
                Listo
              </button>
            </>
          ) : null}
        </div>
      )}
    </ParentSheet>
  );
}