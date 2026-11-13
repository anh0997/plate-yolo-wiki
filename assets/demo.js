/* 車牌辨識實驗室 demo.html 專用腳本（規則見 AGENTS.md 第 11 節）
 * 流程：上傳 → ① 車牌定位（YOLO onnx 自動 / 手動框選）→ ② OCR → ③ 格式檢查 → 與正確答案比對
 * 照片只在瀏覽器內處理，不上傳、不儲存。
 */
(function () {
  "use strict";

  // 外部函式庫：版本固定，只有本頁使用（AGENTS.md 第 2 節例外條款）
  var LIBS = {
    tesseract: "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js",
    ort: "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/ort.min.js",
    ortWasm: "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/"
  };
  var MODEL_URL = "models/plate.onnx";
  var YOLO_SIZE = 640;
  var CONF_TH = 0.25, NMS_TH = 0.45;

  /* ---------- 車牌格式（簡化版，待查證完整法規） ----------
   * L = 英文字母、D = 數字；fmt 決定顯示格式
   */
  var FORMATS = [
    { region: "台灣", name: "新式（汽車／機車）", tpl: "LLLDDDD", fmt: [3, "-"] },
    { region: "台灣", name: "舊式機車", tpl: "LLLDDD", fmt: [3, "-"] },
    { region: "台灣", name: "舊式機車", tpl: "DDDLLL", fmt: [3, "-"] },
    { region: "台灣", name: "舊式汽車", tpl: "LLDDDD", fmt: [2, "-"] },
    { region: "台灣", name: "舊式汽車", tpl: "DDDDLL", fmt: [4, "-"] },
    { region: "越南", name: "汽車（5 碼）", tpl: "DDLDDDDD", vn: "car5" },
    { region: "越南", name: "汽車（5 碼）", tpl: "DDLLDDDDD", vn: "car5" },
    { region: "越南", name: "汽車（4 碼）", tpl: "DDLDDDD", vn: "car4" },
    { region: "越南", name: "機車（5 碼）", tpl: "DDLDDDDDD", vn: "moto5" },
    { region: "越南", name: "機車（4 碼）", tpl: "DDLDDDDD", vn: "moto4" }
  ];
  // 易混字元（模糊時 OCR 常搞混）
  var TO_DIGIT = { O: "0", Q: "0", D: "0", U: "0", I: "1", L: "1", T: "1", Z: "2", S: "5", G: "6", B: "8" };
  var TO_LETTER = { "0": "O", "1": "I", "2": "Z", "5": "S", "6": "G", "8": "B", "4": "A", "7": "T" };

  var $ = function (id) { return document.getElementById(id); };
  var img = null;          // 原始影像
  var box = null;          // 車牌框（原圖座標）{x,y,w,h}
  var autoBoxes = [];      // YOLO 偵測結果
  var session = null;      // onnx session
  var worker = null;       // tesseract worker
  var workerPsm = null;
  var last = null;         // 最近一次辨識結果
  var logs = [];

  /* ---------- 共用 ---------- */
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[src="' + src + '"]')) return resolve();
      var s = document.createElement("script");
      s.src = src; s.async = true;
      s.onload = resolve;
      s.onerror = function () { reject(new Error("無法載入 " + src)); };
      document.head.appendChild(s);
    });
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function show(id) { $(id).hidden = false; }
  function setStatus(state, html) {
    var el = $("model-status");
    el.setAttribute("data-state", state);
    el.innerHTML = html;
  }

  /* ---------- 模型檢查 ---------- */
  function checkModel() {
    fetch(MODEL_URL, { method: "HEAD", cache: "no-store" }).catch(function () {
      return { ok: false };                       // 連不到也視為「沒有模型」
    }).then(function (r) {
      if (!r.ok) throw new Error("no model");
      setStatus("loading", "偵測到 <code>models/plate.onnx</code>，YOLO 模型載入中…");
      return loadScript(LIBS.ort).then(function () {
        window.ort.env.wasm.wasmPaths = LIBS.ortWasm;
        return window.ort.InferenceSession.create(MODEL_URL, { executionProviders: ["wasm"] });
      }).then(function (s) {
        session = s;
        setStatus("on", "① 自動偵測：<strong>已啟用</strong>（YOLO · " + esc(s.inputNames[0]) + "）");
        $("btn-auto").hidden = false;
        if (img) runDetect();
      });
    }).catch(function (e) {
      session = null;
      if (e && e.message !== "no model") {
        setStatus("off", "① 自動偵測：模型載入失敗（" + esc(e.message) + "），請改用手動框選。");
      } else {
        setStatus("off", "① 自動偵測：<strong>未啟用</strong>，尚未放入 <code>models/plate.onnx</code>。請在圖上手動框出車牌。");
      }
    });
  }

  /* ---------- 上傳 ---------- */
  function onFile(file) {
    if (!file || !/^image\//.test(file.type)) return;
    var url = URL.createObjectURL(file);
    var im = new Image();
    im.onload = function () {
      img = im; box = null; autoBoxes = []; last = null;
      show("step-locate");
      $("step-ocr").hidden = true;
      $("step-result").hidden = true;
      draw();
      if (session) runDetect();
      $("step-locate").scrollIntoView({ behavior: "smooth", block: "start" });
    };
    im.src = url;
  }
  $("file").addEventListener("change", function (e) { onFile(e.target.files[0]); });
  var drop = $("drop");
  ["dragenter", "dragover"].forEach(function (t) {
    drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add("over"); });
  });
  ["dragleave", "drop"].forEach(function (t) {
    drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove("over"); });
  });
  drop.addEventListener("drop", function (e) { onFile(e.dataTransfer.files[0]); });

  /* ---------- 畫面與框選 ---------- */
  var view = $("view");
  var vctx = view.getContext("2d");
  var scale = 1;

  function draw(tmp) {
    if (!img) return;
    var maxW = $("stage").clientWidth || 800;
    scale = Math.min(1, maxW / img.naturalWidth, 560 / img.naturalHeight);
    view.width = Math.round(img.naturalWidth * scale);
    view.height = Math.round(img.naturalHeight * scale);
    vctx.drawImage(img, 0, 0, view.width, view.height);
    var cs = getComputedStyle(document.documentElement);
    var green = cs.getPropertyValue("--accent").trim();
    var yellow = cs.getPropertyValue("--plate").trim();
    autoBoxes.forEach(function (b) {
      vctx.strokeStyle = yellow; vctx.lineWidth = 1.5; vctx.setLineDash([5, 4]);
      vctx.strokeRect(b.x * scale, b.y * scale, b.w * scale, b.h * scale);
    });
    vctx.setLineDash([]);
    var b = tmp || box;
    if (b) {
      vctx.strokeStyle = green; vctx.lineWidth = 2.5;
      vctx.strokeRect(b.x * scale, b.y * scale, b.w * scale, b.h * scale);
      if (b.score !== undefined) {
        var label = "plate " + b.score.toFixed(2);
        vctx.font = "bold 12px monospace";
        var tw = vctx.measureText(label).width + 10;
        vctx.fillStyle = green;
        vctx.fillRect(b.x * scale - 1, Math.max(0, b.y * scale - 18), tw, 18);
        vctx.fillStyle = "#0d1114";
        vctx.fillText(label, b.x * scale + 4, Math.max(13, b.y * scale - 5));
      }
    }
  }
  window.addEventListener("resize", function () { draw(); });

  var dragStart = null;
  function pos(e) {
    var r = view.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(img.naturalWidth, (e.clientX - r.left) / r.width * img.naturalWidth)),
      y: Math.max(0, Math.min(img.naturalHeight, (e.clientY - r.top) / r.height * img.naturalHeight))
    };
  }
  function rectFrom(a, b) {
    return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
  }
  view.addEventListener("pointerdown", function (e) {
    if (!img) return;
    dragStart = pos(e);
    view.setPointerCapture(e.pointerId);
  });
  view.addEventListener("pointermove", function (e) {
    if (!dragStart) return;
    draw(rectFrom(dragStart, pos(e)));
  });
  view.addEventListener("pointerup", function (e) {
    if (!dragStart) return;
    var r = rectFrom(dragStart, pos(e));
    dragStart = null;
    if (r.w < 8 || r.h < 4) { draw(); return; }
    setBox(r);
  });
  $("btn-full").addEventListener("click", function () {
    setBox({ x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight });
  });
  $("btn-auto").addEventListener("click", function () { runDetect(); });

  function setBox(b) {
    box = b;
    $("box-info").textContent = "框選範圍：" + Math.round(b.w) + " × " + Math.round(b.h) + " px";
    draw();
    show("step-ocr");
    renderCrop();
  }

  /* ---------- ① YOLO 自動偵測（YOLOv8 ONNX 匯出格式） ---------- */
  function runDetect() {
    if (!session || !img) return;
    $("locate-hint").textContent = "YOLO 偵測中…";
    var S = YOLO_SIZE;
    var c = document.createElement("canvas");
    c.width = S; c.height = S;
    var ctx = c.getContext("2d");
    var r = Math.min(S / img.naturalWidth, S / img.naturalHeight);
    var nw = Math.round(img.naturalWidth * r), nh = Math.round(img.naturalHeight * r);
    var px = Math.floor((S - nw) / 2), py = Math.floor((S - nh) / 2);
    ctx.fillStyle = "rgb(114,114,114)";
    ctx.fillRect(0, 0, S, S);
    ctx.drawImage(img, px, py, nw, nh);
    var d = ctx.getImageData(0, 0, S, S).data;
    var input = new Float32Array(3 * S * S);
    for (var i = 0; i < S * S; i++) {
      input[i] = d[i * 4] / 255;
      input[i + S * S] = d[i * 4 + 1] / 255;
      input[i + 2 * S * S] = d[i * 4 + 2] / 255;
    }
    var feeds = {};
    feeds[session.inputNames[0]] = new window.ort.Tensor("float32", input, [1, 3, S, S]);
    session.run(feeds).then(function (out) {
      var t = out[session.outputNames[0]];
      autoBoxes = decodeYolo(t.data, t.dims, r, px, py);
      if (autoBoxes.length) {
        $("locate-hint").textContent = "YOLO 找到 " + autoBoxes.length + " 個車牌（綠框為信心最高者）。不準的話可以手動重新框選。";
        setBox(autoBoxes[0]);
      } else {
        $("locate-hint").textContent = "YOLO 沒有找到車牌，請手動框選。";
        draw();
      }
    }).catch(function (e) {
      $("locate-hint").textContent = "偵測失敗（" + e.message + "），請手動框選。";
    });
  }

  // 輸出 dims = [1, 4 + 類別數, N]；前 4 列為 cx, cy, w, h（640 座標）
  function decodeYolo(data, dims, r, px, py) {
    var C = dims[1], N = dims[2], cand = [];
    for (var i = 0; i < N; i++) {
      var best = 0;
      for (var k = 4; k < C; k++) best = Math.max(best, data[k * N + i]);
      if (best < CONF_TH) continue;
      var cx = data[i], cy = data[N + i], w = data[2 * N + i], h = data[3 * N + i];
      cand.push({
        x: Math.max(0, (cx - w / 2 - px) / r), y: Math.max(0, (cy - h / 2 - py) / r),
        w: w / r, h: h / r, score: best
      });
    }
    cand.sort(function (a, b) { return b.score - a.score; });
    var keep = [];
    cand.forEach(function (b) {
      if (keep.every(function (k) { return iou(k, b) < NMS_TH; })) keep.push(b);
    });
    return keep.slice(0, 10);
  }
  function iou(a, b) {
    var x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y);
    var x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
    var inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    return inter / (a.w * a.h + b.w * b.h - inter);
  }

  /* ---------- 前處理：裁切 → 放大 → 傾斜校正 → 灰階 → Otsu → 清除邊框雜訊 → 補白邊 ----------
   * OCR 會跑三種版本（variants），再挑最可信的結果：
   *   A = 二值化 + 清除雜訊（預設預覽）  B = 只轉灰階  C = 二值化但不清除
   */
  var crop = $("crop");
  var angleDeg = 0;

  function layoutRows() { return document.querySelector('input[name="layout"]:checked').value === "6" ? 2 : 1; }

  // 把框選範圍畫到新畫布：放大到字高適中，並依角度旋轉（空白處補白）
  function baseCanvas(angle) {
    var rows = layoutRows();
    var targetH = rows === 2 ? 220 : 130;
    var k = Math.min(4, targetH / box.h);
    var w = Math.max(1, Math.round(box.w * k)), h = Math.max(1, Math.round(box.h * k));
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    var ctx = c.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.translate(w / 2, h / 2);
    ctx.rotate(angle * Math.PI / 180);
    ctx.drawImage(img, box.x, box.y, box.w, box.h, -w / 2, -h / 2, w, h);
    return c;
  }
  // 回傳灰階陣列；旋轉後空出的透明區域記為 mask=0，不參與門檻計算
  function toGray(c) {
    var d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    var n = c.width * c.height, g = new Uint8ClampedArray(n), m = new Uint8Array(n), inv = $("opt-inv").checked;
    for (var i = 0; i < n; i++) {
      m[i] = d[i * 4 + 3] > 200 ? 1 : 0;
      var v = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
      g[i] = m[i] ? (inv ? 255 - v : v) : 255;
    }
    g.mask = m;
    return g;
  }
  function binarize(g) {
    var vals = [];
    for (var i = 0; i < g.length; i++) if (g.mask[i]) vals.push(g[i]);
    var th = otsu(vals), b = new Uint8Array(g.length);   // 1 = 黑（字）
    for (var j = 0; j < g.length; j++) b[j] = g.mask[j] && g[j] <= th ? 1 : 0;
    return b;
  }
  // 連通元件分析：保留「像字元」的黑色區塊，刪掉碰到邊框的大塊、太扁或太小的雜訊
  function cleanBinary(b, W, H, rows) {
    var label = new Int32Array(W * H), stack = [], comps = [];
    var lineH = H / rows;
    for (var p0 = 0; p0 < W * H; p0++) {
      if (!b[p0] || label[p0]) continue;
      var id = comps.length + 1;
      var px = [], minX = W, maxX = 0, minY = H, maxY = 0, edge = false;
      stack.push(p0); label[p0] = id;
      while (stack.length) {
        var p = stack.pop(), x = p % W, y = (p - x) / W;
        px.push(p);
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (x === 0 || y === 0 || x === W - 1 || y === H - 1) edge = true;
        if (x > 0 && b[p - 1] && !label[p - 1]) { label[p - 1] = id; stack.push(p - 1); }
        if (x < W - 1 && b[p + 1] && !label[p + 1]) { label[p + 1] = id; stack.push(p + 1); }
        if (y > 0 && b[p - W] && !label[p - W]) { label[p - W] = id; stack.push(p - W); }
        if (y < H - 1 && b[p + W] && !label[p + W]) { label[p + W] = id; stack.push(p + W); }
      }
      comps.push({ px: px, minX: minX, maxX: maxX, minY: minY, maxY: maxY, edge: edge,
                   w: maxX - minX + 1, h: maxY - minY + 1 });
    }
    // 1) 主要字元：高度合理、不會太寬、長寬比像字、不是貼邊的直線
    comps.forEach(function (c) {
      var ratio = c.h / c.w;
      var density = c.px.length / (c.w * c.h);
      var nearSide = c.minX < 0.1 * W || c.maxX > 0.9 * W;
      var edgeLine = nearSide && (ratio > 8 || (density < 0.18 && ratio > 1.5));   // 車牌外框、斜邊
      c.keep = c.h >= 0.28 * lineH && c.h <= 0.98 * lineH && c.w <= 0.3 * W &&
               ratio >= 0.9 && ratio <= 12 && !edgeLine && !(c.edge && c.h > 0.95 * lineH);
    });
    // 1b) 單行車牌：字元高度相近、排在同一列，刪掉高度或位置差太多的區塊
    if (rows === 1) {
      var ks = comps.filter(function (c) { return c.keep; });
      if (ks.length >= 3) {
        var hs = ks.map(function (c) { return c.h; }).sort(function (a, b) { return a - b; });
        var cy = ks.map(function (c) { return (c.minY + c.maxY) / 2; }).sort(function (a, b) { return a - b; });
        var mh = hs[hs.length >> 1], my = cy[cy.length >> 1];
        ks.forEach(function (c) {
          if (Math.abs(c.h - mh) > 0.3 * mh || Math.abs((c.minY + c.maxY) / 2 - my) > 0.3 * mh) c.keep = false;
        });
      }
    }
    // 2) 救回字元的碎片：完全落在字元高度範圍內、不碰邊的小區塊（例如 E 斷掉的橫線）
    var kept = comps.filter(function (c) { return c.keep; });
    if (kept.length) {
      var top = Math.min.apply(null, kept.map(function (c) { return c.minY; }));
      var bot = Math.max.apply(null, kept.map(function (c) { return c.maxY; }));
      var left = Math.min.apply(null, kept.map(function (c) { return c.minX; }));
      var right = Math.max.apply(null, kept.map(function (c) { return c.maxX; }));
      comps.forEach(function (c) {
        if (!c.keep && !c.edge && c.minY >= top - 2 && c.maxY <= bot + 2 &&
            c.minX >= left - 0.05 * W && c.maxX <= right + 0.05 * W && c.px.length >= 15 && c.w <= 0.3 * W) c.keep = true;
      });
    }
    var out = new Uint8Array(W * H);
    comps.forEach(function (c) { if (c.keep) c.px.forEach(function (q) { out[q] = 1; }); });
    return out;
  }
  // 傾斜估計：找讓「字元黑點的水平投影」最集中的角度
  function estimateAngle() {
    var c = baseCanvas(0), W = c.width, H = c.height;
    var kept = cleanBinary(binarize(toGray(c)), W, H, layoutRows());
    var pts = [];
    for (var i = 0; i < W * H; i += 2) if (kept[i]) pts.push(i);
    if (pts.length < 50) return 0;
    var best = 0, bestScore = -1;
    for (var a = -25; a <= 25; a += 1) {
      var t = a * Math.PI / 180, sn = Math.sin(t), cs = Math.cos(t), bins = {};
      for (var j = 0; j < pts.length; j++) {
        var x = pts[j] % W - W / 2, y = (pts[j] - pts[j] % W) / W - H / 2;
        var yy = Math.round(x * sn + y * cs);
        bins[yy] = (bins[yy] || 0) + 1;
      }
      var score = 0;
      for (var key in bins) score += bins[key] * bins[key];
      if (score > bestScore) { bestScore = score; best = a; }
    }
    return best;
  }
  function paint(bits, W, H, isGray) {
    var pad = Math.round(H * 0.18);
    var c = document.createElement("canvas");
    c.width = W + pad * 2; c.height = H + pad * 2;
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    var id = ctx.createImageData(W, H), d = id.data;
    for (var i = 0; i < W * H; i++) {
      var v = isGray ? bits[i] : (bits[i] ? 0 : 255);
      d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255;
    }
    ctx.putImageData(id, pad, pad);
    return c;
  }
  function makeVariant(kind) {
    var c = baseCanvas(angleDeg), W = c.width, H = c.height, g = toGray(c);
    if (kind === "B") return paint(g, W, H, true);
    var b = binarize(g);
    if (kind === "C") return paint(b, W, H, false);
    return paint(cleanBinary(b, W, H, layoutRows()), W, H, false);
  }
  function renderCrop() {
    if (!box) return;
    angleDeg = $("opt-deskew").checked ? estimateAngle() : 0;
    var v = makeVariant("A");
    crop.width = v.width; crop.height = v.height;
    crop.getContext("2d").drawImage(v, 0, 0);
    $("angle-info").textContent = $("opt-deskew").checked ? "傾斜校正：" + (angleDeg > 0 ? "+" : "") + angleDeg + "°" : "";
  }
  function otsu(g) {
    var hist = new Array(256).fill(0), n = g.length;
    for (var i = 0; i < n; i++) hist[g[i]]++;
    var sum = 0;
    for (var t = 0; t < 256; t++) sum += t * hist[t];
    var sumB = 0, wB = 0, best = 0, th = 127;
    for (var u = 0; u < 256; u++) {
      wB += hist[u]; if (!wB) continue;
      var wF = n - wB; if (!wF) break;
      sumB += u * hist[u];
      var mB = sumB / wB, mF = (sum - sumB) / wF;
      var between = wB * wF * (mB - mF) * (mB - mF);
      if (between > best) { best = between; th = u; }
    }
    return th;
  }
  $("opt-deskew").addEventListener("change", renderCrop);
  $("opt-inv").addEventListener("change", renderCrop);
  Array.prototype.forEach.call(document.querySelectorAll('input[name="layout"]'), function (r) {
    r.addEventListener("change", renderCrop);
  });

  /* ---------- ② OCR ---------- */
  function getWorker(psm) {
    var p = loadScript(LIBS.tesseract).then(function () {
      if (worker) return worker;
      return window.Tesseract.createWorker("eng", 1, {
        logger: function (m) {
          if (m.status) $("ocr-progress").textContent = m.status + (m.progress ? " " + Math.round(m.progress * 100) + "%" : "");
        }
      }).then(function (w) { worker = w; return w; });
    });
    return p.then(function (w) {
      if (workerPsm === psm) return w;
      return w.setParameters({
        tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-.",
        tessedit_pageseg_mode: psm,
        user_defined_dpi: "300"
      }).then(function () { workerPsm = psm; return w; });
    });
  }

  var VARIANTS = [
    { kind: "A", name: "二值化＋清除雜訊" },
    { kind: "B", name: "灰階" },
    { kind: "C", name: "二值化" }
  ];
  function scoreOf(a, conf) {
    var s = conf * 0.5;
    if (a.format) s += a.fixes ? 40 - 8 * a.fixes : 60;
    return s;
  }
  $("btn-ocr").addEventListener("click", function () {
    if (!box) return;
    var btn = $("btn-ocr");
    var psm = document.querySelector('input[name="layout"]:checked').value;
    btn.disabled = true;
    $("ocr-progress").textContent = "載入 OCR 引擎（第一次約需數秒）…";
    var t0 = performance.now(), cands = [];
    getWorker(psm).then(function (w) {
      var chain = Promise.resolve();
      VARIANTS.forEach(function (v, i) {
        chain = chain.then(function () {
          $("ocr-progress").textContent = "辨識中 " + (i + 1) + " / " + VARIANTS.length + "（" + v.name + "）";
          return w.recognize(makeVariant(v.kind)).then(function (res) {
            var text = res.data.text || "", conf = res.data.confidence || 0, a = analyse(text);
            cands.push({ variant: v.name, raw: text, conf: conf, a: a, score: scoreOf(a, conf) });
          });
        });
      });
      return chain;
    }).then(function () {
      // 多個版本得到相同結果時加分（互相印證）
      cands.forEach(function (c) {
        var agree = cands.filter(function (o) { return o !== c && o.a.text && o.a.text === c.a.text; }).length;
        c.score += agree * 15;
      });
      cands.sort(function (x, y) { return y.score - x.score; });
      showResult(cands[0], cands, performance.now() - t0);
      $("ocr-progress").textContent = "完成";
    }).catch(function (e) {
      $("ocr-progress").textContent = "辨識失敗：" + e.message + "（請確認網路連線）";
    }).then(function () { btn.disabled = false; });
  });

  /* ---------- ③ 後處理：格式檢查與易混字修正 ---------- */
  function compact(s) { return String(s).toUpperCase().replace(/[^A-Z0-9]/g, ""); }
  function fits(s, tpl) {
    if (s.length !== tpl.length) return false;
    for (var i = 0; i < s.length; i++) {
      var isD = /\d/.test(s[i]);
      if (tpl[i] === "D" ? !isD : isD) return false;
    }
    return true;
  }
  function coerce(s, tpl) {
    if (s.length !== tpl.length) return null;
    var out = "", fixes = 0;
    for (var i = 0; i < s.length; i++) {
      var ch = s[i], isD = /\d/.test(ch);
      if (tpl[i] === "D" && !isD) { if (!TO_DIGIT[ch]) return null; ch = TO_DIGIT[ch]; fixes++; }
      else if (tpl[i] === "L" && isD) { if (!TO_LETTER[ch]) return null; ch = TO_LETTER[ch]; fixes++; }
      out += ch;
    }
    return { text: out, fixes: fixes };
  }
  function pretty(s, f) {
    if (f.fmt) return s.slice(0, f.fmt[0]) + f.fmt[1] + s.slice(f.fmt[0]);
    var head = f.tpl.indexOf("LL") === 2 ? 4 : 3;           // 省市代碼 + 系列
    if (f.vn === "car5") return s.slice(0, head) + "-" + s.slice(head, head + 3) + "." + s.slice(head + 3);
    if (f.vn === "car4") return s.slice(0, 3) + "-" + s.slice(3);
    if (f.vn === "moto5") return s.slice(0, 2) + "-" + s.slice(2, 4) + " " + s.slice(4, 7) + "." + s.slice(7);
    if (f.vn === "moto4") return s.slice(0, 2) + "-" + s.slice(2, 4) + " " + s.slice(4);
    return s;
  }
  function analyse(raw) {
    var c = compact(raw);
    var exact = FORMATS.filter(function (f) { return fits(c, f.tpl); });
    if (exact.length) return { text: c, display: pretty(c, exact[0]), format: exact[0], fixes: 0, all: exact };
    var bestFix = null;
    FORMATS.forEach(function (f) {
      var r = coerce(c, f.tpl);
      if (r && (!bestFix || r.fixes < bestFix.fixes)) bestFix = { text: r.text, display: pretty(r.text, f), format: f, fixes: r.fixes, all: [f] };
    });
    return bestFix || { text: c, display: c || "—", format: null, fixes: 0, all: [] };
  }

  function showResult(best, cands, ms) {
    var a = best.a, conf = best.conf;
    last = { raw: best.raw.trim(), conf: conf, ms: ms, a: a };
    show("step-result");
    $("plate-out").textContent = a.display;
    $("plate-out").setAttribute("data-ok", a.format ? "yes" : "no");
    var fmt = a.format
      ? a.format.region + " · " + a.format.name + (a.all.length > 1 ? "（也可能是 " + a.all.slice(1).map(function (f) { return f.region + f.name; }).join("、") + "）" : "")
      : "不符合已知格式";
    var rows = [
      ["OCR 原始輸出", last.raw.replace(/\s+/g, " ") || "（空白）"],
      ["OCR 信心分數", conf.toFixed(0) + " / 100"],
      ["格式判斷", fmt],
      ["易混字修正", a.fixes ? a.fixes + " 個字元（例如 O→0、B→8）" : "無"],
      ["採用版本", best.variant + (angleDeg ? "，傾斜校正 " + angleDeg + "°" : "")],
      ["辨識耗時", (ms / 1000).toFixed(2) + " 秒（" + cands.length + " 個版本）"],
      ["定位方式", box && box.score !== undefined ? "YOLO 自動偵測" : "手動框選"],
      ["其他候選", cands.slice(1).map(function (c) { return (c.a.display || "—") + "（" + c.conf.toFixed(0) + "）"; }).join("、") || "—"]
    ];
    $("result-spec").innerHTML = rows.map(function (r) {
      return "<div><dt>" + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd></div>";
    }).join("");
    $("verdict").hidden = true;
    $("step-result").scrollIntoView({ behavior: "smooth", block: "start" });
    $("truth").focus({ preventScroll: true });
  }

  /* ---------- 與正確答案比對 ---------- */
  function lev(a, b) {
    var dp = [];
    for (var i = 0; i <= a.length; i++) { dp[i] = [i]; }
    for (var j = 1; j <= b.length; j++) dp[0][j] = j;
    for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    return dp[a.length][b.length];
  }
  function check() {
    if (!last) return;
    var truth = compact($("truth").value);
    if (!truth) { $("truth").focus(); return; }
    var pred = last.a.text;
    var dist = lev(pred, truth);
    var acc = Math.max(0, 1 - dist / truth.length);
    var ok = pred === truth;
    // 逐字標示
    var marks = "";
    for (var i = 0; i < Math.max(pred.length, truth.length); i++) {
      var p = pred[i] || "␣", t = truth[i] || "␣";
      marks += '<span class="' + (p === t ? "c-ok" : "c-bad") + '" title="正確：' + esc(t) + '">' + esc(p) + "</span>";
    }
    var v = $("verdict");
    v.hidden = false;
    v.setAttribute("data-ok", ok ? "yes" : "no");
    v.innerHTML =
      "<strong>" + (ok ? "✓ 完全正確" : "✗ 不完全正確") + "</strong>" +
      '<p class="marks mono">' + marks + "</p>" +
      "<p>字元正確率 " + (acc * 100).toFixed(0) + "%（編輯距離 " + dist + "）" +
      (ok ? "" : "；錯誤可能來自" + (last.a.format ? "字元辨識" : "框選範圍或影像品質") + "。") + "</p>";
    logs.push({ pred: last.a.display, truth: $("truth").value.trim().toUpperCase(), fmt: last.a.format ? last.a.format.region : "—", acc: acc, ok: ok });
    renderLog();
  }
  $("btn-check").addEventListener("click", check);
  $("truth").addEventListener("keydown", function (e) { if (e.key === "Enter") check(); });

  function renderLog() {
    show("step-log");
    $("log").querySelector("tbody").innerHTML = logs.map(function (l, i) {
      return "<tr><td>" + (i + 1) + "</td><td class=\"mono\">" + esc(l.pred) + "</td><td class=\"mono\">" + esc(l.truth) +
        "</td><td>" + esc(l.fmt) + "</td><td>" + (l.acc * 100).toFixed(0) + "%</td><td>" + (l.ok ? "✓" : "✗") + "</td></tr>";
    }).join("");
    var okN = logs.filter(function (l) { return l.ok; }).length;
    var meanAcc = logs.reduce(function (s, l) { return s + l.acc; }, 0) / logs.length;
    $("log-sum").textContent = "共 " + logs.length + " 張｜整串車牌正確率 " + (okN / logs.length * 100).toFixed(0) +
      "%｜平均字元正確率 " + (meanAcc * 100).toFixed(0) + "%";
  }

  // 供測試用（不影響功能）
  window.__plateLab = { analyse: analyse, decodeYolo: decodeYolo, otsu: otsu, makeVariant: makeVariant, estimateAngle: estimateAngle };

  checkModel();
})();
