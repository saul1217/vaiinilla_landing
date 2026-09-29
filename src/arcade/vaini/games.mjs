// Game registry and the one function that composes a frame (scene + effects + HUD/title/game-over).
// The browser shell, the stills and the native ports' reference frames all go through renderFrame.
import { drawFx, hudScore, drawTitle, drawGameOver } from "./kit.mjs";
import * as flappy from "./games/flappy.rules.mjs";
import * as apila from "./games/apila.rules.mjs";
import * as gravedad from "./games/gravedad.rules.mjs";
import * as galaxia from "./games/galaxia.rules.mjs";
import * as skate from "./games/skate.adapter.mjs";
import { draw as drawFlappy, drawHudExtras as extrasFlappy } from "./games/flappy.draw.mjs";
import { draw as drawApila, drawHudExtras as extrasApila } from "./games/apila.draw.mjs";
import { draw as drawGravedad } from "./games/gravedad.draw.mjs";
import { draw as drawGalaxia, drawHudExtras as extrasGalaxia } from "./games/galaxia.draw.mjs";

export const GAMES = {
  flappy: { label: "Vuela", rules: flappy, draw: drawFlappy, extras: extrasFlappy, title: "VUELA", hint: "TOCA PARA VOLAR", tag: "Toca para volar" },
  skate: { label: "Skate", rules: skate.rules, draw: skate.draw, custom: true, tag: "Toca para saltar · otra vez en el aire: kickflip" },
  apila: { label: "Apila", rules: apila, draw: drawApila, extras: extrasApila, title: "APILA", hint: "TOCA PARA SOLTAR", tag: "Toca para soltar" },
  gravedad: { label: "Gravedad", onLight: true, rules: gravedad, draw: drawGravedad, title: "GRAVEDAD", hint: "TOCA PARA VOLTEAR", tag: "Toca para cambiar la gravedad" },
  galaxia: { label: "Galaxia", rules: galaxia, draw: drawGalaxia, extras: extrasGalaxia, title: "GALAXIA", hint: "ARRASTRA PARA MOVER", tag: "Arrastra para mover · dispara sola" },
};

/** ui: { screen: "title" | "playing" | "over", screenTime, best, newBest, dt, touch } */
export function renderFrame(cv, key, s, fx, ui) {
  const g = GAMES[key];
  if (g.custom) {
    g.draw(cv, s, ui);
    if (fx) drawFx(cv, fx);
    return;
  }
  g.draw(cv, s);
  if (fx) drawFx(cv, fx);
  if (ui.screen === "playing" || ui.screen === "over") { hudScore(cv, s.score, ui.best, g.onLight); g.extras?.(cv, s); }
  if (ui.screen === "title") drawTitle(cv, ui.screenTime, g.title, g.hint);
  if (ui.screen === "over") drawGameOver(cv, ui.screenTime, s.score, ui.best, ui.newBest);
}
