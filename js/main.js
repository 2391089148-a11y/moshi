/* =========================================================
 * 末世孤城 · 半感染者 —— 主入口：启动、场景管理、游戏循环
 * ========================================================= */
(function () {
  'use strict';
  const LG = window.LG = window.LG || {};

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, DPR = 1;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  /* ---------- 场景管理 ---------- */
  const Scenes = {
    current: null,
    go(name, param) {
      const next = LG.Scenes[name];
      if (!next) { console.error('未知场景:', name); return; }
      if (this.current && this.current.exit) {
        try { this.current.exit(); } catch (e) { console.error(e); }
      }
      this.current = next;
      if (next.enter) next.enter(param);
    },
    showEnding(type) {
      document.getElementById('hud').classList.add('hidden');
      document.getElementById('controls').classList.add('hidden');
      LG.UI.closeModal();
      LG.UI.showEnding(type);
      LG.TapSDK.share('末世孤城', '我在末世里活到了第 ' + (LG.State.s ? LG.State.s.day : '?') + ' 天。');
    },
  };
  LG.Scenes.go = Scenes.go.bind(Scenes);
  LG.Scenes.showEnding = Scenes.showEnding.bind(Scenes);
  // 暴露当前场景（供调试/扩展读取）
  Object.defineProperty(LG.Scenes, 'current', {
    configurable: true,
    get() { return Scenes.current; },
  });

  /* ---------- 主循环 ---------- */
  let lastT = 0;
  function loop(now) {
    const dt = Math.min((now - lastT) / 1000, 0.05);
    lastT = now;
    if (Scenes.current && Scenes.current.update) {
      try { Scenes.current.update(dt); } catch (e) { console.error(e); }
    }
    ctx.clearRect(0, 0, W, H);
    if (Scenes.current && Scenes.current.render) {
      try { Scenes.current.render(ctx, W, H); } catch (e) { console.error(e); }
    }
    requestAnimationFrame(loop);
  }

  /* ---------- 启动 ---------- */
  function boot() {
    resize();
    window.addEventListener('resize', resize);

    LG.UI.init();
    LG.Input.init();
    LG.TapSDK.init();

    // 首次用户手势后启动音频
    const audioStart = () => {
      LG.Audio.init();
      window.removeEventListener('pointerdown', audioStart);
      window.removeEventListener('keydown', audioStart);
    };
    window.addEventListener('pointerdown', audioStart);
    window.addEventListener('keydown', audioStart);

    // 横屏引导：竖屏时提示旋转；"仍要竖屏"按钮可临时关闭
    const dismiss = document.getElementById('rotate-dismiss');
    if (dismiss) dismiss.addEventListener('click', () => {
      document.getElementById('rotate-overlay').style.display = 'none';
    });
    // 尽力锁定横屏（仅全屏/受支持环境生效，失败静默）
    const tryLockLandscape = () => {
      try {
        if (screen.orientation && screen.orientation.lock) {
          screen.orientation.lock('landscape').catch(() => {});
        }
      } catch (e) { /* 静默 */ }
    };
    window.addEventListener('pointerdown', tryLockLandscape, { once: true });

    // 切后台自动保存
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && LG.State.s) LG.State.autosave();
    });

    // 加载页 → 菜单
    setTimeout(() => {
      const loading = document.getElementById('loading');
      if (loading) loading.classList.add('hidden');
      LG.State.loadGame(); // 有存档则载入（菜单里可继续）
      Scenes.go('menu');
    }, 900);

    lastT = performance.now();
    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
