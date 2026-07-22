/* =====================================================================
 * homework.js — DEVER DE CASA (matérias aleatórias intercaladas)
 * ---------------------------------------------------------------------
 * Cada rodada sorteia uma matéria diferente: Matemática, Português,
 * Ciências ou Lógica. Acertou = ponto; errou = perde uma vida.
 * As questões são GERADAS na hora (nunca repetem igual) e ficam mais
 * difíceis conforme você acerta.
 * ===================================================================== */

import { rewardGame, getRecord } from "./firebase-sync.js";
import { getActiveBaby } from "./session.js";
import { registerCare } from "./streak.js";
import { GAME_CONFIG, BALANCE } from "./config.js";

const rnd = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rnd(arr.length)];
const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((p) => p[1]);

/* Monta as 4 alternativas a partir da certa + erradas plausíveis. */
function alt(certo, erradas) {
  const set = new Set([String(certo)]);
  for (const e of erradas) { if (set.size < 4) set.add(String(e)); }
  let g = 0;
  while (set.size < 4 && g++ < 100) set.add(String(Number(certo) + (rnd(2) ? 1 : -1) * (1 + rnd(9))));
  return shuffle([...set]);
}

/* =====================================================================
 * ESCOLARIDADE — a dificuldade sobe junto com os acertos
 *   0 Educação Infantil · 1 Fund. I · 2 Fund. II · 3 Ensino Médio
 *   4 Ensino Médio avançado
 * ===================================================================== */
export const SERIES = ["Educação Infantil", "Fundamental I", "Fundamental II", "Ensino Médio", "Ensino Médio+"];

/* ---------------- MATEMÁTICA ---------------- */
function matematica(nv) {
  if (nv === 0) {                                   // somar e subtrair pequeno
    const op = pick(["+", "-"]);
    let a = 1 + rnd(10), b = 1 + rnd(10);
    if (op === "-" && b > a) [a, b] = [b, a];
    const r = op === "+" ? a + b : a - b;
    return { p: `${a} ${op} ${b} = ?`, c: r, e: [r + 1, r - 1, r + 2] };
  }
  if (nv === 1) {                                   // tabuada e divisão exata
    if (rnd(2)) { const a = 2 + rnd(9), b = 2 + rnd(9); return { p: `${a} × ${b} = ?`, c: a * b, e: [a * b + a, a * b - b, (a + 1) * b] }; }
    const b = 2 + rnd(8), r = 2 + rnd(9);
    return { p: `${b * r} ÷ ${b} = ?`, c: r, e: [r + 1, r - 1, b] };
  }
  if (nv === 2) {                                   // fração, porcentagem, potência
    const t = rnd(3);
    if (t === 0) { const p = pick([10, 20, 25, 50]), n = pick([40, 60, 80, 120, 200]);
      return { p: `Quanto é ${p}% de ${n}?`, c: (n * p) / 100, e: [(n * p) / 50, (n * p) / 200, n - p] }; }
    if (t === 1) { const b = 2 + rnd(5), x = 2 + rnd(3);
      return { p: `${b}^${x} = ?`, c: b ** x, e: [b * x, b ** x + b, b ** (x - 1)] }; }
    const d = pick([2, 4, 5, 10]), n = d * (1 + rnd(6));
    return { p: `Quanto é ${n} ÷ ${d}?`, c: n / d, e: [n / d + 1, n * d, n - d] };
  }
  if (nv === 3) {                                   // equação 1º grau, raiz, PA
    const t = rnd(3);
    if (t === 0) { const x = 1 + rnd(12), a = 2 + rnd(6), b = 1 + rnd(20);
      return { p: `Resolva: ${a}x + ${b} = ${a * x + b}`, c: `x = ${x}`, e: [`x = ${x + 1}`, `x = ${x - 1}`, `x = ${a}`] }; }
    if (t === 1) { const r = 2 + rnd(14);
      return { p: `√${r * r} = ?`, c: r, e: [r + 1, r * 2, r * r / 2] }; }
    const a1 = 1 + rnd(9), q = 2 + rnd(5), n = 5 + rnd(5);
    const an = a1 + (n - 1) * q;
    return { p: `PA: a₁=${a1}, razão=${q}. Qual é a₍${n}₎?`, c: an, e: [an + q, an - q, a1 * n] };
  }
  // nv >= 4: 2º grau, log, trigonometria
  const t = rnd(3);
  if (t === 0) { const r1 = 1 + rnd(6), r2 = 1 + rnd(6);
    return { p: `Raízes de x² − ${r1 + r2}x + ${r1 * r2} = 0`, c: `${Math.min(r1,r2)} e ${Math.max(r1,r2)}`,
             e: [`${r1 + 1} e ${r2}`, `${-r1} e ${-r2}`, `${r1 * r2} e 1`] }; }
  if (t === 1) { const b = pick([2, 3, 5, 10]), x = 1 + rnd(3);
    return { p: `log${b}(${b ** x}) = ?`, c: x, e: [x + 1, b, b ** x] }; }
  const ang = pick([["sen 30°", "1/2"], ["cos 60°", "1/2"], ["sen 90°", "1"], ["cos 0°", "1"], ["tg 45°", "1"], ["sen 0°", "0"]]);
  return { p: `Quanto vale ${ang[0]}?`, c: ang[1], e: ["√2/2", "√3/2", "0"] };
}

/* ---------------- PORTUGUÊS ---------------- */
const PT = [
  [0, "Qual é o PLURAL de “cão”?", "cães", ["cãos", "cãoes", "cães es"]],
  [0, "Qual é o PLURAL de “pão”?", "pães", ["pãos", "panes", "pãoes"]],
  [0, "Qual é um SUBSTANTIVO?", "cadeira", ["correr", "bonito", "muito"]],
  [1, "Qual está escrito CORRETO?", "exceção", ["esceção", "excessão", "eixeção"]],
  [1, "Qual é o FEMININO de “ator”?", "atriz", ["atora", "atriza", "atoresa"]],
  [1, "Qual é um VERBO?", "pular", ["mesa", "azul", "feliz"]],
  [2, "“Mais” ou “mas”: Eu quis, ___ não deu.", "mas", ["mais", "más", "maz"]],
  [2, "Qual palavra é PAROXÍTONA?", "cadeira", ["café", "médico", "urubu"]],
  [2, "Qual é o COLETIVO de estrelas?", "constelação", ["manada", "cardume", "matilha"]],
  [3, "Em “Comprei o livro”, “o livro” é...", "objeto direto", ["sujeito", "adjunto adverbial", "predicativo"]],
  [3, "“Fui à escola”: por que tem crase?", "a + a (artigo)", ["é acento agudo", "verbo pede crase", "sempre antes de escola"]],
  [3, "Qual é a figura em “chorei rios de lágrimas”?", "hipérbole", ["metonímia", "eufemismo", "pleonasmo"]],
  [4, "“Assisti ao filme” — isso é regência de...", "verbo transitivo indireto", ["verbo intransitivo", "verbo de ligação", "verbo transitivo direto"]],
  [4, "Qual é a oração subordinada em “Espero que venha”?", "que venha", ["Espero", "que", "venha"]],
  [4, "Em “O Brasil venceu” (time), há...", "metonímia", ["hipérbole", "antítese", "ironia"]],
];

/* ---------------- CIÊNCIAS ---------------- */
const CI = [
  [0, "Quantas patas tem um inseto adulto?", "6", ["4", "8", "10"]],
  [0, "Qual órgão bombeia o sangue?", "coração", ["pulmão", "fígado", "rim"]],
  [0, "Qual é o maior animal do mundo?", "baleia-azul", ["elefante", "girafa", "tubarão"]],
  [1, "A água ferve a quantos graus (nível do mar)?", "100 °C", ["50 °C", "80 °C", "120 °C"]],
  [1, "As plantas produzem energia por qual processo?", "fotossíntese", ["digestão", "respiração", "evaporação"]],
  [1, "Qual planeta é o mais próximo do Sol?", "Mercúrio", ["Vênus", "Marte", "Terra"]],
  [2, "Qual é a fórmula da água?", "H₂O", ["CO₂", "O₂", "NaCl"]],
  [2, "Onde ficam os genes?", "no DNA", ["no sangue", "no estômago", "na pele"]],
  [2, "Qual gás as plantas absorvem?", "gás carbônico", ["oxigênio", "nitrogênio", "hidrogênio"]],
  [3, "Qual é a unidade de força no SI?", "newton", ["joule", "watt", "pascal"]],
  [3, "A aceleração da gravidade na Terra é ≈", "9,8 m/s²", ["3,7 m/s²", "1,6 m/s²", "12 m/s²"]],
  [3, "Qual é o símbolo do sódio?", "Na", ["So", "S", "Sd"]],
  [4, "Divisão celular que gera gametas:", "meiose", ["mitose", "citocinese", "apoptose"]],
  [4, "1ª Lei de Newton trata da...", "inércia", ["ação e reação", "gravitação", "energia"]],
  [4, "Ligação entre metal e ametal é...", "iônica", ["covalente", "metálica", "dipolo"]],
];

function banco(lista, nv) {
  const aptas = lista.filter((q) => q[0] <= nv);
  const foco = aptas.filter((q) => q[0] >= nv - 1);
  const q = pick(foco.length ? foco : aptas);
  return { p: q[1], c: q[2], e: q[3] };
}

/* ---------------- LÓGICA ---------------- */
function logica(nv) {
  const t = rnd(nv >= 3 ? 4 : 3);
  if (t === 0) { const i = 1 + rnd(9), p = 2 + rnd(3 + nv);
    const seq = [i, i + p, i + 2 * p, i + 3 * p], r = i + 4 * p;
    return { p: `${seq.join(", ")}, ?`, c: r, e: [r + p, r - 1, r + 1] }; }
  if (t === 1) { const i = 1 + rnd(5), seq = [i, i * 2, i * 4, i * 8], r = i * 16;
    return { p: `${seq.join(", ")}, ?`, c: r, e: [r + i, r - i, i * 12] }; }
  if (t === 2) { const f = ["🔺", "⬛", "🔵", "⭐"]; const a = pick(f); let b = pick(f); while (b === a) b = pick(f);
    return { p: `${a} ${b} ${a} ${b} ${a} ?`, c: b, e: f.filter((x) => x !== b).slice(0, 3) }; }
  const s = [1, 1, 2, 3, 5, 8, 13];                  // Fibonacci (nível alto)
  const k = 3 + rnd(3);
  return { p: `${s.slice(0, k + 1).join(", ")}, ?`, c: s[k + 1], e: [s[k + 1] + 1, s[k] * 2, s[k + 1] - 2] };
}

/* Sorteia matéria + questão do nível de escolaridade atual. */
function sortearQuestao(nv) {
  const n = Math.min(4, nv);
  const m = rnd(4);
  let q, materia, emoji;
  if (m === 0) { q = matematica(n); materia = "Matemática"; emoji = "➗"; }
  else if (m === 1) { q = banco(PT, n); materia = "Português"; emoji = "📚"; }
  else if (m === 2) { q = banco(CI, n); materia = "Ciências"; emoji = "🔬"; }
  else { q = logica(n); materia = "Lógica"; emoji = "🧩"; }
  return { materia, emoji, serie: SERIES[n], pergunta: q.p, certo: String(q.c), opcoes: alt(q.c, q.e) };
}

/* ---------------- jogo ---------------- */
export function initHomework() {
  const root = document.getElementById("hw-root");
  if (!root) return;

  let vidas, pontos, nivel, q, rodando;
  let tempoTotal, tempoRestante, timerId = null;

  const elVidas = document.getElementById("hw-lives");
  const elPontos = document.getElementById("hw-score");
  const elMateria = document.getElementById("hw-subject");
  const elPerg = document.getElementById("hw-question");
  const elOps = document.getElementById("hw-options");
  const elMsg = document.getElementById("hw-msg");
  const btnStart = document.getElementById("hw-start");
  const elTimer = document.getElementById("hw-timer");

  function pararTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }

  function iniciarTimer() {
    pararTimer();
    // fica mais apertado conforme acerta
    tempoTotal = Math.max(BALANCE.homework.timeMin,
                          BALANCE.homework.timeStart - Math.floor(pontos / (BALANCE.homework.timeStepEvery || 2)));
    tempoRestante = tempoTotal;
    pintarTimer();
    timerId = setInterval(() => {
      tempoRestante -= 0.1;
      if (tempoRestante <= 0) { pararTimer(); tempoEsgotado(); }
      else pintarTimer();
    }, 100);
  }

  function pintarTimer() {
    const pct = Math.max(0, (tempoRestante / tempoTotal) * 100);
    elTimer.style.width = `${pct}%`;
    elTimer.dataset.low = pct < 30 ? "true" : "false";
    elTimer.parentElement.querySelector(".hw-timer-num").textContent =
      `${Math.ceil(Math.max(0, tempoRestante))}s`;
  }

  function tempoEsgotado() {
    if (!rodando) return;
    vidas--;
    elMsg.textContent = `Tempo! Era "${q.certo}" ⏰`;
    [...elOps.children].forEach((b) => { b.disabled = true; if (b.textContent === q.certo) b.classList.add("ok"); });
    hud();
    if (vidas <= 0) setTimeout(fim, 800);
    else setTimeout(novaQuestao, 1000);
  }

  function hud() {
    elVidas.textContent = "❤️".repeat(Math.max(0, vidas));
    elPontos.textContent = `${pontos} acertos · 🏆 ${getRecord("homework")}`;
  }

  function novaQuestao() {
    nivel = Math.floor(pontos / (BALANCE.homework.levelEvery || 3));
    q = sortearQuestao(nivel);
    elMateria.textContent = `${q.emoji} ${q.materia} · ${q.serie}`;
    elPerg.textContent = q.pergunta;
    elOps.innerHTML = "";
    for (const op of q.opcoes) {
      const b = document.createElement("button");
      b.className = "hw-op";
      b.textContent = op;
      b.onclick = () => responder(op, b);
      elOps.appendChild(b);
    }
    hud();
    iniciarTimer();
  }

  function responder(op, btn) {
    if (!rodando) return;
    pararTimer();
    [...elOps.children].forEach((b) => (b.disabled = true));
    if (op === q.certo) {
      pontos++;
      btn.classList.add("ok");
      elMsg.textContent = "Boa! ✅";
      setTimeout(novaQuestao, 420);
    } else {
      vidas--;
      btn.classList.add("bad");
      elMsg.textContent = `Era "${q.certo}" ❌`;
      hud();
      if (vidas <= 0) setTimeout(fim, 700);
      else setTimeout(novaQuestao, 900);
    }
  }

  async function fim() {
    rodando = false;
    pararTimer();
    elTimer.style.width = "0%";
    elOps.innerHTML = "";
    elMateria.textContent = "";
    elPerg.textContent = `Fim do dever! ${pontos} acerto(s).`;
    btnStart.hidden = false;
    btnStart.textContent = "Fazer outro dever";

    if (pontos > 0) {
      const r = await rewardGame(getActiveBaby(), "homework", pontos);
      registerCare();
      elMsg.textContent = r.factor === 0
        ? "A criança se cansou de estudar — sem recompensa agora."
        : `${r.record ? "🏆 NOVO RECORDE! " : ""}+${r.coins} 🪙  +${r.xp} XP${r.factor < 1 ? " (cansado)" : ""}`;
    } else {
      elMsg.textContent = "Nenhum acerto desta vez.";
    }
    hud();
  }

  function começar() {
    vidas = BALANCE.homework.lives || 3; pontos = 0; nivel = 0; rodando = true;
    btnStart.hidden = true;
    elMsg.textContent = "";
    novaQuestao();
  }

  btnStart.onclick = começar;
  vidas = 3; pontos = 0; rodando = false;
  elMsg.textContent = "";
  elPerg.textContent = "Vamos estudar? Cada acerto vale pontos.";
  hud();
}
