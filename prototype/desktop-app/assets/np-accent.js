/* ============================================================
   NekoPapa 强调色层 · np-accent.js
   全站唯一 accent（--tPrimary）的可换肤：只换色，不改变
   DESIGN.md 的颜色纪律（accent scarcity 依然成立）。
   所有原型页在 proto.css 之后引入：
   <script src="assets/np-accent.js"></script>
   ============================================================ */
(function () {
  const ACCENTS = {
    pink:   { name: "粉", c: "#E06B97", soft: "#F8DDE7" },   /* 默认 */
    blue:   { name: "蓝", c: "#5B8DEF", soft: "#DFE9FC" },
    green:  { name: "绿", c: "#3D9E6B", soft: "#E2F3EA" },
    violet: { name: "紫", c: "#8B75D8", soft: "#EBE7F9" },
    amber:  { name: "橙", c: "#DD8453", soft: "#FAEADC" },
  };
  function get() {
    const k = localStorage.getItem("np-accent");
    return ACCENTS[k] ? k : "pink";
  }
  function apply(k) {
    const a = ACCENTS[k || get()];
    const r = document.documentElement.style;
    r.setProperty("--tPrimary", a.c);
    r.setProperty("--tPrimarySoft", a.soft);
  }
  function set(k) {
    if (!ACCENTS[k]) return;
    localStorage.setItem("np-accent", k);
    apply(k);
  }
  apply();  /* 同步执行、尽早应用，避免首屏先闪一次默认粉 */
  window.NPA = { ACCENTS, get, set, apply };
})();
