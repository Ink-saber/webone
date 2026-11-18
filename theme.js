/* ============================================================
   theme.js —— 四季皮肤 + 背景画面

   画面参考宋元文人画的做法：
     · 树有主干和分叉，枝干粗细分层
     · 树冠用密集的「点叶」攒出来，不是几何大圆
     · 远山淡墨分层，越远越淡
     · 加坡岸、芦苇、印章这些点睛的东西
   全部用内联 SVG 生成，不加载图片，颜色随主题走。
   ============================================================ */

(function () {
  const KEY = "season";

  const THEMES = [
    { id: "spring", name: "春 · 柳岸", short: "春" },
    { id: "summer", name: "夏 · 荷风", short: "夏" },
    { id: "autumn", name: "秋 · 霜叶", short: "秋" },
    { id: "winter", name: "冬 · 疏梅", short: "冬" }
  ];

  function read() {
    try {
      const id = localStorage.getItem(KEY);
      if (THEMES.some(function (t) { return t.id === id; })) return id;
    } catch (e) { /* 忽略 */ }
    return "spring";
  }

  function apply(id) {
    document.documentElement.setAttribute("data-theme", id);
    try { localStorage.setItem(KEY, id); } catch (e) { /* 忽略 */ }
  }

  /* ============================================================
     随手要用的小工具：确定性的伪随机
     同一颗种子每次生成同一片叶子，刷新不会跳
     ============================================================ */
  function rng(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  // 一团点叶
  function leafCluster(cx, cy, rx, ry, count, size, color, opacity, seed) {
    const R = rng(seed);
    let out = '<g fill="' + color + '" opacity="' + opacity + '">';
    for (let i = 0; i < count; i++) {
      const a = R() * Math.PI * 2;
      const d = Math.sqrt(R());
      const x = cx + Math.cos(a) * d * rx;
      const y = cy + Math.sin(a) * d * ry;
      const r = size * (0.55 + R() * 0.8);
      out += '<ellipse cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) +
             '" rx="' + r.toFixed(1) + '" ry="' + (r * 0.62).toFixed(1) + '"/>';
    }
    return out + '</g>';
  }

  // 一簇草 / 芦苇
  function reeds(x0, y0, count, height, spread, color, opacity, seed) {
    const R = rng(seed);
    let out = '<g stroke="' + color + '" fill="none" stroke-width="1.3" opacity="' + opacity + '" stroke-linecap="round">';
    for (let i = 0; i < count; i++) {
      const x = x0 + (R() - 0.5) * spread;
      const h = height * (0.6 + R() * 0.7);
      const bend = (R() - 0.5) * 26;
      out += '<path d="M' + x.toFixed(1) + ',' + y0 +
             ' q' + (bend * 0.4).toFixed(1) + ',' + (-h * 0.6).toFixed(1) +
             ' ' + bend.toFixed(1) + ',' + (-h).toFixed(1) + '"/>';
    }
    return out + '</g>';
  }

  // 一朵五瓣梅花
  function plumBlossom(cx, cy, r, color, seed) {
    const R = rng(seed);
    let out = '<g opacity="0.55">';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + R() * 0.3;
      const px = cx + Math.cos(a) * r * 0.62;
      const py = cy + Math.sin(a) * r * 0.62;
      out += '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) +
             '" r="' + (r * 0.46).toFixed(1) + '" fill="' + color + '"/>';
    }
    out += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 0.2).toFixed(1) +
           '" fill="var(--surface)"/>';
    return out + '</g>';
  }

  /* ============================================================
     背景画面
     ============================================================ */

  function buildArtSvg() {
    const p = [];
    p.push('<svg viewBox="0 0 1440 620" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">');

    /* ---- 日月 ---- */
    p.push('<circle cx="1116" cy="112" r="58" fill="var(--seal)" opacity="0.10"/>');

    /* ---- 远山：三层，越远越淡 ---- */
    p.push('<path d="M-20,404 C120,332 246,372 392,330 C520,294 616,348 756,318 ' +
           'C900,287 1020,344 1168,318 C1290,296 1380,330 1460,318 L1460,620 L-20,620 Z" ' +
           'fill="var(--text-faint)" opacity="0.18"/>');
    p.push('<path d="M-20,446 C140,398 280,432 438,404 C580,379 700,424 858,400 ' +
           'C1000,378 1140,418 1284,402 C1360,394 1418,410 1460,404 L1460,620 L-20,620 Z" ' +
           'fill="var(--primary-faint)" opacity="0.26"/>');
    p.push('<path d="M-20,486 C160,452 320,480 500,458 C660,438 800,472 980,452 ' +
           'C1140,434 1300,466 1460,452 L1460,620 L-20,620 Z" ' +
           'fill="var(--text-faint)" opacity="0.30"/>');

    /* ---- 坡岸线 + 草脚 ---- */
    p.push('<path d="M0,540 C220,528 420,548 660,538 C900,528 1120,550 1440,538" ' +
           'stroke="var(--text-soft)" stroke-width="1.4" fill="none" opacity="0.22"/>');
    p.push(reeds(120, 546, 16, 26, 220, 'var(--text-soft)', 0.20, 7));
    p.push(reeds(980, 552, 18, 30, 300, 'var(--text-soft)', 0.20, 11));

    /* ================= 春：柳树 ================= */
    p.push('<g class="season season-spring">');

    // 老干：下粗上细，两个分叉
    p.push('<path d="M196,620 C206,556 190,506 210,454 C222,422 214,396 202,372" ' +
           'stroke="var(--text)" stroke-width="11" fill="none" opacity="0.30" stroke-linecap="round"/>');
    p.push('<path d="M210,466 C244,440 286,424 330,416" ' +
           'stroke="var(--text)" stroke-width="6" fill="none" opacity="0.28" stroke-linecap="round"/>');
    p.push('<path d="M204,398 C176,372 152,352 130,326" ' +
           'stroke="var(--text)" stroke-width="5" fill="none" opacity="0.28" stroke-linecap="round"/>');
    p.push('<path d="M204,388 C226,362 244,344 268,328" ' +
           'stroke="var(--text)" stroke-width="4" fill="none" opacity="0.26" stroke-linecap="round"/>');

    // 垂柳：长弧线，末端下垂
    p.push('<g stroke="var(--primary)" fill="none" opacity="0.42" stroke-linecap="round">');
    const willow = [
      [330, 416, 350, 480, 344, 552, 1.9],
      [318, 420, 334, 486, 326, 566, 1.7],
      [130, 326, 120, 386, 128, 448, 1.8],
      [146, 336, 140, 396, 148, 462, 1.6],
      [268, 328, 282, 384, 274, 446, 1.7],
      [252, 332, 246, 392, 254, 456, 1.5]
    ];
    willow.forEach(function (w) {
      p.push('<path d="M' + w[0] + ',' + w[1] +
             ' C' + w[0] + ',' + (w[1] + 40) + ' ' + w[2] + ',' + (w[3] + 30) +
             ' ' + w[2] + ',' + w[5] + '" stroke-width="' + w[6] + '"/>');
    });
    p.push('</g>');

    // 柳叶：沿枝条点短笔
    p.push('<g stroke="var(--primary)" stroke-width="2" opacity="0.38" stroke-linecap="round">');
    const willowLeaf = [
      [342, 470], [338, 500], [332, 530], [124, 380], [126, 410], [132, 438],
      [276, 372], [272, 402], [272, 430], [344, 460], [130, 366], [268, 360]
    ];
    willowLeaf.forEach(function (l, i) {
      const d = 5 + (i % 3);
      p.push('<path d="M' + l[0] + ',' + l[1] + ' l' + d + ',' + (d + 2) + '"/>');
    });
    p.push('</g>');

    // 飘落花瓣
    p.push(leafCluster(420, 470, 70, 40, 12, 3.2, 'var(--seal)', 0.30, 21));
    p.push(leafCluster(300, 250, 50, 30, 8, 2.8, 'var(--seal)', 0.24, 22));

    // 两只燕子
    p.push('<g stroke="var(--text-soft)" stroke-width="1.6" fill="none" opacity="0.34" stroke-linecap="round">');
    p.push('<path d="M520,150 q10,-9 20,0 q10,-9 20,0"/>');
    p.push('<path d="M578,196 q8,-7 16,0 q8,-7 16,0"/>');
    p.push('</g>');
    p.push('</g>');

    /* ================= 夏：荷塘 ================= */
    p.push('<g class="season season-summer">');

    // 水波
    p.push('<g stroke="var(--primary)" fill="none" opacity="0.30">');
    p.push('<path d="M0,516 C120,506 240,528 360,516 C480,504 600,528 720,516 ' +
           'C840,504 960,528 1080,516 C1200,504 1320,528 1440,516" stroke-width="1.6"/>');
    p.push('<path d="M60,548 C170,540 280,558 390,548 C500,538 610,558 720,548" stroke-width="1.2" opacity="0.7"/>');
    p.push('</g>');

    // 荷叶（团扇状，带缺口）
    function pad(cx, cy, r, seed) {
      const R = rng(seed);
      let s = '<g opacity="0.30">';
      s += '<path d="M' + cx + ',' + cy + ' m' + (-r) + ',0 a' + r + ',' + (r * 0.34) +
           ' 0 1,0 ' + (r * 2) + ',0 a' + r + ',' + (r * 0.34) + ' 0 1,0 ' + (-r * 2) + ',0" ' +
           'fill="var(--primary)"/>';
      // 叶脉
      s += '<g stroke="var(--surface)" stroke-width="1.1" opacity="0.6">';
      for (let i = 0; i < 7; i++) {
        const a = Math.PI + (i / 6) * Math.PI;
        const x2 = cx + Math.cos(a) * r * 0.92;
        const y2 = cy + Math.sin(a) * r * 0.34;
        s += '<path d="M' + cx + ',' + cy + ' L' + x2.toFixed(1) + ',' + y2.toFixed(1) + '"/>';
      }
      s += '</g></g>';
      return s;
    }
    p.push(pad(1210, 500, 78, 31));
    p.push(pad(1330, 528, 58, 32));
    p.push(pad(1090, 532, 48, 33));

    // 荷花
    p.push('<g opacity="0.34">');
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      p.push('<ellipse cx="1256" cy="430" rx="8.5" ry="26" fill="var(--seal)" ' +
             'transform="rotate(' + (a * 180 / Math.PI).toFixed(1) + ' 1256 430)"/>');
    }
    p.push('<circle cx="1256" cy="430" r="7" fill="var(--warn-text)"/>');
    p.push('</g>');
    p.push('<path d="M1256,458 L1252,506" stroke="var(--primary)" stroke-width="2.2" opacity="0.36"/>');

    // 芦苇
    p.push(reeds(880, 546, 14, 42, 240, 'var(--text-soft)', 0.24, 41));
    p.push('</g>');

    /* ================= 秋：树 + 落叶 ================= */
    p.push('<g class="season season-autumn">');

    // 树干
    p.push('<path d="M1258,620 C1248,556 1262,500 1246,448 C1238,420 1246,396 1256,374" ' +
           'stroke="var(--text)" stroke-width="11" fill="none" opacity="0.32" stroke-linecap="round"/>');
    // 分枝
    p.push('<path d="M1252,462 C1214,436 1184,418 1156,396" ' +
           'stroke="var(--text)" stroke-width="6" fill="none" opacity="0.28" stroke-linecap="round"/>');
    p.push('<path d="M1254,406 C1290,384 1318,370 1348,356" ' +
           'stroke="var(--text)" stroke-width="5" fill="none" opacity="0.28" stroke-linecap="round"/>');
    p.push('<path d="M1256,376 C1236,352 1220,336 1200,320" ' +
           'stroke="var(--text)" stroke-width="4" fill="none" opacity="0.26" stroke-linecap="round"/>');

    // 点叶（三团）
    p.push(leafCluster(1256, 344, 84, 54, 46, 4.6, 'var(--seal)', 0.26, 51));
    p.push(leafCluster(1176, 392, 54, 38, 26, 4.0, 'var(--seal)', 0.22, 52));
    p.push(leafCluster(1330, 360, 48, 34, 22, 4.0, 'var(--seal)', 0.20, 53));
    p.push(leafCluster(1246, 314, 58, 30, 22, 3.6, 'var(--text)', 0.16, 54));

    // 落叶
    p.push(leafCluster(1110, 452, 90, 30, 6, 5.4, 'var(--seal)', 0.32, 55));
    p.push(leafCluster(1050, 512, 60, 22, 4, 5.0, 'var(--seal)', 0.26, 56));

    // 芦苇
    p.push(reeds(1020, 548, 12, 38, 180, 'var(--text-soft)', 0.22, 57));
    p.push('</g>');

    /* ================= 冬：折枝梅 ================= */
    p.push('<g class="season season-winter">');

    // 老干：从右侧伸入
    p.push('<path d="M1420,86 C1360,120 1316,166 1272,214 C1236,252 1204,278 1168,300" ' +
           'stroke="var(--text)" stroke-width="10" fill="none" opacity="0.34" stroke-linecap="round"/>');
    // 细枝
    p.push('<g stroke="var(--text)" fill="none" opacity="0.30" stroke-linecap="round">');
    p.push('<path d="M1332,146 C1300,158 1276,178 1258,204" stroke-width="4"/>');
    p.push('<path d="M1244,240 C1214,248 1188,266 1170,290" stroke-width="3.2"/>');
    p.push('<path d="M1372,110 C1352,92 1338,74 1330,52" stroke-width="3"/>');
    p.push('<path d="M1300,176 C1322,192 1340,210 1352,232" stroke-width="2.6"/>');
    p.push('</g>');

    // 梅花（圈瓣）
    p.push(plumBlossom(1258, 204, 13, 'var(--seal)', 61));
    p.push(plumBlossom(1170, 290, 12, 'var(--seal)', 62));
    p.push(plumBlossom(1330, 52, 11, 'var(--seal)', 63));
    p.push(plumBlossom(1352, 232, 10, 'var(--seal)', 64));
    p.push(plumBlossom(1300, 158, 9, 'var(--seal)', 65));
    // 花苞
    p.push('<g fill="var(--seal)" opacity="0.34">');
    p.push('<circle cx="1216" cy="262" r="3.4"/><circle cx="1288" cy="230" r="3"/>');
    p.push('<circle cx="1348" cy="126" r="3"/><circle cx="1194" cy="312" r="2.6"/>');
    p.push('</g>');

    // 雪地留白 + 雪点
    p.push('<path d="M0,556 C200,546 360,562 560,556 C760,550 940,562 1120,556 ' +
           'C1280,551 1380,560 1440,556 L1440,620 L0,620 Z" ' +
           'fill="var(--text-faint)" opacity="0.24"/>');
    p.push(leafCluster(320, 200, 210, 130, 26, 2.6, 'var(--text-muted)', 0.26, 66));
    p.push('</g>');

    /* ---- 印章：右下角一枚朱文印 ---- */
    p.push('<g opacity="0.30" transform="translate(1338,548)">');
    p.push('<rect x="0" y="0" width="44" height="44" rx="3" fill="none" ' +
           'stroke="var(--seal)" stroke-width="2.4"/>');
    p.push('<g stroke="var(--seal)" stroke-width="2" stroke-linecap="round">');
    p.push('<path d="M10,12 L10,32"/><path d="M18,12 L18,32"/>');
    p.push('<path d="M26,12 L26,20"/><path d="M26,26 L26,32"/>');
    p.push('<path d="M10,22 L26,22"/><path d="M34,12 L34,32"/>');
    p.push('</g></g>');

    p.push('</svg>');
    return p.join("");
  }

  function buildArt() {
    if (document.querySelector(".bg-art")) return;

    const layer = document.createElement("div");
    layer.className = "bg-art";
    layer.setAttribute("aria-hidden", "true");
    layer.innerHTML = buildArtSvg();

    document.body.insertBefore(layer, document.body.firstChild);
  }

  /* ============================================================
     切换器：圆点按钮 + 下拉面板
     面板会盖在正文之上，所以页头层级要高（见 CSS）
     ============================================================ */

  function buildSwitch() {
    const bar = document.querySelector(".user-bar");
    if (!bar) return;

    const wrap = document.createElement("div");
    wrap.className = "theme-wrap";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "theme-btn";
    btn.title = "切换四季主题";

    const dot = document.createElement("span");
    dot.className = "theme-dot";
    const label = document.createElement("span");

    btn.appendChild(dot);
    btn.appendChild(label);

    const panel = document.createElement("div");
    panel.className = "theme-panel";
    panel.hidden = true;

    THEMES.forEach(function (t) {
      const opt = document.createElement("button");
      opt.type = "button";
      opt.className = "theme-option";
      opt.dataset.id = t.id;
      opt.textContent = t.name;

      opt.addEventListener("click", function (e) {
        e.stopPropagation();
        apply(t.id);
        paint();
        panel.hidden = true;
      });

      panel.appendChild(opt);
    });

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      panel.hidden = !panel.hidden;
    });

    document.addEventListener("click", function () { panel.hidden = true; });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") panel.hidden = true;
    });

    wrap.appendChild(btn);
    wrap.appendChild(panel);
    bar.insertBefore(wrap, bar.firstChild);

    function paint() {
      const id = read();
      const t = THEMES.filter(function (x) { return x.id === id; })[0] || THEMES[0];

      dot.style.background = "var(--seal)";
      label.textContent = t.short;
      btn.title = "当前：" + t.name + "（点击切换）";

      Array.prototype.forEach.call(panel.children, function (o) {
        o.classList.toggle("active", o.dataset.id === id);
      });
    }

    paint();
  }

  function init() {
    buildArt();
    buildSwitch();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
