/* YOLO 車牌辨識知識庫 — 共用腳本
 * 首頁：卡片、分類篩選、搜尋、章節地圖
 * 條目頁：標題／規格卡自動填入、上一頁下一頁
 * 規則見 AGENTS.md；資料只讀 window.ENTRIES
 */
(function () {
  "use strict";

  // category → CSS class（新增分類時必須同步 AGENTS.md 第 4 節與 style.css）
  var CATEGORIES = {
    "基礎概念": "concept",
    "系統流程": "pipeline",
    "資料集": "dataset",
    "惡劣環境": "adverse",
    "評估指標": "metric",
    "模型架構": "arch"
  };

  // 用陣列保持章節順序（物件的數字鍵會被 JS 自動排序）
  var CHAPTER_ORDER = ["1", "2.1", "2.2", "2.3", "2.4", "3", "4"];
  var CHAPTERS = {
    "1": "第一章 緒論",
    "2.1": "2.1 物件偵測與 YOLO",
    "2.2": "2.2 車牌辨識系統",
    "2.3": "2.3 車牌資料集",
    "2.4": "2.4 惡劣環境下的影像辨識",
    "3": "第三章 研究方法",
    "4": "第四章 實驗結果與評估"
  };

  var LEVELS = { 1: "入門", 2: "中階", 3: "進階" };
  var REGIONS = { TW: "台灣", VN: "越南", CN: "中國", "通用": "通用" };

  var entries = (window.ENTRIES || [])
    .filter(function (e) { return !e.hidden; })
    .sort(function (a, b) { return a.no.localeCompare(b.no); });

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function catClass(cat) { return "cat-" + (CATEGORIES[cat] || "concept"); }
  function regionText(r) { return r.map(function (x) { return REGIONS[x] || x; }).join("、"); }

  /* ---------- 首頁 ---------- */
  function initHome() {
    var grid = document.getElementById("grid");
    var chips = document.getElementById("chips");
    var search = document.getElementById("search");
    var count = document.getElementById("count");
    var empty = document.getElementById("empty");
    var current = "全部";

    document.getElementById("stat-entries").textContent = entries.length;
    document.getElementById("stat-cats").textContent =
      Object.keys(CATEGORIES).filter(function (c) {
        return entries.some(function (e) { return e.category === c; });
      }).length;
    document.getElementById("stat-chapters").textContent =
      CHAPTER_ORDER.filter(function (c) {
        return entries.some(function (e) { return e.chapter === c; });
      }).length;

    ["全部"].concat(Object.keys(CATEGORIES)).forEach(function (cat) {
      var n = cat === "全部" ? entries.length
        : entries.filter(function (e) { return e.category === cat; }).length;
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chip" + (cat === "全部" ? " on" : " " + catClass(cat));
      b.innerHTML = esc(cat) + ' <span class="chip-n">' + n + "</span>";
      b.setAttribute("aria-pressed", cat === "全部" ? "true" : "false");
      b.addEventListener("click", function () {
        current = cat;
        Array.prototype.forEach.call(chips.children, function (c) {
          c.classList.remove("on");
          c.setAttribute("aria-pressed", "false");
        });
        b.classList.add("on");
        b.setAttribute("aria-pressed", "true");
        render();
      });
      chips.appendChild(b);
    });

    search.addEventListener("input", render);

    function match(e, q) {
      if (!q) return true;
      var hay = [e.title, e.en, e.summary, e.category, e.no].concat(e.tags).join(" ").toLowerCase();
      return q.split(/\s+/).every(function (w) { return hay.indexOf(w) !== -1; });
    }

    function render() {
      var q = search.value.trim().toLowerCase();
      var list = entries.filter(function (e) {
        return (current === "全部" || e.category === current) && match(e, q);
      });
      grid.innerHTML = list.map(card).join("");
      count.textContent = list.length + " / " + entries.length + " 條目";
      empty.hidden = list.length > 0;
    }

    function card(e) {
      return (
        '<a class="card ' + catClass(e.category) + '" href="entries/' + esc(e.slug) + '.html">' +
          '<span class="corner tl"></span><span class="corner tr"></span>' +
          '<span class="corner bl"></span><span class="corner br"></span>' +
          '<span class="det-label">' + esc(e.category) + " · Lv." + e.level + "</span>" +
          '<span class="plate">No.' + esc(e.no) + "</span>" +
          "<h3>" + esc(e.title) + "</h3>" +
          '<p class="en">' + esc(e.en) + "</p>" +
          '<p class="sum">' + esc(e.summary) + "</p>" +
          '<p class="meta"><span>§' + esc(e.chapter) + "</span><span>" + esc(regionText(e.region)) + "</span></p>" +
          '<p class="tags">' + e.tags.map(function (t) { return "<span>#" + esc(t) + "</span>"; }).join("") + "</p>" +
        "</a>"
      );
    }

    // 論文章節地圖
    var map = document.getElementById("chapter-map");
    map.innerHTML = CHAPTER_ORDER.map(function (ch) {
      var list = entries.filter(function (e) { return e.chapter === ch; });
      return (
        '<li class="' + (list.length ? "" : "is-empty") + '">' +
          '<span class="ch-name">' + esc(CHAPTERS[ch]) + "</span>" +
          '<span class="ch-links">' +
            (list.length
              ? list.map(function (e) {
                  return '<a href="entries/' + esc(e.slug) + '.html">' + esc(e.no) + " " + esc(e.title) + "</a>";
                }).join("")
              : '<span class="todo">尚無條目</span>') +
          "</span>" +
        "</li>"
      );
    }).join("");

    render();
  }

  /* ---------- 條目頁 ---------- */
  function initEntry(slug) {
    var idx = -1;
    entries.forEach(function (e, i) { if (e.slug === slug) idx = i; });
    if (idx === -1) {
      console.warn("[plate-yolo-wiki] entries.js 找不到 slug:", slug);
      return;
    }
    var e = entries[idx];
    document.body.classList.add(catClass(e.category));

    Array.prototype.forEach.call(document.querySelectorAll("[data-fill]"), function (el) {
      var k = el.getAttribute("data-fill");
      if (k === "no") el.textContent = "No." + e.no;
      else if (e[k] !== undefined) el.textContent = e[k];
    });

    var spec = document.getElementById("spec");
    if (spec) {
      var rows = [
        ["編號", "No." + e.no],
        ["分類", e.category],
        ["難度", "Lv." + e.level + " " + LEVELS[e.level]],
        ["地區", regionText(e.region)],
        ["論文章節", CHAPTERS[e.chapter] || e.chapter],
        ["標籤", e.tags.map(function (t) { return "#" + t; }).join(" ")]
      ];
      spec.innerHTML = rows.map(function (r) {
        return "<div><dt>" + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd></div>";
      }).join("");
    }

    var pager = document.getElementById("pager");
    if (pager) {
      var prev = entries[idx - 1], next = entries[idx + 1];
      pager.innerHTML =
        (prev ? '<a class="prev" href="' + esc(prev.slug) + '.html"><small>← 上一條 No.' + esc(prev.no) + "</small>" + esc(prev.title) + "</a>" : "<span></span>") +
        '<a class="home" href="../index.html">全部條目</a>' +
        (next ? '<a class="next" href="' + esc(next.slug) + '.html"><small>下一條 No.' + esc(next.no) + " →</small>" + esc(next.title) + "</a>" : "<span></span>");
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    var slug = document.body.getAttribute("data-slug");
    if (slug) initEntry(slug);
    else if (document.getElementById("grid")) initHome();
  });
})();
