# 🍼 Nosso Bebê Virtual — PWA cooperativo

Pet virtual estilo *Pou*, mas cooperativo: você e sua namorada cuidam do mesmo bebê,
em celulares diferentes, com **status sincronizado em tempo real**. Sem Play Store,
instalável na tela inicial, atualiza sozinho quando você sobe código novo.

- **Programador (você):** mexe no código.
- **Artista (ela):** desenha os `.png` e larga nas pastas certas. **Nada quebra sem arte** — o jogo mostra *placeholders* coloridos até os desenhos chegarem.

---

## 1. Estrutura de pastas

```
bebe-virtual/
├── index.html            # tela principal (casa / loja / minigame)
├── manifest.json         # identidade do PWA (nome, ícones, cores)
├── service-worker.js     # offline + atualização automática de cache
├── firebase-rules.json   # regras de segurança p/ colar no Firebase
├── css/
│   └── style.css         # todo o visual (tema + placeholders)
├── js/
│   ├── config.js         # 🔑 SUAS chaves do Firebase + balanceamento
│   ├── assets-map.js     # 🎨 MAPA DAS ARTES (o único arquivo que muda p/ trocar png)
│   ├── state.js          # lógica pura: decaimento por tempo, fases, humor
│   ├── firebase-sync.js  # sincronização em tempo real (transações)
│   ├── game.js           # game loop + render (multi-bebê: 1 card por criança)
│   ├── shop.js           # loja + inventário comum + vestir (por bebê)
│   ├── minigame.js       # Flappy Bebê (gera moedas)
│   ├── circuit.js        # Feira de Ciências (puzzle de circuitos)
│   ├── board.js          # Quadro de Avisos (recados compartilhados)
│   └── register-sw.js    # registra o service worker
└── assets/
    ├── sprites/
    │   ├── baby/         # corpo do bebê por fase (newborn, crawling, toddler, child)
    │   ├── clothes/      # roupas (camada sobre o corpo)
    │   ├── accessories/  # chapéu, laço… (camada sobre a roupa)
    │   └── toys/         # brinquedos que o bebê segura (camada frontal)
    ├── backgrounds/      # cenários
    ├── ui/               # ícones de botões (opcional; senão usa emoji)
    └── icons/            # ícones do PWA (192 e 512)
```

Cada pasta de arte tem um `LEIA-ME.txt` com o tamanho e os nomes de arquivo esperados —
mande esses arquivos para a artista.

---

## 2. Configurar o Firebase (sincronização entre os 2 celulares)

Usamos o **Realtime Database** no plano gratuito **Spark** (mais que suficiente p/ 2 pessoas).

### Passo a passo

1. Acesse **console.firebase.google.com** e clique em **Adicionar projeto**. Dê um nome (ex.: `nosso-bebe`). Pode desativar o Google Analytics.
2. No menu lateral, **Criar** → **Realtime Database** → **Criar banco de dados**.
   - Escolha a localização (ex.: `us-central1`).
   - Comece em **modo de teste** (liberado por alguns dias). Depois ajustamos as regras.
3. Registre um **app da Web**: na visão geral do projeto, clique no ícone **`</>`** ("Web"). Dê um apelido, **não** precisa marcar Hosting agora. O console vai te mostrar um objeto `firebaseConfig` — **copie ele todo**.
4. Cole esse objeto em **`js/config.js`**, no lugar dos `"COLE_AQUI"`. Confira em especial o campo **`databaseURL`** (algo como `https://nosso-bebe-default-rtdb.firebaseio.com`) — sem ele o Realtime DB não conecta.
5. **Regras de segurança:** vá em **Realtime Database → aba Regras**, apague o conteúdo e cole o que está em **`firebase-rules.json`** (só a parte `"rules": { ... }`). Clique em **Publicar**.

Pronto. Ao abrir o app nos dois celulares, os dois leem/escrevem em `rooms/nosso-bebe`.
Deu comida num celular → o outro atualiza na hora.

### Como os status ficam iguais nos dois aparelhos

O segredo está em **`state.js`**: o banco guarda os valores **+ um `lastUpdate`** (carimbo
de tempo). O status não cai "enquanto o app está aberto" — ele cai conforme o **tempo real**
desde o `lastUpdate`. Então os dois celulares calculam o mesmo valor a partir do mesmo dado,
e toda ação usa **transação** (`runTransaction`) para ninguém sobrescrever o outro.

### Estrutura dos dados (schema multi-bebê)

```
rooms/nosso-bebe/
  ├─ coins                 número — carteira compartilhada da casa
  ├─ inventory/            guarda-roupa comprado (comum aos dois jogadores)
  │    └─ hat_bear: true
  ├─ babies/               um nó por criança
  │    ├─ baby_1/ { name, hunger, sleep, hygiene, fun, love, xp, equipped, lastUpdate }
  │    └─ b<timestamp>/ { ... }   (criados ao "Adotar bebê")
  └─ board/                recados do Quadro de Avisos
```

Regra de divisão: **status, XP e `equipped` são de cada bebê**; **moedas e `inventory`
(guarda-roupa) são da casa**. Assim os gêmeos compartilham a carteira e o closet, mas cada
um veste o seu look. Adotar um bebê custa `adoptCost` moedas (ajustável em `config.js`).

### (Opcional) deixar mais seguro depois

O modo acima é "aberto" (qualquer um com o link do banco poderia escrever). Como o app é
privado, dá para começar assim. Quando quiser fechar:
1. **Authentication → Métodos de login → Anônimo → Ativar.**
2. Adicione um login anônimo no início do app (`signInAnonymously`).
3. Troque as regras para exigir `".read": "auth != null"` e `".write": "auth != null"`.

---

## 3. Rodar e publicar

### Testar no PC
Service workers e módulos ES precisam de um servidor (não abra o `index.html` com `file://`).
Na pasta do projeto:

```bash
python3 -m http.server 8080
# abra http://localhost:8080
```

### Testar no celular / instalar como app
Publique num host estático **grátis** (qualquer um serve HTTPS, exigido pelo PWA):

- **GitHub Pages:** suba a pasta num repositório → Settings → Pages → branch `main`. Pronto.
- **Netlify / Cloudflare Pages:** arraste a pasta ou conecte o repo.
- **Firebase Hosting:** `npm i -g firebase-tools`, `firebase init hosting`, `firebase deploy`.

No celular, abra o link no Chrome/Safari → menu → **Adicionar à tela inicial**. Vira um app.

### Atualização automática
Toda vez que você sobe código novo, o `service-worker.js` busca os arquivos pela rede
(*network-first*) e troca o cache; ao assumir, o `register-sw.js` recarrega uma vez sozinho.
Não precisa reinstalar. Se algum dia quiser **forçar** limpeza total do cache, é só trocar
`CACHE_VERSION = "bebe-v1"` para `"bebe-v2"` no service worker.

---

## 3b. Notificações no celular (100% grátis, sem cartão)

Usamos **Web Push nativo com VAPID** — o navegador/sistema entrega o aviso **mesmo com o app
fechado**, de graça. Não usamos Cloud Functions (essas sim exigiriam o plano pago Blaze):
quem dispara é o script `server/notifier.js`, que você roda onde quiser, de graça.

Avisos enviados: **criança precisando de cuidado**, **foguinho prestes a apagar** e
**recado novo do outro jogador** (quem escreveu não recebe).

### Passo 1 — gerar as chaves VAPID (uma vez)
```bash
cd server
npm install
npx web-push generate-vapid-keys
```
- A chave **pública** vai em `js/config.js` → `PUSH.vapidPublicKey`.
- As duas vão no `server/.env` (copie de `.env.example`). **Nunca** publique a privada.

### Passo 2 — ligar no celular
Abra o app (instalado na tela inicial) e toque no **🔕** na barra do topo. Ele vira 🔔.
Faça isso nos dois celulares. No iPhone, é obrigatório **adicionar à tela inicial antes**.

### Passo 3 — escolher onde rodar o disparador (escolha UMA)

**A) GitHub Actions (recomendado: grátis, sem servidor, sem cartão)**
Já incluí `.github/workflows/notificador.yml`, que roda a cada 15 min.
Suba o projeto para um repositório e cadastre em *Settings → Secrets and variables → Actions*:
`DATABASE_URL`, `ROOM_ID`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

**B) Seu próprio PC** (enquanto estiver ligado)
```bash
cd server && npm install && cp .env.example .env   # preencha o .env
npm run loop     # fica rodando e checando a cada 15 min
```

**C) Hospedagem grátis** (Render / Railway / Fly): rode `node notifier.js --loop`
como *background worker*, com as mesmas variáveis de ambiente.

### Observações
- O `notifier.js` lê o banco via REST. Com as regras abertas atuais funciona direto;
  se você fechar as regras depois, gere um *secret* do banco e adicione `?auth=SEGREDO` nas URLs.
- Ele evita spam: não repete o mesmo aviso antes de `REPEAT_HOURS` (padrão 3h)
  e limpa sozinho assinaturas expiradas.

---

## 4. Fluxo da arte + sobreposição de imagens (chapéu em cima do bebê)

### Como a artista entrega
- PNG com **fundo transparente**, **1024×1024** para tudo que empilha (bebê, roupa, chapéu, brinquedo).
- **Mesmo enquadramento em todas as camadas:** ela desenha a roupa/chapéu já na posição do
  corpo, com o resto transparente. Assim, empilhando, encaixa sozinho.
- Salva na pasta certa e usa os nomes do `LEIA-ME.txt`. Se usar outro nome, você só troca a
  string em **`js/assets-map.js`**. É o único lugar a mexer.

### Como a sobreposição funciona (abordagem usada: CSS)
No `index.html`, o `#baby-stage` tem várias camadas empilhadas:

```html
<div id="baby-stage">
  <div class="layer layer-bg"></div>        <!-- z-index: 0  cenário -->
  <div class="layer layer-baby"></div>      <!-- z-index: 1  corpo -->
  <div class="layer layer-clothes"></div>   <!-- z-index: 2  roupa -->
  <div class="layer layer-accessory"></div> <!-- z-index: 3  chapéu/laço -->
  <div class="layer layer-toy"></div>       <!-- z-index: 4  brinquedo -->
</div>
```

Todas ocupam o mesmo quadrado (`position:absolute; inset:0`), e o **`z-index`** define quem
fica na frente. Como cada PNG é transparente e tem o mesmo enquadramento, o chapéu "cai"
exatamente na cabeça sem cálculo nenhum. Trocar de roupa = trocar o `background-image` da
camada `layer-clothes` (isso o `game.js` já faz ao equipar um item da loja).

**Por que CSS e não Canvas?** Para bonecos vestíveis, camadas de CSS são mais simples de
manter, deixam animar cada peça separada (o bebê "respira", o laço balança) e não exigem
loop de render. **Canvas** só compensa se você for ter muitas partículas/efeitos. Se um dia
quiser Canvas, a ideia é a mesma: desenhar na ordem
`drawImage(bg) → drawImage(baby) → drawImage(clothes) → drawImage(accessory) → drawImage(toy)`,
todos no mesmo retângulo. (O minigame já usa Canvas, então você tem os dois exemplos no projeto.)

---

## 5. Mecânicas e onde mexer

| O quê | Arquivo | Como ajustar |
|------|---------|--------------|
| Velocidade que os status caem | `config.js` → `decayPerHour` | números maiores = mais exigente |
| Quanto cada cuidado recupera | `config.js` → `actionGain` | |
| XP por cuidado / limiar de doente / moedas iniciais | `config.js` | |
| Fases de vida e XP necessário | `state.js` → `PHASES` | adicione novas fases aqui |
| Itens da loja e preços | `assets-map.js` → `SHOP_ITEMS` | |
| Adicionar roupa/chapéu novo | `assets-map.js` (`ASSETS` + `SHOP_ITEMS`) + png na pasta | |

### Minigames pendentes (fila combinada)
- **Feira de Ciências**: circuitos variados e mais complexos (vários layouts, série/paralelo,
  resistores) pagando por circuito completo — a base de pagamento por circuito já está pronta.
- **Dever de Casa**: intercala matérias aleatórias (contas, português, lógica).
- **Pescaria** estilo Stardew Valley (barra de tensão + peixe fugindo).
- Pack arcade do Pou: 2048, Memory, Color Match, Star Popper, Food Drop, Sky Jump…
- Piano/ritmo + parser de arquivos `.osu` (último da fila).

### Ideias de próximos passos
- Segundo bebê (gêmeos): troque `ROOM_ID` por uma lista e uma tela de seleção.
- Notificação "o bebê está com fome" (Web Push via Firebase Cloud Messaging).
- Mais minigames (um "combinar 3" encaixa bem na tela de Jogar).
- Sistema de "quem cuidou mais" (registrar quem tocou cada botão).

Divirtam-se! 💜
