/* ============================================================
   NekoPapa 原型 · 全局假状态层 np-state.js
   用 localStorage 让 16 个页面共享状态，原型演示时"活"起来：
   - 答疑/刷题答错 → 错题本真实 +1
   - 复习消灭错题 → 待复习数 -1
   - 完成学习单元 → 进度前进、连续天数 +1、庆祝时刻
   ============================================================ */
(function () {
  const KEY = 'np-state-v1';
  const DEFAULTS = {
    streak: 12,            // 连续学习天数
    mistakesDue: 23,       // 待复习错题
    mistakesDone: 312,     // 已消灭错题
    lessonProgress: 68,    // 当前学习单元进度 %
    todayDone: ['words7'], // 今日已完成项
    celebratedToday: false // 今天是否已庆祝过
  };

  function load() {
    try {
      return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(KEY) || '{}'));
    } catch (e) { return Object.assign({}, DEFAULTS); }
  }
  function save(s) { localStorage.setItem(KEY, JSON.stringify(s)); emit(); }

  const listeners = [];
  function emit() { listeners.forEach(fn => fn(state)); }

  let state = load();

  window.NP = {
    get: () => load(),
    on(fn) { listeners.push(fn); },

    /* 答错：收进错题本 */
    addMistake(n = 1) {
      const s = load(); s.mistakesDue += n; save(s);
    },
    /* 复习消灭 */
    resolveMistake(n = 1) {
      const s = load();
      s.mistakesDue = Math.max(0, s.mistakesDue - n);
      s.mistakesDone += n; save(s);
    },
    /* 学习单元推进 */
    setLessonProgress(p) {
      const s = load(); s.lessonProgress = Math.min(100, p); save(s);
    },
    /* 完成今日一项；全部完成时返回 true（触发庆祝） */
    completeToday(id) {
      const s = load();
      if (!s.todayDone.includes(id)) s.todayDone.push(id);
      save(s);
      return s.todayDone.length >= 3;
    },
    /* 连续天数 +1（一天只加一次，用日期判断） */
    bumpStreakOnce() {
      const s = load();
      const today = new Date().toDateString();
      if (s._lastBump !== today) {
        s.streak += 1; s._lastBump = today; save(s);
        return true;
      }
      return false;
    },

    /* ---------- 庆祝时刻：撒花 + 她的话（全局可调用） ---------- */
    celebrate(text) {
      if (document.getElementById('np-celebrate')) return;
      const wrap = document.createElement('div');
      wrap.id = 'np-celebrate';
      wrap.innerHTML = `
        <div class="npc-mask">
          <canvas class="npc-canvas"></canvas>
          <div class="npc-card">
            <img src="assets/icon.png" alt="Neko">
            <div class="npc-t">${text || '今日学习全部完成！'}</div>
            <div class="npc-s">连续 ${load().streak} 天 · 她比你先开心</div>
            <button class="npc-btn">收下这份开心</button>
          </div>
        </div>`;
      const st = document.createElement('style');
      st.textContent = `
        .npc-mask { position: fixed; inset: 0; z-index: 999; background: rgba(24,28,35,.28);
          display: grid; place-items: center; animation: npcIn .25s ease; }
        @keyframes npcIn { from { opacity: 0; } }
        .npc-canvas { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
        .npc-card { position: relative; width: 340px; background: #fff; border-radius: 20px;
          box-shadow: 0 6px 20px rgba(24,28,35,.09), 0 24px 64px rgba(24,28,35,.13);
          padding: 30px 28px 26px; text-align: center;
          animation: npcPop .4s cubic-bezier(.34,1.56,.64,1); }
        @keyframes npcPop { from { transform: scale(.85) translateY(16px); opacity: 0; } }
        .npc-card img { width: 60px; height: 60px; border-radius: 16px;
          box-shadow: 0 6px 18px rgba(224,107,151,.35); }
        .npc-t { font-size: 17px; font-weight: 700; color: #181C23; margin: 14px 0 6px; }
        .npc-s { font-size: 12px; color: #7A8492; margin-bottom: 18px; }
        .npc-btn { width: 100%; height: 40px; border: 0; border-radius: 999px;
          background: #E06B97; color: #FFF9FB; font-size: 14px; font-weight: 600;
          font-family: inherit; cursor: pointer; }
        .npc-btn:hover { filter: brightness(1.06); }`;
      document.head.appendChild(st);
      document.body.appendChild(wrap);
      wrap.querySelector('.npc-btn').onclick = () => wrap.remove();
      wrap.querySelector('.npc-mask').addEventListener('click', e => {
        if (e.target.classList.contains('npc-mask')) wrap.remove();
      });

      /* 撒花粒子 */
      const cv = wrap.querySelector('.npc-canvas');
      const ctx = cv.getContext('2d');
      cv.width = innerWidth; cv.height = innerHeight;
      const colors = ['#E06B97', '#F8DDE7', '#4FAF73', '#E5A13D', '#fff'];
      const parts = Array.from({ length: 90 }, () => ({
        x: innerWidth / 2 + (Math.random() - .5) * 240,
        y: innerHeight / 2 - 60,
        vx: (Math.random() - .5) * 9,
        vy: -4 - Math.random() * 8,
        g: .22, w: 5 + Math.random() * 6, h: 3 + Math.random() * 5,
        c: colors[Math.floor(Math.random() * colors.length)],
        r: Math.random() * Math.PI, vr: (Math.random() - .5) * .25,
        life: 1
      }));
      (function tick() {
        if (!document.getElementById('np-celebrate')) return;
        ctx.clearRect(0, 0, cv.width, cv.height);
        let alive = false;
        parts.forEach(p => {
          p.vy += p.g; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life -= .006;
          if (p.life <= 0 || p.y > innerHeight + 20) return;
          alive = true;
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.life);
          ctx.translate(p.x, p.y); ctx.rotate(p.r);
          ctx.fillStyle = p.c;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        });
        if (alive) requestAnimationFrame(tick);
      })();
    }
  };
})();
