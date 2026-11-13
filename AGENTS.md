# AGENTS.md — YOLO 車牌辨識知識庫 (Plate-YOLO Wiki)

> 給 AI 代理（Claude、Codex、Copilot…）閱讀的專案規則。
> 修改或新增任何內容前，**請先完整讀完本文件**，並嚴格遵守。
> 本文件是本專案規則的**唯一真實來源**；`CLAUDE.md` 只是指向這裡。

---

## 1. 專案目的

這是丁國英（勤益科大 電機碩一乙）碩士論文的**研究知識庫網站**。
論文題目方向：以 YOLO 進行車牌偵測與辨識，用來找出報廢／違規車輛，
重點在**惡劣環境**（雨、霧、夜間、逆光、模糊），場景涵蓋**台灣與越南**的交通。

網站把讀過的論文、資料集、概念、評估方法整理成**格式一致的「知識條目 (Entry)」**，目的有三個：

1. **自己複習**：每個條目都用同樣的 8 個區塊，快速找回重點。
2. **寫論文**：每個條目都標註「對應論文章節」，寫第二章文獻探討時可以直接引用。
3. **讓 AI 接手**：AI 讀完本文件後，就能用同樣格式新增條目，不需要再重新說明。

目標讀者：電機／資工研究生，懂基本的深度學習與影像處理。

---

## 2. 技術限制（不可違反）

| 項目 | 規則 |
|---|---|
| 技術棧 | 純 HTML + CSS + 原生 JavaScript；**不使用**框架、建置工具、npm |
| 部署 | GitHub Pages（`main` 分支根目錄）；根目錄必須保留 `.nojekyll` |
| 外部資源 | 只允許 Google Fonts；**不得**引入其他 CDN、追蹤碼、廣告 |
| 圖片 | 圖解一律用**內嵌 SVG**；不放點陣圖，**不放任何真實車牌照片**（隱私） |
| 路徑 | 一律使用**相對路徑**（網站部署在 `/plate-yolo-wiki/` 子路徑下） |
| 語言 | 內文**繁體中文**；專有名詞第一次出現時附英文，例如「交併比 (Intersection over Union, IoU)」 |
| 車牌範例 | 示意車牌一律用**虛構號碼**，如 `ABC-1234`、`51A-123.45`，不可使用真實車牌 |

---

## 3. 檔案結構

```
plate-yolo-wiki/
├── AGENTS.md              ← 本文件（AI 規則）
├── CLAUDE.md              ← 只指向 AGENTS.md
├── README.md              ← 給人看的專案說明
├── .nojekyll
├── index.html             ← 首頁：條目總覽、分類篩選、搜尋（由 entries.js 自動產生）
├── assets/
│   ├── style.css          ← 全站唯一樣式表
│   ├── entries.js         ← 條目登錄表 (Registry)：所有條目的中繼資料
│   └── app.js             ← 首頁渲染／篩選／搜尋、內頁規格卡與上一頁下一頁
└── entries/
    ├── _template.html     ← 新條目模板（一定要複製它，不要從零寫）
    ├── yolo-basics.html
    ├── two-stage-lpr.html
    ├── aolp-dataset.html
    ├── adverse-weather.html
    └── map-iou.html
```

### 命名規則

- 條目檔名：`entries/<slug>.html`
- `slug`：全小寫英文、單字用 `-` 連接，不含空格、中文、底線。例：`ccpd-dataset`、`yolov8-arch`
- `slug` 必須與 `entries.js` 中的 `slug` **完全一致**，也必須等於該頁 `<body data-slug="...">`
- 編號 `no`：三位數字字串，依加入順序遞增（`"001"`、`"002"`…）。**已發佈的編號不可更改、不可重複使用**

---

## 4. 條目登錄表 `assets/entries.js`

首頁卡片、篩選、搜尋、內頁規格卡、上一頁／下一頁，**全部只從這個陣列讀資料**。
新增條目時必須在陣列末端加一筆，欄位如下（全部必填）：

```js
{
  no: "006",                        // 三位數編號
  slug: "ccpd-dataset",             // = 檔名
  title: "CCPD 中國停車場車牌資料集",  // 中文標題
  en: "CCPD Dataset",               // 英文名稱
  category: "資料集",                // 只能用下列 6 種之一（見下表）
  level: 1,                         // 難度：1 入門 / 2 中階 / 3 進階
  region: ["CN"],                   // 相關地區：TW, VN, CN, 通用（無特定地區用 ["通用"]）
  chapter: "2.3",                   // 對應論文章節（見第 7 節章節表）
  tags: ["資料集", "惡劣天氣"],       // 2~5 個標籤，用於搜尋
  summary: "一句話說明，40 字以內"
}
```

### `category` 只能是以下 6 種（首頁的篩選按鈕與顏色依此產生）

| category | 放什麼 |
|---|---|
| `基礎概念` | 物件偵測、YOLO 原理、錨框等基本知識 |
| `系統流程` | 車牌辨識的整體 pipeline、OCR、追蹤 |
| `資料集` | 公開車牌資料集、自建資料集的規劃 |
| `惡劣環境` | 雨、霧、夜間、模糊、逆光的問題與對策 |
| `評估指標` | IoU、mAP、Precision/Recall、FPS 等 |
| `模型架構` | 特定 YOLO 版本或改良模組 |

- 陣列依 `no` 由小到大排列。
- 不可刪除或改名既有欄位；若要加新欄位，必須**同時**更新本節與 `app.js`。
- 若要新增 category，必須同時更新本表、`style.css` 的 `--cat-*` 顏色變數、`app.js` 的 `CATEGORIES`。

---

## 5. 條目頁格式（每一頁都必須一致）

### 5.1 頁首

```html
<body data-slug="ccpd-dataset">
  ...
  <header class="entry-head">
    <p class="crumb"><a href="../index.html">知識庫</a> / <span data-fill="category"></span></p>
    <h1><span class="badge" data-fill="no"></span><span data-fill="title"></span><small data-fill="en"></small></h1>
    <dl class="spec" id="spec"></dl>   ← 規格卡，由 app.js 從 entries.js 自動填入，不要手寫
  </header>
```

標題、英文名、分類、規格卡**都由 app.js 自動填入**，確保頁面與登錄表永遠一致；`<title>` 則手寫為 `中文標題｜YOLO 車牌辨識知識庫`。

### 5.2 八個固定區塊

每個條目頁**必須依序**包含以下 8 個 `<section>`，`id` 不可更改、不可省略：

| 順序 | `id` | 顯示標題 | 內容要求 |
|---|---|---|---|
| 1 | `tldr` | 一句話重點 | 1~2 句，放在 `<p class="tldr">` |
| 2 | `concept` | 核心概念 | 2~4 段，先講「為什麼需要」，再講「怎麼做」 |
| 3 | `figure` | 圖解 | 1 張內嵌 SVG，遵守第 6.2 節規範，下面一行 `<p class="caption">` |
| 4 | `keypoints` | 重點整理 | 公式用 `<div class="eq">` + `<p class="eq-note">`；或表格 `<table class="kv">`；共 3~6 項 |
| 5 | `thesis` | 與我的論文的關係 | 包在 `<div class="thesis-box">`：說明這個條目在論文中**用在哪裡**、**要注意什麼**。這是本站最重要的區塊 |
| 6 | `pitfalls` | 常見問題與注意事項 | `<ul class="pitfalls">`，3~5 點 |
| 7 | `related` | 相關條目 | `<ul class="related">`，至少連結 1 個站內其他條目（相對路徑） |
| 8 | `references` | 參考資料 | `<ol class="refs">`，至少 2 筆，格式見 5.3 |

區塊標題用 `<h2>`，前面加編號 `<span class="sec-no">01</span>`。

### 5.3 參考文獻格式（IEEE 風格）

```
作者姓 名縮寫, …, "論文標題," 期刊/會議名稱, 卷(期), 頁碼, 年份.
```
例：`J. Redmon, S. Divvala, R. Girshick, A. Farhadi, "You Only Look Once: Unified, Real-Time Object Detection," CVPR, 2016.`

### 5.4 頁尾

只保留 `<nav id="pager"></nav>`，上一頁／下一頁由 `app.js` 依 `no` 順序自動產生，**不要手寫連結**。

---

## 6. 視覺風格

主題：**偵測框 (Detection Box)**——深色背景，卡片四角有像 YOLO 預測框的角標，
分類標籤長得像偵測結果的 label（例：`資料集 0.98`），標題用「車牌」造型的徽章。

### 6.1 顏色與字型

- 顏色只能使用 `style.css` 中 `:root` 定義的 CSS 變數，**不可**在 HTML 裡寫死色碼或使用 `style=""`。
  - `--bg` 背景、`--panel` 卡片、`--line` 線條、`--text` 文字、`--muted` 次要文字
  - `--accent` 偵測框綠（連結、強調）、`--plate` 車牌黃、`--warn` 注意事項紅
  - `--cat-concept` `--cat-pipeline` `--cat-dataset` `--cat-adverse` `--cat-metric` `--cat-arch`：6 種分類色
- 字型：內文 `Noto Sans TC`；公式、編號、程式碼 `JetBrains Mono`。
- 版面必須在手機寬度（360px）正常閱讀，不得出現水平捲軸；寬表格包在 `<div class="scroll-x">`。

### 6.2 圖解 (SVG) 規範

- `viewBox` 寬度固定 **720**，高度依內容；加上 `class="fig"`、`role="img"`、`aria-label="..."`。
- 方塊：`<rect class="node">` + `<text class="node-t">`；重點方塊加 `class="node hi"`。
- 箭頭線：`<path class="flow" marker-end="url(#arr)">`；虛線（回授、可選步驟）加 `class="flow dash"`。
- 偵測框示意：`<rect class="bbox">`（預測框）、`<rect class="bbox gt">`（真實框 ground truth）。
- 小字說明：`<text class="note-t">`。
- 每張 SVG 自帶 `<defs>` 裡的 `#arr` marker（每頁只有一張圖，不會衝突）。
- 不在 SVG 裡寫死顏色，顏色由 `style.css` 的 class 控制。

---

## 7. 論文章節對照表（`chapter` 欄位只能用這些值）

| chapter | 章節 |
|---|---|
| `1` | 第一章 緒論（研究動機、台越交通背景） |
| `2.1` | 2.1 物件偵測與 YOLO |
| `2.2` | 2.2 車牌辨識系統 |
| `2.3` | 2.3 車牌資料集 |
| `2.4` | 2.4 惡劣環境下的影像辨識 |
| `3` | 第三章 研究方法 |
| `4` | 第四章 實驗結果與評估 |

---

## 8. 新增一個條目的標準流程（AI 請照做）

1. 在 `entries.js` 搜尋 `slug` 與 `title`，確認沒有重複條目。
2. 在 `entries.js` **末端**新增一筆，`no` = 目前最大編號 + 1，欄位依第 4 節。
3. 複製 `entries/_template.html` 為 `entries/<slug>.html`。
4. 修改 `<body data-slug>` 與 `<title>`，替換所有 `{{ }}` 佔位符，填完 8 個區塊。
5. `related` 至少連一個既有條目；並回到被連結的那頁，在它的 `related` 補上反向連結。
6. 執行第 10 節檢查清單。
7. **不需要**修改 `index.html`——首頁卡片、篩選、搜尋會自動包含新條目。

### 給使用者的指令範例

使用者可能只會說一句話，例如：

> 「新增一個條目：CCPD 資料集。」

AI 應自行推斷 `category`=資料集、`chapter`=2.3，並依上面流程完成；不確定的欄位用最合理的值，並在回覆中說明。

---

## 9. AI 修改既有內容時的規則

- 只改被要求的部分；不要順手重構整站或改動其他條目的文字。
- 不可刪除既有條目檔案；要下架請在 `entries.js` 該筆加上 `hidden: true`（app.js 會略過）。
- 改動 `style.css` 變數名稱前，必須搜尋並更新所有引用處。
- **學術誠信**：論文作者、年份、數據必須正確；不確定時寫「（待查證）」，**不可自行編造**引用或實驗數字。
- 「與我的論文的關係」區塊是作者的研究規劃，AI 可以提出建議，但要用「可以…」「建議…」的語氣，不要寫成已完成的實驗結果。

---

## 10. 完成前檢查清單

- [ ] 8 個 `section` 都在，`id` 與順序正確
- [ ] `<body data-slug>` = 檔名 = `entries.js` 的 `slug`
- [ ] `category`、`chapter`、`region` 都使用允許的值
- [ ] 至少 1 個站內相關條目連結，且已補反向連結
- [ ] 至少 2 筆參考資料，格式符合 5.3
- [ ] 所有連結為相對路徑且點得開
- [ ] 沒有寫死的色碼、沒有 inline style、沒有真實車牌
- [ ] 手機寬度 360px 下無水平捲軸
- [ ] 首頁分類篩選與搜尋都找得到新條目
