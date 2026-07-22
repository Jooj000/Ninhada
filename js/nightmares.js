/* =====================================================================
 * nightmares.js — PESADELOS NOTURNOS (cooperativo)
 * ---------------------------------------------------------------------
 * De madrugada, um bebê pode acordar chorando. Um banner avisa os dois
 * jogadores; quem for ao Quarto, acender a luz e fazer carinho PRIMEIRO
 * ganha a recompensa (a lógica de "primeiro" está no sootheNightmare,
 * via transação atômica no Firebase).
 * ===================================================================== */

import { nightmareCheck } from "./firebase-sync.js";

let cfg = { getBabies: () => null, goToBedroom: () => {} };
let bannerBabyId = null;

export function initNightmares(opts) {
  cfg = { ...cfg, ...opts };

  // Avalia pesadelos periodicamente (a trava de tempo está no Firebase).
  setInterval(() => {
    const babies = cfg.getBabies() || {};
    for (const id of Object.keys(babies)) nightmareCheck(id);
  }, 60_000);

  const go = document.getElementById("nightmare-go");
  if (go) go.addEventListener("click", () => { if (bannerBabyId) cfg.goToBedroom(bannerBabyId); });
}

/* Chamado pelo loop do game.js: mostra/atualiza o banner. */
export function updateNightmares(room) {
  const banner = document.getElementById("nightmare-banner");
  if (!banner) return;
  const babies = (room && room.babies) || {};
  const id = Object.keys(babies).find((k) => babies[k].nightmare);
  if (id) {
    banner.hidden = false;
    if (id !== bannerBabyId) {
      bannerBabyId = id;
      document.getElementById("nightmare-text").textContent =
        `😱 ${babies[id].name || "Bebê"} teve um pesadelo!`;
    }
  } else {
    banner.hidden = true;
    bannerBabyId = null;
  }
}
