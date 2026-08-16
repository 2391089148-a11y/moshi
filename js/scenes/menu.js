/* =========================================================
 * 末世孤城 · 半感染者 —— 主菜单场景
 * 氛围：铅灰色的天空、飘荡的尘埃、远处一尊静止的丧尸剪影、收音机残响
 * ========================================================= */
(function () {
  'use strict';
  const LG = window.LG = window.LG || {};

  const Menu = {
    name: 'menu',
    el: null,
    t: 0,
    radioLine: '',
    radioIdx: 0,
    radioTimer: 0,
    dust: [],

    enter() {
      LG.State.scene = 'menu';
      document.getElementById('hud').classList.add('hidden');
      document.getElementById('controls').classList.add('hidden');
      LG.UI.closeModal();

      this.radioIdx = Math.floor(Math.random() * LG.CFG.RADIO.length);
      this.radioLine = LG.CFG.RADIO[this.radioIdx];
      this.radioTimer = 8;

      // 尘埃粒子
      this.dust = [];
      for (let i = 0; i < 40; i++) {
        this.dust.push({ x: Math.random(), y: Math.random(), s: Math.random() * 2 + 0.5, v: Math.random() * 0.02 + 0.005 });
      }

      // DOM
      const el = document.createElement('div');
      el.id = 'menu-screen';
      el.innerHTML =
        '<div class="menu-title">末世孤城</div>' +
        '<div class="menu-sub">半 感 染 者</div>' +
        '<div class="menu-line"></div>' +
        '<div class="menu-radio" id="menu-radio"></div>' +
        '<div class="menu-btns" id="menu-btns"></div>' +
        '<div class="menu-foot">H5 生存沙盒 · TapTap SDK 接入示例</div>';
      document.getElementById('app').appendChild(el);
      this.el = el;
      document.getElementById('menu-radio').textContent = '📻 ' + this.radioLine;

      // 按钮
      const btns = document.getElementById('menu-btns');
      const hasSave = LG.Save.load() !== null;
      const btnContinue = document.createElement('button');
      btnContinue.className = 'menu-btn';
      btnContinue.textContent = hasSave ? '继续流浪' : '';
      if (hasSave) {
        btnContinue.addEventListener('click', () => {
          LG.Audio.sfx('ui');
          LG.State.loadGame();
          LG.Scenes.go('base');
        });
        btns.appendChild(btnContinue);
      }
      const btnNew = document.createElement('button');
      btnNew.className = 'menu-btn primary';
      btnNew.textContent = hasSave ? '新的开始（覆盖存档）' : '新的开始';
      btnNew.addEventListener('click', () => {
        LG.Audio.sfx('ui');
        LG.State.newGame();
        this.showIntro(() => LG.Scenes.go('base'));
      });
      btns.appendChild(btnNew);
      const btnTap = document.createElement('button');
      btnTap.className = 'menu-btn tap';
      btnTap.textContent = 'TapTap 登录 / 支持';
      btnTap.addEventListener('click', () => {
        LG.Audio.sfx('ui');
        LG.UI.modal('TapTap 平台', '<div>接入示例：登录与激励视频（当前为<strong>模拟模式</strong>）。' +
          '<br>上架前请填写 <span class="need">config.js → LG.CFG.TAP.clientId</span> 并引入官方 SDK。' +
          '<br><span class="desc">TapTap H5 渠道禁止内购，游戏不含支付功能。</span></div>', [
          { label: '🔑 登录 TapTap', cb: () => LG.UI.taptapLogin() },
          { label: '🎬 看广告领物资', cb: () => LG.UI.taptapAd() },
          { label: '返回', cb: () => {} },
        ]);
      });
      btns.appendChild(btnTap);

      const style = document.createElement('style');
      style.id = 'menu-style';
      style.textContent = `
        #menu-screen{position:absolute;inset:0;z-index:5;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;pointer-events:none;}
        #menu-screen>*{pointer-events:auto;}
        .menu-title{font-size:44px;letter-spacing:14px;color:#e6e2d4;text-shadow:0 0 30px rgba(210,190,150,.35),0 2px 4px #000;font-weight:300;}
        .menu-sub{font-size:15px;letter-spacing:10px;color:#9aa8a2;margin-top:10px;}
        .menu-line{width:160px;height:1px;background:linear-gradient(90deg,transparent,rgba(200,190,160,.5),transparent);margin:22px 0;}
        .menu-radio{font-size:12px;color:#7d8d88;max-width:70%;min-height:34px;line-height:1.7;padding:6px 14px;background:rgba(10,14,16,.5);border-radius:16px;border:1px solid rgba(160,180,175,.12);}
        .menu-btns{display:flex;flex-direction:column;gap:12px;margin-top:28px;width:220px;}
        .menu-btn{padding:13px;border-radius:22px;border:1px solid rgba(180,200,190,.25);background:rgba(24,32,36,.75);color:#d8e0dd;font-size:15px;letter-spacing:3px;cursor:pointer;}
        .menu-btn.primary{border-color:rgba(232,178,106,.5);background:rgba(90,70,40,.45);color:#e8d9b8;}
        .menu-btn.tap{font-size:12px;letter-spacing:1px;color:#9fb0ab;}
        .menu-btn:active{transform:scale(.97);}
        .menu-foot{position:absolute;bottom:calc(16px + env(safe-area-inset-bottom));font-size:10px;color:#4d5a56;letter-spacing:2px;}
      `;
      document.head.appendChild(style);
    },

    exit() {
      if (this.el) { this.el.remove(); this.el = null; }
      const st = document.getElementById('menu-style');
      if (st) st.remove();
    },

    showIntro(cb) {
      LG.UI.modal(
        '孤城',
        '<div style="line-height:2.2;">风把广告牌吹得哗哗响，像谁在远处鼓掌。<br><br>' +
        '你醒来时，站在一栋带院子的房子前。栅栏还立着，门板上挂着一块木板，字迹被雨水泡得模糊——但你认得出那两个字：<strong>孤城</strong>。<br><br>' +
        '<span style="color:#8fa09b;">院外的丧尸在晨雾里缓缓走动。它们没有看你。<br>它们只是走着，像还在等什么人下班回家。</span><br><br>' +
        '你摸摸自己的胸口。那里的皮肤是凉的，心跳比常人慢半拍。<br>你是<strong>半感染者</strong>。<br><br>' +
        '<span style="color:#c79aee;">—— 活下去。种点什么。养点什么。别让自己，也变成一具空壳。</span></div>',
        [{ label: '推开栅栏门', cls: 'primary', cb: cb }]
      );
    },

    update(dt) {
      this.t += dt;
      this.radioTimer -= dt;
      if (this.radioTimer <= 0) {
        this.radioTimer = LG.Utils.rand(7, 12);
        this.radioIdx = (this.radioIdx + 1) % LG.CFG.RADIO.length;
        this.radioLine = LG.CFG.RADIO[this.radioIdx];
        const r = document.getElementById('menu-radio');
        if (r) { r.textContent = '📻 ' + this.radioLine; }
        LG.Audio.sfx('radio');
      }
      LG.Audio.updateAmbient(dt);
    },

    render(ctx, w, h) {
      // 天空
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#131820');
      g.addColorStop(0.6, '#1c2026');
      g.addColorStop(1, '#232018');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // 远处天际线剪影
      ctx.fillStyle = 'rgba(10,12,14,0.85)';
      const baseY = h * 0.72;
      let bx = 0;
      while (bx < w) {
        const bw = 30 + ((bx * 7919) % 50);
        const bh = 40 + ((bx * 104729) % 90);
        ctx.fillRect(bx, baseY - bh, bw, bh + h);
        bx += bw + 6;
      }
      // 远处一尊静止的丧尸剪影
      ctx.fillStyle = 'rgba(8,10,12,0.9)';
      const zx = w * 0.5 + Math.sin(this.t * 0.1) * 30, zy = baseY - 14;
      ctx.beginPath();
      ctx.arc(zx, zy, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(zx - 9, zy - 4, 18, 10);
      // 尘埃
      for (const d of this.dust) {
        d.y -= d.v * 0.4;
        if (d.y < -0.05) { d.y = 1.05; d.x = Math.random(); }
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = '#c8c0a8';
        ctx.fillRect(d.x * w, d.y * h, d.s, d.s);
      }
      ctx.globalAlpha = 1;

      // 顶部微光与暗角
      const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.85);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);
    },
  };

  LG.Scenes = LG.Scenes || {};
  LG.Scenes.menu = Menu;
})();
