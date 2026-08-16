/* =========================================================
 * 末世孤城 · 半感染者 —— 工具函数
 * ========================================================= */
(function () {
  'use strict';
  const LG = window.LG = window.LG || {};

  const Utils = {
    /* 可复现的伪随机（用于地图/贴图细节，保证每次进入同一区域纹理一致） */
    mulberry32(seed) {
      let a = seed >>> 0;
      return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    clamp(v, min, max) { return v < min ? min : (v > max ? max : v); },
    lerp(a, b, t) { return a + (b - a) * t; },
    rand(a, b) { return a + Math.random() * (b - a); },
    randInt(a, b) { return Math.floor(Utils.rand(a, b + 1)); },
    choice(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
    chance(p) { return Math.random() < p; },
    dist(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); },
    dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; },
    fmt(n) { return Math.round(n); },
    /* 角度（弧度）归一化 */
    normAngle(a) {
      while (a > Math.PI) a -= Math.PI * 2;
      while (a < -Math.PI) a += Math.PI * 2;
      return a;
    },
    /* 按权重随机取键 */
    weightedPick(obj) {
      const keys = Object.keys(obj);
      let total = 0;
      for (const k of keys) total += obj[k];
      let r = Math.random() * total;
      for (const k of keys) { r -= obj[k]; if (r <= 0) return k; }
      return keys[keys.length - 1];
    },
    /* 时间格式化：第 X 天 */
    dayLabel(day) { return '第 ' + day + ' 天'; },
    pad(n) { return n < 10 ? '0' + n : '' + n; },
    /* 从背包里拿指定数量物品（不校验），返回实际扣除数 */
    takeItems(bag, id, n) {
      n = n || 1;
      const have = bag[id] || 0;
      const take = Math.min(have, n);
      bag[id] = have - take;
      if (bag[id] <= 0) delete bag[id];
      return take;
    },
    addItems(bag, id, n) {
      bag[id] = (bag[id] || 0) + (n || 1);
    },
    countItems(bag, id) { return bag[id] || 0; },
    bagTotal(bag) {
      let t = 0;
      for (const k in bag) t += bag[k];
      return t;
    },
    /* 数组去重 */
    uniq(arr) { return Array.from(new Set(arr)); },

    /* 圆 vs AABB 碰撞推挤（最小穿透轴）
     * 修复了圆心恰好落在矩形内部时的退化情况：
     * 旧实现会把玩家沿 x 方向推出（可能瞬移出地图），
     * 现在改为沿"穿透最浅"的轴推出，玩家永远不会被卡死或穿墙。 */
    resolveCircleRect(px, py, r, rect) {
      const cx = Utils.clamp(px, rect.x, rect.x + rect.w);
      const cy = Utils.clamp(py, rect.y, rect.y + rect.h);
      const dx = px - cx, dy = py - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r * r) return { x: px, y: py };           // 无重叠
      if (d2 > 0.0001) {                                   // 圆心在矩形外：沿法线推出
        const d = Math.sqrt(d2);
        return { x: cx + dx / d * r, y: cy + dy / d * r };
      }
      // 圆心在矩形内部：沿最小穿透轴推出
      const left = px - rect.x, right = rect.x + rect.w - px;
      const top = py - rect.y, bottom = rect.y + rect.h - py;
      const m = Math.min(left, right, top, bottom);
      if (m === left) return { x: rect.x - r, y: py };
      if (m === right) return { x: rect.x + rect.w + r, y: py };
      if (m === top) return { x: px, y: rect.y - r };
      return { x: px, y: rect.y + rect.h + r };
    },
    /* 生成唯一 id */
    uid(prefix) { return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7); },
    /* 简化文本：保留换行 */
    escapeHtml(s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },
  };

  LG.Utils = Utils;
})();
