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
    decayPerHour: { hunger: 20, sleep: 7, hygiene: 8, fun: 15, love: 10 },

    /* Jogar CANSA: cada rodada de minigame consome estes pontos. Sono,
     * fome e higiene caem bem mais rápido quando a criança está jogando. */
    minigameDrain: { sleep: 9, hunger: 7, hygiene: 5 },

    /* Portas de bem-estar: abaixo destes valores a criança recusa.
     *   - sem higiene E sem barriga cheia, não quer dormir;
     *   - sem barriga cheia E sem sono, não quer brincar. */
    minParaDormir:  { hygiene: 25, hunger: 25 },
    minParaBrincar: { hunger: 20, sleep: 20 },
    // Média abaixo disso = criança doente.
    sickThreshold: 20,
    // Abaixo disso a criança "demonstra" (sujeira, cara de sono/fome/carência).
    conditionThreshold: 35,
  },

  /* ================= CUIDADOS ================= */
  care: {
    // Remédio: cura resfriado na hora (e dá uma ajudinha no ânimo).
    remedioCusto: 140,      // caro, mas 1 por dia e cura MUITO na hora
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
    // Baixou de 4 para 1,6: encher o sono agora leva bem mais tempo.
    sleepPerTick: 0.0625,       // 100 pontos ≈ 40 min de luz apagada
    /* Dormir CONTINUA com o app fechado: ao voltar, o tempo em que a
     * criança ficou no escuro é convertido nesta taxa por hora. */
    sleepPerHourDormindo: 150,  // 100 pontos ≈ 40 min dormindo (app fechado)
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
    g2048:      { minPhase: "toddler",  coinsPerPoint: 0.32,  xpPerPoint: 2.20, hard: true  },   // 4x do original
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
    moedaMin: 170, moedaMax: 320,   // bem mais moedas pelo caminho
  },

  /* ================= SAÚDE ================= */
  health: {
    // limiares (com histerese: adoece cedo, mas só sara bem melhor)
    doenteAbaixo: 35,
    saraAcima: 55,

    // pesos do cálculo por HORA (ver state.ajustarSaude)
    pesoHigiene: 3.5,       // higiene é o que mais pesa
    pesoSaciedade: 3.0,
    pesoMedia: 2.0,
    bonusTempoBom: 1.0,     // temperatura agradável
    penalidadeFrio: 3.0,    // frio derruba

    // doces: até este número por dia não faz mal
    docesSemPenalidade: 3,
    penalidadePorDoce: 2.5,

    // efeitos de estar DOENTE (por hora)
    doenteLovePorHora: 6,
    doenteFunPorHora: 8,

    // remédio: 15% mais caro e SÓ UM por dia
    remedioCura: 45,        /* Referência de mercado: a Vitamina dá 10 ❤️ por
                             * 48 🪙 (0,21 ❤️/moeda). O remédio dá 45 ❤️ por
                             * 140 🪙 (0,32 ❤️/moeda) E cura resfriado na
                             * hora — melhor por moeda, mas só 1 por dia. */
  },

  /* ================= FLAPPY BABY ================= */
  flappy: {
    /* A distância HORIZONTAL entre os canos é sorteada como uma fração
     * da ALTURA DO VÃO: entre 0,8× e 1,0×. Canos mais juntos = mais
     * difícil, e a dificuldade acompanha o tamanho do vão. */
    espacoMin: 0.8,
    espacoMax: 1.0,
  },

  /* ================= SKY JUMP ================= */
  skyjump: {
    /* Números tirados do comportamento do Pou (tela de referência 460 px):
     *   - o pulo sobe 40% da altura da tela
     *   - ida + volta levam ~1,2 s (0,6 s subindo)
     *   => g = 0,40·H / (t²/2)  e  impulso = g·t                       */
    gravidade: 0.284,
    forcaPulo: 10.22,
    // vãos com folga dentro dos 40% do pulo (o maior fica em ~34% da tela)
    vaoMin: 78,
    vaoMax: 150,
    larguraPlataforma: 1 / 6,   // fração da LARGURA da tela
    plataformas: 6,
    chanceMoeda: 0.28,
    chanceQuebra: 0.28,

    /* ---- CONTROLE POR INCLINAÇÃO (só ele; o toque continua igual) ----
     * A inclinação dá VELOCIDADE, não aceleração: vx alvo = (ângulo /
     * ângulo máximo) · velMaxH. Não existe atrito. A única "inércia" é
     * um amortecedor levíssimo que impede o degrau seco — ao voltar ao
     * centro o boneco simplesmente para de andar. */
    filtroInclinacao: 0.5,      // passa-baixa mínimo (contra tremor)
    saltoInclinacao: 3,         // virada ≥3° passa direto
    zonaMortaGraus: 3,
    grausMax: 24,
    velMaxH: 6.0,               // velocidade no ângulo máximo
    curvaAngulo: 1.6,           // resposta fina perto do centro
    /* Movimento: velocidade suavizada, com aceleração PROPORCIONAL ao
     * que falta (a = k·(alvo − vx)) — nunca um teto fixo. É o que torna
     * o deslocamento simétrico no tempo: inverter o giro traz o boneco
     * de volta pelo mesmo caminho. */
    suavizacao: 0.3,            // k do amortecimento (maior = freia mais seco)
    linhaCamera: 0.48,          // a câmera sobe quando ele passa dos 48%
    /* toque e teclado (inalterados) */
    acelToque: 0.0011,
    acelSeta: 0.20,
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
    foodPriceMultiplier: 3.2,   // comida e ingredientes bem mais caros
    ingredientePremiumDesconto: 0.7,  // mel/chocolate/frango não podem inviabilizar a receita
    cookXpMultiplier: 1.4,      // cozinhar rende MAIS que comprar pronto
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
