/* ============================================================
   NekoPapa 原型 · 全局存在层 np-her.js
   在没有 Live2D 舞台的页面上，她以一个 mini 形态持续在场：
   - 左下角圆形小她（头像 + 状态点），hover 显示她在做什么
   - 有待复习错题时，她会在页面加载后冒个小泡提醒
   已有 Live2D 的页面（learn-flow/chat/quiz/reading/speaking/pet/index）自动跳过
   ============================================================ */
(function () {
  // 有完整 Live2D 的页面不注入
  if (document.querySelector('#buddyStage, #buddy, .pet, .buddy')) return;

  const s = (window.NP && NP.get()) || { mistakesDue: 0, streak: 12 };

  const st = document.createElement('style');
  st.textContent = `
    .nph-wrap { position: fixed; left: 18px; bottom: 18px; z-index: 500; }
    .nph-her { width: 42px; height: 42px; border-radius: 50%; overflow: hidden;
      border: 2px solid #F8DDE7; box-shadow: 0 2px 8px rgba(24,28,35,.05), 0 10px 28px rgba(24,28,35,.09);
      cursor: pointer; background: #fff;
      transition: transform .2s cubic-bezier(.34,1.56,.64,1); }
    .nph-her:hover { transform: scale(1.1); }
    .nph-her img { width: 100%; height: 100%; object-fit: cover; }
    .nph-her .dot { position: absolute; right: -1px; bottom: -1px; width: 12px; height: 12px;
      border-radius: 50%; background: #4FAF73; border: 2.5px solid #fff; }
    .nph-tip { position: absolute; left: 50px; bottom: 6px; white-space: nowrap;
      background: #181C23; color: #fff; font-size: 11px; padding: 5px 10px; border-radius: 8px;
      opacity: 0; pointer-events: none; transition: opacity .15s; }
    .nph-wrap:hover .nph-tip { opacity: 1; }
    .nph-bubble { position: absolute; left: 52px; bottom: 0; width: 240px;
      background: #fff; border: 1px solid #E1E7EF; border-radius: 14px;
      box-shadow: 0 6px 20px rgba(24,28,35,.09), 0 24px 64px rgba(24,28,35,.13);
      padding: 12px 14px; font-size: 13px; color: #181C23; line-height: 1.6;
      opacity: 0; transform: translateY(8px); pointer-events: none;
      transition: opacity .25s ease, transform .25s cubic-bezier(.34,1.56,.64,1); }
    .nph-bubble.show { opacity: 1; transform: translateY(0); pointer-events: auto; }
    .nph-bubble .who { font-size: 10px; font-weight: 800; letter-spacing: .08em; color: #E06B97; margin-bottom: 4px; }
    .nph-bubble .acts { display: flex; gap: 8px; margin-top: 9px; }
    .nph-bubble .acts a, .nph-bubble .acts button {
      height: 26px; padding: 0 13px; border-radius: 999px; font-size: 12px; font-weight: 600;
      display: inline-flex; align-items: center; text-decoration: none; cursor: pointer;
      font-family: inherit; }
    .nph-bubble .acts .go { background: #E06B97; color: #FFF9FB; border: 0; }
    .nph-bubble .acts .later { background: transparent; color: #7A8492; border: 1px solid #E1E7EF; }
  `;
  document.head.appendChild(st);

  const wrap = document.createElement('div');
  wrap.className = 'nph-wrap';
  wrap.innerHTML = `
    <div class="nph-her" id="nphHer">
      <img src="assets/icon.png" alt="Neko">
      <span class="dot"></span>
    </div>
    <div class="nph-tip">Neko · 陪伴中</div>
    <div class="nph-bubble" id="nphBubble">
      <div class="who">NEKO</div>
      <div>有 <b>${s.mistakesDue}</b> 道错题到期了，现在来两道？</div>
      <div class="acts">
        <a class="go" href="review.html">去复习</a>
        <button class="later" id="nphLater">稍后</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);

  // 有待复习时，加载 4s 后她主动冒泡
  if (s.mistakesDue > 0) {
    setTimeout(() => {
      const b = document.getElementById('nphBubble');
      b.classList.add('show');
      setTimeout(() => b.classList.remove('show'), 8000);
    }, 4000);
  }
  document.getElementById('nphLater').addEventListener('click', () =>
    document.getElementById('nphBubble').classList.remove('show'));
  document.getElementById('nphHer').addEventListener('click', () =>
    document.getElementById('nphBubble').classList.toggle('show'));
})();
