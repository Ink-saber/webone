/* ============================================================
   theme.js —— 四季皮肤切换 + 背景画面

   切换器改成「并排四个按钮」，不用弹层：
   弹层容易被打到页头下面，点不到；并排按钮点哪儿都是命中。

   四套皮肤只是同一组 CSS 变量的不同取值，
   切换等于改 <html data-theme="spring|summer|autumn|winter">。
   ============================================================ */

(function () {
  const KEY = "season";

  const THEMES = [
    { id: "spring", name: "春" },
    { id: "summer", name: "夏" },
    { id: "autumn", name: "秋" },
    { id: "winter", name: "冬" }
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
     背景画面：内联 SVG，随主题变色
     左下一棵树 / 右下一丛荷 / 右上一枝梅
     ============================================================ */

  const ART_SVG = [
    '<svg viewBox="0 0 1440 560" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">',

    // 日月
    '<circle cx="1128" cy="120" r="62" fill="var(--seal)" opacity="0.12"/>',

    // ---------- 远山两层（四季共用） ----------
    '<path d="M0,384 C150,312 268,362 402,312 C524,267 618,326 758,294 ' +
      'C898,262 1018,326 1158,298 C1278,274 1362,322 1440,304 L1440,560 L0,560 Z" ' +
      'fill="var(--primary-faint)" opacity="0.22"/>',
    '<path d="M0,452 C176,404 300,446 462,416 C602,390 722,438 880,412 ' +
      'C1020,389 1158,432 1300,414 C1372,405 1412,424 1440,418 L1440,560 L0,560 Z" ' +
      'fill="var(--text-faint)" opacity="0.30"/>',

    /* ================= 春：一棵柳树 ================= */
    '<g class="season season-spring">',

    // 树干
    '<path d="M96,560 C104,486 92,424 106,352 C110,330 104,310 98,292" ' +
      'stroke="var(--text-soft)" stroke-width="7" fill="none" opacity="0.38" stroke-linecap="round"/>',
    // 主枝
    '<path d="M104,392 C140,368 176,352 214,344" stroke="var(--text-soft)" stroke-width="4" fill="none" opacity="0.34" stroke-linecap="round"/>',
    '<path d="M102,336 C70,314 44,296 26,272" stroke="var(--text-soft)" stroke-width="4" fill="none" opacity="0.34" stroke-linecap="round"/>',
    '<path d="M104,300 C128,278 150,262 172,250" stroke="var(--text-soft)" stroke-width="3" fill="none" opacity="0.32" stroke-linecap="round"/>',

    // 垂下的柳丝
    '<g stroke="var(--primary)" stroke-width="2" fill="none" opacity="0.45" stroke-linecap="round">',
    '<path d="M214,344 C226,382 214,420 222,458"/>',
    '<path d="M196,350 C204,388 192,424 200,464"/>',
    '<path d="M26,272 C36,312 24,348 32,384"/>',
    '<path d="M46,282 C54,320 44,356 52,392"/>',
    '<path d="M172,250 C182,288 172,322 180,356"/>',
    '<path d="M150,258 C158,294 148,328 156,360"/>',
    '</g>',
    // 柳叶
    '<g fill="var(--primary)" opacity="0.34">',
    '<ellipse cx="222" cy="420" rx="7" ry="3" transform="rotate(74 222 420)"/>',
    '<ellipse cx="200" cy="430" rx="7" ry="3" transform="rotate(78 200 430)"/>',
    '<ellipse cx="32" cy="350" rx="7" ry="3" transform="rotate(76 32 350)"/>',
    '<ellipse cx="52" cy="360" rx="7" ry="3" transform="rotate(80 52 360)"/>',
    '<ellipse cx="180" cy="320" rx="7" ry="3" transform="rotate(72 180 320)"/>',
    '<ellipse cx="156" cy="326" rx="7" ry="3" transform="rotate(78 156 326)"/>',
    '</g>',
    // 飘落的花瓣
    '<g fill="var(--seal)" opacity="0.30">',
    '<ellipse cx="268" cy="404" rx="6" ry="3.4" transform="rotate(28 268 404)"/>',
    '<ellipse cx="320" cy="470" rx="6" ry="3.4" transform="rotate(-16 320 470)"/>',
    '<ellipse cx="236" cy="500" rx="6" ry="3.4" transform="rotate(44 236 500)"/>',
    '</g>',
    '</g>',

    /* ================= 夏：荷叶荷花 ================= */
    '<g class="season season-summer">',

    // 水波
    '<g stroke="var(--primary)" fill="none" opacity="0.34">',
    '<path d="M0,486 C120,474 240,498 360,486 C480,474 600,498 720,486 ' +
      'C840,474 960,498 1080,486 C1200,474 1320,498 1440,486" stroke-width="2"/>',
    '<path d="M0,512 C130,502 250,522 380,512 C510,502 630,522 760,512 ' +
      'C890,502 1010,522 1140,512 C1270,502 1380,520 1440,514" stroke-width="1.6" opacity="0.7"/>',
    '</g>',

    // 荷叶（三片）
    '<g fill="var(--primary)" opacity="0.26">',
    '<ellipse cx="1188" cy="486" rx="78" ry="26"/>',
    '<ellipse cx="1300" cy="510" rx="62" ry="21"/>',
    '<ellipse cx="1096" cy="516" rx="54" ry="18"/>',
    '</g>',
    // 荷叶脉络
    '<g stroke="var(--surface)" stroke-width="1.4" opacity="0.55">',
    '<path d="M1110,486 L1266,486"/><path d="M1188,462 L1188,510"/>',
    '<path d="M1238,510 L1362,510"/>',
    '</g>',

    // 荷花（花瓣围一圈）
    '<g fill="var(--seal)" opacity="0.34">',
    '<ellipse cx="1236" cy="424" rx="9" ry="26"/>',
    '<ellipse cx="1236" cy="424" rx="9" ry="26" transform="rotate(45 1236 424)"/>',
    '<ellipse cx="1236" cy="424" rx="9" ry="26" transform="rotate(-45 1236 424)"/>',
    '<ellipse cx="1236" cy="424" rx="9" ry="26" transform="rotate(90 1236 424)"/>',
    '<ellipse cx="1236" cy="424" rx="9" ry="26" transform="rotate(135 1236 424)"/>',
    '<ellipse cx="1236" cy="424" rx="9" ry="26" transform="rotate(-90 1236 424)"/>',
    '</g>',
    '<circle cx="1236" cy="424" r="7" fill="var(--warn-text)" opacity="0.35"/>',
    // 花梗
    '<path d="M1236,450 L1236,500" stroke="var(--primary)" stroke-width="2.4" opacity="0.4"/>',
    '</g>',

    /* ================= 秋：一棵树 + 落叶 ================= */
    '<g class="season season-autumn">',

    // 树干
    '<path d="M1252,560 C1244,492 1256,432 1242,372 C1238,350 1244,330 1252,312" ' +
      'stroke="var(--text-soft)" stroke-width="7" fill="none" opacity="0.40" stroke-linecap="round"/>',
    // 枝
    '<path d="M1248,410 C1212,388 1186,372 1162,352" stroke="var(--text-soft)" stroke-width="3.6" fill="none" opacity="0.34" stroke-linecap="round"/>',
    '<path d="M1246,356 C1280,336 1306,324 1332,312" stroke="var(--text-soft)" stroke-width="3.6" fill="none" opacity="0.34" stroke-linecap="round"/>',

    // 树冠（三个圆叠出蓬松感）
    '<g fill="var(--seal)" opacity="0.20">',
    '<circle cx="1244" cy="292" r="66"/>',
    '<circle cx="1176" cy="330" r="48"/>',
    '<circle cx="1316" cy="326" r="44"/>',
    '</g>',
    // 树冠里的小叶点
    '<g fill="var(--seal)" opacity="0.26">',
    '<circle cx="1206" cy="272" r="7"/><circle cx="1276" cy="256" r="6"/>',
    '<circle cx="1310" cy="300" r="5"/><circle cx="1180" cy="316" r="5"/>',
    '</g>',

    // 落叶
    '<g fill="var(--seal)" opacity="0.32">',
    '<ellipse cx="1120" cy="420" rx="10" ry="5" transform="rotate(28 1120 420)"/>',
    '<ellipse cx="1064" cy="470" rx="10" ry="5" transform="rotate(-22 1064 470)"/>',
    '<ellipse cx="1176" cy="486" rx="9" ry="5" transform="rotate(58 1176 486)"/>',
    '<ellipse cx="1004" cy="504" rx="9" ry="5" transform="rotate(10 1004 504)"/>',
    '</g>',
    '</g>',

    /* ================= 冬：梅枝 + 雪 ================= */
    '<g class="season season-winter">',

    // 枝干：从右侧斜出
    '<path d="M1372,60 C1320,120 1300,180 1252,232 C1224,262 1196,282 1164,300" ' +
      'stroke="var(--text-soft)" stroke-width="6" fill="none" opacity="0.40" stroke-linecap="round"/>',
    '<path d="M1318,140 C1284,150 1258,168 1238,192" stroke="var(--text-soft)" stroke-width="3.4" fill="none" opacity="0.34" stroke-linecap="round"/>',
    '<path d="M1268,214 C1236,222 1210,240 1192,262" stroke="var(--text-soft)" stroke-width="3" fill="none" opacity="0.32" stroke-linecap="round"/>',
    '<path d="M1340,96 C1312,86 1292,74 1278,58" stroke="var(--text-soft)" stroke-width="3" fill="none" opacity="0.30" stroke-linecap="round"/>',

    // 梅花
    '<g fill="var(--seal)" opacity="0.42">',
    '<circle cx="1238" cy="192" r="6"/><circle cx="1192" cy="262" r="5.4"/>',
    '<circle cx="1278" cy="58" r="5"/><circle cx="1164" cy="300" r="5.6"/>',
    '<circle cx="1318" cy="150" r="4.6"/>',
    '</g>',
    // 花蕊（浅色小点）
    '<g fill="var(--surface)" opacity="0.75">',
    '<circle cx="1238" cy="192" r="2"/><circle cx="1192" cy="262" r="1.8"/>',
    '<circle cx="1164" cy="300" r="1.8"/>',
    '</g>',

    // 雪地
    '<path d="M0,540 C180,528 320,548 520,540 C720,532 900,548 1100,540 ' +
      'C1260,534 1360,544 1440,540 L1440,560 L0,560 Z" ' +
      'fill="var(--text-faint)" opacity="0.28"/>',
    // 雪点
    '<g fill="var(--text-muted)" opacity="0.34">',
    '<circle cx="240" cy="120" r="3.4"/><circle cx="330" cy="196" r="2.6"/>',
    '<circle cx="180" cy="264" r="3"/><circle cx="400" cy="128" r="2.4"/>',
    '<circle cx="286" cy="330" r="3.2"/><circle cx="452" cy="238" r="2.6"/>',
    '<circle cx="120" cy="180" r="2.6"/><circle cx="360" cy="288" r="2.4"/>',
    '</g>',
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

  /* ============================================================
     切换器：并排四个按钮，直接点
     ============================================================ */

  function buildSwitch() {
    const bar = document.querySelector(".user-bar");
    if (!bar) return;

    const group = document.createElement("div");
    group.className = "theme-switch";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", "切换季节主题");

    THEMES.forEach(function (t) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.id = t.id;
      btn.textContent = t.name;
      btn.title = "切换到「" + t.name + "」主题";

      btn.addEventListener("click", function () {
        apply(t.id);
        paint();
      });

      group.appendChild(btn);
    });

    bar.insertBefore(group, bar.firstChild);

    function paint() {
      const id = read();
      Array.prototype.forEach.call(group.children, function (b) {
        b.classList.toggle("active", b.dataset.id === id);
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
