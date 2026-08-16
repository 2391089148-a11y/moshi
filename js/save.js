/* =========================================================
 * 末世孤城 · 半感染者 —— 存档系统（localStorage）
 * ========================================================= */
(function () {
  'use strict';
  const LG = window.LG = window.LG || {};

  const SAVE_KEY = 'lg_save_v1';
  const STATS_KEY = 'lg_stats_v1';

  const Save = {
    /* 存档数据结构 */
    defaultSave() {
      return {
        ver: 1,
        day: 1,
        hp: 100, maxHp: 100,
        energy: 80, maxEnergy: 100,
        hunger: 80, thirst: 80,
        infection: 35,
        weapon: 'pipe',
        equip: { head: null, body: null, foot: null, acc: null, toy: null },
        bag: { pipe: 1, water: 2, can: 1, bandage: 1, seedPotato: 3, seedCorn: 2, rawMeat: 2 },
        storage: {},             // 储物箱 {itemId: qty}
        crops: [],               // [{id, crop, plantedDay, watered}]
        tamed: [],               // [{id, name, type, hp, hungry}]
        bigZombies: [],          // [{id, name, type, hp}]
        furniture: [],           // [{id, type, x, y}] 摆在家里的家具
        pets: [],                // [{zone, type, name}] 收养的宠物
        plantPets: [],           // [{crop, name, x, y}] 变异植物宠物（每种作物限一只）
        humans: [],              // 招募的人类 [{type, name}]
        diaryFound: [],          // 已收集日记 id
        stats: { kills: 0, scavenges: 0, plants: 0, harvests: 0, tames: 0, synths: 0, deaths: 0 },
        settings: { sound: true, music: true, shake: true },
        flags: { introSeen: false, radioHeard: 0, catFed: 0, bagUpgrades: 0, followerSlot2: false },
        weather: 'overcast',
        dead: false,
        ending: null,
      };
    },

    save(s) {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(s));
        return true;
      } catch (e) { return false; }
    },

    load() {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return null;
        const s = JSON.parse(raw);
        // 补默认字段（升级兼容）
        const d = this.defaultSave();
        return Object.assign(d, s);
      } catch (e) { return null; }
    },

    clear() {
      try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* noop */ }
    },

    /* 统计（跨周目累计，用于 TapTap 玩家信息展示） */
    stats() {
      try {
        const raw = localStorage.getItem(STATS_KEY);
        return raw ? JSON.parse(raw) : { runs: 0, totalDays: 0 };
      } catch (e) { return { runs: 0, totalDays: 0 }; }
    },
    addStats(delta) {
      try {
        const s = this.stats();
        for (const k in delta) s[k] = (s[k] || 0) + delta[k];
        localStorage.setItem(STATS_KEY, JSON.stringify(s));
      } catch (e) { /* noop */ }
    },
  };

  LG.Save = Save;
})();
