// Señal de "la página está animando algo": el arcade la escucha para no competir por el
// hilo principal mientras una tarjeta se abre o se cierra.
type Listener = (busy: boolean) => void;

let running = 0;
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) listener(running > 0);
}

/** Marca el inicio de una animación; llama a la función devuelta al terminar (una vez). */
export function beginMotion(): () => void {
  running += 1;
  if (running === 1) notify();
  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    running -= 1;
    if (running === 0) notify();
  };
}

export function onMotionChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
