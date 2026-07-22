/* =====================================================================
 * shop.js — LOJA + GUARDA-ROUPA (por categorias)
 * ---------------------------------------------------------------------
 * - Modo "Loja": comprar peças (moedas da casa, guarda-roupa comum).
 * - Modo "Guarda-roupa": só o que já foi comprado, pra vestir.
 * - Abas por categoria: Corpo, Cabelo, Camisa, Calça, Sapatos,
 *   Acessórios, Brinquedos.
 * - Acessórios têm VÁRIAS camadas: você escolhe em qual colocar cada um
 *   (dá pra usar mais de um, ex.: laço de cada lado).
 * ===================================================================== */

import { SHOP_ITEMS, getAsset, CATEGORIES, slotsForCategory } from "./assets-map.js";
import { buyItem, equipItem, toggleAccessory } from "./firebase-sync.js";
import { getActiveBaby, setActiveBaby, onActiveBaby } from "./session.js";
import { BALANCE } from "./config.js";

/* Preço final = preço base (assets-map) × multiplicador global (balance). */
const preco = (item) => Math.round(item.price * BALANCE.economy.priceMultiplier);

let mode = "loja";            // "loja" | "guarda"
let category = CATEGORIES[0].id;

export function initShop() {
  const select = document.getElementById("shop-baby-select");
  if (select) select.addEventListener("change", () => setActiveBaby(select.value));
  onActiveBaby(renderShop);

  document.getElementById("mode-loja").addEventListener("click", () => setMode("loja"));
  document.getElementById("mode-guarda").addEventListener("click", () => setMode("guarda"));

  buildTabs();
  setInterval(renderShop, 800);
}

function setMode(m) {
  mode = m;
  document.getElementById("mode-loja").classList.toggle("active", m === "loja");
  document.getElementById("mode-guarda").classList.toggle("active", m === "guarda");
  renderShop();
}

function buildTabs() {
  const tabs = document.getElementById("shop-tabs");
  tabs.innerHTML = "";
  for (const c of CATEGORIES) {
    const b = document.createElement("button");
    b.className = "shop-tab" + (c.id === category ? " active" : "");
    b.textContent = c.label;
    b.onclick = () => {
      category = c.id;
      tabs.querySelectorAll(".shop-tab").forEach((t) => t.classList.remove("active"));
      b.classList.add("active");
      renderShop();
    };
    tabs.appendChild(b);
  }
}

function syncBabySelect(state) {
  const select = document.getElementById("shop-baby-select");
  if (!select) return;
  const babies = state.babies || {};
  const ids = Object.keys(babies);
  const sig = ids.map((id) => `${id}:${babies[id].name || ""}`).join("|");
  if (select.dataset.sig !== sig) {
    select.dataset.sig = sig;
    select.innerHTML = "";
    for (const id of ids) {
      const opt = document.createElement("option");
      opt.value = id; opt.textContent = babies[id].name || "Bebê";
      select.appendChild(opt);
    }
  }
  if (getActiveBaby()) select.value = getActiveBaby();
}

function renderShop() {
  const state = window.__STATE__;
  if (!state) return;

  const shopCoins = document.getElementById("coins-shop");
  if (shopCoins) shopCoins.textContent = state.coins ?? 0;
  syncBabySelect(state);

  const grid = document.getElementById("shop-grid");
  if (!grid) return;

  const activeId = getActiveBaby();
  const inv = state.inventory || {};
  const baby = (state.babies || {})[activeId] || {};
  const eq = baby.equipped || {};
  const slots = slotsForCategory(category);          // objetos de camada
  const isAcc = category === "acessorios";

  const items = SHOP_ITEMS.filter((it) => it.category === category)
    .filter((it) => (mode === "guarda" ? !!inv[it.id] : !inv[it.id]));  // loja só mostra o que falta

  grid.innerHTML = "";
  if (!items.length) {
    grid.innerHTML = `<p class="board-empty" style="color:var(--ink-soft)">${
      mode === "guarda" ? "Nada comprado nesta categoria ainda."
                        : "Vocês já compraram tudo desta categoria! 🎉"}</p>`;
    return;
  }

  for (const item of items) {
    const asset = getAsset(item.category, item.id);
    const owned = !!inv[item.id];

    const card = document.createElement("div");
    card.className = "shop-card";

    const thumb = document.createElement("div");
    thumb.className = "shop-thumb is-placeholder";
    thumb.style.backgroundColor = asset.placeholder;
    thumb.textContent = asset.label;
    const timg = new Image();
    timg.onload = () => {
      thumb.style.backgroundImage = `url("${asset.src}")`;
      thumb.style.backgroundColor = "transparent";
      thumb.classList.remove("is-placeholder");
      thumb.textContent = "";
    };
    timg.src = asset.src;
    card.appendChild(thumb);

    const name = document.createElement("div");
    name.className = "shop-name";
    name.textContent = asset.label;
    card.appendChild(name);

    if (!owned) {
      const btn = document.createElement("button");
      btn.className = "shop-btn";
      btn.textContent = item.price > 0 ? `Comprar · ${preco(item)} 🪙` : "Pegar (grátis)";
      btn.disabled = (state.coins ?? 0) < preco(item);
      btn.onclick = () => buyItem({ ...item, price: preco(item) });
      card.appendChild(btn);
    } else if (!activeId) {
      const b = document.createElement("button");
      b.className = "shop-btn"; b.disabled = true; b.textContent = "Sem bebê";
      card.appendChild(b);
    } else if (isAcc) {
      // Acessório: uma zona ATRÁS e uma FRENTE, cada uma sem limite de peças.
      const row = document.createElement("div");
      row.className = "layer-row";
      slots.forEach((zone) => {
        const on = !!(eq[zone.id] && eq[zone.id][item.id]);
        const b = document.createElement("button");
        b.className = "layer-btn" + (on ? " on" : "");
        b.textContent = on ? `✓ ${zone.short}` : zone.short;
        b.title = zone.label;
        b.onclick = () => toggleAccessory(activeId, zone.id, item.id);
        row.appendChild(b);
      });
      card.appendChild(row);
    } else {
      // Categoria de camada única: Vestir / Tirar.
      const slotId = slots[0].id;
      const on = eq[slotId] === item.id;
      const btn = document.createElement("button");
      btn.className = "shop-btn" + (on ? " equipped" : "");
      btn.textContent = on ? "Tirar" : "Vestir";
      btn.onclick = () => equipItem(activeId, slotId, on ? null : item.id);
      card.appendChild(btn);
    }
    grid.appendChild(card);
  }
}

export { renderShop };
