/* =========================================================
 * 末世孤城 · 半感染者 —— 输入系统
 * 键盘(WASD/方向键) + 鼠标 + 虚拟摇杆 + 触屏按钮
 * ========================================================= */
(function () {
  'use strict';
  const LG = window.LG = window.LG || {};

  const Input = {
    keys: {},
    moveVec: { x: 0, y: 0 },       // 归一化移动向量
    joystick: { active: false, cx: 0, cy: 0, dx: 0, dy: 0, lastTap: 0 },
    taps: [],                       // 屏幕点击队列 {sx, sy}
    pendingAttack: false,
    pendingInteract: false,
    pendingSkill: false,
    pendingDash: false,
    isTouch: false,

    init() {
      this.isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

      window.addEventListener('keydown', (e) => {
        this.keys[e.code] = true;
        if (e.code === 'Escape' || e.code === 'KeyP') { LG.UI.toggleSettings(); }
        if (e.code === 'KeyE' || e.code === 'Space') this.pendingInteract = true;
        if (e.code === 'KeyQ') this.pendingSkill = true;
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.pendingDash = true;
        if (e.code === 'KeyI') LG.UI.toggleBag();
        if (e.code === 'KeyJ') LG.UI.toggleDiary();
        if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].indexOf(e.code) >= 0) e.preventDefault();
      });
      window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });

      // 摇杆
      const zone = document.getElementById('joystick-zone');
      const knob = document.getElementById('joystick-knob');
      const setStick = (sx, sy) => {
        const r = zone.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        let dx = sx - cx, dy = sy - cy;
        const len = Math.sqrt(dx * dx + dy * dy);
        const maxR = r.width / 2 - 8;
        if (len > maxR) { dx = dx / len * maxR; dy = dy / len * maxR; }
        this.joystick.cx = cx; this.joystick.cy = cy;
        this.joystick.dx = dx; this.joystick.dy = dy;
        this.joystick.active = true;
        knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      };
      const clearStick = () => {
        this.joystick.active = false;
        this.joystick.dx = 0; this.joystick.dy = 0;
        knob.style.transform = 'translate(0px,0px)';
      };
      const onTouchStart = (e) => {
        if (!this.isTouch) return;
        e.preventDefault();
        const t = e.changedTouches[0];
        const now = Date.now();
        if (now - this.joystick.lastTap < 320) { this.pendingDash = true; this.joystick.lastTap = 0; }
        else this.joystick.lastTap = now;
        setStick(t.clientX, t.clientY);
      };
      const onTouchMove = (e) => {
        if (!this.isTouch) return;
        e.preventDefault();
        const t = e.changedTouches[0];
        setStick(t.clientX, t.clientY);
      };
      const onTouchEnd = (e) => {
        if (!this.isTouch) return;
        e.preventDefault();
        clearStick();
      };
      zone.addEventListener('touchstart', onTouchStart, { passive: false });
      zone.addEventListener('touchmove', onTouchMove, { passive: false });
      zone.addEventListener('touchend', onTouchEnd, { passive: false });
      zone.addEventListener('touchcancel', onTouchEnd, { passive: false });

      // 攻击 / 交互 / 技能 按钮
      const btnAtk = document.getElementById('btn-atk');
      const btnInt = document.getElementById('btn-interact');
      const btnSkill = document.getElementById('btn-skill');
      const press = (btn, flag) => {
        btn.addEventListener('touchstart', (e) => { e.preventDefault(); Input[flag] = true; }, { passive: false });
        btn.addEventListener('mousedown', (e) => { e.preventDefault(); Input[flag] = true; });
        btn.addEventListener('touchend', (e) => { e.preventDefault(); Input[flag] = false; }, { passive: false });
        btn.addEventListener('mouseup', () => { Input[flag] = false; });
      };
      press(btnAtk, 'pendingAttack');
      press(btnInt, 'pendingInteract');
      press(btnSkill, 'pendingSkill');
      btnAtk.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
      btnInt.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
      btnSkill.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });

      // 画布点击/触摸 → 世界交互
      const canvas = document.getElementById('game');
      const pushTap = (sx, sy) => { this.taps.push({ sx, sy }); };
      canvas.addEventListener('mousedown', (e) => {
        if (this.isTouch) return;
        pushTap(e.clientX, e.clientY);
        if (e.button === 2) this.pendingAttack = true;
      });
      canvas.addEventListener('touchstart', (e) => {
        if (!this.isTouch) return;
        // 只在右半边（非摇杆区）的触摸视为点击
        const t = e.changedTouches[0];
        if (t.clientX > window.innerWidth * 0.5) {
          pushTap(t.clientX, t.clientY);
        }
        e.preventDefault();
      }, { passive: false });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    },

    /* 计算移动向量（键盘 + 摇杆） */
    computeMove() {
      let x = 0, y = 0;
      if (this.keys['KeyW'] || this.keys['ArrowUp']) y -= 1;
      if (this.keys['KeyS'] || this.keys['ArrowDown']) y += 1;
      if (this.keys['KeyA'] || this.keys['ArrowLeft']) x -= 1;
      if (this.keys['KeyD'] || this.keys['ArrowRight']) x += 1;
      if (this.joystick.active) {
        const len = Math.sqrt(this.joystick.dx * this.joystick.dx + this.joystick.dy * this.joystick.dy);
        if (len > 8) { x = this.joystick.dx / 52; y = this.joystick.dy / 52; }
      }
      const len = Math.sqrt(x * x + y * y);
      if (len > 1) { x /= len; y /= len; }
      this.moveVec.x = x; this.moveVec.y = y;
      return this.moveVec;
    },

    takeTaps() {
      if (this.taps.length === 0) return null;
      return this.taps.splice(0, this.taps.length);
    },

    takeAttack() {
      const v = this.pendingAttack;
      this.pendingAttack = false;
      return v;
    },
    takeInteract() {
      const v = this.pendingInteract;
      this.pendingInteract = false;
      return v;
    },
    takeSkill() {
      const v = this.pendingSkill;
      this.pendingSkill = false;
      return v;
    },
    takeDash() {
      const v = this.pendingDash;
      this.pendingDash = false;
      return v;
    },
  };

  LG.Input = Input;
})();
