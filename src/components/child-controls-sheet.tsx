import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { errorMessage } from '../lib/api-error';
import {
  allergenLabel,
  controlAmountProblem,
  CONTROLS_NOTES_LIMIT,
  emptyControls,
  encodeControls,
  firstName,
  parseControlMoneyOrNull,
  SCHOOL_ALLERGENS,
  type Dependent,
} from '../lib/guardianship';
import { createIdempotencyKey } from '../lib/idempotency';
import type { CatalogCategory } from '../types/api';
import { ParentSheet } from './parent-sheet';

const amountText = (value: string | null) => value?.replace(/\.00$/, '') ?? '';

/**
 * Controles del hijo (Expo `ChildControlsSheet`): el tutor principal cambia el límite diario, la nota para Caja,
 * las alergias y las categorías bloqueadas; cualquier tutor cambia su aviso de saldo bajo o lo quita de sus hijos.
 */
export function ChildControlsSheet({
  token,
  child,
  placeSlug,
  onSaved,
  onUnlinked,
  onClosed,
}: {
  token: string;
  child: Dependent;
  placeSlug: string | null;
  onSaved: (child: Dependent) => void;
  onUnlinked: () => void;
  onClosed: () => void;
}) {
  const base = child.controls ?? emptyControls();
  const principal = child.isPrincipal;
  const first = firstName(child.name);
  const [dailyLimit, setDailyLimit] = useState(amountText(base.dailyLimit));
  const [lowBalance, setLowBalance] = useState(amountText(base.lowBalanceAlert));
  const [notes, setNotes] = useState(base.notes);
  const [allergens, setAllergens] = useState<string[]>(base.allergens);
  const [blockedCategories, setBlockedCategories] = useState<number[]>(base.blockedCategoryIds);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmUnlink, setConfirmUnlink] = useState(false);

  useEffect(() => {
    if (!principal || !placeSlug) return;
    let active = true;
    api
      .getGuestCatalog(placeSlug)
      .then((catalog) => {
        if (active) setCategories([...catalog.categorias].sort((a, b) => a.orden - b.orden));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [placeSlug, principal]);

  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

  const save = async (close: () => void) => {
    const problem = (principal ? controlAmountProblem(dailyLimit) : null) ?? controlAmountProblem(lowBalance);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const alert = parseControlMoneyOrNull(lowBalance);
      const body = principal
        ? encodeControls({
            ...base,
            dailyLimit: parseControlMoneyOrNull(dailyLimit),
            lowBalanceAlert: alert,
            notes: notes.trim().slice(0, CONTROLS_NOTES_LIMIT),
            allergens,
            blockedCategoryIds: blockedCategories,
          })
        : // Quien no es el principal solo puede mandar su aviso de saldo bajo.
          { umbral_saldo_bajo: alert };
      const updated = await api.updateDependent(token, child.userId, body, createIdempotencyKey());
      if (updated) onSaved(updated);
      close();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const unlink = async (close: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await api.unlinkDependent(token, child.userId, createIdempotencyKey());
      close();
      onUnlinked();
    } catch (cause) {
      setError(errorMessage(cause));
      setConfirmUnlink(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ParentSheet
      id="child-controls-title"
      title={`Controles de ${first}`}
      lead="La caja los revisa en cada compra."
      onClosed={onClosed}
    >
      {(close) => (
        <div className="parent-sheet__body">
          {principal ? (
            <label className="alumno-field">
              Límite diario
              <input
                inputMode="decimal"
                autoComplete="off"
                value={dailyLimit}
                onChange={(event) => setDailyLimit(event.target.value.replace(/[^\d.,$]/g, '').slice(0, 9))}
                placeholder="Sin límite (ej. 120)"
              />
            </label>
          ) : null}
          <label className="alumno-field">
            Aviso de saldo bajo
            <input
              inputMode="decimal"
              autoComplete="off"
              value={lowBalance}
              onChange={(event) => setLowBalance(event.target.value.replace(/[^\d.,$]/g, '').slice(0, 9))}
              placeholder="Ej. 50"
            />
          </label>
          {principal ? (
            <>
              <label className="alumno-field">
                Nota para Caja
                <textarea
                  value={notes}
                  maxLength={CONTROLS_NOTES_LIMIT}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Ej. Sin picante"
                  rows={2}
                />
              </label>
              <fieldset>
                <legend>Alergias</legend>
                <p className="alumno-muted">No se le vende lo que tenga estos ingredientes.</p>
                <div className="alumno-chips parent-sheet__wrap">
                  {SCHOOL_ALLERGENS.map((code) => (
                    <button
                      key={code}
                      type="button"
                      aria-pressed={allergens.includes(code)}
                      className={`alumno-chip${allergens.includes(code) ? ' is-on' : ''}`}
                      onClick={() => setAllergens((list) => toggle(list, code))}
                    >
                      {allergenLabel(code)}
                    </button>
                  ))}
                </div>
              </fieldset>
              {categories.length > 0 ? (
                <fieldset>
                  <legend>Categorías bloqueadas</legend>
                  <p className="alumno-muted">No puede comprar nada de lo que marques.</p>
                  <div className="alumno-chips parent-sheet__wrap">
                    {categories.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        aria-pressed={blockedCategories.includes(category.id)}
                        className={`alumno-chip${blockedCategories.includes(category.id) ? ' is-on' : ''}`}
                        onClick={() => setBlockedCategories((list) => toggle(list, category.id))}
                      >
                        {category.nombre}
                      </button>
                    ))}
                  </div>
                </fieldset>
              ) : null}
            </>
          ) : (
            <p className="alumno-muted">El límite, las alergias y lo bloqueado los pone su tutor principal.</p>
          )}
          {error ? (
            <p className="alumno-error" role="alert">
              {error}
            </p>
          ) : null}
          <button className="alumno-btn alumno-btn--lime" type="button" disabled={busy} onClick={() => void save(close)}>
            {busy && !confirmUnlink ? 'Guardando…' : 'Guardar'}
          </button>
          {confirmUnlink ? (
            <div className="parent-sheet__confirm" role="alertdialog" aria-label={`¿Quitar a ${first} de tus hijos?`}>
              <p>
                <strong>¿Quitar a {first} de tus hijos?</strong> Dejas de ver su saldo, sus apartados y sus movimientos
                desde esta cuenta.
              </p>
              <button className="alumno-btn alumno-btn--danger" type="button" disabled={busy} onClick={() => void unlink(close)}>
                {busy ? 'Quitando…' : 'Sí, quitarlo'}
              </button>
              <button className="alumno-btn alumno-btn--ghost" type="button" disabled={busy} onClick={() => setConfirmUnlink(false)}>
                No
              </button>
            </div>
          ) : (
            <button className="alumno-link parent-sheet__danger-link" type="button" onClick={() => setConfirmUnlink(true)}>
              Quitar de mis hijos
            </button>
          )}
        </div>
      )}
    </ParentSheet>
  );
}