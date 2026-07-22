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
    newborn: {src:"assets/sprites/baby/newborn.png",placeholder:"#F7C7D8",label:"Recém-nascido"},
    crawling: {src:"assets/sprites/baby/crawling.png",placeholder:"#F5B7C9",label:"Engatinhando"},
    toddler: {src:"assets/sprites/baby/toddler.png",placeholder:"#F0A0BC",label:"Criança"},
    child: {src:"assets/sprites/baby/child.png",placeholder:"#E888AE",label:"Criança grande"},
  },

  /* ---- Camadas equipáveis (chave = id da categoria) ---- */
  corpo: {
    pele_clara: {src:"assets/sprites/corpo/pele_clara.png",placeholder:"#FBD9B8",label:"Pele Clara"},
    pele_media: {src:"assets/sprites/corpo/pele_media.png",placeholder:"#E0A878",label:"Pele Média"},
    pele_escura: {src:"assets/sprites/corpo/pele_escura.png",placeholder:"#9C6B45",label:"Pele Escura"},
  },
  cabelo: {
    cabelo_castanho: {src:"assets/sprites/cabelo/cabelo_castanho.png",placeholder:"#6B4A2B",label:"Cabelo Castanho"},
    cabelo_loiro: {src:"assets/sprites/cabelo/cabelo_loiro.png",placeholder:"#E8C46B",label:"Cabelo Loiro"},
  },
  camisa: {
    body_stars: {src:"assets/sprites/clothes/body_stars.png",placeholder:"#8FB8FF",label:"Body Estrelas"},
    camisa_listrada: {src:"assets/sprites/camisa/camisa_listrada.png",placeholder:"#7EC8A0",label:"Camisa Listrada"},
    camisa: {src:"assets/sprites/camisa/camisa.png",placeholder:"#A0C8FF",label:"Camisa Lisa"},
  },
  calca: {
    calca_jeans: {src:"assets/sprites/calca/calca_jeans.png",placeholder:"#5B7DA6",label:"Calça Jeans"},
    saia: {src:"assets/sprites/calca/saia.png",placeholder:"#D46A6A",label:"Saia"},
  },
  sapatos: {
    tenis: {src:"assets/sprites/sapatos/tenis.png",placeholder:"#D46A6A",label:"Tênis"},
  },
  acessorios: {
    hat_bear: {src:"assets/sprites/accessories/hat_bear.png",placeholder:"#C9A06B",label:"Toca de Urso"},
    bow_pink: {src:"assets/sprites/accessories/bow_pink.png",placeholder:"#FF9EC4",label:"Laço Rosa"},
    laco: {src:"assets/sprites/accessories/laco.png",placeholder:"#FFB4A2",label:"Laço"},
    pulseiras: {src:"assets/sprites/accessories/pulseiras.png",placeholder:"#A2C4FF",label:"Pulseiras"},
  },
  brinquedos: {
    rattle: {src:"assets/sprites/toys/rattle.png",placeholder:"#FFD36B",label:"Chocalho"},
    teddy: {src:"assets/sprites/toys/teddy.png",placeholder:"#B78A5E",label:"Ursinho"},
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
  { id: "pele_clara",        category: "corpo",                            price: 0   },
  { id: "pele_media",        category: "corpo",                            price: 0   },
  { id: "pele_escura",       category: "corpo",                            price: 0   },
  { id: "cabelo_castanho",   category: "cabelo",                           price: 180   },
  { id: "cabelo_loiro",      category: "cabelo",                           price: 180   },
  { id: "body_stars",        category: "camisa",                           price: 240   },
  { id: "camisa_listrada",   category: "camisa",                           price: 260   },
  { id: "camisa",            category: "camisa",                           price: 220   },
  { id: "calca_jeans",       category: "calca",                            price: 240   },
  { id: "saia",              category: "calca",                            price: 210   },
  { id: "tenis",             category: "sapatos",                          price: 200   },
  { id: "hat_bear",          category: "acessorios",                       price: 190   },
  { id: "bow_pink",          category: "acessorios",                       price: 140   },
  { id: "laco",              category: "acessorios",                       price: 140   },
  { id: "pulseiras",         category: "acessorios",                       price: 160   },
  { id: "rattle",            category: "brinquedos",                       price: 170   },
  { id: "teddy",             category: "brinquedos",                       price: 420   },
  { id: "teto",              category: "brinquedos",                       price: 295   },
];

export function getAsset(category, id) {
  return ASSETS[category] ? ASSETS[category][id] : null;
}
