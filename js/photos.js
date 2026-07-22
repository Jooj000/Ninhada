/* =====================================================================
 * photos.js — ÁLBUM DE FOTOS
 * ---------------------------------------------------------------------
 * Tira uma "foto" do visual atual da criança: desenha as MESMAS camadas
 * do jogo num <canvas> (cenário → pose → roupas → acessórios) e salva a
 * imagem no Firebase, compartilhada entre os dois jogadores.
 *
 * A imagem vai como JPEG pequeno (data URL) direto no Realtime Database,
 * porque o Firebase Storage passou a exigir plano pago em projetos novos.
 * ===================================================================== */

import { ASSETS, getAsset, SLOTS } from "./assets-map.js";
import { phaseForXp } from "./state.js";
import { savePhoto, onPhotosChange, deletePhoto } from "./firebase-sync.js";
import { getActiveBaby } from "./session.js";
import { getPlayerName } from "./identity.js";

const SIZE = 512;          // resolução da foto salva
const QUALITY = 0.72;      // compressão JPEG (bom equilíbrio tamanho/qualidade)

function loadImg(src) {
  return new Promise((res) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => res(null);
    i.src = src;
  });
}

/* Desenha uma imagem "contida" no quadro, alinhada embaixo (igual ao CSS). */
function drawContain(ctx, img) {
  const s = Math.min(SIZE / img.width, SIZE / img.height);
  const w = img.width * s, h = img.height * s;
  ctx.drawImage(img, (SIZE - w) / 2, SIZE - h, w, h);
}

/* Monta a foto do bebê e devolve um data URL. */
export async function renderBabyPhoto(baby) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = SIZE;
  const ctx = cv.getContext("2d");

  // Fundo: cenário se existir, senão a cor do placeholder (JPEG não tem alfa)
  const bgAsset = ASSETS.backgrounds.nursery;
  ctx.fillStyle = bgAsset.placeholder || "#FDEFF4";
  ctx.fillRect(0, 0, SIZE, SIZE);
  const bg = await loadImg(bgAsset.src);
  if (bg) ctx.drawImage(bg, 0, 0, SIZE, SIZE);

  const phase = phaseForXp(baby.xp || 0);
  const eq = baby.equipped || {};

  for (const slot of SLOTS) {
    if (slot.base) {
      const a = ASSETS.baby[phase.id];
      const img = a && (await loadImg(a.src));
      if (img) drawContain(ctx, img);
      continue;
    }
    if (slot.multi) {                       // zonas de acessório (vários)
      const set = eq[slot.id] || {};
      for (const id of Object.keys(set)) {
        if (!set[id]) continue;
        const a = getAsset(slot.category, id);
        const img = a && (await loadImg(a.src));
        if (img) drawContain(ctx, img);
      }
      continue;
    }
    const itemId = eq[slot.id];
    if (!itemId) continue;
    const a = getAsset(slot.category, itemId);
    const img = a && (await loadImg(a.src));
    if (img) drawContain(ctx, img);
  }

  return cv.toDataURL("image/jpeg", QUALITY);
}

/* Tira a foto do bebê ativo e guarda no álbum. */
export async function takePhoto() {
  const state = window.__STATE__;
  const id = getActiveBaby();
  const baby = state && state.babies && state.babies[id];
  if (!baby) return;

  const btn = document.getElementById("photo-btn");
  if (btn) { btn.disabled = true; btn.textContent = "📸…"; }

  const img = await renderBabyPhoto(baby);
  const phase = phaseForXp(baby.xp || 0);
  await savePhoto({
    img,
    babyName: baby.name || "Bebê",
    phase: phase.name,
    by: getPlayerName() || "",
    at: Date.now(),
  });

  if (btn) { btn.disabled = false; btn.textContent = "📸"; }
  flash();
}

/* Efeito de "flash" da câmera. */
function flash() {
  const f = document.createElement("div");
  f.className = "camera-flash";
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 400);
}

/* Marco automático: tira foto sozinho quando a criança muda de fase. */
const lastPhase = {};
export function checkMilestones(room) {
  if (!room || !room.babies) return;
  for (const [id, baby] of Object.entries(room.babies)) {
    const p = phaseForXp(baby.xp || 0).id;
    if (lastPhase[id] && lastPhase[id] !== p) {
      renderBabyPhoto(baby).then((img) =>
        savePhoto({
          img,
          babyName: baby.name || "Bebê",
          phase: phaseForXp(baby.xp || 0).name,
          milestone: true,
          by: "",
          at: Date.now(),
        })
      );
    }
    lastPhase[id] = p;
  }
}

export function initPhotos() {
  const btn = document.getElementById("photo-btn");
  if (btn) btn.addEventListener("click", takePhoto);

  const grid = document.getElementById("photo-grid");
  if (!grid) return;

  onPhotosChange((list) => {
    grid.innerHTML = "";
    if (!list.length) {
      grid.innerHTML = `<p class="board-empty" style="color:var(--ink-soft)">
        Nenhuma foto ainda. Toque no 📸 na Sala para registrar o visual de agora.</p>`;
      return;
    }
    for (const p of list) {
      const card = document.createElement("figure");
      card.className = "photo-card" + (p.milestone ? " milestone" : "");
      const img = document.createElement("img");
      img.src = p.img;
      img.alt = `${p.babyName} — ${p.phase}`;
      img.loading = "lazy";
      const cap = document.createElement("figcaption");
      const d = new Date(p.at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
      cap.textContent = `${p.milestone ? "🌟 " : ""}${p.babyName} · ${p.phase} · ${d}`;
      const del = document.createElement("button");
      del.className = "photo-del";
      del.textContent = "✕";
      del.title = "Apagar foto";
      del.onclick = () => { if (confirm("Apagar esta foto?")) deletePhoto(p.id); };
      const dl = document.createElement("a");
      dl.className = "photo-dl";
      dl.textContent = "⬇";
      dl.title = "Baixar";
      dl.href = p.img;
      dl.download = `${p.babyName}-${d.replace(/\//g, "-")}.jpg`;

      card.append(img, cap, del, dl);
      grid.appendChild(card);
    }
  });
}
