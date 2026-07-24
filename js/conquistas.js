/* =====================================================================
 * conquistas.js — CONQUISTAS DA CASA
 * ---------------------------------------------------------------------
 * As conquistas são da CASA (compartilhadas entre os dois jogadores) e
 * ficam em `room.conquistas = { id: true }`.
 *
 * O prêmio é sempre um MÚLTIPLO DE 50 🪙, proporcional à dificuldade:
 * um nível fácil paga 50, o seguinte 100, e assim por diante.
 *
 * As de NÍVEL são geradas em série a partir de um alvo base: "x pontos",
 * "2x", "3x"… — cada degrau vale um múltiplo a mais.
 * ===================================================================== */

import { MINIGAMES } from "./config.js";

const PREMIO = 50;

/* Gera a série de níveis de uma conquista.
 *   base   : o alvo do nível 1
 *   niveis : quantos degraus
 *   passo  : multiplicador do alvo por degrau (padrão: 1x, 2x, 3x…) */
function serie({ id, titulo, emoji, base, niveis = 4, medir, unidade = "" }) {
  const out = [];
  for (let n = 1; n <= niveis; n++) {
    const alvo = base * n;
    out.push({
      id: `${id}_${n}`,
      titulo: `${titulo} ${alvo}${unidade}`,
      emoji,
      alvo,
      nivel: n,
      premio: PREMIO * n,          // 50, 100, 150, 200…
      medir,
    });
  }
  return out;
}

/* ---- medidores: leem o estado da casa e devolvem um número ---- */
const M = {
  recordeDe: (jogo) => (st) => ((st.records || {})[jogo] || 0),
  receitas:  (st) => Object.keys(st.recipes || {}).length,
  especies:  (st) => Object.keys(st.fishlog || {}).filter((k) => (st.fishlog[k] || 0) > 0).length,
  peixes:    (st) => Object.values(st.fishlog || {}).reduce((t, n) => t + (n || 0), 0),
  peixeDe:   (nome) => (st) => ((st.fishlog || {})[nome] || 0),
  moedas:    (st) => st.coins || 0,
  sequencia: (st) => (st.streak && st.streak.melhor) || 0,
  crianca: (chave) => (st) => Math.max(0,
    ...Object.values(st.babies || {}).map((b) => b[chave] || 0)),
};

/* ---- catálogo ---- */
export const CONQUISTAS = [
  /* pontuação nos minigames (uma série por jogo, com alvo próprio) */
  ...serie({ id: "flappy", titulo: "Flappy Baby:", emoji: "🐤", base: 10, medir: M.recordeDe("flappy"), unidade: " pts" }),
  ...serie({ id: "dino",   titulo: "Corrida:",     emoji: "🦖", base: 300, medir: M.recordeDe("dino"), unidade: " m" }),
  ...serie({ id: "skyjump",titulo: "Sky Jump:",    emoji: "☁️", base: 300, medir: M.recordeDe("skyjump"), unidade: " m" }),
  ...serie({ id: "hill",   titulo: "Hill Drive:",  emoji: "🚙", base: 400, medir: M.recordeDe("hilldrive"), unidade: " m" }),
  ...serie({ id: "match3", titulo: "Match 3:",     emoji: "🍬", base: 600, medir: M.recordeDe("match3"), unidade: " pts" }),
  ...serie({ id: "g2048",  titulo: "2048:",        emoji: "🔢", base: 1000, medir: M.recordeDe("g2048"), unidade: " pts" }),
  ...serie({ id: "sp",     titulo: "Star Popper:", emoji: "⭐", base: 40, medir: M.recordeDe("starpopper"), unidade: " pts" }),

  /* cozinha */
  ...serie({ id: "receitas", titulo: "Descubra", emoji: "📔", base: 4, niveis: 5, medir: M.receitas, unidade: " receitas" }),

  /* pescaria */
  ...serie({ id: "especies", titulo: "Conheça", emoji: "🐟", base: 2, niveis: 4, medir: M.especies, unidade: " espécies" }),
  ...serie({ id: "peixes",   titulo: "Pesque",  emoji: "🎣", base: 15, niveis: 4, medir: M.peixes, unidade: " peixes" }),
  ...serie({ id: "pirarucu", titulo: "Pesque",  emoji: "🐋", base: 1, niveis: 3, medir: M.peixeDe("Pirarucu"), unidade: " Pirarucu" }),
  ...serie({ id: "dourado",  titulo: "Pesque",  emoji: "🐡", base: 3, niveis: 3, medir: M.peixeDe("Dourado"), unidade: " Dourado" }),

  /* casa e cuidado */
  ...serie({ id: "moedas",  titulo: "Junte", emoji: "🪙", base: 500, niveis: 4, medir: M.moedas, unidade: " 🪙" }),
  ...serie({ id: "streak",  titulo: "Cuide por", emoji: "🔥", base: 3, niveis: 4, medir: M.sequencia, unidade: " dias seguidos" }),
  ...serie({ id: "xp",      titulo: "Chegue a", emoji: "⭐", base: 500, niveis: 5, medir: M.crianca("xp"), unidade: " XP" }),
];

/* Progresso de uma conquista: 0..1 */
export function progresso(c, estado) {
  const v = c.medir(estado || {});
  return Math.max(0, Math.min(1, v / c.alvo));
}
export function valorAtual(c, estado) {
  return c.medir(estado || {});
}

/* Quais conquistas ACABARAM de ser completadas (ainda não marcadas). */
export function novasConquistas(estado) {
  const feitas = (estado && estado.conquistas) || {};
  return CONQUISTAS.filter((c) => !feitas[c.id] && valorAtual(c, estado) >= c.alvo);
}

export const TOTAL_PREMIO = CONQUISTAS.reduce((t, c) => t + c.premio, 0);
