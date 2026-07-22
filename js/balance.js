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
    // Bônus ao BATER O RECORDE de um minigame (pago fora da fadiga:
    // é conquista, não farm — e o recorde vai ficando mais difícil).
    recordBonus: { coins: 20, xp: 40 },
  },

  /* ================= FADIGA (anti-farm) ================= */
  fatigue: {
    full: 10,          // as N primeiras vezes pagam cheio
    taper: 15,         // até aqui pagam metade
    resetMinutes: 5,  // sem repetir por N min, o contador zera
    hardFloor: 0.2,    // minigames difíceis nunca zeram de todo
  },

  /* ================= MINIGAMES ================= */
  // Recompensa é sempre POR PONTO (nunca por só abrir o jogo).
  // `minPhase` define em que idade libera E o multiplicador de valor.
  minigames: {
    // Alvo de equilíbrio (como no Pou): partida MÉDIA ≈ 15 moedas,
    // partida BOA ≈ 30, partida muito sortuda ≈ 60. Nunca mais que isso.
    flappy:     { minPhase: "newborn",  coinsPerPoint: 1,     xpPerPoint: 2,    hard: false },
    dino:       { minPhase: "crawling", coinsPerPoint: 0.010, xpPerPoint: 0.025, hard: false },
    fishing:    { minPhase: "crawling", coinsPerPoint: 2,     xpPerPoint: 2.6,  hard: false },
    circuit:    { minPhase: "toddler",  coinsPerPoint: 2.5,   xpPerPoint: 3.5,  hard: false },
    homework:   { minPhase: "toddler",  coinsPerPoint: 1.25,  xpPerPoint: 3,    hard: true  },
    // ----- pack arcade -----
    fooddrop:   { minPhase: "newborn",  coinsPerPoint: 0.8,   xpPerPoint: 1.6,  hard: false },
    memory:     { minPhase: "crawling", coinsPerPoint: 0.55,  xpPerPoint: 1.1,  hard: false },
    colormatch: { minPhase: "crawling", coinsPerPoint: 1,     xpPerPoint: 1.8,  hard: false },
    g2048:      { minPhase: "toddler",  coinsPerPoint: 0.25,  xpPerPoint: 0.55, hard: true  },
    match3:     { minPhase: "crawling", coinsPerPoint: 1.2,   xpPerPoint: 2,    hard: false },
    starpopper: { minPhase: "crawling", coinsPerPoint: 0.22,  xpPerPoint: 0.5,  hard: false },
    // sky jump: 1 ponto = 1 moeda pega OU 100 m subidos
    skyjump:    { minPhase: "crawling", coinsPerPoint: 1,     xpPerPoint: 3,    hard: false },
  },
  // Multiplicador por faixa etária (índice da fase mínima do jogo).
  tierMultiplier: [1, 1.5, 2, 2.6],

  /* ================= DEVER DE CASA ================= */
  homework: {
    lives: 3,
    timeStart: 10,     // segundos na 1ª questão
    timeMin: 5,        // não fica mais curto que isso
    timeStepEvery: 2,  // a cada N acertos, tira 1 segundo
    // A cada N acertos sobe um "nível de escolaridade" (até o ensino médio).
    levelEvery: 3,
  },

  /* ================= PESCARIA ================= */
  fishing: {
    netHeightPx: 70,        // altura da rede (menor = mais difícil)
    // Ligeireza derivada do VALOR do peixe: base + porPonto × pontos.
    velBase: 1.3, velPerPoint: 0.14,
    erraticBase: 0.05, erraticPerPoint: 0.006,
    fugaBase: 0.004, fugaPerPoint: 0.00032,
    ganhoNaRede: 0.005,    // quanto a barra enche com o peixe dentro
    esperaMinMs: 1400, esperaMaxMs: 5600,   // demora até morder
    janelaFisgadaMs: 800,  // tempo para reagir ao "❗"
  },

  /* ================= COZINHA ================= */
  kitchen: {
    // Multiplicadores rápidos (os valores base ficam em recipes.js).
    foodPriceMultiplier: 1,
    cookXpMultiplier: 1,
    readyFoodXpMultiplier: 1,
    cookSpeed: 5,           // velocidade do marcador (maior = mais difícil)
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
