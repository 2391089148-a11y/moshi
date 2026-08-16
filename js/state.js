/* =========================================================
 * 末世孤城 · 半感染者 —— 全局状态与规则
 * ========================================================= */
(function () {
  'use strict';
  const LG = window.LG = window.LG || {};

  const State = {
    scene: 'menu',        // 当前场景: menu / base / scavenge
    s: null,              // 存档数据
    weatherIdx: 0,
    nextWeather: 1,

    newGame() {
      const s = LG.Save.defaultSave();
      s.weather = 'overcast';
      LG.Save.save(s);
      this.s = s;
    },

    loadGame() {
      const s = LG.Save.load();
      if (s) {
        this.s = s;
        return true;
      }
      return false;
    },

    /* 重新开始（清档） */
    resetGame() {
      LG.Save.clear();
      this.newGame();
    },

    autosave() {
      if (!this.s) return;
      LG.Save.save(this.s);
    },

    /* ---------- 基础数值 ---------- */
    get hp() { return this.s ? this.s.hp : 100; },
    get maxHp() { return this.s ? this.s.maxHp : 100; },
    get infection() { return this.s ? this.s.infection : 0; },

    /* ---------- 物品 ---------- */
    addItem(id, n) { LG.Utils.addItems(this.s.bag, id, n); },
    removeItem(id, n) { LG.Utils.takeItems(this.s.bag, id, n); },
    count(id) { return LG.Utils.countItems(this.s.bag, id); },
    bagTotal() { return LG.Utils.bagTotal(this.s.bag); },
    /* 有效最大生命（装备加成） */
    effectiveMaxHp() {
      return LG.CFG.BAL.maxHp + this.equipBonus('maxHp');
    },
    /* 有效背包容量：基础 + 布袋(旧配方遗留) + 看广告扩容（最多 +8） */
    effectiveMaxCarry() {
      const pouch = Math.min(this.s.bag.pouch || 0, LG.CFG.BAL.pouchSlots);
      const ads = Math.min(this.s.flags.bagUpgrades || 0, 2);
      return LG.CFG.BAL.maxCarry + pouch * LG.CFG.BAL.pouchBonus + ads * 4;
    },
    canCarry(n) { return this.bagTotal() + (n || 1) <= this.effectiveMaxCarry(); },
    storageTotal() { return LG.Utils.bagTotal(this.s.storage); },

    /* ---------- 装备栏 ---------- */
    equippedItem(slot) {
      const s = this.s;
      return (s.equip && s.equip[slot]) || null;
    },
    /* 装备/卸下（物品保留在背包，只记录槽位） */
    equipItem(id) {
      const it = LG.CFG.ITEMS[id];
      if (!it || it.cat !== 'equip' || !it.slot) return false;
      const s = this.s;
      s.equip[it.slot] = id;
      // 装备头部装备后最大生命变化，血量跟随钳制
      if (it.slot === 'head') this.s.hp = LG.Utils.clamp(this.s.hp, 0, this.effectiveMaxHp());
      this.autosave();
      return true;
    },
    unequipItem(slot) {
      const s = this.s;
      if (!s.equip[slot]) return;
      s.equip[slot] = null;
      if (slot === 'head') this.s.hp = LG.Utils.clamp(this.s.hp, 0, this.effectiveMaxHp());
      this.autosave();
    },
    hasEquip(id) {
      const s = this.s;
      if (!s.equip) return false;
      for (const k in s.equip) if (s.equip[k] === id) return true;
      return false;
    },
    /* 装备提供的加成 */
    equipBonus(key) {
      const s = this.s;
      if (!s.equip) return 0;
      let total = 0;
      for (const k in s.equip) {
        const id = s.equip[k];
        const eq = id && LG.CFG.EQUIP[id];
        if (eq && eq.bonus && eq.bonus[key]) total += eq.bonus[key];
      }
      return total;
    },

    /* ---------- 驯服成功率（半感染者体质加成） ---------- */
    tamedChance() {
      const inf = this.s.infection;
      let c = LG.CFG.BAL.tamedBaseChance;
      if (inf >= 50) c += 0.15;
      if (inf >= 75) c += 0.1;
      return Math.min(c, 0.85);
    },

    /* ---------- 玩家状态变更 ---------- */
    heal(n) { this.s.hp = LG.Utils.clamp(this.s.hp + n, 0, this.effectiveMaxHp()); },
    damage(n) { this.s.hp = LG.Utils.clamp(this.s.hp - n, 0, this.effectiveMaxHp()); },
    addInfection(n) { this.s.infection = LG.Utils.clamp(this.s.infection + n, 0, 100); },
    useEnergy(n) { this.s.energy = LG.Utils.clamp(this.s.energy - n, 0, this.s.maxEnergy); },
    eat(itemId) {
      const it = LG.CFG.ITEMS[itemId];
      if (!it) return;
      this.s.hunger = LG.Utils.clamp(this.s.hunger + (it.hunger || 0), 0, 100);
      this.s.thirst = LG.Utils.clamp(this.s.thirst + (it.thirst || 0), 0, 100);
      if (it.infection) this.addInfection(it.infection);
      this.sfx('pickup');
    },
    useMed(itemId) {
      const it = LG.CFG.ITEMS[itemId];
      if (!it) return;
      if (it.heal) this.heal(it.heal);
      if (it.infection) this.addInfection(it.infection);
      this.sfx('heal');
    },

    /* ---------- 时间 ---------- */
    /* 按天数掷出新一天天气（雾天第 3 天起解锁，后期雨天更多） */
    pickWeather(day) {
      const pool = [
        ['clear', 24], ['overcast', 24], ['wind', 18], ['rain', 18],
      ];
      if (day >= 3) pool.push(['fog', 12]);
      if (day >= 7) pool.push(['rain', 10]);   // 后期雨更多 → 溺尸更多
      let total = 0;
      for (const [, w] of pool) total += w;
      let r = Math.random() * total;
      let pick = pool[pool.length - 1][0];
      for (const [id, w] of pool) { r -= w; if (r <= 0) { pick = id; break; } }
      // 避免与昨天完全一样（只有一种候选时除外）
      const s = this.s;
      if (s && s.weather === pick && pool.length > 1) {
        const others = pool.filter(([id]) => id !== pick);
        let t2 = 0;
        for (const [, w] of others) t2 += w;
        let r2 = Math.random() * t2;
        pick = others[others.length - 1][0];
        for (const [id, w] of others) { r2 -= w; if (r2 <= 0) { pick = id; break; } }
      }
      return pick;
    },

    /* 休息一晚：真正进入下一天（作物生长、状态衰减、新天气、随机氛围） */
    passDay() {
      const s = this.s;
      s.day += 1;
      // 宠物增益
      const hasPet = (t) => s.pets.some(p => p.type === t);
      const hamster = hasPet('hamster');   // 仓鼠：作物加速
      const cat = hasPet('cat');           // 暹罗猫：体力恢复更多
      const rabbit = hasPet('rabbit');     // 变异兔：感染漂移减缓
      // 变异植物宠物增益
      const hasPlant = (c) => s.plantPets.some(p => p.crop === c);
      const plantPotato = hasPlant('potato');    // 土豆精：饥饿衰减 -3
      const plantCorn = hasPlant('corn');        // 玉米精：作物 +0.2
      const plantTomato = hasPlant('mtomato');   // 番茄精：感染漂移 -0.5
      const plantMush = hasPlant('mushroom');    // 菇精：体力 +5
      // 艾巳：每日生产医疗用品
      if (s.humans && s.humans.some(h => h.type === 'aishi')) {
        const made = LG.Utils.chance(0.7) ? 'bandage' : 'medkit';
        if (LG.Utils.bagTotal(s.storage) < LG.CFG.BAL.maxStorage) {
          LG.Utils.addItems(s.storage, made, 1);
          if (LG.UI.toast) LG.UI.toast('👩 艾巳做好了 ' + LG.CFG.ITEMS[made].name + '，放进了储物箱。', '');
        }
      }
      // 作物生长
      for (const c of s.crops) {
        if (c.watered) { c.growth += 1.5; c.watered = false; }
        else c.growth += 1;
        if (hamster || plantCorn) c.growth += 0.25;
      }
      // 状态衰减
      s.hunger = LG.Utils.clamp(s.hunger - (LG.CFG.BAL.hungerDecayPerDay - (plantPotato ? 3 : 0)), 0, 100);
      s.thirst = LG.Utils.clamp(s.thirst - LG.CFG.BAL.thirstDecayPerDay, 0, 100);
      if (s.hunger <= 0 || s.thirst <= 0) {
        this.damage(12);
      }
      // 感染轻微漂移（半感染者体质；变异兔/番茄精/深水坠饰能减缓）
      if (s.infection > 60) {
        const drift = Math.max(0.2, (rabbit ? 0.5 : 1) - (plantTomato ? 0.5 : 0) - this.equipBonus('infDrift'));
        this.addInfection(drift);
      }
      // 体力恢复（暹罗猫 + 菇精加成）
      s.energy = LG.Utils.clamp(s.energy + 45 + (cat ? 10 : 0) + (plantMush ? 5 : 0), 0, s.maxEnergy);
      // 土狗：每天有概率在院子里捡到东西
      if (hasPet('dog') && LG.Utils.chance(0.4)) {
        const gift = LG.Utils.weightedPick({ scrap: 3, cloth: 3, rawMeat: 2, water: 2, seedCorn: 1 });
        if (this.canCarry(1)) {
          this.addItem(gift, 1);
          if (LG.UI.toast) LG.UI.toast('🐕 土狗叼回来一件东西：' + LG.CFG.ITEMS[gift].name, '');
        }
      }
      // 新一天的天气
      s.weather = this.pickWeather(s.day);
      LG.Audio.setWeather(s.weather);
      // 饥饿/口渴/感染死亡判定
      if (s.hp <= 0) {
        s.hp = 1;
        LG.UI.toast('饥饿与干渴啃噬着你……', 'warn');
      }
      // 堕落结局判定
      if (s.infection >= 100) {
        this.triggerEnding('fall');
        return;
      } else if (s.day >= LG.CFG.BAL.winDay && s.diaryFound.length >= LG.CFG.DIARY.length) {
        this.triggerEnding('watch');
        return;
      }
      // "度过一天"转场：真正进入下一天
      const w = LG.CFG.WEATHER.find(x => x.id === s.weather);
      const lines = LG.CFG.DAY_LINES[s.weather] || [];
      const line = lines[Math.floor(Math.random() * lines.length)] || '';
      if (LG.UI.dayTransition) LG.UI.dayTransition(s.day, w ? w.name : '', line);
      this.autosave();
      LG.TapSDK.trackEvent('day_pass', { day: s.day });
    },

    /* ---------- 日记 ---------- */
    addDiary(id) {
      if (this.s.diaryFound.indexOf(id) >= 0) return false;
      this.s.diaryFound.push(id);
      // 日记碎片的用处：每页都夹着前主人留下的物资
      const pool = ['core', 'core', 'antibiotic', 'medkit', 'gasoline', 'battery', 'seedTomato', 'cookedMeat', 'water', 'bandage'];
      const n = LG.Utils.randInt(1, 2);
      const gifts = [];
      for (let i = 0; i < n; i++) gifts.push(LG.Utils.choice(pool));
      const fits = gifts.every(g => this.canCarry(1));
      if (fits) {
        for (const g of gifts) this.addItem(g, 1);
        if (LG.UI.toast) LG.UI.toast('📜 纸页里夹着：' + gifts.map(g => LG.CFG.ITEMS[g].icon + LG.CFG.ITEMS[g].name).join('、'), '');
        this.autosave();
      } else {
        if (LG.UI.toast) LG.UI.toast('背包满了，日记里的东西散落了……', 'warn');
      }
      return true;
    },

    /* ---------- 结局 ---------- */
    /* 主线：病毒解药 —— 自由选择是否释放 */
    cureModal() {
      const s = this.s;
      if (!s.cure || s.ending) return;
      LG.UI.modal('🫙 病毒解药',
        '<div class="desc">玻璃罐里装着淡绿色的气体，安静得像一个谎言。</div><br>' +
        '科研所的记录说：这是解药。打开它，病毒会被净化。<br>' +
        '但你体内的另一半，似乎也在等着什么……',
        [
          { label: '🌍 释放解药——净化病毒，拯救世界', cls: 'primary', cb: () => { s.cureUsed = true; this.autosave(); this.triggerEnding('clean'); } },
          { label: '👑 收下它——成为末日帝王', cb: () => { s.cureUsed = true; this.autosave(); this.triggerEnding('emperor'); } },
          { label: '🏠 先带回家，再想想', cb: () => { s.cureKept = true; this.autosave(); LG.UI.toast('玻璃罐沉甸甸的。你暂时收下了它。', ''); } },
        ]);
    },

    triggerEnding(type) {
      const s = this.s;
      if (s.ending) return;
      s.ending = type;
      s.dead = true;
      this.autosave();
      LG.Save.addStats({ runs: 1, totalDays: s.day });
      LG.Audio.sfx('dead');
      LG.TapSDK.trackEvent('ending', { type, day: s.day });
      // 交给场景层展示
      if (LG.Scenes && LG.Scenes.showEnding) LG.Scenes.showEnding(type);
    },

    /* ---------- 音效便捷 ---------- */
    sfx(kind) { LG.Audio.sfx(kind); },
  };

  LG.State = State;
})();
