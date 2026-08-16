/* =========================================================
 * 末世孤城 · 半感染者 —— TapTap SDK 适配层
 *
 * 说明：
 *  - 本文件封装了游戏内对 TapTap 的全部调用，游戏代码不直接接触官方 SDK。
 *  - 开发环境（useRealSdk=false）下自动使用模拟实现，游戏可完整跑通。
 *  - 上架前：把 config.js 里 LG.CFG.TAP.clientId 改为真实 Client ID，
 *    在 index.html 引入官方 H5 SDK 脚本，并把 useRealSdk 置为 true。
 *    详见 docs/taptap-sdk.md。
 * ========================================================= */
(function () {
  'use strict';
  const LG = window.LG = window.LG || {};

  const TapSDK = {
    available: false,      // 官方 SDK 是否就绪
    mock: true,            // 是否处于模拟模式
    user: null,            // 登录用户 {name, avatar, openid}
    initialized: false,

    init() {
      const cfg = LG.CFG.TAP;
      if (!cfg || !cfg.enabled) return;
      if (this.initialized) return;
      this.initialized = true;

      // 尝试发现官方 SDK（引入后通常挂载为 window.TapSDK 或 window.tapsdk）
      const real = window.TapSDK || window.tapsdk || window.Tap;
      if (cfg.useRealSdk && real && typeof real.init === 'function') {
        this.mock = false;
        try {
          real.init({ client_id: cfg.clientId });
          this.available = true;
          // 登录态恢复
          if (real.getAccessToken && real.getAccessToken()) {
            this.user = { name: 'TapTap 玩家', openid: 'taptap', fromSdk: true };
          }
          console.log('[TapSDK] 已连接官方 SDK');
        } catch (e) {
          console.warn('[TapSDK] 官方 SDK 初始化失败，回退模拟：', e);
          this.mock = true;
        }
      } else {
        this.mock = true;
        console.log('[TapSDK] 模拟模式（未接入官方 SDK）');
      }
    },

    isMock() { return this.mock; },

    /* 登录 */
    login() {
      return new Promise((resolve) => {
        if (this.mock) {
          // 模拟登录弹窗
          const name = '幸存者' + Math.floor(Math.random() * 900 + 100);
          this.user = { name, avatar: '', openid: 'mock_' + Date.now() };
          resolve({ ok: true, user: this.user, mock: true });
          return;
        }
        const real = window.TapSDK || window.tapsdk || window.Tap;
        if (real && real.login) {
          real.login().then((r) => {
            this.user = { name: r && r.name ? r.name : 'TapTap 玩家', openid: r && r.openid ? r.openid : '', fromSdk: true };
            resolve({ ok: true, user: this.user });
          }).catch((e) => resolve({ ok: false, error: e }));
        } else {
          resolve({ ok: false, error: 'SDK 未就绪' });
        }
      });
    },

    logout() {
      this.user = null;
      if (!this.mock) {
        const real = window.TapSDK || window.tapsdk || window.Tap;
        if (real && real.logout) { try { real.logout(); } catch (e) { /* noop */ } }
      }
    },

    getUserInfo() { return this.user; },

    /* 支付（内购）。
     * 注意：TapTap H5 渠道禁止内购，本游戏未接入任何支付功能。
     * 此方法仅作适配层示例保留，不用于游戏内。 */
    pay(productId) {
      return new Promise((resolve) => {
        if (!this.user) { resolve({ ok: false, error: '未登录' }); return; }
        if (this.mock) {
          setTimeout(() => resolve({ ok: true, orderId: 'mock_' + Date.now(), amount: 0 }), 600);
          return;
        }
        const real = window.TapSDK || window.tapsdk || window.Tap;
        if (real && real.pay) {
          real.pay({ productId }).then((r) => resolve({ ok: true, orderId: r.orderId }))
            .catch((e) => resolve({ ok: false, error: e }));
        } else {
          resolve({ ok: false, error: 'SDK 未就绪' });
        }
      });
    },

    /* 激励视频广告（观看后给奖励）。返回 Promise<{ok, rewarded}> */
    showRewardedVideo() {
      return new Promise((resolve) => {
        if (this.mock) {
          setTimeout(() => resolve({ ok: true, rewarded: true, mock: true }), 1200);
          return;
        }
        const real = window.TapSDK || window.tapsdk || window.Tap;
        if (real && real.showRewardedVideo) {
          real.showRewardedVideo({
            onReward: () => resolve({ ok: true, rewarded: true }),
            onError: (e) => resolve({ ok: false, error: e }),
          });
        } else {
          resolve({ ok: false, error: 'SDK 未就绪' });
        }
      });
    },

    /* 分享 */
    share(title, text) {
      if (this.mock) return;
      const real = window.TapSDK || window.tapsdk || window.Tap;
      if (real && real.share) {
        try { real.share({ title: title || '末世孤城', text: text || '', imageUrl: '' }); } catch (e) { /* noop */ }
      }
    },

    /* 事件埋点 */
    trackEvent(name, props) {
      if (this.mock) return;
      const real = window.TapSDK || window.tapsdk || window.Tap;
      if (real && real.trackEvent) {
        try { real.trackEvent({ eventName: name, properties: props || {} }); } catch (e) { /* noop */ }
      }
    },
  };

  LG.TapSDK = TapSDK;
})();
