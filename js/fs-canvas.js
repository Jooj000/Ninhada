/* =====================================================================
 * fs-canvas.js — CANVAS EM TELA CHEIA + CICLO DE VIDA DAS TELAS
 * ---------------------------------------------------------------------
 * Todos os minigames de canvas usam isto:
 *   - o canvas preenche a TELA INTEIRA (o jogo "é o jogo", como no Pou);
 *   - a resolução interna usa devicePixelRatio: nada de meia dúzia de
 *     pixels esticados — o desenho é nítido em qualquer celular;
 *   - as dimensões LÓGICAS (view.w / view.h) são os pixels CSS reais,
 *     então cada jogo se adapta ao tamanho/proporção da tela.
 *
 * Ciclo de vida (disparado pelo showScreen do game.js):
 *   "screen-shown" — a tela abriu: o jogo se ajusta e RECOMEÇA;
 *   "screen-left"  — a tela fechou: o jogo RESETA (sair = zerar).
 * ===================================================================== */

export function fullscreenCanvas(canvas, screenId) {
  const ctx = canvas.getContext("2d");
  const view = { w: 360, h: 640, dpr: 1, ctx, ready: false };

  function fit() {
    const host = canvas.parentElement || canvas;
    const r = host.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return false;   // tela ainda oculta
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const w = Math.round(r.width), h = Math.round(r.height);

    /* Se nada mudou, NÃO mexe em canvas.width/height: cada atribuição
     * realoca o buffer inteiro e limpa a tela. Tocar rápido para
     * recomeçar dispara vários reset() seguidos, e realocar em rajada
     * derrubava o FPS. */
    if (view.ready && w === view.w && h === view.h && dpr === view.dpr) return true;

    view.dpr = dpr; view.w = w; view.h = h;
    canvas.width = Math.round(view.w * view.dpr);
    canvas.height = Math.round(view.h * view.dpr);
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    view.ready = true;
    return true;
  }
  view.fit = fit;

  window.addEventListener("resize", () => {
    const tela = document.getElementById(screenId);
    if (tela && tela.classList.contains("active")) { fit(); view.onResize && view.onResize(); }
  });

  return view;
}

/* Registra o que fazer quando a tela abre/fecha. */
export function onScreenShown(screenId, fn) {
  document.addEventListener("screen-shown", (e) => { if (e.detail.id === screenId) fn(); });
}
export function onScreenLeft(screenId, fn) {
  document.addEventListener("screen-left", (e) => { if (e.detail.id === screenId) fn(); });
}

/* Chamado pela navegação: avisa a tela que saiu e a que entrou. */
export function announceScreenChange(leftId, shownId) {
  if (leftId && leftId !== shownId) {
    document.dispatchEvent(new CustomEvent("screen-left", { detail: { id: leftId } }));
  }
  if (shownId) {
    // pequeno atraso: a tela precisa estar visível para o canvas ter tamanho
    requestAnimationFrame(() => {
      document.dispatchEvent(new CustomEvent("screen-shown", { detail: { id: shownId } }));
    });
  }
}
