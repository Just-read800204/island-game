# 島 · 像素遊戲起手式

Phaser 3 + Vite + TypeScript 的俯視角像素遊戲骨架。跑起來就能走、能撞牆、能跟 NPC 講話。

這套組合是逆向 [nine-snake-island.pages.dev](https://nine-snake-island.pages.dev/)（《女兒島：最後的試煉》）之後
確認的技術棧，這裡把它重建成一個乾淨、可以直接往上長的起點。

```bash
npm install
npm run dev      # http://localhost:5173
```

| 指令 | 用途 |
|---|---|
| `npm run dev` | 開發伺服器，存檔即熱更新 |
| `npm run build` | 型別檢查 + 產出 `dist/` |
| `npm run preview` | 在本機預覽 build 出來的東西 |
| `npm run typecheck` | 只跑 `tsc --noEmit` |
| `npm run assets` | 重新產生佔位素材與地圖 |
| `npm run standalone` | 打包成單一 HTML 檔（`dist-standalone/island.html`） |

**操作**：方向鍵／WASD 移動、Shift 跑、空白鍵（或 E／Enter）互動、F1 除錯疊圖、F9 清存檔重來。

---

## 現在有什麼

- **Tiled 地圖載入**：`.tmj` 格式，三層地形 + 一層物件
- **Tile 碰撞**：完全由 Tiled 裡的 `collides` 屬性驅動，程式端一行 `setCollisionByProperty`
- **四方向走路動畫**、八方向移動（斜走已做 normalize，不會比直走快）
- **深度排序**：角色依 y 座標自動決定前後，樹冠會蓋在頭上
- **資料驅動的對話系統**：打字機效果、多頁、分支選項、旗標記憶、二次對話走不同內容
- **存檔**：localStorage，記位置與旗標
- **除錯疊圖**：F1 顯示碰撞格、座標、目前旗標
- **佔位素材產生器**：不依賴任何外部素材包，`npm run assets` 就能重生

## 目錄結構

```
tools/                 素材與地圖產生器（純 Node，不會進 bundle）
  png.mjs              極簡 PNG 編碼器
  gen-tileset.mjs      產生 terrain.png
  gen-characters.mjs   產生角色圖集
  gen-map.mjs          產生 island.tmj

public/assets/         執行期直接抓的檔案（Vite 原樣複製）
  tilesets/terrain.png
  characters/*.png
  maps/island.tmj

src/
  main.ts              Phaser 設定與啟動
  config.ts            所有可調的數值都在這
  types.ts             共用型別
  scenes/
    BootScene.ts       載入資源
    WorldScene.ts      地圖、玩家、NPC、互動偵測
    UIScene.ts         疊在世界上的 UI 層
  objects/
    Character.ts       玩家與 NPC 的共同基底
    Player.ts          鍵盤操作
    Npc.ts
  systems/
    events.ts          場景之間的型別安全事件匯流排
    state.ts           旗標與存檔
    animations.ts      角色動畫註冊
  ui/
    DialogueBox.ts     對話框（狀態 + 畫面）
  data/
    npcs.json          NPC 定義
    dialogues.json     對話內容
```

---

## 幾個做了選擇的地方

**canvas 用 960×540，世界靠鏡頭 zoom 2 放大。**
純像素風的做法是把內部解析度設成 480×270，但那樣中文字只剩幾個像素高，
UI 會慘不忍睹。這裡讓 canvas 維持 960×540（文字清楚），世界則用 `camera.setZoom(2)`
放大到等同 480×270 的視野。兩邊都拿到。原作也是同一個取捨。

**碰撞盒只有腳下 10×8，不是整張 16×24 的圖。**
這是俯視角遊戲的關鍵手感 —— 頭可以疊在樹叢前面，只有腳會被擋住。
在 `config.ts` 的 `BODY_WIDTH` / `BODY_HEIGHT` 調。

**用 Phaser 內建的 Arcade physics，不自己寫碰撞。**
原作自己寫了一整套 tile 碰撞判定，那是在解決 Phaser 已經解決的問題。
等你真的撞到 Arcade 的限制再換掉。

**用 Phaser 的 Tiled 解析器，不自己寫 parser。**
原作連 TMX 的 XML parser 都自己實作了。`load.tilemapTiledJSON` 已經夠用。

**按鍵只在 WorldScene 收，再用事件轉給 UI。**
兩個場景各自監聽同一顆按鍵的話，同一幀會被吃兩次 —— 按空白鍵開啟對話的那一幀，
對話框會立刻被翻到下一頁。集中在一處收就沒這個問題。

**對話內容放 JSON，不放在程式裡。**
原作是「一句台詞一張 PNG」，改字要重出圖。這裡改 `dialogues.json` 就好。

---

## 怎麼往下做

### 改地圖

用 [Tiled](https://www.mapeditor.org/) 打開 `public/assets/maps/island.tmj`，改完存檔，重新整理就生效。

- 想讓某種 tile 會擋路：在 Tiled 裡選那個 tile，加一個 `collides` 的 bool 屬性設為 true
- 想加新 NPC：在 `objects` 圖層放一個 Point，Type 設 `npc`，加自訂屬性 `npcId`，
  再去 `src/data/npcs.json` 補上這個 id 的定義
- 想加可查看的東西（牌子、箱子）：Point，Type 設 `interactable`，屬性 `dialogueId`

**不要再跑 `npm run assets`**，那會把你手改的地圖蓋掉。那支腳本只是給你一個不是空白的起點。

### 改對話

編輯 `src/data/dialogues.json`：

```jsonc
{
  "村長_初次": {
    "speaker": "村長",
    "redirectIfFlag": { "flag": "見過村長", "to": "村長_再次" },  // 講過就改播別段
    "pages": ["第一句。", "第二句。"],                              // 一頁一句
    "setFlag": "見過村長",                                        // 講完設旗標
    "choices": [                                                  // 最後一頁講完才出現
      { "label": "答應", "next": "村長_答應", "setFlag": "接了任務" },
      { "label": "拒絕", "next": "村長_拒絕" }
    ]
  }
}
```

旗標就是整個劇情系統。要做「拿到某物才能過」「見過某人才會出現新對話」，
一律用 `gameState.hasFlag()` 判斷。

### 換掉佔位素材

現在的圖是程式畫的，能看但不好看。要換成真的素材：

1. 免費來源：[itch.io 的免費像素素材](https://itch.io/game-assets/free/tag-pixel-art)、
   [Kenney.nl](https://kenney.nl/)（CC0）、Sprout Lands、Ninja Adventure Pack
2. **角色圖集**只要是 4 欄 × 4 列、順序為「下／左／右／上」，換上去就能直接跑。
   順序不一樣的話改 `src/systems/animations.ts` 的 `ROW_OF` 那張表，
   單格尺寸改 `config.ts` 的 `FRAME_WIDTH` / `FRAME_HEIGHT`
3. **tileset** 換掉之後，在 Tiled 裡重新指定圖片、重畫地圖就好

### 還沒做、但你早晚會需要的

- **音效**：現在完全沒有。至少先把 `this.sound.play()` 的呼叫點留出來，後期再補很痛
  （原作到最後都沒做，這是它最明顯的缺口）
- **場景轉換**：`this.cameras.main.fadeOut()` + `scene.start()`，進室內／換地圖用
- **標題畫面**：再開一個 `TitleScene` 放進 `main.ts` 的 `scene` 陣列最前面
- **背包／道具**：跟旗標同一套思路，塞進 `systems/state.ts`
- **手機操作**：Phaser 有 `this.input.addPointer()`，需要自己畫虛擬搖桿

---

## 部署

### 單一檔案（最快給人看的方式）

```bash
npm run standalone      # 產出 dist-standalone/island.html
```

Phaser、遊戲程式、地圖、所有圖檔都內嵌成 data URI，整份檔案不會發出任何對外請求。
直接用瀏覽器打開、丟進聊天室、附在信裡都能玩。約 1.2 MB。

原理：build 完之後把 bundle 裡的 `"assets/..."` 字面值改寫成查表函式，
再把整包塞進一個 HTML。細節在 `tools/build-standalone.mjs`。

### 一般靜態部署

`npm run build` 之後把 `dist/` 丟上任何靜態空間：

- **Cloudflare Pages**：build command `npm run build`，output directory `dist`（原作就是這樣）
- **Vercel / Netlify / GitHub Pages**：同上

`vite.config.ts` 裡 `base: './'` 已經設好，放在子路徑也不會壞。

---

## 佔位素材是怎麼來的

`tools/` 底下三支腳本用純 Node（沒有任何影像處理套件）逐像素畫出 PNG，
再手工組出符合 Tiled 1.10 格式的 `.tmj`。這樣做的理由：

- 不用煩惱素材包的授權
- 整份 repo 可重現，`npm run assets` 產出的東西每次都一模一樣
- 想調色調大小，改幾個常數就好

要看單張圖的細節，把 PNG 拖進任何看得到像素的檢視器即可。
