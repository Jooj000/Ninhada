/* =====================================================================
 * baby-sprite.js — A CRIANÇA DENTRO DOS MINIGAMES
 * ---------------------------------------------------------------------
 * Os jogos usavam emoji (👶). Aqui eu monto o BONECO COMPLETO — com a
 * pele, o rosto, o cabelo e TODA a roupa equipada — num canvas escondido,
 * e entrego pronto para qualquer jogo desenhar.
 *
 * O desenho é caro (várias imagens), então fica em CACHE e só é refeito
 * quando muda alguma coisa: a criança ativa, o que ela veste ou a fase.
 * Enquanto as imagens carregam (ou se a arte não existir), cai no emoji,
 * para nunca ficar um buraco na tela.
 * ===================================================================== */

import { ASSETS, getAsset, SLOTS } from "./assets-map.js";
import { phaseForXp } from "./state.js";
import { getActiveBaby } from "./session.js";
import { conditionAsset } from "./render-utils.js";

const LADO = 256;                 // resolução do sprite pronto

/* ONDE FICA A CABEÇA dentro da arte (medido no quadro de 1024×1024):
 *   300px de ar à esquerda · 350px de cabeça · 380px de ar à direita
 *   a cabeça começa a 650px do rodapé e tem 320px de altura
 * Guardado em FRAÇÕES para valer em qualquer resolução de sprite. */
const CABECA = {
  x: 300 / 1024, larg: 350 / 1024,
  y: (1024 - 650 - 320) / 1024, alt: 320 / 1024,
};
const cacheImgs = new Map();      // src -> HTMLImageElement (ou null se falhou)

let canvasPronto = null;          // canvas com o boneco montado
let assinaturaAtual = "";         // p/ saber quando precisa remontar
let montando = false;
let temAlgo = false;              // alguma camada carregou? senão usa emoji

function carregar(src) {
  if (cacheImgs.has(src)) return Promise.resolve(cacheImgs.get(src));
  return new Promise((res) => {
    const i = new Image();
    i.onload = () => { cacheImgs.set(src, i); res(i); };
    i.onerror = () => { cacheImgs.set(src, null); res(null); };
    i.src = src;
  });
}

/* Assinatura = tudo que muda o visual. Se não mudou, não remonta. */
function assinatura(baby) {
  if (!baby) return "";
  const eq = baby.equipped || {};
  const partes = [phaseForXp(baby.xp || 0).id];
  for (const s of SLOTS) {
    if (s.base) continue;
    if (s.multi) partes.push(s.id + ":" + Object.keys(eq[s.id] || {}).sort().join("+"));
    else if (s.condition) partes.push(s.id + ":" + (conditionAsset(s.condition, baby)?.src || ""));
    else partes.push(s.id + ":" + (eq[s.id] || ""));
  }
  return partes.join("|");
}

/* Desenha "contido" no quadro, encostado embaixo (igual ao CSS do jogo). */
function contido(ctx, img) {
  const e = Math.min(LADO / img.width, LADO / img.height);
  const w = img.width * e, h = img.height * e;
  ctx.drawImage(img, (LADO - w) / 2, LADO - h, w, h);
}

async function montar(baby) {
  montando = true;
  const cv = document.createElement("canvas");
  cv.width = cv.height = LADO;
  const ctx = cv.getContext("2d");
  const fase = phaseForXp(baby.xp || 0);
  const eq = baby.equipped || {};
  let algum = false;

  for (const slot of SLOTS) {
    const alvos = [];
    if (slot.base) alvos.push(ASSETS.baby[fase.id]);
    else if (slot.condition) alvos.push(conditionAsset(slot.condition, baby));
    else if (slot.multi) {
      const set = eq[slot.id] || {};
      for (const id of Object.keys(set)) if (set[id]) alvos.push(getAsset(slot.category, id));
    } else if (eq[slot.id]) alvos.push(getAsset(slot.category, eq[slot.id]));

    for (const a of alvos) {
      if (!a) continue;
      const img = await carregar(a.src);
      if (img) { contido(ctx, img); algum = true; }
    }
  }

  canvasPronto = cv;
  temAlgo = algum;
  montando = false;
}

/* Garante que o sprite está atualizado (chamar no loop do jogo é seguro). */
export function atualizarSprite() {
  const st = window.__STATE__;
  const baby = st && st.babies && st.babies[getActiveBaby()];
  if (!baby) return;
  const a = assinatura(baby);
  if (a === assinaturaAtual || montando) return;
  assinaturaAtual = a;
  montar(baby);
}

/* O canvas do boneco, ou null se ainda não está pronto. */
export function spriteBebe() {
  atualizarSprite();
  return temAlgo ? canvasPronto : null;
}

/* ---------------------------------------------------------------------
 * DESENHAR — é isso que os jogos chamam.
 *   ctx      contexto do canvas do jogo
 *   x, y     ponto de ANCORAGEM (x = centro, y = base/pés)
 *   altura   altura desejada: do BONECO inteiro, ou da CABEÇA se soCabeca
 *   opts     { espelhar, giro, alpha, soCabeca }
 * ------------------------------------------------------------------- */
export function desenharBebe(ctx, x, y, altura, opts = {}) {
  const { espelhar = false, giro = 0, alpha = 1, soCabeca = false } = opts;
  const sp = spriteBebe();

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  if (giro) ctx.rotate(giro);
  if (espelhar) ctx.scale(-1, 1);

  if (sp) {
    /* ESCALA UNIFORME — nunca esticar nem achatar a criança.
     * `altura` é o tamanho que o boneco INTEIRO teria; com `soCabeca`
     * a gente só recorta a parte de cima, mantendo a mesma escala. */
    if (soCabeca) {
      /* Recorta EXATAMENTE a cabeça e desenha na proporção real dela
       * (nada de esticar). Aqui `altura` é a altura da CABEÇA. */
      const sx = CABECA.x * LADO, sy = CABECA.y * LADO;
      const sw = CABECA.larg * LADO, sh = CABECA.alt * LADO;
      const dh = altura, dw = altura * (sw / sh);      // mantém a proporção
      ctx.drawImage(sp, sx, sy, sw, sh, -dw / 2, -dh, dw, dh);
    } else {
      const d = altura;                                // quadro quadrado: 1:1
      ctx.drawImage(sp, -d / 2, -d, d, d);
    }
  } else {
    ctx.font = `${Math.round(altura)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("👶", 0, 0);
  }
  ctx.restore();
}
