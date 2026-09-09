/* ============================================================
   NekoPapa 原型 · 数据适配层 np-data.js
   页面所有动态数据只从 window.NPD 取。
   当前：内存态空数据（诚实的空态 UI）。
   未来：后端/Stage 就绪后，只改本文件内部的 source 实现，
        页面代码零改动。
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 数据源探测 ----------
     tauri  : 桌面宿主内，未来走 window.__TAURI__ 桥
     memory : 浏览器原型，内存态（默认）                  */
  const hasTauri = typeof window !== 'undefined' &&
    !!(window.__TAURI__ || window.__TAURI_INTERNALS__);
  const SOURCE = hasTauri ? 'tauri' : 'memory';

  /* ---------- 内存态（原型期默认实现） ----------
     全部为「无数据」：新用户的第一天。写操作只改内存并广播，
     让 UI 交互闭环可用；接真后端后整段替换为远端调用。     */
  const mem = {
    user: null,            // { name }
    streak: null,          // number | null（null = 还没有记录）
    mistakes: null,        // { due, resolved }
    conversations: [],     // [{ id, title, href, running }]
    todayItems: [],        // [{ id, title, meta, durationMin, done, href }]
    weekDays: null,        // null = 由 buildEmptyWeek() 生成空周格
    notifications: [],     // [{ id, kind, title, desc, unread, href }]
    runningTasks: [],      // [{ id, title, meta, href }]
    suggestion: null,      // { text, actionText }
    bubbleLines: []        // [string]
  };

  /* 空周格：以今天为锚的本周一→周日，没有任何计划块 */
  function buildEmptyWeek() {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const names = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    return names.map((name, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return {
        name,
        month: d.getMonth() + 1,
        date: d.getDate(),
        isToday: d.toDateString() === now.toDateString(),
        blocks: []
      };
    });
  }

  /* ---------- 演示种子：?demo=1 时填充（仅 memory 源，设计预览用） ----------
     默认仍是诚实空态；接真后端后整段随 memory 实现一起替换。 */
  if (SOURCE === 'memory' && typeof location !== 'undefined' &&
      /[?&]demo=1\b/.test(location.search)) {
    mem.user = { name: 'sora' };
    mem.streak = 7;
    mem.mistakes = { due: 5, resolved: 12 };
    mem.conversations = [
      { id: 'c1', title: '「〜ことにする」的用法', href: 'chat.html', running: false },
      { id: 'c2', title: '词汇 · 食物篇', href: 'chat.html', running: false },
      { id: 'c3', title: '听力 · 车站对话精听', href: 'chat.html', running: true }
    ];
    mem.todayItems = [
      { id: 't1', title: '词汇', meta: '18 个新词', durationMin: 8, done: true, href: 'learn-flow.html' },
      { id: 't2', title: '语法', meta: '〜ようになる', durationMin: 12, done: false, href: 'learn-flow.html' },
      { id: 't3', title: '听力', meta: '日常会话', durationMin: 10, done: false, href: 'learn-flow.html' }
    ];
    /* 过去的几天点亮足迹条，今天留空由学习行为点亮 */
    const demoLoad = [2, 1, 3, 1, 2, 0, 0];
    mem.weekDays = buildEmptyWeek().map((d, i) => ({
      ...d,
      blocks: Array.from({ length: demoLoad[i] }, (_, j) => ({ id: d.name + '-' + j }))
    }));
    mem.notifications = [
      { id: 'n1', kind: 'review', title: '5 道错题到了最佳复习时机', desc: '现在复习，记得最牢', unread: true, href: 'review.html', icon: '' }
    ];
    mem.suggestion = { text: '昨天的<b>听力</b>比前天顺了不少。今天先把到期的 <b>5 道错题</b>收掉，再学新语法？', actionText: '好，就这样' };
    mem.bubbleLines = [
      '我在呢。今天也从 25 分钟开始吧。',
      '错题我都记着，到了最佳时机会提醒你。',
      '累了就说一声，换个轻松的话题也行。'
    ];
  }

  /* ---------- 订阅 ---------- */
  const listeners = [];
  function emit() { listeners.forEach(fn => fn(NPD)); }

  /* ---------- 公共 API ---------- */
  const NPD = {
    source: SOURCE,

    /* 首次解析完成；未来接真后端时在这里 await 首屏数据 */
    ready: Promise.resolve(),

    /* ----- 读 ----- */
    getUser()          { return mem.user; },
    getStreak()        { return mem.streak; },
    getMistakes()      { return mem.mistakes; },
    getConversations() { return mem.conversations.slice(); },
    getTodayPlan()     { return { items: mem.todayItems.slice() }; },
    getWeekPlan()      { return { days: mem.weekDays || buildEmptyWeek() }; },
    getNextUp() {
      const it = mem.todayItems.find(t => !t.done);
      return it ? { title: it.title, subtitle: it.meta, durationMin: it.durationMin, href: it.href || 'learn-flow.html' } : null;
    },
    getNotifications() { return mem.notifications.slice(); },
    getRunningTasks()  { return mem.runningTasks.slice(); },
    getHerSuggestion() { return mem.suggestion; },
    getBubbleLines()   { return mem.bubbleLines.slice(); },

    /* ----- 写（原型期内存态，接真后端后替换） ----- */
    toggleTodayItem(id) {
      const it = mem.todayItems.find(t => t.id === id);
      if (it) { it.done = !it.done; emit(); }
    },
    addTodayItem(title) {
      const t = String(title || '').trim();
      if (!t) return null;
      const it = { id: 't' + Date.now(), title: t, meta: '', durationMin: null, done: false, href: null };
      mem.todayItems.push(it); emit();
      return it;
    },
    dismissSuggestion() { mem.suggestion = null; emit(); },
    markAllNotificationsRead() {
      mem.notifications.forEach(n => { n.unread = false; }); emit();
    },

    onChange(fn) { listeners.push(fn); }
  };

  window.NPD = NPD;
})();
