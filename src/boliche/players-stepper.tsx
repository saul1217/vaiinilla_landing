// Boliche: cuántos juegan en la pista, para tenerla lista con sus zapatos. Espejo del selector de
// jugadores de ReservationsScreen (Android, R11/U03). Va de 1 a la capacidad de la pista.
import { playersLabel } from './bowling';
import './bowling.css';

export function PlayersStepper({
  players,
  max,
  disabled = false,
  onChange,
}: {
  players: number;
  max: number;
  disabled?: boolean;
  onChange: (players: number) => void;
}) {
  return (
    <div className="boliche-players" role="group" aria-labelledby="boliche-players-label">
      <span className="boliche-players__text">
        <strong id="boliche-players-label">¿Cuántos van a jugar?</strong>
        <small>{players > 0 ? `Caben hasta ${max} en esta pista.` : 'Anótalo para apartar la pista.'}</small>
      </span>
      <span className="boliche-players__controls">
        <button
          type="button"
          className="alumno-res__small"
          aria-label="Un jugador menos"
          disabled={disabled || players <= 1}
          onClick={() => onChange(players - 1)}
        >
          −
        </button>
        <output aria-live="polite" aria-label={players > 0 ? playersLabel(players) : 'Sin jugadores anotados'}>
          {players > 0 ? players : '–'}
        </output>
        <button
          type="button"
          className="alumno-res__small"
          aria-label="Un jugador más"
          disabled={disabled || players >= max}
          onClick={() => onChange(players + 1)}
        >
          +
        </button>
      </span>
    </div>
  );
}
