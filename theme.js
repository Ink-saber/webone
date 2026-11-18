/* ============================================================
   theme.js —— 四季皮肤切换

   四套皮肤只是同一组 CSS 变量的不同取值，切换就是改
   <html data-theme="spring|summer|autumn|winter">。

   选择记在 localStorage 里；每个页面的 <head> 里还有一段极小的
   内联脚本，在样式生效前就把 data-theme 设好，避免刷新时闪一下。
   ============================================================ */

(function () {
  const KEY = "season";

  const THEMES = [
    { id: "spring", name: "春 · 柳岸", dot: "#5f7f4e" },
    { id: "summer", name: "夏 · 荷风", dot: "#3f7e7b" },
    { id: "autumn", name: "秋 · 霜叶", dot: "#9a5730" },
    { id: "winter", name: "冬 · 疏梅", dot: "#47607a" }
  ];

  function read() {
    try {
      const id = localStorage.getItem(KEY);
      if (THEMES.some(function (t) { return t.id === id; })) return id;
    } catch (e) {
      // localStorage 不可用就用默认
    }
    return "spring";
  }

  function apply(id) {
    document.documentElement.setAttribute("data-theme", id);
    try {
      localStorage.setItem(KEY, id);
    } catch (e) {
      // 忽略
    }
  }

  /* ============================================================
     背景画面：内联 SVG，不用图片
     - 远山两层，随主题变色
     - 一轮日月
     - 四季各自的点缀，靠 CSS 只显示当前季节那一组
     ============================================================ */

  const SEASONS = ["spring", "summer", "autumn", "winter"];

  const ART_SVG = [
    '<svg viewBox="0 0 1440 520" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">',

    // 日月
    '<circle cx="1130" cy="128" r="54" fill="var(--seal)" opacity="0.10"/>',

    // 远山（两层）
    '<path d="M0,356 C150,286 268,336 402,286 C524,241 618,300 758,268 ' +
      'C898,236 1018,300 1158,272 C1278,248 1362,296 1440,278 L1440,520 L0,520 Z" ' +
      'fill="var(--primary-faint)" opacity="0.20"/>',
    '<path d="M0,424 C176,376 300,418 462,388 C602,362 722,410 880,384 ' +
      'C1020,361 1158,404 1300,386 C1372,377 1412,396 1440,390 L1440,520 L0,520 Z" ' +
      'fill="var(--text-faint)" opacity="0.26"/>',

    // ---------- 春：柳枝 + 落花 ----------
    '<g class="season season-spring" stroke="var(--primary)" fill="none" opacity="0.34">',
    '<path d="M120,0 C150,80 120,150 150,236" stroke-width="2"/>',
    '<path d="M168,0 C196,70 168,140 200,214" stroke-width="2"/>',
    '<path d="M96,20 C120,86 96,148 118,208" stroke-width="2"/>',
    '<path d="M120,70 l-14,10 M120,70 l14,10 M138,110 l-14,10 M138,110 l14,10 ' +
      'M132,160 l-14,10 M132,160 l14,10" stroke-width="1.5"/>',
    '</g>',
    '<g class="season season-spring" fill="var(--seal)" opacity="0.28">',
    '<ellipse cx="240" cy="150" rx="5" ry="3" transform="rotate(24 240 150)"/>',
    '<ellipse cx="300" cy="230" rx="5" ry="3" transform="rotate(-18 300 230)"/>',
    '<ellipse cx="210" cy="300" rx="5" ry="3" transform="rotate(40 210 300)"/>',
    '<ellipse cx="360" cy="180" rx="5" ry="3" transform="rotate(12 360 180)"/>',
    '</g>',

    // ---------- 夏：水波 + 荷叶 ----------
    '<g class="season season-summer" stroke="var(--primary)" fill="none" opacity="0.32">',
    '<path d="M0,470 C120,458 240,482 360,470 C480,458 600,482 720,470 ' +
      'C840,458 960,482 1080,470 C1200,458 1320,482 1440,470" stroke-width="2"/>',
    '<path d="M0,492 C130,482 250,502 380,492 C510,482 630,502 760,492 ' +
      'C890,482 1010,502 1140,492 C1270,482 1380,500 1440,494" stroke-width="1.5" opacity="0.7"/>',
    '</g>',
    '<g class="season season-summer" fill="var(--primary)" opacity="0.22">',
    '<ellipse cx="1180" cy="452" rx="42" ry="14"/>',
    '<ellipse cx="1246" cy="466" rx="30" ry="10"/>',
    '</g>',

    // ---------- 秋：落叶 ----------
    '<g class="season season-autumn" fill="var(--seal)" opacity="0.30">',
    '<ellipse cx="180" cy="120" rx="10" ry="5" transform="rotate(28 180 120)"/>',
    '<ellipse cx="268" cy="212" rx="10" ry="5" transform="rotate(-22 268 212)"/>',
    '<ellipse cx="150" cy="300" rx="9" ry="5" transform="rotate(58 150 300)"/>',
    '<ellipse cx="330" cy="150" rx="10" ry="5" transform="rotate(-8 330 150)"/>',
    '<ellipse cx="236" cy="368" rx="9" ry="5" transform="rotate(36 236 368)"/>',
    '</g>',
    '<g class="season season-autumn" stroke="var(--warn-text)" fill="none" opacity="0.20">',
    '<path d="M180,120 q26,40 4,84" stroke-width="1.4"/>',
    '<path d="M268,212 q-24,44 2,90" stroke-width="1.4"/>',
    '</g>',

    // ---------- 冬：梅枝 + 雪 ----------
    '<g class="season season-winter" stroke="var(--text-soft)" fill="none" opacity="0.34">',
    '<path d="M1320,0 C1290,70 1300,130 1262,196 C1240,232 1216,258 1186,286" stroke-width="2.4"/>',
    '<path d="M1300,96 C1272,104 1252,120 1236,142" stroke-width="1.8"/>',
    '<path d="M1270,186 C1244,192 1224,210 1210,232" stroke-width="1.6"/>',
    '</g>',
    '<g class="season season-winter" fill="var(--seal)" opacity="0.34">',
    '<circle cx="1236" cy="142" r="4.5"/><circle cx="1210" cy="232" r="4"/>',
    '<circle cx="1296" cy="72" r="4"/><circle cx="1258" cy="176" r="3.6"/>',
    '</g>',
    '<g class="season season-winter" fill="var(--text-muted)" opacity="0.30">',
    '<circle cx="220" cy="90" r="3"/><circle cx="300" cy="170" r="2.4"/>',
    '<circle cx="180" cy="250" r="2.6"/><circle cx="360" cy="120" r="2.2"/>',
    '<circle cx="260" cy="320" r="2.8"/><circle cx="410" cy="240" r="2.4"/>',
    '</g>',

    '</svg>'
  ].join("");

  function buildArt() {
    if (document.querySelector(".bg-art")) return;

    const layer = document.createElement("div");
    layer.className = "bg-art";
    layer.setAttribute("aria-hidden", "true");
    layer.innerHTML = ART_SVG;

    document.body.insertBefore(layer, document.body.firstChild);
  }

  function build() {
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

      const d = document.createElement("span");
      d.className = "theme-dot";
      d.style.background = t.dot;

      const n = document.createElement("span");
      n.textContent = t.name;

      opt.appendChild(d);
      opt.appendChild(n);

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
      const theme = THEMES.filter(function (t) { return t.id === id; })[0] || THEMES[0];

      dot.style.background = theme.dot;
      label.textContent = theme.name.slice(0, 1);   // 春 / 夏 / 秋 / 冬
      btn.title = "当前：" + theme.name + "（点击切换）";

      Array.prototype.forEach.call(panel.children, function (o) {
        o.classList.toggle("active", o.dataset.id === id);
      });
    }

    paint();
  }

  function init() {
    buildArt();   // 背景画面先挂上，不依赖顶栏
    build();      // 再挂切换器（没有顶栏的页面会自动跳过）
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
