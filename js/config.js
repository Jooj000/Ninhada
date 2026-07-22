/* =====================================================================
 * config.js  —  CONFIGURAÇÃO DO FIREBASE + DO JOGO
 * ---------------------------------------------------------------------
 * COLE AQUI o objeto que o console do Firebase te dá em:
 *   Configurações do Projeto → Seus apps → App da Web → firebaseConfig
 * (o passo a passo completo está no README.md)
 * ===================================================================== */

export const firebaseConfig = {
  apiKey: "AIzaSyA0tFr-fZmVNXeLF8x9lbfORVhUtmknRFs",
  authDomain: "ninhada-bf659.firebaseapp.com",
  databaseURL: "https://ninhada-bf659-default-rtdb.firebaseio.com/",
  projectId: "ninhada-bf659",
  storageBucket: "ninhada-bf659.firebasestorage.app",
  messagingSenderId: "167652549564",
  appId: "1:167652549564:web:a5c8abdbf30e40fdc501b9",
  measurementId: "G-PLN1CCL24S",
};

/* "Quarto" único no banco onde os dois jogadores se encontram. */
export const ROOM_ID = "nosso-bebe";

/* Nome do cômodo mostrado no topo da tela principal (é uma casa; troque
 * conforme for criando outros cômodos: Cozinha, Banheiro, Quarto…). */
export const ROOM_NAME = "Sala";

/* -------- Regras de balanceamento do jogo (mexa à vontade) -------- */
export const GAME_CONFIG = {
  // Quanto cada status cai por HORA (0–100). Ajuste para o jogo ficar
  // mais tranquilo (valores menores) ou mais exigente (maiores).
  decayPerHour: {
    hunger:  20,  // fome sobe = barrinha de "saciedade" desce
    sleep:   12,
    hygiene: 8,
    fun:     15,
    love:    10,
  },

  // Quanto cada ação de BOTÃO recupera. Diversão vem dos minigames e
  // Afeto vem do toque (cabeça/corpo/cócegas), então não ficam aqui.
  actionGain: {
    feed:  35,  // -> hunger
    sleep: 40,  // -> sleep
    clean: 50,  // -> hygiene
  },

  // Diversão ganha ao terminar uma rodada de minigame COM aquele bebê.
  funPerMinigame: 30,

  // XP ganho por ação de cuidado.
  xpPerAction: 5,

  // Bebê fica "doente" se a MÉDIA dos status cair abaixo disso.
  sickThreshold: 20,

  // Moedas de início.
  startingCoins: 50,

  // Custo (em moedas) para adotar/desbloquear um novo bebê.
  adoptCost: 250,

  // Clima: abaixo desta temperatura (°C) conta como "frio".
  coldThreshold: 16,
  // De quanto em quanto tempo o risco de resfriado é reavaliado (min).
  coldCheckMinutes: 15,

  // Pesadelos noturnos: só acontecem "de madrugada" (entre estas horas).
  // Dica p/ testar de dia: ponha nightStartHour na hora atual.
  nightStartHour: 22,   // 22h
  nightEndHour:   6,    // até 6h
  nightmareCheckMinutes: 20,
  nightmareChance: 0.4,           // chance por checagem durante a noite
  nightmareReward: { coins: 20, love: 35 },  // p/ quem acode primeiro
};

/* -------- Notificações (Web Push, 100% grátis) --------
 * Gere o par de chaves uma vez com:  npx web-push generate-vapid-keys
 * A PÚBLICA vai aqui; a PRIVADA fica só no notificador (server/.env).
 * Sem a chave, o app funciona normal — só não envia push. */
export const PUSH = {
  vapidPublicKey: "BJFpt5fM_kAGqxYrkqdcvifVKCRE9k_zt7esf_VSLJV3Ih34T3oRQCYX4rqbVwMRHzFoQjE1F_pR_ybcXTBiUxo",
};

/* Quando avisar (usado pelo notificador e pelos avisos locais). */
export const NOTIFY = {
  lowStatus: 25,          // status abaixo disso = "precisa de cuidado"
  repeatHours: 3,         // não repete o mesmo aviso antes disso
  streakHour: 20,         // a partir de 20h avisa se o foguinho não foi feito
};

/* -------- Clima simulado DENTRO do jogo (sem API) --------
 * O tempo muda sozinho e é determinístico pelo relógio, então os dois
 * celulares sempre veem o mesmo clima. Mexa nas chances à vontade. */
export const WEATHER = {
  changeMinutes: 25,   // de quanto em quanto tempo o clima muda
  stormChance:   0.10, // tempestade (chove + relâmpago)
  rainChance:    0.28, // chuva
  coldChance:    0.15, // friagem (neve leve)
  // o resto do tempo alterna entre nublado e céu limpo
};
