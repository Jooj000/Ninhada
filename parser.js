const fs = require('fs');
const path = require('path');
const vm = require('vm');

const filePath = path.join(__dirname, 'js', 'assets-map.js');
let content = fs.readFileSync(filePath, 'utf8');

// Isola ASSETS e SHOP_ITEMS para leitura via VM
const evaluableContent = content
  .replace(/export\s+const\s+/g, 'var ')
  .replace(/export\s+function\s+\w+\s*\(.*\)\s*\{[\s\S]*?\}/g, '');

try {
  const context = {};
  vm.createContext(context);
  vm.runInContext(evaluableContent, context);
  var ASSETS = context.ASSETS || {};
  var SHOP_ITEMS = context.SHOP_ITEMS || [];
} catch (e) {
  console.error("Erro ao ler dados atuais do assets-map.js:", e);
  process.exit(1);
}

// 1. Calcular o preço médio real por categoria (mantendo 0 para o corpo, etc.)
const categoryPrices = {};
SHOP_ITEMS.forEach(item => {
  if (!categoryPrices[item.category]) {
    categoryPrices[item.category] = [];
  }
  categoryPrices[item.category].push(item.price);
});

const avgPrices = {};
Object.keys(categoryPrices).forEach(cat => {
  const prices = categoryPrices[cat];
  const sum = prices.reduce((a, b) => a + b, 0);
  const avg = Math.round(sum / prices.length);
  avgPrices[cat] = avg < 50 ? 0 : avg;
});

const defaultPrices = {
  corpo: 0,
  face: 0,
  cabelo: 180,
  camisa: 220,
  calca: 220,
  sapatos: 200,
  acessorios: 150,
  brinquedos: 200
};

// 2. Mapeamento das pastas de sprites
const spritesRoot = path.join(__dirname, 'assets', 'sprites');
const folderMapping = {
  'baby': { group: 'baby', shopCat: null },
  'corpo': { group: 'corpo', shopCat: 'corpo' },
  'cabelo': { group: 'cabelo', shopCat: 'cabelo' },
  'Rosto': { group: 'face', shopCat: 'face' },
  'camisa': { group: 'camisa', shopCat: 'camisa' },
  'clothes': { group: 'camisa', shopCat: 'camisa' },
  'calca': { group: 'calca', shopCat: 'calca' },
  'sapatos': { group: 'sapatos', shopCat: 'sapatos' },
  'accessories': { group: 'acessorios', shopCat: 'acessorios' },
  'toys': { group: 'brinquedos', shopCat: 'brinquedos' }
};

let addedAssetsCount = 0;
let addedShopCount = 0;

// Lista o que existe no disco para casar a pasta sem depender de
// maiúsculas/minúsculas ("Rosto", "rosto" e "ROSTO" funcionam igual).
const pastasNoDisco = fs.existsSync(spritesRoot) ? fs.readdirSync(spritesRoot) : [];

Object.keys(folderMapping).forEach(folderKey => {
  const folderName = pastasNoDisco.find(
    (d) => d.toLowerCase() === folderKey.toLowerCase()
  );
  if (!folderName) return;
  const folderPath = path.join(spritesRoot, folderName);
  if (!fs.statSync(folderPath).isDirectory()) return;

  const mapInfo = folderMapping[folderKey];
  const group = mapInfo.group;
  const shopCat = mapInfo.shopCat;

  if (!ASSETS[group]) {
    ASSETS[group] = {};
  }

  const files = fs.readdirSync(folderPath);
  files.forEach(file => {
    const ext = path.extname(file).toLowerCase();
    if (ext === '.png' || ext === '.gif') {
      // Nome do arquivo pode ter ESPAÇOS: "cabelo cacheado.png"
      //   id    -> cabelo_cacheado   (chave segura p/ JS e Firebase)
      //   label -> Cabelo Cacheado   (texto bonito na tela)
      //   src   -> caminho com %20   (URL válida)
      const rawName = path.basename(file, ext);
      const id = rawName
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // tira acentos
        .trim().replace(/\s+/g, '_')                        // espaços -> _
        .replace(/[^A-Za-z0-9_-]/g, '')                     // só o que é seguro
        .toLowerCase();
      const srcPath = `assets/sprites/${folderName}/${encodeURIComponent(file)}`;

      // Adiciona ao ASSETS se não existir
      if (!ASSETS[group][id]) {
        const label = rawName.trim().split(/[\s_]+/)
          .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        const placeholder = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
        
        ASSETS[group][id] = {
          src: srcPath,
          placeholder: placeholder,
          label: label
        };
        addedAssetsCount++;
        console.log(`[Novo Sprite] Grupo: ${group} | ID: ${id}`);
      }

      // Adiciona à Loja se pertencer a uma categoria comercializável e não estiver lá
      if (shopCat) {
        const existsInShop = SHOP_ITEMS.some(item => item.id === id);
        if (!existsInShop) {
          let price = avgPrices[shopCat];
          if (price === undefined) price = defaultPrices[shopCat] ?? 200;
          
          SHOP_ITEMS.push({
            id: id,
            category: shopCat,
            price: price
          });
          addedShopCount++;
          console.log(`[Adicionado à Loja] Item: ${id} | Categoria: ${shopCat} | Preço: ${price}`);
        }
      }
    }
  });
});

// 3. Formatação idêntica ao original (mantendo cada item de asset em linha única)
function formatAssetGroup(obj, indent = 2) {
  const spaces = ' '.repeat(indent);
  const innerSpaces = ' '.repeat(indent + 2);
  const entries = Object.entries(obj).map(([key, val]) => {
    // Mantém o objeto interno limpo em uma única linha, sem aspas nas chaves
    const valStr = JSON.stringify(val, null, 0).replace(/"([^"]+)":/g, '$1:');
    return `${innerSpaces}${key}: ${valStr}`;
  });
  return `{\n${entries.join(',\n')},\n${spaces}}`;
}

function generateAssetsCode(assets) {
  let code = `export const ASSETS = {\n`;
  code += `  /* Cenário */\n`;
  code += `  backgrounds: ${formatAssetGroup(assets.backgrounds, 2)},\n\n`;
  
  code += `  /* POSE base (não equipável) — muda por fase só pra crescer. */\n`;
  code += `  baby: ${formatAssetGroup(assets.baby, 2)},\n\n`;

  code += `  /* ---- Camadas equipáveis (chave = id da categoria) ---- */\n`;
  const categoriesToPrint = ['corpo', 'face', 'cabelo', 'camisa', 'calca', 'sapatos', 'acessorios', 'brinquedos'];
  categoriesToPrint.forEach(cat => {
    if (assets[cat]) {
      code += `  ${cat}: ${formatAssetGroup(assets[cat], 2)},\n`;
    }
  });

  if (assets.conditions) {
    code += `\n  /* ---- CONDIÇÕES (aparecem sozinhas conforme o status cai) ----\n`;
    code += `   * Pasta: assets/sprites/conditions/\n`;
    code += `   * \`placeholder: null\` = INVISÍVEL enquanto o .png não existir, para\n`;
    code += `   * não sujar a tela. Basta criar o arquivo que ele passa a aparecer. */\n`;
    code += `  conditions: ${formatAssetGroup(assets.conditions, 2)},\n`;
  }

  if (assets.ui) {
    code += `\n  /* Ícones de botões (opcional; senão usa emoji) */\n`;
    code += `  ui: ${formatAssetGroup(assets.ui, 2)},\n`;
  }

  code += `};\n`;
  return code;
}

function generateShopCode(shopItems) {
  let code = `export const SHOP_ITEMS = [\n`;
  shopItems.forEach(item => {
    code += `  { id: "${item.id}",`.padEnd(28);
    code += ` category: "${item.category}",`.padEnd(46);
    code += ` price: ${item.price}   },\n`;
  });
  code += `];\n`;
  return code;
}

const newAssetsStr = generateAssetsCode(ASSETS);
const newShopStr = generateShopCode(SHOP_ITEMS);

content = content.replace(/export const ASSETS = \{[\s\S]*?\};\s*\n\s*\/\* Catálogo da loja/m, `${newAssetsStr}\n\n/* Catálogo da loja`);
content = content.replace(/export const SHOP_ITEMS = \[[\s\S]*?\];\s*\n/m, `${newShopStr}\n`);

fs.writeFileSync(filePath, content, 'utf8');
console.log(`\n==========================================`);
console.log(`  PARSER EXECUTADO COM SUCESSO!`);
console.log(`  - Novos sprites encontrados: ${addedAssetsCount}`);
console.log(`  - Novos itens incluídos na loja: ${addedShopCount}`);
console.log(`==========================================`);