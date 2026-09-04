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
        date: d.getDate(),
        isToday: d.toDateString() === now.toDateString(),
        blocks: []
      };
    });
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
