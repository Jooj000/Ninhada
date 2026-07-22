/* =====================================================================
 * push.js — NOTIFICAÇÕES (Web Push nativo + VAPID) — 100% grátis
 * ---------------------------------------------------------------------
 * O navegador/sistema entrega o aviso mesmo com o app FECHADO, de graça.
 * Não usa Cloud Functions (que exigiriam o plano pago): quem dispara é
 * o script em server/notifier.js, que você roda de graça (PC, GitHub
 * Actions, Render...). Ver README.
 *
 * Aqui fazemos: pedir permissão, assinar o push e guardar a assinatura
 * no Firebase, para o notificador saber para onde mandar.
 * ===================================================================== */

import { PUSH } from "./config.js";
import { savePushSubscription, removePushSubscription } from "./firebase-sync.js";
import { getPlayerId, ensurePlayerName } from "./identity.js";

/* Converte a chave VAPID (base64url) para o formato que o navegador quer. */
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((ch) => ch.charCodeAt(0)));
}

export function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/* Liga as notificações neste aparelho. */
export async function enablePush() {
  if (!pushSupported()) {
    alert("Este navegador não suporta notificações. No iPhone, adicione o app à tela inicial primeiro.");
    return false;
  }
  if (!PUSH.vapidPublicKey || PUSH.vapidPublicKey.startsWith("COLE")) {
    alert("Falta a chave VAPID pública em js/config.js (veja o README).");
    return false;
  }

  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    alert("Permissão negada. Você pode liberar nas configurações do site.");
    return false;
  }

  const name = ensurePlayerName();
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUSH.vapidPublicKey),
    });
  }
  await savePushSubscription(getPlayerId(), { sub: sub.toJSON(), name, at: Date.now() });
  localNotify("Notificações ligadas 🔔", "Você será avisado das crianças, do foguinho e dos recados.");
  return true;
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (sub) await sub.unsubscribe();
  await removePushSubscription(getPlayerId());
}

/* Aviso local (só funciona com o app aberto/recente; não custa nada). */
export function localNotify(title, body) {
  try {
    if (Notification.permission !== "granted") return;
    navigator.serviceWorker.ready.then((reg) =>
      reg.showNotification(title, {
        body,
        icon: "assets/icons/icon-192.png",
        badge: "assets/icons/icon-192.png",
        tag: "bebe-local",
      })
    );
  } catch (_) {}
}

/* Botão da interface. */
export async function initPushUI() {
  const btn = document.getElementById("push-btn");
  if (!btn) return;
  const refresh = async () => {
    const sub = await currentSubscription();
    const on = !!sub && Notification.permission === "granted";
    btn.textContent = on ? "🔔" : "🔕";
    btn.title = on ? "Notificações ligadas (toque para desligar)" : "Ligar notificações";
    btn.classList.toggle("on", on);
  };
  btn.addEventListener("click", async () => {
    const sub = await currentSubscription();
    if (sub && Notification.permission === "granted") await disablePush();
    else await enablePush();
    refresh();
  });
  refresh();
}
