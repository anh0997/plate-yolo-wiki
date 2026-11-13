// 條目登錄表 Registry — 欄位規則見 AGENTS.md 第 4 節
// 新增條目：在陣列「末端」加一筆，no = 目前最大編號 + 1
window.ENTRIES = [
  {
    no: "001",
    slug: "yolo-basics",
    title: "YOLO 物件偵測原理",
    en: "You Only Look Once",
    category: "基礎概念",
    level: 1,
    region: ["通用"],
    chapter: "2.1",
    tags: ["YOLO", "單階段偵測", "網格", "信心分數"],
    summary: "把整張影像切成網格，一次前向傳播同時預測框與類別。"
  },
  {
    no: "002",
    slug: "two-stage-lpr",
    title: "兩階段車牌辨識流程",
    en: "Two-Stage License Plate Recognition",
    category: "系統流程",
    level: 2,
    region: ["通用"],
    chapter: "2.2",
    tags: ["LPR", "車牌偵測", "字元辨識", "OCR"],
    summary: "先偵測車輛／車牌位置，再對裁切出的車牌做字元辨識。"
  },
  {
    no: "003",
    slug: "aolp-dataset",
    title: "AOLP 台灣車牌資料集",
    en: "Application-Oriented License Plate Dataset",
    category: "資料集",
    level: 1,
    region: ["TW"],
    chapter: "2.3",
    tags: ["資料集", "台灣", "AC/LE/RP"],
    summary: "台灣科技大學團隊發表的台灣車牌資料集，依應用情境分三組。"
  },
  {
    no: "004",
    slug: "adverse-weather",
    title: "惡劣天氣下的偵測挑戰",
    en: "Detection under Adverse Weather",
    category: "惡劣環境",
    level: 2,
    region: ["TW", "VN"],
    chapter: "2.4",
    tags: ["雨天", "霧", "夜間", "去霧", "熱成像"],
    summary: "雨、霧、夜間會降低對比與清晰度，使車牌偵測率明顯下降。"
  },
  {
    no: "005",
    slug: "map-iou",
    title: "IoU 與 mAP 評估指標",
    en: "IoU & mean Average Precision",
    category: "評估指標",
    level: 1,
    region: ["通用"],
    chapter: "4",
    tags: ["IoU", "mAP", "Precision", "Recall"],
    summary: "用框的重疊程度判斷對錯，再把 PR 曲線面積平均成 mAP。"
  }
];
