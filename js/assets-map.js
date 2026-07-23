/* =====================================================================
 * assets-map.js — MAPA CENTRAL DE ARTES (sistema de camadas/avatar)
 * ---------------------------------------------------------------------
 * O bebê agora é um "boneco de papel": uma POSE base (igual pra todos,
 * muda só de tamanho por fase) + várias CAMADAS equipáveis por cima.
 *
 * As camadas são definidas UMA vez em SLOTS (ordem = de trás pra frente).
 * Loja, guarda-roupa e a renderização derivam tudo daqui.
 *
 * ARTE (fundo TRANSPARENTE, 1024x1024, mesmo enquadramento da pose):
 *   - Corpo/pose:  assets/sprites/baby/    (newborn.png, crawling.png, ...)
 *   - Pele/corpo:  assets/sprites/corpo/
 *   - Cabelo:      assets/sprites/cabelo/
 *   - Camisa:      assets/sprites/camisa/
 *   - Calça:       assets/sprites/calca/
 *   - Sapatos:     assets/sprites/sapatos/
 *   - Acessórios:  assets/sprites/accessories/
 *   - Brinquedos:  assets/sprites/toys/
 *
 * GIF ANIMADO: qualquer `src` pode ser .gif — ele anima sozinho (as
 * camadas usam background-image, que roda GIF). É só apontar pro .gif.
 * ===================================================================== */

/* Camadas do avatar, de TRÁS pra FRENTE. `base:true` é a pose (não
 * equipável). Acessórios têm duas ZONAS `multi` (cada uma aceita VÁRIOS
 * acessórios ao mesmo tempo, sem limite): uma ATRÁS do corpo/cabeça e
 * uma na FRENTE. Assim dá pra pôr laço atrás da cabeça e outros na frente. */
export const SLOTS = [
  { id: "accTras",    category: "acessorios", multi: true, label: "Acessórios atrás",  short: "Atrás" },
  { id: "__base__",   base: true },                                                     // pose
  { id: "corpo",      category: "corpo",  label: "Corpo" },
  { id: "face",       category: "face",   label: "Rosto" },
  { id: "calca",      category: "calca",  label: "Calça" },
  { id: "camisa",     category: "camisa", label: "Camisa" },
  { id: "sapatos",    category: "sapatos",label: "Sapatos" },
  { id: "rosto",      condition: "face",  label: "Expressão" },
  { id: "cabelo",     category: "cabelo", label: "Cabelo" },
  { id: "sujeira",    condition: "dirt",  label: "Sujeira" },
  { id: "accFrente",  category: "acessorios", multi: true, label: "Acessórios frente", short: "Frente" },
  { id: "brinquedos", category: "brinquedos", label: "Brinquedos" },
];

/* Categorias da loja (sem repetir "acessorios"), na ordem de exibição. */
export const CATEGORIES = [
  { id: "corpo",      label: "Corpo" },
  { id: "face",       label: "Rosto" },
  { id: "cabelo",     label: "Cabelo" },
  { id: "camisa",     label: "Camisa" },
  { id: "calca",      label: "Calça" },
  { id: "sapatos",    label: "Sapatos" },
  { id: "acessorios", label: "Acessórios" },
  { id: "brinquedos", label: "Brinquedos" },
];

/* Slots (camadas) de uma categoria — objetos completos. */
export function slotsForCategory(cat) {
  return SLOTS.filter((s) => s.category === cat);
}

export const ASSETS = {
  /* Cenário */
  backgrounds: {
    nursery: {src:"assets/backgrounds/nursery.png",placeholder:"#FDEFF4",label:"Quarto do bebê"},
  },

  /* POSE base (não equipável) — muda por fase só pra crescer. */
  baby: {
    newborn: {src:"assets/sprites/baby/base.png",placeholder:"#F7C7D8",label:"Recém-nascido"},
    crawling: {src:"assets/sprites/baby/base.png",placeholder:"#F5B7C9",label:"Engatinhando"},
    toddler: {src:"assets/sprites/baby/base.png",placeholder:"#F0A0BC",label:"Criança"},
    child: {src:"assets/sprites/baby/base.png",placeholder:"#E888AE",label:"Criança grande"},
    base: {src:"assets/sprites/baby/base.png",placeholder:"#5df660",label:"Base"},
  },

  /* ---- Camadas equipáveis (chave = id da categoria) ---- */
  corpo: {
    pele_clara: {src:"assets/sprites/corpo/Pele%20Clara.png",placeholder:"#FBD9B8",label:"Pele Clara"},
    pele_morena: {src:"assets/sprites/corpo/Pele%20Morena.png",placeholder:"#b6fa89",label:"Pele Morena"},
  },
  face: {
    rosto_alice: {src:"assets/sprites/Rosto/Rosto%20Alice.png",placeholder:null,label:"Rosto Alice"},
    rosto_lilian: {src:"assets/sprites/Rosto/Rosto%20Lilian.png",placeholder:null,label:"Rosto Lilian"},
    rosto_filho: {src:"assets/sprites/Rosto/Rosto%20Filho.png",placeholder:null,label:"Rosto Filho"},
  },
  cabelo: {
    cabelo_alice: {src:"assets/sprites/cabelo/Cabelo%20Alice.png",placeholder:"#f4f94d",label:"Cabelo Alice"},
    cabelo_filho: {src:"assets/sprites/cabelo/Cabelo%20Filho.png",placeholder:"#5decb3",label:"Cabelo Filho"},
    cabelo_lilian: {src:"assets/sprites/cabelo/Cabelo%20Lilian.png",placeholder:"#c62e36",label:"Cabelo Lilian"},
  },
  camisa: {
    camisa_pikachu: {src:"assets/sprites/camisa/Camisa%20Pikachu.png",placeholder:"#dc42cb",label:"Camisa Pikachu"},
  },
  calca: {
    bermuda_rosa: {src:"assets/sprites/calca/Bermuda%20Rosa.png",placeholder:"#855760",label:"Bermuda Rosa"},
  },
  sapatos: {
    bota_galinha: {src:"assets/sprites/sapatos/Bota%20Galinha.png",placeholder:"#73db7d",label:"Bota Galinha"},
  },
  acessorios: {
    lacos_vermelhos: {src:"assets/sprites/accessories/Lacos%20Vermelhos.png",placeholder:"#FFB4A2",label:"Laços vermelhos"},
    pulseiras_coloridas: {src:"assets/sprites/accessories/Pulseiras%20Coloridas.png",placeholder:"#A2C4FF",label:"Pulseiras coloridas"},
  },
  brinquedos: {
    teto: {src:"assets/sprites/toys/teto.png",placeholder:"#2702d6",label:"Teto"},
  },

  /* ---- CONDIÇÕES (aparecem sozinhas conforme o status cai) ----
   * Pasta: assets/sprites/conditions/
   * `placeholder: null` = INVISÍVEL enquanto o .png não existir, para
   * não sujar a tela. Basta criar o arquivo que ele passa a aparecer. */
  conditions: {
    sono: {src:"assets/sprites/conditions/sono.png",placeholder:null,label:"Com sono"},
    fome: {src:"assets/sprites/conditions/fome.png",placeholder:null,label:"Com fome"},
    carente: {src:"assets/sprites/conditions/carente.png",placeholder:null,label:"Carente"},
    sujo: {src:"assets/sprites/conditions/sujo.png",placeholder:null,label:"Sujo"},
    doente: {src:"assets/sprites/conditions/doente.png",placeholder:null,label:"Doente"},
  },

  /* Ícones de botões (opcional; senão usa emoji) */
  ui: {
    feed: {src:"assets/ui/feed.png",placeholder:"#FFB4A2",emoji:"🍼",label:"Alimentar"},
    sleep: {src:"assets/ui/sleep.png",placeholder:"#A2C4FF",emoji:"😴",label:"Ninar"},
    clean: {src:"assets/ui/clean.png",placeholder:"#A2E4FF",emoji:"🛁",label:"Banho"},
    play: {src:"assets/ui/play.png",placeholder:"#C4FFA2",emoji:"🎈",label:"Brincar"},
  },
};


/* Catálogo da loja: item aponta pra uma categoria + preço. */
export const SHOP_ITEMS = [
  {id:"pele_clara", category:"corpo", price:0},
  {id:"pele_morena", category:"corpo", price:0},
  {id:"rosto_alice", category:"face", price:0},
  {id:"rosto_lilian", category:"face", price:0},
  {id:"rosto_filho", category:"face", price:0},
  {id:"cabelo_alice", category:"cabelo", price:0},
  {id:"cabelo_filho", category:"cabelo", price:0},
  {id:"cabelo_lilian", category:"cabelo", price:0},
  {id:"camisa_pikachu", category:"camisa", price:100},
  {id:"bermuda_rosa", category:"calca", price:100},
  {id:"bota_galinha", category:"sapatos", price:100},
  {id:"lacos_vermelhos", category:"acessorios", price:100},
  {id:"pulseiras_coloridas", category:"acessorios", price:100},
  {id:"teto", category:"brinquedos", price:100},
];

/* Busca IGNORANDO maiúsculas/minúsculas: "Cabelo_Liso", "cabelo_liso" e
 * "CABELO_LISO" acham a mesma arte (o parser pode ter gerado o id numa
 * caixa e o Firebase guardado noutra). */
export function getAsset(category, id) {
  if (!category || id == null) return null;
  const grupo = ASSETS[category] ||
    ASSETS[Object.keys(ASSETS).find((k) => k.toLowerCase() === String(category).toLowerCase())];
  if (!grupo) return null;
  if (grupo[id]) return grupo[id];
  const alvo = String(id).toLowerCase();
  const chave = Object.keys(grupo).find((k) => k.toLowerCase() === alvo);
  return chave ? grupo[chave] : null;
}

/* O disco/servidor DIFERENCIA maiúsculas de minúsculas no nome do
 * arquivo, mas o autor da arte não tem que se preocupar com isso: se
 * "gato.png" não existir, tentamos .PNG, .gif, .GIF… na mesma ordem.
 * Devolve a lista de caminhos a tentar, do mais provável ao menos. */
export function variacoesDeSrc(src) {
  if (!src) return [];
  const ponto = src.lastIndexOf(".");
  if (ponto < 0) return [src];
  const base = src.slice(0, ponto), ext = src.slice(ponto + 1);
  const exts = ["png", "PNG", "gif", "GIF"];
  const listaExt = [ext, ext.toLowerCase(), ext.toUpperCase(), ...exts];

  /* variações de CAIXA do nome do arquivo (a pasta fica intacta):
   * "pele clara" -> "pele clara", "Pele Clara", "PELE CLARA" */
  const corte = base.lastIndexOf("/");
  const pasta = corte < 0 ? "" : base.slice(0, corte + 1);
  const nome = corte < 0 ? base : base.slice(corte + 1);
  /* Atenção: o espaço vem codificado como %20, então ele também separa
   * palavras. "pele%20clara" -> "Pele%20Clara". */
  const titulo = nome
    .split(/(%20|\s|_)/)
    .map((p) => (/^(%20|\s|_)$/.test(p)
      ? p
      : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()))
    .join("");
  const nomes = [nome, titulo, nome.toLowerCase(), nome.toUpperCase()];

  const vistos = new Set();
  const saida = [];
  for (const n of nomes) {
    for (const e of listaExt) {
      const cand = `${pasta}${n}.${e}`;
      if (!vistos.has(cand)) { vistos.add(cand); saida.push(cand); }
    }
  }
  return saida;
}
