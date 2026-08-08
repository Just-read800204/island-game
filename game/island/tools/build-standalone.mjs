// 把 dist/ 打包成「一個檔案就能玩」的 HTML。
//
// 用途：丟給別人看、貼進不能跑 build 的地方、或當作離線備份。
// 做法是把 bundle 內嵌成 inline script，並把所有 public/assets 轉成 data URI，
// 這樣整份檔案不會發出任何對外請求。
//
//   npm run build && node tools/build-standalone.mjs
//
// 產出：dist-standalone/island.html
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const PUBLIC_ASSETS = path.join(ROOT, 'public/assets');
const OUT_DIR = path.join(ROOT, 'dist-standalone');

const MIME = {
  '.png': 'image/png',
  '.json': 'application/json',
  '.tmj': 'application/json',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
};

/** 遞迴收集 public/assets 底下所有檔案，key 用執行期會出現的相對路徑。 */
function collectAssets(dir, prefix = 'assets') {
  const map = {};
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const key = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      Object.assign(map, collectAssets(full, key));
      continue;
    }
    const mime = MIME[path.extname(entry.name).toLowerCase()];
    if (!mime) {
      console.warn(`[standalone] 跳過不認識的副檔名：${key}`);
      continue;
    }
    map[key] = `data:${mime};base64,${fs.readFileSync(full).toString('base64')}`;
  }
  return map;
}

function findBundle() {
  const dir = path.join(DIST, 'assets');
  if (!fs.existsSync(dir)) {
    throw new Error('找不到 dist/，請先執行 npm run build');
  }
  const file = fs.readdirSync(dir).find((name) => name.endsWith('.js'));
  if (!file) throw new Error('dist/assets 裡沒有 .js');
  return path.join(dir, file);
}

const assets = collectAssets(PUBLIC_ASSETS);
const bundlePath = findBundle();
let bundle = fs.readFileSync(bundlePath, 'utf8');

// 把所有 "assets/..." 或 `assets/...${x}.png` 的字面值改成走 __A() 查表。
// 用反向參照確保前後引號一致，樣板字串裡的 ${} 不含引號所以一併涵蓋。
let rewrites = 0;
bundle = bundle.replace(/(["'`])(assets\/[^"'`]*)\1/g, (match) => {
  rewrites += 1;
  return `__A(${match})`;
});
if (rewrites === 0) throw new Error('bundle 裡找不到任何 assets/ 路徑，重寫規則需要更新');

const page = `<style>
  /* 刻意只做深色：這是一台遊戲機的殼，不是文件。
     所有顏色都明寫，不依賴宿主頁面的底色。 */
  :root {
    --ground: #12151c;
    --panel: #1b2030;   /* 遊戲裡對話框的底色 */
    --edge: #2b3450;
    --ink: #f4f0e8;     /* 遊戲裡的文字色 */
    --muted: #8e97ad;
    --accent: #ffd98a;  /* 遊戲裡選項游標的琥珀 */
    --sea: #2f5a8f;     /* 遊戲裡的水 */
    --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
    --sans: system-ui, -apple-system, "Noto Sans TC", "PingFang TC",
            "Microsoft JhengHei", sans-serif;
  }

  .island-page {
    background: var(--ground);
    color: var(--ink);
    font-family: var(--sans);
    line-height: 1.65;
    min-height: 100vh;
    margin: 0;
    padding: clamp(20px, 4vw, 56px) clamp(16px, 4vw, 32px) 64px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 28px;
  }

  .island-page * { box-sizing: border-box; }

  .shell { width: 100%; max-width: 1040px; display: flex; flex-direction: column; gap: 28px; }

  /* 卡匣標頭：這份檔案是一個程式專案的產出，就用程式的語彙標示它 */
  .rom-header {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 20px;
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted);
    padding-bottom: 14px;
    border-bottom: 1px solid var(--edge);
  }
  .rom-header b { color: var(--accent); font-weight: 500; }

  .titles { display: flex; flex-direction: column; gap: 6px; }
  .titles h1 {
    margin: 0;
    font-size: clamp(28px, 4.6vw, 42px);
    font-weight: 650;
    letter-spacing: -0.015em;
    text-wrap: balance;
  }
  .titles p { margin: 0; color: var(--muted); max-width: 62ch; font-size: 15px; }

  /* 螢幕：唯一一處花力氣的地方，水藍外暈把畫面從底色上撐起來 */
  .screen {
    position: relative;
    background: #15181f;
    border: 1px solid var(--edge);
    border-radius: 4px;
    padding: 10px;
    box-shadow:
      0 0 0 1px rgba(47, 90, 143, 0.35),
      0 24px 60px -28px rgba(47, 90, 143, 0.7),
      inset 0 1px 0 rgba(244, 240, 232, 0.06);
  }
  #app {
    width: 100%;
    aspect-ratio: 16 / 9;
    display: block;
    background: #15181f;
  }
  #app canvas { display: block; image-rendering: pixelated; }

  .screen:focus-within { border-color: var(--sea); }

  /* 還沒點擊時蓋在畫面上的提示，點掉之後鍵盤才會進到遊戲 */
  .veil {
    position: absolute;
    inset: 10px;
    display: grid;
    place-content: center;
    gap: 10px;
    text-align: center;
    background: rgba(18, 21, 28, 0.82);
    cursor: pointer;
    border: 0;
    color: inherit;
    font: inherit;
    z-index: 2;
  }
  .veil[hidden] { display: none; }
  .veil strong { font-size: 17px; font-weight: 600; }
  .veil span {
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .veil:focus-visible { outline: 2px solid var(--accent); outline-offset: -12px; }

  .keys {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(148px, 1fr));
    gap: 1px;
    background: var(--edge);
    border: 1px solid var(--edge);
    border-radius: 3px;
    overflow: hidden;
  }
  .keys div { background: var(--panel); padding: 12px 14px; }
  .keys dt {
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: 0.1em;
    color: var(--accent);
    margin: 0 0 3px;
  }
  .keys dd { margin: 0; font-size: 13px; color: var(--muted); }

  .notes { display: grid; gap: 14px; max-width: 68ch; font-size: 14.5px; color: var(--muted); }
  .notes h2 {
    margin: 0;
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ink);
  }
  .notes p { margin: 0; }
  .notes code {
    font-family: var(--mono);
    font-size: 0.88em;
    color: var(--ink);
    background: var(--panel);
    padding: 1px 5px;
    border-radius: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    * { animation: none !important; transition: none !important; }
  }
</style>

<div class="island-page">
  <div class="shell">
    <div class="rom-header">
      <span>Phaser <b>3.90</b></span>
      <span>Vite <b>7</b></span>
      <span>TypeScript</span>
      <span>960×540 · zoom <b>2</b></span>
      <span>60×40 tiles</span>
      <span>single file · <b>no network</b></span>
    </div>

    <div class="titles">
      <h1>島 · 像素遊戲起手式</h1>
      <p>俯視角像素 RPG 的骨架，整包塞進這一個檔案裡。能走、會撞牆、走得到樹後面，跟島上兩個人講得了話。</p>
    </div>

    <div class="screen">
      <button class="veil" id="veil" type="button">
        <strong>點一下開始</strong>
        <span>需要鍵盤焦點</span>
      </button>
      <div id="app"></div>
    </div>

    <dl class="keys">
      <div><dt>↑ ↓ ← → / WASD</dt><dd>移動</dd></div>
      <div><dt>SHIFT</dt><dd>跑</dd></div>
      <div><dt>SPACE / E</dt><dd>跟人講話、看牌子</dd></div>
      <div><dt>F1</dt><dd>顯示碰撞格與座標</dd></div>
      <div><dt>F9</dt><dd>清掉存檔重來</dd></div>
    </dl>

    <div class="notes">
      <h2>看什麼</h2>
      <p>往北走進石屋找<strong>長老</strong>，往南沿石板路找<strong>行腳商人</strong>。商人那段有分支選項，選了會記住——再跟他講一次，內容不一樣。路邊的木牌也可以看。</p>
      <p>走到樹的下半部時，樹冠會蓋在你頭上：角色的碰撞盒只有腳下 10×8 像素，不是整張圖。這是俯視角遊戲的手感關鍵。</p>
      <p>按 <code>F1</code> 會把碰撞格畫出來，順便顯示目前踩到哪一格、以及已經拿到哪些劇情旗標。</p>
      <h2>這個檔案</h2>
      <p>遊戲本體、Phaser、地圖、所有圖檔都內嵌在這一頁裡，不會對外連任何東西。原始碼與可編輯的 Tiled 地圖在 repo 的 <code>game/island/</code>。</p>
    </div>
  </div>
</div>

<script>
  // 內嵌資源表。bundle 裡所有 "assets/..." 都被改寫成 __A("assets/...")。
  var __ASSETS = ${JSON.stringify(assets)};
  function __A(p) { return __ASSETS[p] || p; }

  // iframe 裡的頁面預設沒有鍵盤焦點，先讓使用者點一下
  document.addEventListener('DOMContentLoaded', function () {
    var veil = document.getElementById('veil');
    if (!veil) return;
    veil.addEventListener('click', function () {
      veil.hidden = true;
      var canvas = document.querySelector('#app canvas');
      if (canvas) { canvas.setAttribute('tabindex', '0'); canvas.focus(); }
      window.focus();
    });
  });
</script>

<script type="module">
${bundle}
</script>
`;

fs.mkdirSync(OUT_DIR, { recursive: true });
const outFile = path.join(OUT_DIR, 'island.html');
fs.writeFileSync(outFile, page);

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(`寫入 ${path.relative(ROOT, outFile)}`);
console.log(`  bundle ${kb(bundle.length)}，資源 ${Object.keys(assets).length} 個（${kb(
  Object.values(assets).reduce((sum, uri) => sum + uri.length, 0),
)}），改寫 ${rewrites} 處路徑`);
console.log(`  總計 ${kb(page.length)}`);
