/* =====================================================================
 * render-utils.js — camadas do avatar (data-driven pelos SLOTS)
 * ---------------------------------------------------------------------
 * buildStageLayers: monta o palco (cenário + pose base + 1 div por SLOT).
 * paintBabyLayers:  pinta a pose (por fase) e cada peça equipada.
 * paintLayer:       usa .png/.gif se existir; camadas de cima nunca
 *                   pintam bloco de cor (só corpo/cenário usam placeholder).
 * ===================================================================== */

import { ASSETS, getAsset, SLOTS } from "./assets-map.js";
import { phaseForXp } from "./state.js";
import { GAME_CONFIG } from "./config.js";

export function paintLayer(el, asset) {
  if (!el) return;
  if (!asset) {
    if (el.dataset.paintedSrc !== "") el.dataset.paintedSrc = "";
    el.style.display = "none";
    return;
  }
  if (el.dataset.paintedSrc === asset.src) return;   // idempotente
  el.dataset.paintedSrc = asset.src;

  // Só a POSE base e o CENÁRIO usam cor de placeholder. Camadas de cima
  // ficam transparentes (senão tapariam o bebê com um bloco de cor).
  const isBase = el.classList.contains("layer-base") || el.classList.contains("layer-bg");

  el.style.display = "block";
  el.style.backgroundColor = isBase ? (asset.placeholder || "transparent") : "transparent";
  el.classList.add("is-placeholder");
  el.title = asset.label || "";
  el.textContent = isBase ? (asset.label || "") : "";

  const img = new Image();
  img.onload = () => {
    if (el.dataset.paintedSrc !== asset.src) return;
    el.style.backgroundImage = `url("${asset.src}")`;   // .png ou .gif animado
    el.style.backgroundColor = "transparent";
    el.classList.remove("is-placeholder");
    el.textContent = "";
  };
  img.onerror = () => {
    if (el.dataset.paintedSrc !== asset.src) return;
    el.style.backgroundImage = "none";
    el.style.backgroundColor = isBase ? (asset.placeholder || "transparent") : "transparent";
    el.classList.add("is-placeholder");
    el.textContent = isBase ? (asset.label || "") : "";
  };
  img.src = asset.src;
}

/* Monta as camadas dentro de um .baby-stage. Retorna refs por id.
 * IMPORTANTE: tudo que é "o boneco" (pose + roupas + acessórios) vai
 * dentro de um mesmo grupo `.baby-doll`. As animações são aplicadas
 * NO GRUPO, então roupa/cabelo/acessórios se movem junto com o corpo.
 * O cenário (bg) fica FORA do grupo, pra não balançar junto. */
export function buildStageLayers(stageEl, includeBg = true) {
  stageEl.innerHTML = "";
  const refs = {};
  let z = 0;

  if (includeBg) {
    const bg = document.createElement("div");
    bg.className = "layer layer-bg";
    bg.style.zIndex = "0";
    stageEl.appendChild(bg);
    refs.bg = bg;
  }

  const doll = document.createElement("div");
  doll.className = "baby-doll";
  stageEl.appendChild(doll);
  refs.doll = doll;

  const add = (cls, key) => {
    const d = document.createElement("div");
    d.className = `layer ${cls}`;
    d.style.zIndex = String(z++);
    doll.appendChild(d);
    refs[key] = d;
  };
  for (const slot of SLOTS) {
    if (slot.base) add("layer-base is-placeholder", "base");
    else add(`layer-slot layer-${slot.id}`, slot.id);
  }
  return refs;
}

/* Pinta uma ZONA com VÁRIOS sprites de uma vez (acessórios ilimitados).
 * Usa múltiplos background-image na mesma camada (todos no mesmo
 * enquadramento 1024x1024, então se empilham certinho). */
export function paintMultiLayer(el, srcs) {
  if (!el) return;
  const key = srcs.join("|");
  if (el.dataset.paintedSrc === key) return;     // idempotente
  el.dataset.paintedSrc = key;
  if (!srcs.length) { el.style.display = "none"; el.style.backgroundImage = "none"; return; }
  el.style.display = "block";
  el.style.backgroundColor = "transparent";
  el.classList.remove("is-placeholder");
  el.textContent = "";
  el.style.backgroundImage = srcs.map((s) => `url("${s}")`).join(", ");
}

/* Decide QUAL condição mostrar em cada camada de condição.
 *  - "face": a carência mais urgente (o status mais baixo entre sono,
 *    fome e afeto), se estiver abaixo do limiar. Doente tem prioridade.
 *  - "dirt": sujeira quando a higiene está baixa.
 * Devolve null quando não há nada a mostrar. */
export function conditionAsset(kind, baby) {
  const lim = GAME_CONFIG.conditionThreshold ?? 35;
  if (kind === "dirt") {
    return (baby.hygiene ?? 100) < lim ? ASSETS.conditions.sujo : null;
  }
  if (kind === "face") {
    if (baby.cold || baby.sick) return ASSETS.conditions.doente;
    const cand = [
      { k: "sono",    v: baby.sleep ?? 100 },
      { k: "fome",    v: baby.hunger ?? 100 },
      { k: "carente", v: baby.love ?? 100 },
    ].filter((c) => c.v < lim).sort((a, b) => a.v - b.v);
    return cand.length ? ASSETS.conditions[cand[0].k] : null;
  }
  return null;
}

/* Pinta a pose base (por fase) + cada peça equipada, na ordem dos SLOTS. */
export function paintBabyLayers(refs, baby) {
  const phase = phaseForXp(baby.xp || 0);
  if (refs.bg) paintLayer(refs.bg, ASSETS.backgrounds.nursery);
  const eq = baby.equipped || {};
  for (const slot of SLOTS) {
    if (slot.base) { paintLayer(refs.base, ASSETS.baby[phase.id]); continue; }
    if (slot.condition) { paintLayer(refs[slot.id], conditionAsset(slot.condition, baby)); continue; }
    if (slot.multi) {
      const set = eq[slot.id] || {};
      const srcs = Object.keys(set)
        .filter((id) => set[id])
        .map((id) => getAsset(slot.category, id))
        .filter(Boolean)
        .map((a) => a.src);
      paintMultiLayer(refs[slot.id], srcs);
      continue;
    }
    const itemId = eq[slot.id];
    const asset = itemId ? getAsset(slot.category, itemId) : null;
    paintLayer(refs[slot.id], asset);
  }
}
