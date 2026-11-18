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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();
