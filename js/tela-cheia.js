/* =====================================================================
 * tela-cheia.js — "DEITAR A TELA" nos jogos largos
 * ---------------------------------------------------------------------
 * Dino e Hill Drive são bem mais largos que altos: no celular em pé eles
 * ficam pequenininhos. Aqui entra um botão que põe o jogo em tela cheia
 * e pede para o celular deitar.
 *
 * Uso a API nativa (fullscreen + orientação) DE PROPÓSITO, em vez de
 * girar por CSS: girar com `transform` bagunçaria o toque, porque os
 * jogos convertem a posição do dedo usando getBoundingClientRect(), que
 * enxerga a caixa já girada. Com a API nativa quem gira é o navegador e
 * as coordenadas continuam certinhas.
 *
 * Onde travar a orientação não é permitido (iPhone), o jogo ainda entra
 * em tela cheia e basta o usuário virar o aparelho.
 * ===================================================================== */

export function initDeitar(screenId) {
  const tela = document.getElementById(screenId);
  if (!tela) return;
  const wrap = tela.querySelector(".mini-wrap");
  if (!wrap) return;

  const btn = document.createElement("button");
  btn.className = "btn-deitar";
  btn.type = "button";
  btn.textContent = "⛶ Deitar tela";
  btn.title = "Jogar em tela cheia, deitado";

  const alvo = wrap.parentElement || wrap;
  alvo.insertBefore(btn, wrap);

  const emTelaCheia = () => document.fullscreenElement === wrap ||
                            document.webkitFullscreenElement === wrap;

  async function deitar() {
    try {
      if (wrap.requestFullscreen) await wrap.requestFullscreen({ navigationUI: "hide" });
      else if (wrap.webkitRequestFullscreen) wrap.webkitRequestFullscreen();
    } catch (_) { /* alguns navegadores recusam: segue sem tela cheia */ }

    try {
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock("landscape");
      }
    } catch (_) {
      // iPhone não deixa travar: o usuário vira o aparelho na mão
    }
  }

  async function levantar() {
    try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (_) {}
    try { if (document.exitFullscreen) await document.exitFullscreen(); } catch (_) {}
  }

  btn.addEventListener("click", () => (emTelaCheia() ? levantar() : deitar()));

  document.addEventListener("fullscreenchange", () => {
    const on = emTelaCheia();
    wrap.classList.toggle("deitado", on);
    btn.textContent = on ? "⤫ Voltar" : "⛶ Deitar tela";
  });
}
