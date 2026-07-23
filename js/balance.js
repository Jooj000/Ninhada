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
    // Remédio: cura resfriado na hora (e dá uma ajudinha no ânimo).
    remedioCusto: 25,
    remedioLove: 10,
    remedioXp: 15,
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
    // PONTOS pagam POUCO de propósito: quem paga bem são as MOEDAS
    // COLETÁVEIS dentro dos jogos (🪙 pegas valem 1:1, sem desconto).
    // Partida média ≈ 3-6 moedas de pontos + o que você coletar.
    flappy:     { minPhase: "newborn",  coinsPerPoint: 0.15,  xpPerPoint: 2,    hard: false },
    dino:       { minPhase: "crawling", coinsPerPoint: 0.004, xpPerPoint: 0.025, hard: false },
    fishing:    { minPhase: "crawling", coinsPerPoint: 0.4,   xpPerPoint: 2.6,  hard: false },
    circuit:    { minPhase: "toddler",  coinsPerPoint: 1,     xpPerPoint: 3.5,  hard: false },
    homework:   { minPhase: "toddler",  coinsPerPoint: 0.5,   xpPerPoint: 3,    hard: true  },
    // ----- pack arcade -----
    fooddrop:   { minPhase: "newborn",  coinsPerPoint: 0.2,   xpPerPoint: 1.6,  hard: false },
    memory:     { minPhase: "crawling", coinsPerPoint: 0.2,   xpPerPoint: 1.1,  hard: false },
    colormatch: { minPhase: "crawling", coinsPerPoint: 0.3,   xpPerPoint: 1.8,  hard: false },
    g2048:      { minPhase: "toddler",  coinsPerPoint: 0.08,  xpPerPoint: 0.55, hard: true  },
    match3:     { minPhase: "crawling", coinsPerPoint: 0.3,   xpPerPoint: 2,    hard: false },
    starpopper: { minPhase: "crawling", coinsPerPoint: 0.06,  xpPerPoint: 0.5,  hard: false },
    // ----- arcades do Pou -----
    // sky jump: pontos = metros/100; as 🪙 pegas entram por fora, 1:1
    skyjump:    { minPhase: "crawling", coinsPerPoint: 0.3,   xpPerPoint: 3,    hard: false },
    hilldrive:  { minPhase: "crawling", coinsPerPoint: 0.002, xpPerPoint: 0.012, hard: false },
    goal:       { minPhase: "toddler",  coinsPerPoint: 0.25,  xpPerPoint: 1.6,  hard: false },
    connect:    { minPhase: "toddler",  coinsPerPoint: 1.5,   xpPerPoint: 7,    hard: true  },
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
    // BAÚ: aparece num ponto aleatório durante a luta; encoste a rede
    // nele (sem deixar a barra zerar!) para ganhar moedas na hora.
    bauChance: 0.55,        // chance de UM baú aparecer por peixe
    bauDuracaoMs: 4500,     // quanto tempo ele fica na água
    bauCoins: 5,            // moedas pagas direto (1:1, sem fadiga)
    bauSegurarMs: 500,      // tempo com a rede em cima para abrir
  },

  /* ================= HILL DRIVE ================= */
  hilldrive: {
    // CARRO LEVE: gravidade baixa = qualquer crista em velocidade vira
    // voo de verdade. E TOPO PESADO: a criança sentada em cima fica
    // ACIMA do eixo das rodas, então no ar o peso dela faz o carro girar
    // sozinho — quem não corrigir com os pedais, capota.
    gravidade: 0.24,           // mais LEVE: sai do chão fácil
    motor: 0.30,            // força de aceleração
    freio: 0.34,            // força da ré/freio
    atritoSolo: 0.988,      // quanto o carro perde de velocidade sozinho
    velMax: 10.5,
    velMinRe: -3.2,
    // Rotação no ar: acelerar empina, frear abaixa o nariz.
    torqueAr: 0.030,           // FORÇA para empinar/corrigir no ar
    atritoAngular: 0.996,   // o giro quase não amortece sozinho
    giroCrista: 0.5,        // ao decolar, herda o giro que a rampa impôs
    topoPesado: 0.0055,     // desequilíbrio do peso alto (o que faz capotar)
    alongarCorpo: 1.3,      // carroceria mais COMPRIDA (só na horizontal)
    torqueSolo: 1.2,        // no chão o motor já empina (~23° de cavalinho)
    // Só perde quando a CABEÇA da criança encosta no chão (como no
    // Hill Climb Racing). Inclinar o carro por si só não derruba.
    // Altura da cabeça MEDIDA A PARTIR DO CHÃO (fração do tamanho do carro).
    // A cabeça gira em volta do ponto onde as rodas tocam o solo, então
    // tombar além de ~85° é o que encosta a cabeça.
    alturaCabeca: 0.78,
    tamanhoCarro: 46,
    moedaMin: 450, moedaMax: 800,   // moedas bem mais espaçadas
  },

  /* ================= SKY JUMP ================= */
  skyjump: {
    gravidade: 0.42,
    forcaPulo: 11.4,
    // Altura máxima que o pulo alcança = forcaPulo² / (2 × gravidade) ≈ 155 px.
    // O vão MÁXIMO fica um tiquinho abaixo disso, senão vira impossível.
    vaoMin: 70,
    vaoMax: 139,
    plataformas: 6,
    chanceMoeda: 0.28,
    chanceQuebra: 0.28,
    /* ---- CONTROLE HORIZONTAL: MASSA e INÉRCIA (como no Pou) ----
     * O celular NÃO é um joystick analógico: a inclinação não define a
     * velocidade, ela gera ACELERAÇÃO. O fluxo é
     *   inclinação -> filtro -> zona morta -> aceleração -> velocidade
     *   -> atrito -> posição
     * Resultado: o boneco DEMORA a ganhar velocidade, CONTINUA deslizando
     * quando o celular volta ao centro e para aos poucos. */
    /* O amortecimento estava EMPILHADO: filtro lento + zona morta larga
     * + curva quadrática + atrito, tudo somando atraso ANTES de o boneco
     * sair do lugar. Agora o freio vem só DEPOIS do movimento começar
     * (inércia + atrito), como no Doodle Jump/Pou. */
    filtroInclinacao: 0.45,     // passa-baixa: ganho MÍNIMO (só contra tremor)
    saltoInclinacao: 4,         // virada ≥4° é "de propósito" e passa na hora
    zonaMortaGraus: 3,          // só o bastante p/ o boneco não vibrar parado
    grausMax: 24,               // leitura do sensor satura aqui
    /* Calibrados para a velocidade terminal NATURAL (aceleração ÷ atrito)
     * já dar ~velMaxH: o teto quase nunca é acionado, então o movimento
     * é físico e não "no limite do joystick". Com estes números:
     *   10° de inclinação  -> já sai do lugar em ~0,2 s (era >1 s)
     *   a força é PROPORCIONAL ao ângulo (linear), sem ponto morto largo
     *   nivelou o aparelho -> desliza ~135 px por ~1,4 s: o "peso" está
     *   na INÉRCIA depois de andar, não numa demora para começar
     * Ainda é massa com inércia, mas responde dentro do arco de UM pulo
     * — antes demorava mais que o pulo inteiro e parecia travado. */
    /* A aceleração NÃO é linear com o ângulo: segue uma curva
     * (t^curvaInclinacao), com t indo de 0 na borda da zona morta a 1 na
     * inclinação máxima. Assim inclinar pouco quase não acelera e o
     * ajuste fino fica fácil; a força total só vem no ângulo cheio. */
    curvaInclinacao: 1,         // LINEAR: inclinou pouco, já responde na hora
    acelMax: 0.30,              // aceleração no ÂNGULO MÁXIMO
    atritoH: 0.955,             // por frame: desacelera devagar ao nivelar
    velMaxH: 6.5,               // ÚNICO teto: a velocidade (nunca a aceleração)
    acelToque: 0.0011,          // arrastar: aceleração rumo ao dedo (por px)
    acelSeta: 0.20,             // setas do teclado: aceleração constante
  },

  /* ================= MATCH 3 ================= */
  match3: {
    chanceMoeda: 0.07,      // chance de uma peça nova nascer com 🪙
  },

  /* ================= STAR POPPER ================= */
  starpopper: {
    coresIniciais: 2,        // rodada 1 começa com 2 cores (+1 por rodada limpa)
    bolhasIniciais: 22,      // massa no INÍCIO de cada rodada (antes: 8)
    bolhasIniciaisExtra: 4,  // +N a cada rodada vencida
    cresceSegundos: 35,      // tempo entre as ONDAS de crescimento
    bolhasPorOnda: 5,        // quantas bolhas vêm de uma vez
    bolhasPorOndaExtra: 1,   // +N a cada rodada vencida
    // O torque do impacto é normalizado (÷1000) antes de multiplicar por
    // este número, então ele é legível: 0.115 dá ~120 graus/s num tiro bom.
    torque: 0.115,
    atrito: 0.9903,          // calculado para PARAR sozinho em ~10 s
    giroMax: 0.075,          // teto (~430 graus/s)
    pisoGiro: 0.0001,        // abaixo disso considera parado
    penalidade: 5,           // pontos perdidos ao errar o tiro
    mostrarProxima: true,    // mostrar a próxima bolha no canhão
    chanceMoeda: 0.10,       // chance de uma bolha nova vir com moedinha
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
