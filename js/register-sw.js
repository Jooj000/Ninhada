/* =====================================================================
 * register-sw.js — registra o Service Worker e recarrega ao atualizar
 * ===================================================================== */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").then((reg) => {
      // Verifica atualização quando o app volta ao foco.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") reg.update();
      });
    });

    // Quando um novo SW assume o controle, recarrega uma vez para
    // pegar o código novo. (evita loop com a flag abaixo)
    let refreshed = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshed) return;
      refreshed = true;
      window.location.reload();
    });
  });
}

/* (Opcional) botão "Instalar app" — o navegador dispara este evento
 * quando o PWA é instalável. Você pode plugar num botão se quiser. */
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  // Ex.: mostrar seu próprio botão e chamar deferredPrompt.prompt()
});
