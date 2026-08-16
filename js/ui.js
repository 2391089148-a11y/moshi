/* =========================================================
 * 末世孤城 · 半感染者 —— DOM UI 层（HUD / 弹窗 / 面板）
 * ========================================================= */
(function () {
  'use strict';
  const LG = window.LG = window.LG || {};

  const UI = {
    els: {},
    modalOpen: false,
    selectedBagItem: null,

    init() {
      const $ = (id) => document.getElementById(id);
      this.els = {
        hud: $('hud'), controls: $('controls'), loading: $('loading'),
        barHp: $('bar-hp'), barInf: $('bar-inf'), barHun: $('bar-hun'), barThi: $('bar-thi'), barEn: $('bar-en'),
        txtHp: $('txt-hp'), txtInf: $('txt-inf'), txtHun: $('txt-hun'), txtThi: $('txt-thi'), txtEn: $('txt-en'),
        txtDay: $('txt-day'), txtWeather: $('txt-weather'),
        modalMask: $('modal-mask'), modalTitle: $('modal-title'), modalBody: $('modal-body'), modalBtns: $('modal-btns'),
        panelBag: $('panel-bag'), bagGrid: $('bag-grid'),
        panelDiary: $('panel-diary'), diaryList: $('diary-list'),
        panelSet: $('panel-set'),
        ending: $('ending'), endingTitle: $('ending-title'), endingText: $('ending-text'),
        btnEndingRestart: $('btn-ending-restart'),
        daypass: $('daypass'), daypassDay: $('daypass-day'), daypassWeather: $('daypass-weather'), daypassLine: $('daypass-line'),
        setSfx: $('set-sfx'), setMusic: $('set-music'), setShake: $('set-shake'), btnTap: $('btn-tap'),
        btnSave: $('btn-save'), btnReset: $('btn-reset'),
        toastWrap: $('toast-wrap'),
      };

      $('btn-bag').addEventListener('click', () => this.toggleBag());
      $('btn-diary').addEventListener('click', () => this.toggleDiary());
      $('btn-set').addEventListener('click', () => this.toggleSettings());
      document.querySelectorAll('.panel-close').forEach(b => {
        b.addEventListener('click', () => {
          const which = b.dataset.close;
          if (which === 'bag') this.closeBag();
          if (which === 'diary') this.closeDiary();
          if (which === 'set') this.closeSettings();
        });
      });
      this.els.setSfx.addEventListener('click', () => this.toggleSetting('sound', this.els.setSfx));
      this.els.setMusic.addEventListener('click', () => this.toggleSetting('music', this.els.setMusic));
      this.els.setShake.addEventListener('click', () => this.toggleSetting('shake', this.els.setShake));
      this.els.btnTap.addEventListener('click', () => this.taptapLogin());
      this.els.btnSave.addEventListener('click', () => { LG.State.autosave(); this.toast('已保存', ''); });
      this.els.btnReset.addEventListener('click', () => {
        this.confirm('重新开始', '将清除当前存档，一切回到第 1 天。确定吗？', () => {
          LG.State.resetGame();
          this.closeSettings();
          LG.Scenes.go('menu');
        });
      });
      this.els.btnEndingRestart.addEventListener('click', () => {
        this.els.ending.classList.add('hidden');
        LG.State.resetGame();
        LG.Scenes.go('menu');
      });

      // 初始化设置按钮文本
      if (LG.State.s && LG.State.s.settings) {
        this.els.setSfx.textContent = LG.State.s.settings.sound === false ? '关' : '开';
        this.els.setMusic.textContent = LG.State.s.settings.music === false ? '关' : '开';
        this.els.setShake.textContent = LG.State.s.settings.shake === false ? '关' : '开';
      }
    },

    toggleSetting(kind, btn) {
      if (!LG.State.s.settings) LG.State.s.settings = {};
      LG.State.s.settings[kind] = !(LG.State.s.settings[kind] === false);
      btn.textContent = LG.State.s.settings[kind] ? '开' : '关';
      if (kind === 'sound' || kind === 'music') LG.Audio.setEnabled(kind, LG.State.s.settings[kind]);
      LG.State.autosave();
      this.sfx('ui');
    },

    /* ---------- HUD ---------- */
    updateHUD() {
      const s = LG.State.s;
      if (!s) return;
      const maxHp = LG.State.effectiveMaxHp ? LG.State.effectiveMaxHp() : s.maxHp;
      const pct = (v, m) => Math.round(LG.Utils.clamp(v / m, 0, 1) * 100) + '%';
      this.els.barHp.style.width = pct(s.hp, maxHp);
      this.els.barInf.style.width = pct(s.infection, 100);
      this.els.barHun.style.width = pct(s.hunger, 100);
      this.els.barThi.style.width = pct(s.thirst, 100);
      this.els.barEn.style.width = pct(s.energy, s.maxEnergy);
      this.els.txtHp.textContent = Math.ceil(s.hp) + '/' + maxHp;
      this.els.txtInf.textContent = Math.ceil(s.infection) + '%';
      this.els.txtHun.textContent = Math.ceil(s.hunger);
      this.els.txtThi.textContent = Math.ceil(s.thirst);
      this.els.txtEn.textContent = Math.ceil(s.energy);
      this.els.txtDay.textContent = '第 ' + s.day + ' 天';
      const w = LG.CFG.WEATHER.find(x => x.id === s.weather);
      this.els.txtWeather.textContent = w ? w.name : '';
      // 高感染时 HUD 感染条闪烁
      this.els.barInf.style.opacity = s.infection > 75 ? (Math.sin(Date.now() / 300) > 0 ? 1 : 0.5) : 1;
    },

    /* ---------- Toast ---------- */
    toast(text, cls, dur) {
      const el = document.createElement('div');
      el.className = 'toast' + (cls ? ' ' + cls : '');
      el.textContent = text;
      this.els.toastWrap.appendChild(el);
      setTimeout(() => {
        el.style.transition = 'opacity .5s';
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 500);
      }, dur || 2600);
    },

    /* ---------- Modal ---------- */
    modal(title, bodyHTML, buttons) {
      this.modalOpen = true;
      this.els.modalTitle.textContent = title;
      this.els.modalBody.innerHTML = bodyHTML;
      this.els.modalBtns.innerHTML = '';
      (buttons || []).forEach(b => {
        const btn = document.createElement('button');
        btn.className = 'mbtn' + (b.cls ? ' ' + b.cls : '');
        btn.innerHTML = b.label;
        if (b.disabled) btn.classList.add('disabled');
        btn.addEventListener('click', () => {
          if (b.cb) b.cb();
          this.closeModal();
        });
        this.els.modalBtns.appendChild(btn);
      });
      this.els.modalMask.classList.remove('hidden');
    },
    closeModal() {
      this.modalOpen = false;
      this.els.modalMask.classList.add('hidden');
    },

    confirm(title, text, onOk) {
      this.modal(title, '<div>' + LG.Utils.escapeHtml(text).replace(/\n/g, '<br>') + '</div>', [
        { label: '取消', cb: () => {} },
        { label: '确定', cls: 'primary', cb: onOk || (() => {}) },
      ]);
    },

    /* ---------- 背包 ---------- */
    toggleBag() {
      if (this.modalOpen) return;
      if (this.els.panelBag.classList.contains('hidden')) this.showBag();
      else this.closeBag();
    },
    showBag() {
      this.closeDiary(); this.closeSettings();
      this.selectedBagItem = null;
      this.renderBag();
      this.els.panelBag.classList.remove('hidden');
    },
    closeBag() { this.els.panelBag.classList.add('hidden'); },

    renderBag() {
      const s = LG.State.s;
      if (!s) return;
      const grid = this.els.bagGrid;
      grid.innerHTML = '';
      // 装备栏 + 看广告按钮
      const s2 = LG.State;
      let equipHtml = '<div style="grid-column:1/-1;">' +
        '<div style="font-size:12px;color:#9fd8b4;margin:2px 0 6px;">装备栏</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;">';
      // 武器
      const w = LG.CFG.ITEMS[s.weapon];
      equipHtml += '<div style="text-align:center;min-width:52px;background:rgba(40,50,50,.5);border:1px solid rgba(170,190,182,.14);border-radius:8px;padding:4px 6px;">' +
        '<div style="font-size:16px;">' + (w ? w.icon : '🗡') + '</div>' +
        '<div style="font-size:9px;color:#8fa09b;">武器<br>' + (w ? w.name : '无') + '</div></div>';
      // 装备槽位
      LG.CFG.EQUIP_SLOTS.forEach(([slot, label]) => {
        const id = s.equip[slot];
        const it = id ? LG.CFG.ITEMS[id] : null;
        equipHtml += '<div style="text-align:center;min-width:52px;background:rgba(40,50,50,.5);border:1px solid ' + (it ? 'rgba(232,178,106,.45)' : 'rgba(170,190,182,.14)') + ';border-radius:8px;padding:4px 6px;cursor:pointer;" data-unequip="' + slot + '" title="点击卸下">' +
          '<div style="font-size:16px;">' + (it ? it.icon : '·') + '</div>' +
          '<div style="font-size:9px;color:#8fa09b;">' + label + '<br>' + (it ? it.name : '空') + '</div></div>';
      });
      equipHtml += '</div>' +
        '<button class="mbtn" data-bag-ad style="margin-top:8px;">🎬 看广告补充物资</button>' +
        '<div style="margin:8px 0;border-bottom:1px solid rgba(170,190,182,.1);"></div></div>';
      grid.innerHTML = equipHtml;
      // 绑定：卸下装备
      grid.querySelectorAll('[data-unequip]').forEach(el => el.addEventListener('click', () => {
        const slot = el.dataset.unequip;
        if (s.equip[slot]) {
          s2.unequipItem(slot);
          this.toast('卸下了装备', '');
          this.renderBag();
        }
      }));
      // 绑定：看广告
      const adBtn = grid.querySelector('[data-bag-ad]');
      if (adBtn) adBtn.addEventListener('click', () => {
        LG.UI.taptapSupplyPack();
      });

      const ids = Object.keys(s.bag).filter(id => s.bag[id] > 0);
      if (ids.length === 0) {
        grid.innerHTML += '<div style="grid-column:1/-1;color:#66756f;font-size:12px;padding:12px;">背包空空如也。废墟不会施舍你什么。</div>';
        return;
      }
      ids.sort((a, b) => {
        const catA = LG.CFG.ITEMS[a] ? LG.CFG.ITEMS[a].cat : 'z';
        const catB = LG.CFG.ITEMS[b] ? LG.CFG.ITEMS[b].cat : 'z';
        return catA.localeCompare(catB);
      });
      ids.forEach(id => {
        const it = LG.CFG.ITEMS[id];
        if (!it) return;
        const el = document.createElement('div');
        el.className = 'bag-item' + (this.selectedBagItem === id ? ' selected' : '');
        el.innerHTML = '<div><span class="i-name">' + it.icon + ' ' + it.name + '</span><span class="i-num">×' + s.bag[id] + '</span></div>' +
          '<div class="i-desc">' + it.desc + '</div>';
        el.addEventListener('click', () => {
          this.selectedBagItem = this.selectedBagItem === id ? null : id;
          this.renderBag();
          this.itemActions(id);
        });
        grid.appendChild(el);
      });
    },

    itemActions(id) {
      const s = LG.State.s;
      const it = LG.CFG.ITEMS[id];
      const btns = [];
      if (it.cat === 'food') {
        btns.push({ label: '吃下（饱食+' + (it.hunger || 0) + (it.thirst ? ' 水分+' + it.thirst : '') + (it.infection ? ' <span class="need">感染+' + it.infection + '</span>' : '') + '）', cb: () => { LG.State.removeItem(id, 1); LG.State.eat(id); this.renderBag(); this.toast('你吃下了' + it.name, ''); } });
      }
      if (it.cat === 'med') {
        btns.push({ label: '使用（' + (it.heal ? '治疗' + it.heal + ' ' : '') + (it.infection ? '感染' + (it.infection < 0 ? '' : '+') + it.infection + ' ' : '') + '）', cb: () => { LG.State.removeItem(id, 1); LG.State.useMed(id); this.renderBag(); this.toast(it.infection && it.infection < 0 ? '尸化被压下去了……' : '伤口在愈合。', ''); } });
      }
      if (it.cat === 'weapon') {
        const equipped = s.weapon === id;
        btns.push({ label: equipped ? '（已装备）' : '装备 ' + it.name, disabled: equipped, cb: () => { s.weapon = id; this.renderBag(); this.toast('你握紧了' + it.name, ''); LG.State.autosave(); } });
      }
      if (it.cat === 'equip') {
        const slot = it.slot;
        const equipped = s.equip[slot] === id;
        const slotName = (LG.CFG.EQUIP_SLOTS.find(x => x[0] === slot) || [slot, slot])[1];
        if (equipped) {
          btns.push({ label: '（已装备于' + slotName + '）', disabled: true, cb: () => {} });
        } else {
          btns.push({ label: '装备到' + slotName, cb: () => {
            LG.State.equipItem(id);
            this.renderBag();
            this.toast(it.name + ' 已装备。', '');
          } });
        }
      }
      btns.push({ label: '取消', cb: () => {} });
      if (btns.length > 1) {
        this.modal(it.icon + ' ' + it.name, '<div class="desc">' + it.desc + '</div><br>持有 ×' + s.bag[id], btns);
      }
    },

    /* ---------- 日记 ---------- */
    toggleDiary() {
      if (this.modalOpen) return;
      if (this.els.panelDiary.classList.contains('hidden')) this.showDiary();
      else this.closeDiary();
    },
    showDiary() {
      this.closeBag(); this.closeSettings();
      const s = LG.State.s;
      const list = this.els.diaryList;
      list.innerHTML = '';
      if (s.diaryFound.length === 0) {
        list.innerHTML = '<div style="color:#66756f;font-size:12px;padding:10px;">还没有找到阿岚的笔记。废墟深处，有人在等一个读者。<br><br>（搜索废墟时，在箱柜里翻找，有机会找到日记碎片）</div>';
      }
      LG.CFG.DIARY.forEach(d => {
        const found = s.diaryFound.indexOf(d.id) >= 0;
        const el = document.createElement('div');
        el.className = 'diary-entry';
        if (!found) {
          el.innerHTML = '<div class="d-head">第 ' + d.day + ' 天 · 未找到</div><div style="color:#4d5a56;">—— 纸页被风吹散在废墟里 ——</div>';
          el.style.opacity = '0.5';
        } else {
          el.innerHTML = '<div class="d-head">第 ' + d.day + ' 天 · 阿岚</div>' + LG.Utils.escapeHtml(d.text);
        }
        list.appendChild(el);
      });
      this.els.panelDiary.classList.remove('hidden');
    },
    closeDiary() { this.els.panelDiary.classList.add('hidden'); },

    /* ---------- 设置 ---------- */
    toggleSettings() {
      if (this.modalOpen) return;
      if (this.els.panelSet.classList.contains('hidden')) this.showSettings();
      else this.closeSettings();
    },
    showSettings() {
      this.closeBag(); this.closeDiary();
      // 动态生成 TapTap 区（仅登录与激励视频；TapTap H5 禁止内购）
      const tapRow = document.getElementById('tap-extra');
      if (!tapRow) {
        const div = document.createElement('div');
        div.id = 'tap-extra';
        div.innerHTML = '<div style="margin-top:14px;font-size:12px;color:#8fa09b;border-bottom:1px solid rgba(170,190,182,.08);padding-bottom:6px;">TapTap 平台（H5 渠道禁止内购，无支付功能）</div>' +
          '<div class="set-row"><span>看广告领物资礼包</span><button id="tap-ad" class="toggle-btn">观看</button></div>' +
          '<div class="set-row"><span>看广告扩充背包（+4，最多2次）</span><button id="tap-bag" class="toggle-btn">观看</button></div>' +
          '<div class="set-row"><span>看广告解锁第二随从位</span><button id="tap-follow" class="toggle-btn">观看</button></div>' +
          '<div class="set-row"><span>隐私政策</span><button id="tap-privacy" class="toggle-btn">查看</button></div>';
        this.els.panelSet.appendChild(div);
        document.getElementById('tap-ad').addEventListener('click', () => this.taptapSupplyPack());
        document.getElementById('tap-bag').addEventListener('click', () => this.taptapBagUpgrade());
        document.getElementById('tap-follow').addEventListener('click', () => this.taptapFollowerSlot());
        document.getElementById('tap-privacy').addEventListener('click', () => {
          const url = (LG.CFG.TAP && LG.CFG.TAP.privacyUrl) || 'https://2391089148-a11y.github.io/moshi/';
          window.open(url, '_blank');
        });
      }
      const user = LG.TapSDK.getUserInfo();
      this.els.btnTap.textContent = user ? user.name : '未登录';
      this.els.panelSet.classList.remove('hidden');
    },
    closeSettings() { this.els.panelSet.classList.add('hidden'); },

    taptapLogin() {
      this.toast('正在连接 TapTap…', '');
      LG.TapSDK.login().then(r => {
        if (r.ok) {
          this.els.btnTap.textContent = r.user.name;
          this.toast(r.mock ? '已登录（模拟）' : '已登录 TapTap', '');
        } else {
          this.toast('登录失败', 'warn');
        }
      });
    },

    /* 看广告：物资礼包（可重复） */
    taptapSupplyPack() {
      this.toast('正在播放广告…', '');
      LG.TapSDK.showRewardedVideo().then(r => {
        if (r.ok && r.rewarded) {
          const gifts = ['water', 'water', 'can', 'bandage', LG.Utils.choice(['rawMeat', 'scrap', 'seedCorn', 'battery'])];
          for (const g of gifts) {
            if (LG.State.canCarry(1)) LG.State.addItem(g, 1);
          }
          LG.State.autosave();
          this.toast('🎁 物资礼包到手：清水×2、罐头、绷带、' + LG.CFG.ITEMS[gifts[4]].name, '');
          this.sfx('pickup');
          LG.TapSDK.trackEvent('supply_pack', {});
        } else {
          this.toast('广告未完成', 'warn');
        }
      });
    },

    /* 看广告：扩充背包容量 */
    taptapBagUpgrade() {
      const s = LG.State.s;
      if ((s.flags.bagUpgrades || 0) >= 2) { this.toast('背包已经扩到最大了', ''); return; }
      this.toast('正在播放广告…', '');
      LG.TapSDK.showRewardedVideo().then(r => {
        if (r.ok && r.rewarded) {
          s.flags.bagUpgrades = (s.flags.bagUpgrades || 0) + 1;
          LG.State.autosave();
          this.toast('🎒 背包容量 +4（当前 ' + LG.State.effectiveMaxCarry() + '）', 'purple');
          this.sfx('pickup');
          LG.TapSDK.trackEvent('bag_upgrade', { level: s.flags.bagUpgrades });
        } else {
          this.toast('广告未完成', 'warn');
        }
      });
    },

    /* 看广告：解锁第二随从位 */
    taptapFollowerSlot() {
      const s = LG.State.s;
      if (s.flags.followerSlot2) { this.toast('第二随从位已解锁', ''); return; }
      this.toast('正在播放广告…', '');
      LG.TapSDK.showRewardedVideo().then(r => {
        if (r.ok && r.rewarded) {
          s.flags.followerSlot2 = true;
          LG.State.autosave();
          this.toast('🧟 第二随从位已解锁（外出最多带 2 名随从）', 'purple');
          this.sfx('pickup');
          LG.TapSDK.trackEvent('unlock_follower2', {});
        } else {
          this.toast('广告未完成', 'warn');
        }
      });
    },

    taptapAd() {
      this.toast('正在播放广告…', '');
      LG.TapSDK.showRewardedVideo().then(r => {
        if (r.ok && r.rewarded) {
          const gift = LG.Utils.choice(['bandage', 'water', 'rawMeat', 'seedCorn', 'scrap']);
          LG.State.addItem(gift, 2);
          LG.State.autosave();
          this.toast('广告结束。废墟给你留了点东西：' + LG.CFG.ITEMS[gift].name + ' ×2', '');
          this.sfx('pickup');
        } else {
          this.toast('广告未完成', 'warn');
        }
      });
    },

    /* ---------- 度过一天转场 ---------- */
    dayTransition(day, weatherName, line) {
      const e = this.els;
      if (!e.daypass) return;
      e.daypassDay.textContent = '第 ' + day + ' 天';
      e.daypassWeather.textContent = weatherName ? '今日天气 · ' + weatherName : '';
      e.daypassLine.textContent = line || '';
      e.daypass.classList.remove('hidden');
      // 重启动画
      e.daypass.style.animation = 'none';
      void e.daypass.offsetWidth;
      e.daypass.style.animation = '';
      clearTimeout(this._daypassTimer);
      this._daypassTimer = setTimeout(() => {
        e.daypass.classList.add('hidden');
      }, 2600);
    },

    /* ---------- 结局 ---------- */
    showEnding(type) {
      const e = LG.CFG.ENDINGS[type];
      if (!e) return;
      this.els.endingTitle.textContent = e.title;
      let text = e.text.replace('{day}', LG.State.s ? LG.State.s.day : '?');
      if (e.purple) text = text.replace(/半感染者/g, '<span class="purple">半感染者</span>');
      this.els.endingText.innerHTML = text.replace(/\n/g, '\n');
      this.els.ending.classList.remove('hidden');
    },

    sfx(kind) { LG.Audio.sfx(kind); },
  };

  LG.UI = UI;
})();
