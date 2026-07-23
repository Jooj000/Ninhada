/* =====================================================================
 * circuit-solver.js — SIMULADOR DE CIRCUITOS DC (análise nodal)
 * ---------------------------------------------------------------------
 * Calcula TENSÃO em cada nó e CORRENTE em cada componente, de verdade.
 * Assim o jogo pode ensinar Lei de Ohm com números que batem com a
 * realidade (e com o que a criança mediria num multímetro).
 *
 * COMO FUNCIONA (Análise Nodal Modificada — MNA):
 *   Monta o sistema linear  A · x = z  onde
 *     x = [tensões dos nós ..., correntes das fontes de tensão ...]
 *   Resistor entre a e b: soma G = 1/R na matriz de condutâncias.
 *   Bateria: entra com uma linha/coluna extra (a corrente é incógnita).
 *   LED: não é linear, então uso o modelo por partes —
 *        desligado  -> resistência enorme (não passa corrente)
 *        ligado     -> queda fixa Vf em série com uma resistência pequena
 *        e itero algumas vezes até o estado parar de mudar.
 *
 * Unidades: volts (V), ohms (Ω), amperes (A). O jogo mostra em mA.
 * ===================================================================== */

/* Resolve A·x = z por eliminação de Gauss com pivoteamento parcial. */
export function resolverSistema(A, z) {
  const n = A.length;
  const M = A.map((linha, i) => [...linha, z[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-12) continue;            // coluna nula: ignora
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      if (!f) continue;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((linha, i) => (Math.abs(linha[i]) < 1e-12 ? 0 : linha[n] / linha[i]));
}

/* Componentes aceitos:
 *   { tipo:"bateria",  a, b, volts }
 *   { tipo:"resistor", a, b, ohms }
 *   { tipo:"led",      a, b, vf, imax }      (a = ânodo/+, b = cátodo/−)
 *   { tipo:"fio",      a, b }                (resistência desprezível)
 *   { tipo:"chave",    a, b, fechada }
 * `nos` é a lista de nomes de nós. O nó "GND" é a referência (0 V).
 */
export function simular(nos, componentes) {
  const idx = new Map();
  let n = 0;
  for (const no of nos) if (no !== "GND") idx.set(no, n++);
  const baterias = componentes.filter((c) => c.tipo === "bateria");
  const N = n + baterias.length;

  const R_FIO = 1e-3, R_ABERTO = 1e12, R_LED_ON = 12;
  const ligado = componentes.map((c) => c.tipo === "led");   // chute inicial: LEDs on

  let V = null, correntes = null;

  for (let iter = 0; iter < 24; iter++) {
    const A = Array.from({ length: N }, () => new Array(N).fill(0));
    const z = new Array(N).fill(0);

    const stampG = (a, b, G) => {
      const ia = idx.has(a) ? idx.get(a) : -1;
      const ib = idx.has(b) ? idx.get(b) : -1;
      if (ia >= 0) A[ia][ia] += G;
      if (ib >= 0) A[ib][ib] += G;
      if (ia >= 0 && ib >= 0) { A[ia][ib] -= G; A[ib][ia] -= G; }
    };
    const stampI = (a, b, I) => {          // fonte de corrente de a para b
      const ia = idx.has(a) ? idx.get(a) : -1;
      const ib = idx.has(b) ? idx.get(b) : -1;
      if (ia >= 0) z[ia] -= I;
      if (ib >= 0) z[ib] += I;
    };

    componentes.forEach((c, i) => {
      if (c.tipo === "resistor") stampG(c.a, c.b, 1 / Math.max(1e-6, c.ohms));
      else if (c.tipo === "fio") stampG(c.a, c.b, 1 / R_FIO);
      else if (c.tipo === "chave") stampG(c.a, c.b, c.fechada ? 1 / R_FIO : 1 / R_ABERTO);
      else if (c.tipo === "led") {
        if (ligado[i]) {
          const G = 1 / R_LED_ON;
          stampG(c.a, c.b, G);
          stampI(c.a, c.b, -(c.vf ?? 2) * G);   // desloca a curva em Vf
        } else stampG(c.a, c.b, 1 / R_ABERTO);
      }
    });

    baterias.forEach((b, k) => {
      const linha = n + k;
      const ia = idx.has(b.a) ? idx.get(b.a) : -1;
      const ib = idx.has(b.b) ? idx.get(b.b) : -1;
      if (ia >= 0) { A[ia][linha] += 1; A[linha][ia] += 1; }
      if (ib >= 0) { A[ib][linha] -= 1; A[linha][ib] -= 1; }
      z[linha] = b.volts;
    });

    const x = resolverSistema(A, z);
    V = {};
    for (const no of nos) V[no] = no === "GND" ? 0 : (x[idx.get(no)] || 0);

    // reavalia os LEDs: acende quem tem tensão suficiente
    let mudou = false;
    componentes.forEach((c, i) => {
      if (c.tipo !== "led") return;
      const v = V[c.a] - V[c.b];
      const deveria = ligado[i] ? v > (c.vf ?? 2) * 0.92 : v > (c.vf ?? 2);
      if (deveria !== ligado[i]) { ligado[i] = deveria; mudou = true; }
    });

    correntes = componentes.map((c, i) => {
      const v = V[c.a] - V[c.b];
      if (c.tipo === "resistor") return v / Math.max(1e-6, c.ohms);
      if (c.tipo === "fio") return v / R_FIO;
      if (c.tipo === "chave") return c.fechada ? v / R_FIO : 0;
      if (c.tipo === "led") return ligado[i] ? Math.max(0, (v - (c.vf ?? 2)) / R_LED_ON) : 0;
      return 0;                                       // bateria: calculada abaixo
    });
    baterias.forEach((b, k) => {
      const i = componentes.indexOf(b);
      correntes[i] = -(x[n + k] || 0);
    });

    if (!mudou) break;
  }

  return {
    tensoes: V,
    correntes,
    /* Ajudinhas para a interface */
    tensaoEm: (c) => V[c.a] - V[c.b],
    correnteEm: (c) => correntes[componentes.indexOf(c)] || 0,
    ledsAcesos: componentes.map((c, i) => c.tipo === "led" && ligado[i] && correntes[i] > 0.0005),
    ledsQueimados: componentes.map((c, i) =>
      c.tipo === "led" && correntes[i] > (c.imax ?? 0.03)),
  };
}

/* ---- ajudinhas didáticas (usadas nos textos do jogo) ---- */

/* Resistor que a criança precisa para um LED: R = (Vfonte − Vf) / I */
export function resistorParaLed(vFonte, vf, correnteAlvo) {
  return (vFonte - vf) / correnteAlvo;
}

/* Resistência equivalente em série e em paralelo. */
export const serie = (...rs) => rs.reduce((a, b) => a + b, 0);
export const paralelo = (...rs) => 1 / rs.reduce((a, r) => a + 1 / r, 0);

/* Formata bonitinho para a tela. */
export function fmtA(i) {
  const ma = i * 1000;
  if (Math.abs(ma) < 1) return `${(ma * 1000).toFixed(0)} µA`;
  if (Math.abs(ma) < 1000) return `${ma.toFixed(1)} mA`;
  return `${i.toFixed(2)} A`;
}
export function fmtV(v) { return `${v.toFixed(2)} V`; }
export function fmtR(r) {
  if (r >= 1000) return `${(r / 1000).toFixed(r % 1000 ? 1 : 0)} kΩ`;
  return `${r} Ω`;
}
