/* =====================================================================
 * balance.js — ⚙️ PAINEL DE CONTROLE DO JOGO
 * ---------------------------------------------------------------------
 * TODOS os números ajustáveis do jogo estão AQUI, em um lugar só.
 * Mexer neste arquivo não quebra nada: os outros módulos leem daqui.
 *
 * O que NÃO fica aqui (de propósito):
 *   - chaves do Firebase / VAPID .......... js/config.js
 *   - lista de sprites e itens da loja .... js/assets-map.js (seu parser)
 *   - textos das perguntas do dever ....... js/homework.js
 *
 * Dica: para deixar o jogo mais "corrido", mexa em `status.decayPerHour`.
 * Para deixar mais fácil de comprar, mexa em `economy.priceMultiplier`.
 * ===================================================================== */

export const BALANCE = {

  /* ================= STATUS / NECESSIDADES ================= */
  status: {
    // Quanto cada barra cai por HORA (0–100). Maior = mais exigente.
    decayPerHour: { hunger: 20, sleep: 12, hygiene: 8, fun: 15, love: 10 },
    // Média abaixo disso = criança doente.
    sickThreshold: 20,
    // Abaixo disso a criança "demonstra" (sujeira, cara de sono/fome/carência).
    conditionThreshold: 35,
  },

  /* ================= CUIDADOS ================= */
  care: {
    // Quanto cada ação de botão recupera.
    actionGain: { feed: 35, sleep: 40, clean: 50 },
    // Diversão ganha ao terminar uma rodada de minigame.
    funPerMinigame: 30,
    // XP por pulso de cuidado contínuo (carinho, esfregar, ninar).
    xpPerCare: 2,
    // XP por ação pontual (servir comida pronta).
    xpPerAction: 12,
    // Carinho/banho: quanto de status por pixel deslizado.
    lovePerPixel: 0.05,
    hygienePerPixel: 0.06,
    // Sono ganho por "tique" com a luz apagada (a cada 1,5 s).
    sleepPerTick: 4,
  },

  /* ================= CRESCIMENTO ================= */
  growth: {
    // Fases e XP necessário. Dá pra acrescentar fases novas aqui
    // (precisa do sprite correspondente em ASSETS.baby).
    phases: [
      { id: "newborn",  name: "Recém-nascido",  xpNeeded: 0 },
      { id: "crawling", name: "Engatinhando",   xpNeeded: 600 },
      { id: "toddler",  name: "Criança",        xpNeeded: 2500 },
      { id: "child",    name: "Criança grande", xpNeeded: 6000 },
    ],
  },

  /* ================= ECONOMIA ================= */
  economy: {
    startingCoins: 50,
    adoptCost: 250,
    // Multiplica TODOS os preços da loja de uma vez (o preço base de cada
    // peça continua no assets-map.js, gerenciado pelo seu parser).
    // 1 = normal · 0.5 = tudo pela metade · 2 = tudo o dobro.
    priceMultiplier: 1,
  },

  /* ================= FADIGA (anti-farm) ================= */
  fatigue: {
    full: 10,          // as N primeiras vezes pagam cheio
    taper: 15,         // até aqui pagam metade
    resetMinutes: 10,  // sem repetir por N min, o contador zera
    hardFloor: 0.2,    // minigames difíceis nunca zeram de todo
  },

  /* ================= MINIGAMES ================= */
  // Recompensa é sempre POR PONTO (nunca por só abrir o jogo).
  // `minPhase` define em que idade libera E o multiplicador de valor.
  minigames: {
    flappy:   { minPhase: "newborn",  coinsPerPoint: 1,    xpPerPoint: 2,   hard: false },
    dino:     { minPhase: "crawling", coinsPerPoint: 0.013, xpPerPoint: 0.028, hard: false },
    fishing:  { minPhase: "crawling", coinsPerPoint: 1.5,  xpPerPoint: 2,   hard: false },
    circuit:  { minPhase: "toddler",  coinsPerPoint: 2.5,  xpPerPoint: 3.5, hard: true  },
    homework: { minPhase: "toddler",  coinsPerPoint: 1.25, xpPerPoint: 3,   hard: true  },
  },
  // Multiplicador por faixa etária (índice da fase mínima do jogo).
  tierMultiplier: [1, 1.5, 2, 2.6],

  /* ================= DEVER DE CASA ================= */
  homework: {
    lives: 3,
    timeStart: 14,     // segundos na 1ª questão
    timeMin: 6,        // não fica mais curto que isso
    timeStepEvery: 2,  // a cada N acertos, tira 1 segundo
    // A cada N acertos sobe um "nível de escolaridade" (até o ensino médio).
    levelEvery: 3,
  },

  /* ================= PESCARIA ================= */
  fishing: {
    netHeightPx: 74,        // altura da rede (menor = mais difícil)
    // Ligeireza derivada do VALOR do peixe: base + porPonto × pontos.
    velBase: 1.25, velPerPoint: 0.14,
    erraticBase: 0.03, erraticPerPoint: 0.006,
    fugaBase: 0.0036, fugaPerPoint: 0.00032,
    ganhoNaRede: 0.0055,    // quanto a barra enche com o peixe dentro
    esperaMinMs: 1400, esperaMaxMs: 5600,   // demora até morder
    janelaFisgadaMs: 1100,  // tempo para reagir ao "❗"
  },

  /* ================= COZINHA ================= */
  kitchen: {
    // Multiplicadores rápidos (os valores base ficam em recipes.js).
    foodPriceMultiplier: 1,
    cookXpMultiplier: 1,
    readyFoodXpMultiplier: 1,
    cookSpeed: 6,           // velocidade do marcador (maior = mais difícil)
  },

  /* ================= CLIMA ================= */
  weather: {
    changeMinutes: 25,
    stormChance: 0.10,
    rainChance: 0.28,
    coldChance: 0.15,
    coldThreshold: 16,      // °C: abaixo disso conta como frio
    coldCheckMinutes: 15,
  },

  /* ================= PESADELOS ================= */
  nightmares: {
    startHour: 22, endHour: 6,
    checkMinutes: 20,
    chance: 0.4,
    reward: { coins: 20, love: 35 },
  },

  /* ================= NOTIFICAÇÕES ================= */
  notify: {
    lowStatus: 25,
    repeatHours: 3,
    streakHour: 20,
  },
};
