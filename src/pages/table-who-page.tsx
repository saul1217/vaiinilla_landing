import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlumnoPageHeader } from '../components/alumno-brand';
import { AppShell } from '../components/app-shell';
import { useAuth } from '../context/auth-context';
import { useBuyerSession } from '../context/buyer-session';
import { api } from '../lib/api';
import { errorMessage, VaiinillaApiError } from '../lib/api-error';
import { clientSessionForPlace } from '../lib/client-session-for-place';
import {
  dropTableParticipantOnSessionChange,
  rememberTableParticipant,
  tableParticipantFor,
} from '../lib/table-participant';
import { spaceNoun } from '../lib/space-words';
import type { SharedTable, TableSession } from '../types/api';

const ALIAS_MAX = 30;

function isNameTaken(cause: unknown): string | null {
  if (cause instanceof VaiinillaApiError && cause.status === 409 && cause.code === 'PARTICIPANT_NAME_TAKEN') {
    return cause.message;
  }
  return null;
}

/**
 * "¿Quién eres?" de la mesa: al escanear el QR de un espacio compartible se elige
 * quién se es antes de pedir. La verdad es el servidor (`yo`); la identidad local
 * solo adelanta el "¿Continuar como X?" y detecta cambio de sesión.
 */
export function TableWhoPage() {
  const { slug = '', token: qrToken = '' } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { context, openClientSession } = useBuyerSession();
  const openClientSessionRef = useRef(openClientSession);
  openClientSessionRef.current = openClientSession;
  const next = search.get('next') || `/e/${slug}`;

  const [session, setSession] = useState<TableSession | null>(null);
  const [clientToken, setClientToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [alias, setAlias] = useState('');
  const [busy, setBusy] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Sin pedir nombre: invitado anónimo o registrado, lo que haya.
      const client = await clientSessionForPlace({
        slug,
        user: user ?? null,
        context,
        openClientSession: openClientSessionRef.current,
      });
      setClientToken(client.access_token);
      const table = await api.tableSession(client.access_token, qrToken);
      // Sesión nueva (mesa cerrada y reabierta): la identidad local ya no vale.
      dropTableParticipantOnSessionChange(table.sesion_id);
      setSession(table);
      setShowList(false);
      setShowAdd(table.participantes.length === 0);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [context, qrToken, slug, user]);

  useEffect(() => {
    void load();
  }, [load]);

  // Yo según el servidor; si no me reconoce pero el dispositivo era alguien de la
  // lista, se ofrece continuar igual (reingreso con otra sesión de cliente).
  const stored =
    session != null ? tableParticipantFor(slug, session.espacio.id, session.sesion_id) : null;
  const listedSelf =
    !session?.yo && stored
      ? (session?.participantes.find((p) => p.id === stored.participanteId) ?? null)
      : null;
  const me = session?.yo ?? (listedSelf ? { id: listedSelf.id, alias: listedSelf.alias } : null);
  const offerContinue = me && !showList;

  function finishWith(table: SharedTable) {
    dropTableParticipantOnSessionChange(table.sesion_id);
    const mine = table.mi_participante;
    if (mine) {
      rememberTableParticipant({
        slug,
        espacioId: table.espacio.id,
        sesionId: table.sesion_id,
        participanteId: mine.id,
        alias: mine.alias,
      });
    }
    void navigate(next, { replace: true });
  }

  async function joinAs(input: { alias: string } | { participanteId: string }) {
    if (!clientToken) return;
    setBusy(true);
    setJoinError(null);
    try {
      const table = await api.joinTable(clientToken, qrToken, input);
      finishWith(table);
    } catch (cause) {
      const taken = isNameTaken(cause);
      // 409 con el nombre repetido: se muestra el mensaje del servidor tal cual y
      // se deja el texto escrito para agregar el apellido.
      setJoinError(taken ?? errorMessage(cause));
      if (!taken) setError(null);
    } finally {
      setBusy(false);
    }
  }

  function submitAlias(event: FormEvent) {
    event.preventDefault();
    const clean = alias.trim();
    if (!clean) return;
    void joinAs({ alias: clean });
  }

  const noun = spaceNoun(session?.espacio.tipo);
  const heading =
    session && offerContinue && me ? `¿Continuar como ${me.alias}?` : '¿Quién eres?';

  return (
    <AppShell tab="none">
      <main id="main-content" className="alumno-main table-who">
        <AlumnoPageHeader
          kicker={session ? session.espacio.nombre : `Tu ${noun}`}
          title={heading}
          lead={session && !(offerContinue && me) ? 'Selecciona tu nombre para continuar.' : undefined}
        />
        {loading ? (
          <p role="status">Viendo quién está en la mesa…</p>
        ) : error && !session ? (
          <>
            <p className="alumno-error">{error}</p>
            <button className="alumno-btn alumno-btn--lime" type="button" onClick={() => void load()}>
              Reintentar
            </button>
          </>
        ) : session && offerContinue && me ? (
          <>
            <div className="alumno-arrive table-who__stack">
              <button
                className="alumno-btn alumno-btn--lime"
                type="button"
                disabled={busy}
                onClick={() => void joinAs({ participanteId: me.id })}
              >
                Continuar como {me.alias}
              </button>
              <button
                className="alumno-btn alumno-btn--ghost"
                type="button"
                disabled={busy}
                onClick={() => {
                  setShowList(true);
                  setShowAdd(session.participantes.length === 0);
                }}
              >
                No soy {me.alias}
              </button>
            </div>
            {joinError ? <p className="alumno-error table-who__fade">{joinError}</p> : null}
          </>
        ) : session ? (
          <>
            {session.participantes.length === 0 ? null : (
              <div className="alumno-arrive table-who__stack">
                {session.participantes.map((person) => (
                  <button
                    key={person.id}
                    className="alumno-btn alumno-btn--ghost"
                    type="button"
                    disabled={busy}
                    onClick={() => void joinAs({ participanteId: person.id })}
                  >
                    {person.alias}
                  </button>
                ))}
              </div>
            )}
            {session.participantes.length === 0 || showAdd ? (
              <form className="table-who__add is-open" onSubmit={submitAlias}>
                <div className="table-who__add-inner">
                  <label className="alumno-field">
                    <span>Tu nombre</span>
                    <input
                      value={alias}
                      maxLength={ALIAS_MAX}
                      autoComplete="nickname"
                      onChange={(event) => {
                        setAlias(event.target.value);
                        setJoinError(null);
                      }}
                      placeholder="Como te dicen en la mesa"
                    />
                  </label>
                  <p className="alumno-muted">Ej. David R. o David Ramírez</p>
                  {joinError ? <p className="alumno-error table-who__fade">{joinError}</p> : null}
                  <button
                    className="alumno-btn alumno-btn--lime"
                    type="submit"
                    disabled={busy || !alias.trim()}
                  >
                    Entrar
                  </button>
                </div>
              </form>
            ) : (
              <button
                className="alumno-btn alumno-btn--lime"
                type="button"
                disabled={busy}
                onClick={() => setShowAdd(true)}
              >
                Agregarme a la mesa
              </button>
            )}
          </>
        ) : null}
      </main>
    </AppShell>
  );
}
