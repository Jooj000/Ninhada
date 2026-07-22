/* =====================================================================
 * weather.js — CLIMA SIMULADO DENTRO DO JOGO (sem API) + efeito visual
 * ---------------------------------------------------------------------
 * O tempo é gerado a partir do RELÓGIO, em "baldes" de tempo. Como os
 * dois celulares usam o mesmo relógio e a mesma semente, veem o mesmo
 * clima sem precisar sincronizar nada pelo Firebase.
 *
 * Estados: clear ☀️ | clouds ☁️ | rain 🌧️ | storm ⛈️ | cold ❄️
 * Chuva e neve são desenhadas num canvas por cima do jogo; a tempestade
 * pisca um relâmpago. O resfriado (state.js → nextColdState) usa este
 * clima do mesmo jeito que usava a API.
 * ===================================================================== */

import { WEATHER, GAME_CONFIG } from "./config.js";
import { weatherCheck } from "./firebase-sync.js";

let current = null;
export function getWeather() { return current; }

/* PRNG determinística (mulberry32) a partir de uma semente inteira. */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Calcula o clima para um instante `t` (mesmo resultado nos dois cel.). */
function weatherAt(t) {
  const periodMs = (WEATHER.changeMinutes || 25) * 60_000;
  const bucket = Math.floor(t / periodMs);
  const rnd = mulberry32(bucket ^ 0x9e3779b1);
  const roll = rnd();

  let main = "clear", rain = false, cold = false;
  const s = WEATHER.stormChance, r = WEATHER.rainChance, c = WEATHER.coldChance;
  if (roll < s) { main = "storm"; rain = true; }
  else if (roll < s + r) { main = "rain"; rain = true; }
  else if (roll < s + r + c) { main = "cold"; cold = true; }
  else if (roll < 0.72) { main = "clouds"; }
  else { main = "clear"; }

  // Temperatura: curva do dia + ajuste da condição + ruidinho.
  const d = new Date(t);
  const hour = d.getHours() + d.getMinutes() / 60;
  let temp = 22 + 6 * Math.sin(((hour - 9) / 24) * 2 * Math.PI);
  if (main === "cold") temp -= 12;
  if (rain) temp -= 4;
  temp = Math.round(temp + (rnd() * 4 - 2));
  if (temp <= (GAME_CONFIG.coldThreshold ?? 16)) cold = true;

  const desc = { storm: "tempestade", rain: "chuva", cold: "frio", clouds: "nublado", clear: "céu limpo" }[main];
  return { main, rain, cold, temp, desc };
}

export function initWeather(getBabies) {
  buildCanvas();
  tickWeather(getBabies);
  setInterval(() => tickWeather(getBabies), 20_000);   // reavalia clima
  setInterval(() => runColdChecks(getBabies), 60_000); // avalia resfriado
  requestAnimationFrame(drawLoop);
}

function tickWeather(getBabies) {
  current = weatherAt(Date.now());
  showPill(current);
}

function runColdChecks(getBabies) {
  if (!current) return;
  const babies = (getBabies && getBabies()) || {};
  for (const id of Object.keys(babies)) weatherCheck(id, current);
}

function showPill(w) {
  const el = document.getElementById("weather-pill");
  if (!el) return;
  el.hidden = false;
  const icon = { storm: "⛈️", rain: "🌧️", cold: "❄️", clouds: "☁️", clear: "☀️" }[w.main];
  el.textContent = `${icon} ${w.temp}°`;
  el.title = w.desc + (w.cold ? " · agasalhe os bebês" : "");
}

/* -------------------- efeito visual (canvas) -------------------- */
let cv, ctx, drops = [], flakes = [], flash = 0, lastFlash = 0;

function buildCanvas() {
  cv = document.createElement("canvas");
  cv.id = "weather-canvas";
  Object.assign(cv.style, {
    position: "fixed", inset: "0", width: "100%", height: "100%",
    pointerEvents: "none", zIndex: "45",
  });
  document.body.appendChild(cv);
  resize();
  window.addEventListener("resize", resize);
}

function resize() {
  if (!cv) return;
  cv.width = window.innerWidth;
  cv.height = window.innerHeight;
  ctx = cv.getContext("2d");
  const n = Math.round(cv.width / 6);
  drops = Array.from({ length: n }, makeDrop);
  flakes = Array.from({ length: Math.round(n / 2) }, makeFlake);
}

const makeDrop  = () => ({ x: Math.random() * cv.width, y: Math.random() * cv.height, len: 8 + Math.random() * 14, sp: 6 + Math.random() * 7 });
const makeFlake = () => ({ x: Math.random() * cv.width, y: Math.random() * cv.height, r: 1.5 + Math.random() * 2.5, sp: 0.6 + Math.random() * 1.2, dx: Math.random() * 0.6 - 0.3 });

function drawLoop() {
  requestAnimationFrame(drawLoop);
  if (!ctx || !current) return;
  ctx.clearRect(0, 0, cv.width, cv.height);

  if (current.rain) {
    ctx.strokeStyle = "rgba(120,150,200,0.45)";
    ctx.lineWidth = 1.4;
    const wind = current.main === "storm" ? 3 : 1.2;
    for (const d of drops) {
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - wind, d.y + d.len);
      ctx.stroke();
      d.y += d.sp; d.x -= wind * 0.4;
      if (d.y > cv.height) { d.y = -d.len; d.x = Math.random() * cv.width; }
    }
    if (current.main === "storm") {
      const now = Date.now();
      if (now - lastFlash > 2600 + Math.random() * 3000) { flash = 1; lastFlash = now; }
      if (flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${flash * 0.35})`;
        ctx.fillRect(0, 0, cv.width, cv.height);
        flash -= 0.06;
      }
    }
  } else if (current.cold) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (const f of flakes) {
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
      f.y += f.sp; f.x += f.dx;
      if (f.y > cv.height) { f.y = -4; f.x = Math.random() * cv.width; }
    }
  }
}
