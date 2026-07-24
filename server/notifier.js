#!/usr/bin/env node
/* =====================================================================
 * notifier.js — DISPARADOR DE NOTIFICAÇÕES (substitui Cloud Functions)
 * ---------------------------------------------------------------------
 * Roda de graça em qualquer lugar: seu PC, GitHub Actions (cron),
 * Render, Railway... Ele:
 *   1. lê o estado do jogo no Realtime Database (via REST)
 *   2. decide o que merece aviso (criança precisando, foguinho, recado)
 *   3. envia Web Push (VAPID) para os aparelhos inscritos
 *   4. anota o que já avisou, pra não repetir
 *
 * Uso:
 *   cd server && npm install
 *   cp .env.example .env   (preencha as chaves)
 *   node notifier.js       (uma passada)  |  node notifier.js --loop
 * ===================================================================== */

import webpush from "web-push";
import "dotenv/config";

const DB = (process.env.DATABASE_URL || "").replace(/\/$/, "");
const ROOM = process.env.ROOM_ID || "nosso-bebe";
const PUB = process.env.VAPID_PUBLIC_KEY;
const PRIV = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:voce@exemplo.com";

const LOW = Number(process.env.LOW_STATUS || 25);
const REPEAT_H = Number(process.env.REPEAT_HOURS || 3);
const STREAK_HOUR = Number(process.env.STREAK_HOUR || 20);

if (!DB || !PUB || !PRIV) {
  console.error("Faltam variáveis no .env (DATABASE_URL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY).");
  process.exit(1);
}

/* ---------------------------------------------------------------------
 * VALIDAÇÃO DAS CHAVES VAPID
 * O erro "Vapid private key should be 32 bytes long when decoded" quase
 * sempre NÃO é problema de código: é a chave chegando suja. As causas
 * comuns são espaço/quebra de linha coladas junto, aspas em volta, a
 * chave em base64 comum (com + e /) em vez de base64url (- e _), ou a
 * PÚBLICA colada no lugar da privada (65 bytes em vez de 32).
 * Limpamos o que dá e explicamos exatamente o que está errado.
 * ------------------------------------------------------------------- */
function limparChave(v) {
  return String(v || "")
    .trim()                       // espaços e quebras de linha das secrets
    .replace(/^["']|["']$/g, "")  // aspas coladas por engano
    .replace(/\s+/g, "")          // qualquer espaço interno
    .replace(/\+/g, "-")          // base64 comum -> base64url
    .replace(/\//g, "_")
    .replace(/=+$/, "");          // padding
}

function tamanhoEmBytes(chave) {
  try { return Buffer.from(chave, "base64url").length; }
  catch { return -1; }
}

const PUB_L = limparChave(PUB);
const PRIV_L = limparChave(PRIV);
const nPub = tamanhoEmBytes(PUB_L);
const nPriv = tamanhoEmBytes(PRIV_L);

if (nPriv !== 32 || nPub !== 65) {
  console.error("\n=== CHAVES VAPID INVÁLIDAS ===");
  console.error(`  VAPID_PRIVATE_KEY decodifica para ${nPriv} byte(s) — precisa ser 32.`);
  console.error(`  VAPID_PUBLIC_KEY  decodifica para ${nPub} byte(s) — precisa ser 65.`);
  if (nPriv === 65 && nPub === 32) {
    console.error("  >> As duas parecem TROCADAS: a pública está no campo da privada.");
  } else if (nPriv > 32) {
    console.error("  >> A privada está longa demais. Se ela tem cabeçalho -----BEGIN,");
    console.error("     é um PEM: o web-push quer a chave crua em base64url.");
  } else if (nPriv > 0) {
    console.error("  >> A privada está curta: provavelmente foi cortada ao copiar.");
  }
  console.error("\n  Para gerar um par novo e correto:");
  console.error("     npx web-push generate-vapid-keys");
  console.error("  Depois cole cada valor EXATO (sem aspas e sem espaços) nos secrets");
  console.error("  do repositório: VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY.");
  console.error("  Atenção: a pública também precisa ser a MESMA usada no app (js/config.js),");
  console.error("  senão as assinaturas antigas param de funcionar e precisam ser refeitas.\n");
  process.exit(1);
}

webpush.setVapidDetails(SUBJECT, PUB_L, PRIV_L);

const url = (path) => `${DB}/${path}.json`;
const getJSON = async (path) => (await fetch(url(path))).json();
const putJSON = async (path, data) =>
  fetch(url(path), { method: "PUT", body: JSON.stringify(data) });

const STATUS_LABEL = {
  hunger: "com fome", sleep: "com sono", hygiene: "precisando de banho",
  fun: "entediado(a)", love: "querendo carinho",
};

const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/* Aplica o mesmo decaimento por tempo que o jogo usa. */
const DECAY = { hunger: 20, sleep: 12, hygiene: 8, fun: 15, love: 10 };
function decayed(baby, now = Date.now()) {
  const hours = Math.max(0, (now - (baby.lastUpdate || now)) / 3_600_000);
  const out = { ...baby };
  for (const k of Object.keys(DECAY)) {
    out[k] = Math.max(0, Math.min(100, (baby[k] ?? 0) - DECAY[k] * hours));
  }
  return out;
}

/* Envia para todos os inscritos (opcionalmente pulando um jogador). */
async function sendAll(subs, payload, skipPlayerId = null) {
  const jobs = [];
  for (const [pid, entry] of Object.entries(subs || {})) {
    if (!entry || !entry.sub) continue;
    if (skipPlayerId && pid === skipPlayerId) continue;   // não avisa quem escreveu
    jobs.push(
      webpush.sendNotification(entry.sub, JSON.stringify(payload)).catch(async (err) => {
        // 404/410 = assinatura morta: limpa do banco
        if (err.statusCode === 404 || err.statusCode === 410) {
          await fetch(url(`rooms/${ROOM}/pushSubs/${pid}`), { method: "DELETE" });
          console.log("removida assinatura expirada:", pid);
        } else {
          console.warn("falha ao enviar:", err.statusCode || err.message);
        }
      })
    );
  }
  await Promise.all(jobs);
}

async function runOnce() {
  const room = await getJSON(`rooms/${ROOM}`);
  if (!room) { console.log("sala vazia"); return; }

  const subs = room.pushSubs || {};
  if (!Object.keys(subs).length) { console.log("ninguém inscrito ainda"); return; }

  const state = room.notifyState || {};
  const now = Date.now();
  const gap = REPEAT_H * 3_600_000;
  let changed = false;

  /* 1) Crianças precisando de cuidado */
  for (const [id, raw] of Object.entries(room.babies || {})) {
    const baby = decayed(raw, now);
    const low = Object.keys(STATUS_LABEL).filter((k) => (baby[k] ?? 100) < LOW);
    if (!low.length) continue;
    const key = `baby_${id}`;
    if (now - (state[key] || 0) < gap) continue;
    const nome = raw.name || "O bebê";
    await sendAll(subs, {
      title: `${nome} precisa de você`,
      body: `Está ${low.map((k) => STATUS_LABEL[k]).join(" e ")}.`,
      tag: key,
    });
    state[key] = now; changed = true;
    console.log("avisou:", nome, low.join(","));
  }

  /* 2) Foguinho prestes a apagar */
  const streak = room.streak || {};
  const hour = new Date().getHours();
  if (hour >= STREAK_HOUR && streak.lastDay !== dayKey()) {
    const key = `streak_${dayKey()}`;
    if (!state[key]) {
      await sendAll(subs, {
        title: "🔥 O foguinho vai apagar!",
        body: `Vocês estão em ${streak.count || 0} dia(s). Cuidem de alguém hoje para manter.`,
        tag: "streak",
      });
      state[key] = now; changed = true;
      console.log("avisou: foguinho");
    }
  }

  /* 3) Recados novos (avisa só quem NÃO escreveu) */
  const board = room.board || {};
  const lastSeen = state.lastBoardAt || 0;
  const novos = Object.values(board).filter((m) => m && m.at > lastSeen);
  if (novos.length) {
    const ultimo = novos.sort((a, b) => a.at - b.at).slice(-1)[0];
    await sendAll(subs, {
      title: `📝 Recado de ${ultimo.author || "alguém"}`,
      body: ultimo.text,
      tag: "board",
    }, ultimo.authorId);
    state.lastBoardAt = Math.max(...novos.map((m) => m.at));
    changed = true;
    console.log("avisou: recado");
  }

  if (changed) await putJSON(`rooms/${ROOM}/notifyState`, state);
  console.log("ok —", new Date().toLocaleString("pt-BR"));
}

const loop = process.argv.includes("--loop");
await runOnce();
if (loop) {
  const min = Number(process.env.INTERVAL_MINUTES || 15);
  console.log(`modo loop: a cada ${min} min`);
  setInterval(() => runOnce().catch(console.error), min * 60_000);
}
