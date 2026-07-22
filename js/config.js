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

  // XP por ação "pontual" (servir comida pronta).
  xpPerAction: 12,
  // XP por pulso de cuidado contínuo (carinho, esfregar no banho, ninar).
  // Vale pouco de propósito: o ganho vem de insistir no cuidado.
  xpPerCare: 2,

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

  /* --- FADIGA: evita farmar a mesma coisa na mesma criança ---
   * As primeiras `fatigueFull` vezes pagam cheio; até `fatigueTaper`
   * pagam metade; depois disso não pagam nada (minigames difíceis ainda
   * pagam `hardFloor`). O contador zera após `fatigueResetMinutes` sem
   * repetir aquela atividade. NÃO afeta o status (cuidar sempre cuida),
   * só a RECOMPENSA de XP e moedas. */
  fatigueFull: 10,
  fatigueTaper: 15,
  fatigueResetMinutes: 10,
  hardFloor: 0.2,

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

/* -------- MINIGAMES: recompensa POR PONTO (nada por só dar play) -----
 * `minPhase` também define a "dificuldade": jogos liberados em idades
 * mais avançadas pagam mais (multiplicador por faixa etária).
 * `hard: true` = continua pagando um pouquinho mesmo com fadiga alta. */
export const MINIGAMES = {
  flappy:  { minPhase: "newborn",  coinsPerPoint: 1,    xpPerPoint: 2,   hard: false },
  // dino: a pontuação é distância, então cresce MUITO rápido (≈1500 em 30s).
  // Taxas baixas de propósito: ~30 moedas / ~65 XP numa corrida de 30s.
  dino:    { minPhase: "crawling", coinsPerPoint: 0.013, xpPerPoint: 0.028, hard: false },
  circuit:  { minPhase: "toddler",  coinsPerPoint: 12,   xpPerPoint: 15,  hard: true  },
  // dever de casa: 1 ponto por acerto; difícil de emendar muitos acertos
  homework: { minPhase: "toddler",  coinsPerPoint: 2.5,  xpPerPoint: 6,   hard: true  },
  // pescaria: pontos variam com a raridade do peixe
  fishing:  { minPhase: "crawling", coinsPerPoint: 3,    xpPerPoint: 4,   hard: false },
};

/* Multiplicador por faixa etária do minigame (índice da fase mínima). */
export const TIER_MULTIPLIER = [1, 1.5, 2, 2.6];
