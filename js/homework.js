/* =====================================================================
 * homework.js — DEVER DE CASA (matérias aleatórias intercaladas)
 * ---------------------------------------------------------------------
 * Cada rodada sorteia uma matéria diferente: Matemática, Português,
 * Ciências ou Lógica. Acertou = ponto; errou = perde uma vida.
 * As questões são GERADAS na hora (nunca repetem igual) e ficam mais
 * difíceis conforme você acerta.
 * ===================================================================== */

import { rewardGame, saveRecord, getRecord } from "./firebase-sync.js";
import { getActiveBaby } from "./session.js";
import { registerCare } from "./streak.js";

const rnd = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rnd(arr.length)];
const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((p) => p[1]);

/* ---------------- geradores por matéria ---------------- */
function matematica(nivel) {
  const max = 5 + nivel * 4;
  const ops = nivel < 2 ? ["+", "-"] : nivel < 4 ? ["+", "-", "×"] : ["+", "-", "×", "÷"];
  const op = pick(ops);
  let a = 1 + rnd(max), b = 1 + rnd(max), r;
  if (op === "+") r = a + b;
  else if (op === "-") { if (b > a) [a, b] = [b, a]; r = a - b; }
  else if (op === "×") { a = 1 + rnd(Math.min(10, 3 + nivel)); b = 1 + rnd(Math.min(10, 3 + nivel)); r = a * b; }
  else { b = 1 + rnd(8); r = 1 + rnd(8); a = b * r; }                  // divisão exata
  const certo = String(r);
  const opcoes = new Set([certo]);
  while (opcoes.size < 4) {
    const d = r + (rnd(2) ? 1 : -1) * (1 + rnd(Math.max(3, Math.round(r * 0.3))));
    if (d >= 0) opcoes.add(String(d));
  }
  return { materia: "Matemática", emoji: "➗", pergunta: `${a} ${op} ${b} = ?`, certo, opcoes: shuffle([...opcoes]) };
}

function portugues() {
  const bancos = [
    { p: "Qual é o PLURAL de “cão”?", c: "cães", e: ["cãos", "cães es", "cãoes"] },
    { p: "Qual é o PLURAL de “pão”?", c: "pães", e: ["pãos", "pães es", "panes"] },
    { p: "Qual está escrito CORRETO?", c: "exceção", e: ["esceção", "excessão", "eixeção"] },
    { p: "Qual está escrito CORRETO?", c: "gengibre", e: ["jenjibre", "gengibri", "jengibre"] },
    { p: "Qual é o FEMININO de “ator”?", c: "atriz", e: ["atora", "atriza", "atoresa"] },
    { p: "Onde vai o acento em “facil”?", c: "fácil", e: ["facíl", "fàcil", "facil"] },
    { p: "Qual é o COLETIVO de estrelas?", c: "constelação", e: ["manada", "cardume", "matilha"] },
    { p: "“Mais” ou “mas”: Eu quis, ___ não deu.", c: "mas", e: ["mais", "más", "maz"] },
    { p: "Qual é um SUBSTANTIVO?", c: "cadeira", e: ["correr", "bonito", "rapidamente"] },
    { p: "Qual é um VERBO?", c: "pular", e: ["mesa", "azul", "feliz"] },
  ];
  const q = pick(bancos);
  return { materia: "Português", emoji: "📚", pergunta: q.p, certo: q.c, opcoes: shuffle([q.c, ...q.e]) };
}

function ciencias() {
  const bancos = [
    { p: "Qual planeta é o mais próximo do Sol?", c: "Mercúrio", e: ["Vênus", "Marte", "Terra"] },
    { p: "A água ferve a quantos graus (nível do mar)?", c: "100 °C", e: ["50 °C", "80 °C", "120 °C"] },
    { p: "Qual órgão bombeia o sangue?", c: "coração", e: ["pulmão", "fígado", "rim"] },
    { p: "As plantas produzem energia por qual processo?", c: "fotossíntese", e: ["digestão", "respiração", "evaporação"] },
    { p: "Quantas patas tem um inseto adulto?", c: "6", e: ["4", "8", "10"] },
    { p: "Qual é o maior animal do mundo?", c: "baleia-azul", e: ["elefante", "girafa", "tubarão"] },
    { p: "O que a Lua faz em volta da Terra?", c: "orbita", e: ["evapora", "derrete", "explode"] },
    { p: "Qual estado da água é o gelo?", c: "sólido", e: ["líquido", "gasoso", "plasma"] },
  ];
  const q = pick(bancos);
  return { materia: "Ciências", emoji: "🔬", pergunta: q.p, certo: q.c, opcoes: shuffle([q.c, ...q.e]) };
}

function logica(nivel) {
  const tipo = rnd(3);
  if (tipo === 0) {                                   // sequência aritmética
    const ini = 1 + rnd(9), passo = 2 + rnd(3 + nivel);
    const seq = [ini, ini + passo, ini + 2 * passo, ini + 3 * passo];
    const r = ini + 4 * passo;
    const op = shuffle([String(r), String(r + passo), String(r - 1), String(r + 1)]);
    return { materia: "Lógica", emoji: "🧩", pergunta: `${seq.join(", ")}, ?`, certo: String(r), opcoes: op };
  }
  if (tipo === 1) {                                   // dobro
    const ini = 1 + rnd(5);
    const seq = [ini, ini * 2, ini * 4, ini * 8];
    const r = ini * 16;
    return { materia: "Lógica", emoji: "🧩", pergunta: `${seq.join(", ")}, ?`, certo: String(r),
             opcoes: shuffle([String(r), String(r + ini), String(r - ini), String(ini * 12)]) };
  }
  const formas = ["🔺", "⬛", "🔵", "⭐"];             // padrão que se repete
  const a = pick(formas); let b = pick(formas); while (b === a) b = pick(formas);
  return { materia: "Lógica", emoji: "🧩", pergunta: `${a} ${b} ${a} ${b} ${a} ?`, certo: b,
           opcoes: shuffle([a, b, ...formas.filter((f) => f !== a && f !== b).slice(0, 2)]) };
}

function sortearQuestao(nivel) {
  return pick([matematica, portugues, ciencias, logica])(nivel);
}

/* ---------------- jogo ---------------- */
export function initHomework() {
  const root = document.getElementById("hw-root");
  if (!root) return;

  let vidas, pontos, nivel, q, rodando;

  const elVidas = document.getElementById("hw-lives");
  const elPontos = document.getElementById("hw-score");
  const elMateria = document.getElementById("hw-subject");
  const elPerg = document.getElementById("hw-question");
  const elOps = document.getElementById("hw-options");
  const elMsg = document.getElementById("hw-msg");
  const btnStart = document.getElementById("hw-start");

  function hud() {
    elVidas.textContent = "❤️".repeat(Math.max(0, vidas));
    elPontos.textContent = `${pontos} acertos · 🏆 ${getRecord("homework")}`;
  }

  function novaQuestao() {
    nivel = Math.floor(pontos / 3);
    q = sortearQuestao(nivel);
    elMateria.textContent = `${q.emoji} ${q.materia}`;
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
  }

  function responder(op, btn) {
    if (!rodando) return;
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
    elOps.innerHTML = "";
    elMateria.textContent = "";
    elPerg.textContent = `Fim do dever! ${pontos} acerto(s).`;
    btnStart.hidden = false;
    btnStart.textContent = "Fazer outro dever";

    if (pontos > 0) {
      const rec = getRecord("homework");
      const r = await rewardGame(getActiveBaby(), "homework", pontos);
      await saveRecord("homework", pontos);
      registerCare();
      elMsg.textContent = r.factor === 0
        ? "A criança se cansou de estudar — sem recompensa agora."
        : `${pontos > rec ? "🏆 NOVO RECORDE! " : ""}+${r.coins} 🪙  +${r.xp} XP${r.factor < 1 ? " (cansado)" : ""}`;
    } else {
      elMsg.textContent = "Nenhum acerto desta vez.";
    }
    hud();
  }

  function começar() {
    vidas = 3; pontos = 0; nivel = 0; rodando = true;
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
