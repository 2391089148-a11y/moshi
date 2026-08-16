/* =========================================================
 * 末世孤城 · 半感染者 —— 基地场景（孤城的院子）
 * 农田 / 畜栏 / 合成台 / 医疗站 / 储物箱 / 篝火 / 大门 / 收音机 / 猫
 * ========================================================= */
(function () {
  'use strict';
  const LG = window.LG = window.LG || {};

  const Base = {
    name: 'base',
    T: 34,
    camX: 0, camY: 0,
    player: null,
    particles: null,
    solids: [],
    plots: [],
    cat: null,
    yardZombies: [],   // 驯养丧尸（装饰性漫游）
    bigZombies: [],    // 异能大丧尸（装饰性漫游）
    walkTarget: null,
    nearestHint: null,
    fireFlicker: 0,
    leaves: [],
    rainDrops: [],
    hintPulse: 0,
    t: 0,

    /* ---------- 生命周期 ---------- */
    enter() {
      LG.State.scene = 'base';
      const s = LG.State.s;
      if (!s) return;
      document.getElementById('hud').classList.remove('hidden');
      document.getElementById('controls').classList.remove('hidden');
      // 基地没有敌人：隐藏攻击/技能按钮（进入搜索时再显示）
      document.getElementById('btn-atk').style.display = 'none';
      document.getElementById('btn-skill').style.display = 'none';

      this.t = 0;
      this.particles = new LG.Entities.Particles();
      this.player = new LG.Entities.Player(
        LG.CFG.BASE_LAYOUT.playerSpawn.x * this.T,
        LG.CFG.BASE_LAYOUT.playerSpawn.y * this.T
      );
      this.player.dir = Math.PI / 2; // 面朝下（屏幕）

      this.buildWorld();
      this.buildYardCreatures();

      this.cat = {
        x: LG.CFG.BASE_LAYOUT.catSpawn.x * this.T,
        y: LG.CFG.BASE_LAYOUT.catSpawn.y * this.T,
        state: 'idle', target: null, timer: 0, dir: 0, bob: 0,
      };

      this.walkTarget = null;
      this.inGate = false;          // 大门自动触发状态
      this.movingFurniture = null;  // 正在摆放的家具
      this.leaves = [];
      this.rainDrops = [];
      for (let i = 0; i < 30; i++) {
        this.leaves.push({ x: Math.random(), y: Math.random(), s: Math.random() * 3 + 2, v: Math.random() * 40 + 20, ph: Math.random() * 6 });
      }
      LG.Audio.setWeather(s.weather);

      // 首日提示
      if (!s.flags.introSeen) {
        s.flags.introSeen = true;
        LG.State.autosave();
        setTimeout(() => LG.UI.toast('这是你的院子。风声很大，但这里是安全的。', ''), 1200);
        setTimeout(() => LG.UI.toast('点击 ✋ 按钮或靠近设施进行互动', '', 4000), 4200);
        setTimeout(() => LG.UI.toast('去农田种点什么，或者从大门出发去搜索物资', '', 4000), 8000);
      }
      LG.UI.updateHUD();
    },

    exit() {
      LG.State.autosave();
    },

    /* ---------- 世界构建 ---------- */
    buildWorld() {
      const L = LG.CFG.BASE_LAYOUT;
      const T = this.T;
      const mw = L.mapW * T, mh = L.mapH * T;
      this.worldW = mw; this.worldH = mh;
      this.solids = [];

      // 边界墙（南侧为大门，玩家可走进触发出发面板；墙体本身实心防止掉出地图）
      // 北墙
      this.solids.push({ x: 0, y: 0, w: mw, h: T });
      // 西墙 / 东墙
      this.solids.push({ x: 0, y: 0, w: T, h: mh });
      this.solids.push({ x: mw - T, y: 0, w: T, h: mh });
      // 南墙（实心，不留洞）
      this.solids.push({ x: 0, y: mh - T, w: mw, h: T });

      // 建筑
      const B = L.buildings;
      // 储物箱
      this.addSolidBuilding(B.storage);
      // 医疗站
      this.addSolidBuilding(B.med);
      // 合成台
      this.addSolidBuilding(B.synth);
      // 农田（不实心，内部是田垄）
      this.farmRect = this.tileRect(B.farm);
      // 畜栏（不实心，围栏视觉）
      this.penRect = this.tileRect(B.pen);
      // 篝火区
      this.fireRect = this.tileRect(B.fire);
      // 工作台（篝火旁）
      this.benchRect = this.tileRect(B.bench);
      // 遮雨棚
      this.shelterRect = this.tileRect(B.shelter);
      // 大门区
      this.gateRect = this.tileRect(B.gate);
      // 收音机
      this.radioRect = this.tileRect(B.radio);

      // 农田垄位（6 块）
      this.plots = [];
      const f = this.farmRect;
      const rows = 2, cols = 3;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const px = f.x + 26 + c * ((f.w - 52) / (cols - 1) - 14) + 14 * c;
          const py = f.y + 24 + r * ((f.h - 48) / (rows - 1) - 10) + 10 * r;
          this.plots.push({ x: px - 16, y: py - 16, w: 32, h: 32 });
        }
      }

      // 地块种子（纹理）
      this.floorSeed = Math.floor(Math.random() * 99999);
    },

    tileRect(b) {
      const T = this.T;
      return { x: b.x * T, y: b.y * T, w: b.w * T, h: b.h * T };
    },

    addSolidBuilding(b) {
      const T = this.T;
      const r = { x: b.x * T, y: b.y * T, w: b.w * T, h: b.h * T };
      // 底部中间留门
      r.door = { x: r.x + r.w / 2 - T / 2, y: r.y + r.h - 8, w: T, h: 8 };
      this.solids.push(r);
    },

    buildYardCreatures() {
      this.yardZombies = [];
      const s = LG.State.s;
      if (s.tamed) {
        for (const td of s.tamed) {
          this.yardZombies.push({
            ref: td,
            x: LG.Utils.rand(this.penRect.x + 20, this.penRect.x + this.penRect.w - 20),
            y: LG.Utils.rand(this.penRect.y + 20, this.penRect.y + this.penRect.h - 20),
            target: null, timer: LG.Utils.rand(0, 3), dir: 0,
          });
        }
      }
      this.bigZombies = [];
      if (s.bigZombies) {
        for (const bz of s.bigZombies) {
          this.bigZombies.push({
            ref: bz,
            x: LG.Utils.rand(300, this.worldW - 300),
            y: LG.Utils.rand(300, this.worldH - 200),
            target: null, timer: LG.Utils.rand(0, 4), dir: 0,
          });
        }
      }
      // 宠物
      this.yardPets = [];
      if (s.pets) {
        for (const pt of s.pets) {
          const pcfg = LG.CFG.PETS[pt.zone] || LG.CFG.PETS[Object.keys(LG.CFG.PETS).find(k => LG.CFG.PETS[k].type === pt.type)];
          if (!pcfg) continue;
          this.yardPets.push({
            ref: pt, cfg: pcfg,
            x: LG.Utils.rand(200, this.worldW - 200),
            y: LG.Utils.rand(250, this.worldH - 250),
            target: null, timer: LG.Utils.rand(0, 3), dir: 0, bob: Math.random() * 10,
          });
        }
      }
      // 家具：新收集的（x,y 为 0,0）自动摆到篝火附近
      if (s.furniture) {
        let placed = 0;
        for (const f of s.furniture) {
          if (!f.x && !f.y) {
            f.x = this.fireRect.x + this.fireRect.w + 40 + (placed % 3) * 56;
            f.y = this.fireRect.y + 20 + Math.floor(placed / 3) * 52;
            placed++;
          }
        }
      }
      // 艾巳（招募后住在院子里）
      this.yardAiShi = null;
      if (s.humans && s.humans.some(h => h.type === 'aishi')) {
        this.yardAiShi = {
          x: LG.Utils.rand(300, this.worldW - 300),
          y: LG.Utils.rand(300, this.worldH - 300),
          dir: 0, bob: Math.random() * 10, wanderT: LG.Utils.rand(1, 3), target: null,
        };
      }
      // 变异植物宠物（在农田边活动）
      this.plantPetEnts = [];
      for (const pp of s.plantPets || []) {
        this.plantPetEnts.push({
          ref: pp,
          x: pp.x || LG.Utils.rand(this.farmRect.x + 20, this.farmRect.x + this.farmRect.w - 20),
          y: pp.y || LG.Utils.rand(this.farmRect.y + this.farmRect.h + 30, this.farmRect.y + this.farmRect.h + 70),
          bob: Math.random() * 10,
        });
      }
    },

    /* ---------- 物理 ---------- */
    collideCircle(px, py, r) {
      // 与实心矩形碰撞并推出（最小穿透轴，不会把玩家瞬移出地图）
      for (const s of this.solids) {
        // 门洞跳过
        if (s.door) {
          const d = s.door;
          if (px > d.x - r && px < d.x + d.w + r && py > d.y - r && py < d.y + d.h + r) continue;
        }
        const res = LG.Utils.resolveCircleRect(px, py, r, s);
        px = res.x; py = res.y;
      }
      // 农田垄位也碰撞
      for (const p of this.plots) {
        const res = LG.Utils.resolveCircleRect(px, py, r, p);
        px = res.x; py = res.y;
      }
      // 家具也有碰撞体积（优化家具：不再被穿过）
      if (LG.State.s && LG.State.s.furniture) {
        for (const f of LG.State.s.furniture) {
          const res = LG.Utils.resolveCircleRect(px, py, r, { x: f.x - 16, y: f.y - 10, w: 32, h: 22 });
          px = res.x; py = res.y;
        }
      }
      return { x: px, y: py };
    },

    /* ---------- 更新 ---------- */
    update(dt) {
      if (LG.State.s && LG.State.s.ending) return;
      this.t += dt;
      const s = LG.State.s;
      if (!s) return;

      // 移动输入
      const vec = LG.Input.computeMove();
      const wasDash = false;
      this.player.move(dt, vec);

      // 家具摆放模式：点击放置
      if (this.movingFurniture) {
        const taps2 = LG.Input.takeTaps();
        if (taps2 && taps2.length) {
          const tap = taps2[taps2.length - 1];
          const wx = tap.sx + this.camX, wy = tap.sy + this.camY;
          this.placeFurniture(wx, wy);
        }
        if (LG.Input.takeInteract()) {
          this.movingFurniture = null;
          LG.UI.toast('家具放回原位。', '');
        }
        if (LG.Input.takeDash()) this.player.dash();
        this.nearestHint = null;
        const intBtn2 = document.getElementById('btn-interact');
        if (intBtn2) intBtn2.style.background = '';
        this.updateCamera();
        LG.UI.updateHUD();
        return;
      }

      // 点击移动目标
      const taps = LG.Input.takeTaps();
      if (taps) {
        for (const tap of taps) {
          const wx = tap.sx + this.camX, wy = tap.sy + this.camY;
          const b = this.buildingAt(wx, wy);
          if (b) { this.interactBuilding(b.id); break; }
          this.walkTarget = { x: wx, y: wy };
        }
      }

      // 走向目标
      if (this.walkTarget) {
        const d = LG.Utils.dist(this.player.x, this.player.y, this.walkTarget.x, this.walkTarget.y);
        if (d < 12) this.walkTarget = null;
        else {
          const ang = Math.atan2(this.walkTarget.y - this.player.y, this.walkTarget.x - this.player.x);
          this.player.move(dt, { x: Math.cos(ang), y: Math.sin(ang) });
        }
      }

      // 碰撞
      const pos = this.collideCircle(this.player.x, this.player.y, 9);
      this.player.x = pos.x; this.player.y = pos.y;

      // 技能 / 交互 / 冲刺
      if (LG.Input.takeSkill()) {
        this.player.claw([]);
      }
      if (LG.Input.takeAttack()) {
        // 基地没有敌人：免费挥一下空气，不消耗体力
        if (this.player.attackCd <= 0) {
          this.player.attackCd = this.player.weapon().atkSpeed;
          this.player.attackTimer = 0.22;
          LG.Audio.sfx('swing');
        }
      }
      if (LG.Input.takeDash()) this.player.dash();
      if (LG.Input.takeInteract()) {
        const h = this.findHint();
        if (h) this.interactBuilding(h.id, h);
      }

      // 最近交互目标
      this.nearestHint = this.findHint();
      const intBtn = document.getElementById('btn-interact');
      if (intBtn) {
        intBtn.style.background = this.nearestHint ? 'rgba(90,70,40,.7)' : '';
        intBtn.style.borderColor = this.nearestHint ? 'rgba(232,178,106,.6)' : '';
      }

      // 走进大门 → 自动弹出出发面板（边缘触发，避免每帧弹窗）
      const inGate = this.player.x > this.gateRect.x + 8 &&
                     this.player.x < this.gateRect.x + this.gateRect.w - 8 &&
                     this.player.y > this.gateRect.y + 8 &&
                     this.player.y < this.gateRect.y + this.gateRect.h - this.T - 8;
      if (inGate && !this.inGate && !LG.UI.modalOpen) {
        this.inGate = true;
        this.gatePanel();
      }
      if (!inGate) this.inGate = false;

      // 猫
      this.updateCat(dt);
      // 驯养丧尸漫游（限制在畜栏内，不会走出围栏；也不会穿墙/穿家具）
      for (const z of this.yardZombies) {
        this.wanderEntity(z, 24, dt, this.penRect);
        const zp = this.collideCircle(z.x, z.y, 10);
        z.x = zp.x; z.y = zp.y;
      }
      // 异能大丧尸漫游（不穿墙）
      for (const z of this.bigZombies) {
        this.wanderEntity(z, 18, dt);
        const zp = this.collideCircle(z.x, z.y, 12);
        z.x = zp.x; z.y = zp.y;
      }
      // 天气与逗猫棒对动物的影响
      const raining = s.weather === 'rain';
      const shelterBounds = { x: this.shelterRect.x - 40, y: this.shelterRect.y - 40, w: this.shelterRect.w + 80, h: this.shelterRect.h + 80 };
      const toyEquipped = LG.State.equippedItem('toy') === 'catToy';
      // 宠物漫游（下雨天更倾向于躲在遮雨棚下；逗猫棒会引诱它们跟着你）
      for (const pt of this.yardPets) {
        pt.bob = (pt.bob || 0) + dt;
        if (toyEquipped) {
          pt.target = { x: this.player.x + LG.Utils.rand(-50, 50), y: this.player.y + LG.Utils.rand(-30, 30) };
          pt.timer = 1;
        } else if (raining) {
          // 下雨天：固定一个棚下的"蹲点"，走到就安静待着（修复抽搐转圈）
          if (!pt.shelterSpot) {
            pt.shelterSpot = {
              x: LG.Utils.rand(shelterBounds.x + 14, shelterBounds.x + shelterBounds.w - 14),
              y: LG.Utils.rand(shelterBounds.y + 14, shelterBounds.y + shelterBounds.h - 14),
            };
          }
          const sd = LG.Utils.dist(pt.x, pt.y, pt.shelterSpot.x, pt.shelterSpot.y);
          if (sd > 16) {
            pt.target = pt.shelterSpot;
            pt.timer = 1;
          } else {
            pt.target = null;   // 已就位，安静待着
            pt.wanderT = 99;
          }
        } else {
          // 天晴了，解除蹲点，恢复正常漫游
          if (pt.shelterSpot) {
            pt.shelterSpot = null;
            pt.wanderT = LG.Utils.rand(1, 3);
          }
        }
        this.wanderEntity(pt, toyEquipped ? 46 : (raining ? 22 : 26), dt);
        // 仅当宠物还在棚区范围外时才钳制（避免在边界抖动）
        if (raining && !toyEquipped) {
          pt.x = LG.Utils.clamp(pt.x, shelterBounds.x + 2, shelterBounds.x + shelterBounds.w - 2);
          pt.y = LG.Utils.clamp(pt.y, shelterBounds.y + 2, shelterBounds.y + shelterBounds.h - 2);
        }
        const pp = this.collideCircle(pt.x, pt.y, 8);
        pt.x = pp.x; pt.y = pp.y;
      }
      // 艾巳漫游
      if (this.yardAiShi) {
        this.yardAiShi.bob += dt;
        this.wanderEntity(this.yardAiShi, 30, dt);
        const ap = this.collideCircle(this.yardAiShi.x, this.yardAiShi.y, 8);
        this.yardAiShi.x = ap.x; this.yardAiShi.y = ap.y;
      }
      // 变异植物宠物（轻轻摇晃，不移动）
      for (const pp of this.plantPetEnts) pp.bob += dt;
      // 猫也躲着墙走
      {
        const cp = this.collideCircle(this.cat.x, this.cat.y, 8);
        this.cat.x = cp.x; this.cat.y = cp.y;
      }

      // 粒子
      this.particles.update(dt);
      // 落叶 / 雨
      for (const l of this.leaves) {
        l.y -= l.v * dt / this.worldH;
        l.x += Math.sin(this.t + l.ph) * 0.3 * dt;
        if (l.y < -0.02) { l.y = 1.02; l.x = Math.random(); }
      }
      if (s.weather === 'rain') {
        const n = 60;
        while (this.rainDrops.length < n) this.rainDrops.push({ x: Math.random(), y: Math.random(), l: Math.random() * 14 + 8 });
        for (const r of this.rainDrops) {
          r.y += dt * 0.55;
          r.x -= dt * 0.08;
          if (r.y > 1.02) { r.y = -0.02; r.x = Math.random(); }
        }
      } else {
        this.rainDrops = [];
      }

      // 篝火粒子
      if (Math.random() < dt * 8) {
        const fx = this.fireRect.x + this.fireRect.w / 2, fy = this.fireRect.y + this.fireRect.h / 2 + 10;
        this.particles.spawn(fx + LG.Utils.rand(-8, 8), fy, {
          n: 1, color: LG.Utils.choice(['#e8833a', '#d96a3a', '#c9a83a']), life: 0.8, grav: -60, size: 2.2,
        });
      }

      // 相机
      this.updateCamera();
      LG.UI.updateHUD();
      LG.Audio.updateAmbient(dt);
    },

    updateCamera() {
      const w = window.innerWidth, h = window.innerHeight;
      this.camX = LG.Utils.clamp(this.player.x - w / 2, 0, Math.max(0, this.worldW - w));
      this.camY = LG.Utils.clamp(this.player.y - h / 2, 0, Math.max(0, this.worldH - h));
    },

    wanderEntity(e, speed, dt, bounds) {
      e.timer -= dt;
      if (!e.target) {
        if (e.timer <= 0) {
          e.timer = LG.Utils.rand(3, 7);
          if (LG.Utils.chance(0.7)) {
            if (bounds) {
              // 限制在指定区域内活动（驯养丧尸不许走出畜栏）
              e.target = {
                x: LG.Utils.rand(bounds.x + 12, bounds.x + bounds.w - 12),
                y: LG.Utils.rand(bounds.y + 12, bounds.y + bounds.h - 12),
              };
            } else {
              e.target = {
                x: LG.Utils.rand(80, this.worldW - 80),
                y: LG.Utils.rand(120, this.worldH - 120),
              };
            }
          }
        }
        return;
      }
      const d = LG.Utils.dist(e.x, e.y, e.target.x, e.target.y);
      if (d < 10) { e.target = null; e.timer = LG.Utils.rand(2, 5); return; }
      const ang = Math.atan2(e.target.y - e.y, e.target.x - e.x);
      e.dir = ang;
      e.x += Math.cos(ang) * speed * dt;
      e.y += Math.sin(ang) * speed * dt;
      // 硬限制在区域内
      if (bounds) {
        e.x = LG.Utils.clamp(e.x, bounds.x + 10, bounds.x + bounds.w - 10);
        e.y = LG.Utils.clamp(e.y, bounds.y + 10, bounds.y + bounds.h - 10);
      }
    },

    updateCat(dt) {
      const c = this.cat;
      const s = LG.State.s;
      c.bob += dt;
      c.timer -= dt;
      const raining = s.weather === 'rain';
      const toyEquipped = LG.State.equippedItem('toy') === 'catToy';
      // 逗猫棒：老橘也逃不掉
      if (toyEquipped) {
        c.target = { x: this.player.x + 30, y: this.player.y + 8 };
        c.state = 'walk';
        c.timer = 1;
      } else if (raining && LG.Utils.chance(dt * 0.5)) {
        // 下雨天：往遮雨棚下躲
        c.target = {
          x: LG.Utils.rand(this.shelterRect.x - 20, this.shelterRect.x + this.shelterRect.w + 20),
          y: LG.Utils.rand(this.shelterRect.y - 20, this.shelterRect.y + this.shelterRect.h + 20),
        };
        c.state = 'walk';
        c.timer = 2;
      }
      if (c.state === 'walk') {
        const d = LG.Utils.dist(c.x, c.y, c.target.x, c.target.y);
        if (d < 8 || c.timer <= 0) {
          c.state = LG.Utils.chance(0.4) ? 'sit' : 'idle';
          c.timer = LG.Utils.rand(2, 6);
          c.target = null;
        } else {
          const ang = Math.atan2(c.target.y - c.y, c.target.x - c.x);
          c.dir = ang;
          c.x += Math.cos(ang) * 46 * dt;
          c.y += Math.sin(ang) * 46 * dt;
        }
      } else if (c.state === 'idle' && c.timer <= 0) {
        c.state = 'walk';
        c.timer = 4;
        c.target = raining
          ? { x: LG.Utils.rand(this.shelterRect.x - 20, this.shelterRect.x + this.shelterRect.w + 20), y: LG.Utils.rand(this.shelterRect.y - 20, this.shelterRect.y + this.shelterRect.h + 20) }
          : { x: LG.Utils.rand(120, this.worldW - 120), y: LG.Utils.rand(150, this.worldH - 150) };
      } else if (c.state === 'sit' && c.timer <= 0) {
        c.state = 'walk';
        c.timer = 4;
        c.target = { x: LG.Utils.rand(120, this.worldW - 120), y: LG.Utils.rand(150, this.worldH - 150) };
      }
      // 玩家靠近，猫会看向你
      const dp = LG.Utils.dist(c.x, c.y, this.player.x, this.player.y);
      if (dp < 160) {
        const ang = Math.atan2(this.player.y - c.y, this.player.x - c.x);
        c.dir = LG.Utils.lerp(c.dir, ang, 0.1);
      }
    },

    /* ---------- 交互 ---------- */
    buildingAt(wx, wy) {
      const B = LG.CFG.BASE_LAYOUT.buildings;
      for (const id in B) {
        const r = this.tileRect(B[id]);
        if (wx >= r.x && wx <= r.x + r.w && wy >= r.y && wy <= r.y + r.h) return { id, r };
      }
      return null;
    },

    findHint() {
      const p = this.player;
      const B = LG.CFG.BASE_LAYOUT.buildings;
      let best = null, bestD = 80;
      const points = {
        farm: { x: this.farmRect.x + this.farmRect.w / 2, y: this.farmRect.y + this.farmRect.h + 26 },
        pen: { x: this.penRect.x + this.penRect.w / 2, y: this.penRect.y + this.penRect.h + 26 },
        synth: { x: this.synthDoorPoint().x, y: this.synthDoorPoint().y + 16 },
        med: { x: this.medDoorPoint().x, y: this.medDoorPoint().y + 16 },
        storage: { x: this.storageDoorPoint().x, y: this.storageDoorPoint().y + 16 },
        fire: { x: this.fireRect.x + this.fireRect.w / 2, y: this.fireRect.y + this.fireRect.h / 2 },
        bench: { x: this.benchRect.x + this.benchRect.w / 2, y: this.benchRect.y + this.benchRect.h / 2 },
        shelter: { x: this.shelterRect.x + this.shelterRect.w / 2, y: this.shelterRect.y + this.shelterRect.h / 2 },
        gate: { x: this.gateRect.x + this.gateRect.w / 2, y: this.gateRect.y + 10 },
        radio: { x: this.radioRect.x + this.radioRect.w / 2, y: this.radioRect.y + this.radioRect.h / 2 },
      };
      // 猫也是可交互的
      const cd = LG.Utils.dist(p.x, p.y, this.cat.x, this.cat.y);
      if (cd < bestD) {
        bestD = cd;
        best = { id: 'cat', x: this.cat.x, y: this.cat.y - 20, icon: '🐈', name: '老橘' };
      }
      // 家具（移动）
      for (const f of LG.State.s.furniture) {
        const fd = LG.Utils.dist(p.x, p.y, f.x, f.y);
        if (fd < bestD) {
          bestD = fd;
          best = { id: 'furn', obj: f, x: f.x, y: f.y - 24, icon: '🪑', name: '移动家具' };
        }
      }
      // 宠物
      for (const pt of this.yardPets) {
        const pcfg = pt.cfg;
        if (!pcfg) continue;
        const pd = LG.Utils.dist(p.x, p.y, pt.x, pt.y);
        if (pd < bestD) {
          bestD = pd;
          best = { id: 'pet', obj: pt, x: pt.x, y: pt.y - 20, icon: pcfg.icon, name: pcfg.name };
        }
      }
      // 艾巳
      if (this.yardAiShi) {
        const ad = LG.Utils.dist(p.x, p.y, this.yardAiShi.x, this.yardAiShi.y);
        if (ad < bestD) {
          bestD = ad;
          best = { id: 'aishi', obj: this.yardAiShi, x: this.yardAiShi.x, y: this.yardAiShi.y - 20, icon: '👩', name: '艾巳' };
        }
      }
      // 变异植物宠物
      for (const pp of this.plantPetEnts) {
        const pcfg = LG.CFG.PLANT_PETS[pp.ref.crop];
        if (!pcfg) continue;
        const pd = LG.Utils.dist(p.x, p.y, pp.x, pp.y);
        if (pd < bestD) {
          bestD = pd;
          best = { id: 'plantpet', obj: pp, x: pp.x, y: pp.y - 18, icon: pcfg.icon, name: pcfg.name };
        }
      }
      for (const id in points) {
        const pt = points[id];
        const d = LG.Utils.dist(p.x, p.y, pt.x, pt.y);
        if (d < bestD) {
          bestD = d;
          best = { id, x: pt.x, y: pt.y, icon: B[id].icon, name: B[id].name };
        }
      }
      return best;
    },

    doorPoint(b) {
      const T = this.T;
      return { x: b.x * T + b.w * T / 2, y: b.y * T + b.h * T };
    },
    synthDoorPoint() { return this.doorPoint(LG.CFG.BASE_LAYOUT.buildings.synth); },
    medDoorPoint() { return this.doorPoint(LG.CFG.BASE_LAYOUT.buildings.med); },
    storageDoorPoint() { return this.doorPoint(LG.CFG.BASE_LAYOUT.buildings.storage); },

    interactBuilding(id, hint) {
      const s = LG.State.s;
      LG.Audio.sfx('ui');
      switch (id) {
        case 'farm': this.farmPanel(); break;
        case 'pen': this.penPanel(); break;
        case 'synth': this.synthPanel(); break;
        case 'med': this.medPanel(); break;
        case 'storage': this.storagePanel(); break;
        case 'fire': this.firePanel(); break;
        case 'bench': this.benchPanel(); break;
        case 'shelter': this.shelterPanel(); break;
        case 'gate': this.gatePanel(); break;
        case 'radio': this.radioPanel(); break;
        case 'cat': this.catPanel(); break;
        case 'furn': this.furniturePanel(hint && hint.obj); break;
        case 'pet': this.petPanel(hint && hint.obj); break;
        case 'aishi': this.aiShiPanel(); break;
        case 'plantpet': this.plantPetPanel(hint && hint.obj); break;
      }
    },

    /* ================= 农田 ================= */
    farmPanel() {
      const s = LG.State.s;
      const rows = [];
      for (let i = 0; i < LG.CFG.BAL.farmPlots; i++) {
        const crop = s.crops.find(c => c.plot === i);
        if (!crop) {
          rows.push('<div class="desc">【垄 ' + (i + 1) + '】空地</div><button class="mbtn" data-plant="' + i + '">🌱 种植（体力5）</button>');
        } else {
          const cc = LG.CFG.CROPS[crop.crop];
          const prog = Math.min(1, crop.growth / cc.days);
          const ready = crop.growth >= cc.days;
          rows.push('<div class="desc">【垄 ' + (i + 1) + '】' + cc.icon + ' ' + cc.name +
            ' · 生长 ' + Math.floor(prog * 100) + '%' + (crop.watered ? ' · 💧已浇' : '') +
            (ready ? ' · <span style="color:#9fd8b4">成熟</span>' : '') + '</div>' +
            '<button class="mbtn' + (ready ? ' primary' : '') + '" data-harvest="' + i + '">' + (ready ? '🧺 收获' : '还没熟…') + '</button>' +
            '<button class="mbtn" data-water="' + i + '">💧 浇水（体力3）</button>');
        }
      }
      LG.UI.modal('🌾 农田', rows.join('<div style="margin:6px 0;border-bottom:1px solid rgba(170,190,182,.08);"></div>'), [
        { label: '离开', cb: () => {} },
      ]);
      // 绑定行内按钮
      const body = document.getElementById('modal-body');
      body.querySelectorAll('[data-plant]').forEach(b => b.addEventListener('click', () => this.plantFlow(parseInt(b.dataset.plant))));
      body.querySelectorAll('[data-water]').forEach(b => b.addEventListener('click', () => this.waterPlot(parseInt(b.dataset.water))));
      body.querySelectorAll('[data-harvest]').forEach(b => b.addEventListener('click', () => this.harvestPlot(parseInt(b.dataset.harvest))));
      // 阻止这些按钮关闭弹窗
      body.querySelectorAll('.mbtn').forEach(b => b.addEventListener('click', (e) => e.stopPropagation()));
    },

    plantFlow(plot) {
      const s = LG.State.s;
      const seeds = Object.keys(s.bag).filter(id => LG.CFG.ITEMS[id] && LG.CFG.ITEMS[id].cat === 'seed' && s.bag[id] > 0);
      if (seeds.length === 0) {
        LG.UI.toast('没有种子。废墟里翻翻箱柜能找到。', 'warn');
        return;
      }
      const btns = seeds.map(id => {
        const it = LG.CFG.ITEMS[id];
        const crop = LG.CFG.CROPS[it.crop];
        return {
          label: it.icon + ' ' + it.name + '（' + crop.name + '，' + crop.days + ' 天成熟）×' + s.bag[id],
          cb: () => {
            if (s.energy < 5) { LG.UI.toast('体力不足', 'warn'); return; }
            LG.State.removeItem(id, 1);
            s.crops.push({ plot, crop: it.crop, plantedDay: s.day, growth: 0, watered: false });
            LG.State.useEnergy(5);
            s.stats.plants++;
            LG.State.autosave();
            LG.Audio.sfx('plant');
            LG.UI.toast('种子埋进了土里。', '');
            // 变异植物宠物：种植时有概率种出（每种作物限一只）
            const ppCfg = LG.CFG.PLANT_PETS[it.crop];
            if (ppCfg && !s.plantPets.some(p => p.crop === it.crop) && LG.Utils.chance(LG.CFG.BAL.plantPetChance)) {
              s.plantPets.push({
                crop: it.crop,
                name: ppCfg.name,
                x: LG.Utils.rand(this.farmRect.x + 30, this.farmRect.x + this.farmRect.w - 30),
                y: LG.Utils.rand(this.farmRect.y + this.farmRect.h + 40, this.farmRect.y + this.farmRect.h + 80),
              });
              LG.State.autosave();
              LG.UI.toast(ppCfg.icon + ' 变异植物宠物诞生了！' + ppCfg.name + '（' + ppCfg.buff + '）', 'purple');
              this.buildYardCreatures();
            }
            setTimeout(() => this.farmPanel(), 120);
          },
        };
      });
      btns.push({ label: '取消', cb: () => {} });
      LG.UI.modal('种植', '选择种子：', btns);
      this.refarmPanel();
    },

    waterPlot(plot) {
      const s = LG.State.s;
      const crop = s.crops.find(c => c.plot === plot);
      if (!crop) return;
      if (crop.watered) { LG.UI.toast('这块地已经浇过了', ''); return; }
      if (s.energy < 3) { LG.UI.toast('体力不足', 'warn'); return; }
      crop.watered = true;
      LG.State.useEnergy(3);
      LG.Audio.sfx('pickup');
      LG.UI.toast('浇了水。明天会长得好一些。', '');
      LG.State.autosave();
      setTimeout(() => this.farmPanel(), 120);
    },

    harvestPlot(plot) {
      const s = LG.State.s;
      const crop = s.crops.find(c => c.plot === plot);
      if (!crop) return;
      const cc = LG.CFG.CROPS[crop.crop];
      if (crop.growth < cc.days) { LG.UI.toast('还没成熟', 'warn'); return; }
      const n = LG.Utils.randInt(cc.yieldMin, cc.yieldMax);
      if (!LG.State.canCarry(n)) { LG.UI.toast('背包满了', 'warn'); return; }
      LG.State.addItem(cc.yield, n);
      s.crops = s.crops.filter(c => c !== crop);
      s.stats.harvests++;
      // 30% 概率掉回种子
      if (LG.Utils.chance(0.3) && LG.State.canCarry(1)) LG.State.addItem(cc.seed, 1);
      LG.Audio.sfx('harvest');
      LG.UI.toast('收获了 ' + LG.CFG.ITEMS[cc.yield].name + ' ×' + n, '');
      LG.State.autosave();
    },

    /* 重开农田面板（种植选择后刷新） */
    refarmPanel() {
      setTimeout(() => {
        if (document.getElementById('modal-mask') && !document.getElementById('modal-mask').classList.contains('hidden')) {
          // 弹窗还开着（种植选择）→ 先关掉再重开农田
        }
      }, 0);
    },

    /* ================= 畜栏 ================= */
    penPanel() {
      const s = LG.State.s;
      const list = s.tamed.map((td, i) => {
        const zc = LG.CFG.ZOMBIES[td.type] || LG.CFG.ZOMBIES.walker;
        return '<div class="desc">🐾 ' + td.name + '（' + zc.name + '）· 饱食 ' + td.hungry +
          '</div><button class="mbtn" data-feed="' + i + '">🍖 喂食</button>' +
          '<button class="mbtn" data-rename="' + i + '">✏️ 改名</button>' +
          '<button class="mbtn" data-release="' + i + '" style="color:#e8a99a;">💨 放生</button>';
      }).join('<div style="margin:8px 0;border-bottom:1px solid rgba(170,190,182,.08);"></div>');
      LG.UI.modal('🐾 畜栏（' + s.tamed.length + '/' + LG.CFG.BAL.penSlots + '）',
        s.tamed.length === 0
          ? '<div class="desc">畜栏空着。在废墟里遇到丧尸时，喂它 2 块生肉，有机会把它带回家。</div>'
          : list,
        [{ label: '离开', cb: () => {} }]);
      const body = document.getElementById('modal-body');
      body.querySelectorAll('[data-feed]').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); this.feedTamed(parseInt(b.dataset.feed)); }));
      body.querySelectorAll('[data-rename]').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); this.renameTamed(parseInt(b.dataset.rename)); }));
      body.querySelectorAll('[data-release]').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); this.releaseTamed(parseInt(b.dataset.release)); }));
    },

    feedTamed(i) {
      const s = LG.State.s;
      const td = s.tamed[i];
      if (!td) return;
      const foods = ['rawMeat', 'potato', 'corn', 'mushroom'].filter(id => s.bag[id] > 0);
      if (foods.length === 0) { LG.UI.toast('没有可喂的食物', 'warn'); return; }
      const btns = foods.map(id => ({
        label: LG.CFG.ITEMS[id].icon + ' ' + LG.CFG.ITEMS[id].name + ' ×' + s.bag[id],
        cb: () => {
          LG.State.removeItem(id, 1);
          td.hungry = LG.Utils.clamp(td.hungry + 25, 0, 100);
          LG.State.autosave();
          LG.Audio.sfx('pickup');
          LG.UI.toast(td.name + '安静地吃完了。它信任你。', '');
        },
      }));
      btns.push({ label: '取消', cb: () => {} });
      LG.UI.modal('喂食 ' + td.name, '选择食物：', btns);
    },

    renameTamed(i) {
      const s = LG.State.s;
      const td = s.tamed[i];
      if (!td) return;
      LG.UI.modal('改名', '<input id="rename-input" maxlength="6" style="width:100%;padding:10px;border-radius:8px;border:1px solid rgba(170,190,182,.2);background:rgba(30,38,42,.8);color:#dde5e2;font-size:15px;" value="' + td.name + '">', [
        { label: '确定', cb: () => {
          const v = document.getElementById('rename-input');
          if (v && v.value.trim()) td.name = v.value.trim().slice(0, 6);
          LG.State.autosave();
          LG.UI.toast('它有了新名字：' + td.name, '');
        } },
        { label: '取消', cb: () => {} },
      ]);
    },

    releaseTamed(i) {
      const s = LG.State.s;
      const td = s.tamed[i];
      if (!td) return;
      LG.UI.confirm('放生', '把 ' + td.name + ' 放回废墟？它可能会走很远，也可能某天回来看看。', () => {
        s.tamed.splice(i, 1);
        LG.State.autosave();
        LG.UI.toast(td.name + '最后看了你一眼，慢慢走向大门……', 'purple');
        this.buildYardCreatures();
      });
    },

    /* ================= 合成台 ================= */
    synthPanel() {
      const s = LG.State.s;
      const rows = [];
      for (const key in LG.CFG.SYNTH) {
        const r = LG.CFG.SYNTH[key];
        const haveZombie = s.tamed.length > 0;
        const materials = Object.keys(r.need).map(id => {
          const have = s.bag[id] || 0;
          const need = r.need[id];
          return LG.CFG.ITEMS[id].icon + ' ' + LG.CFG.ITEMS[id].name + ' ' + have + '/' + need +
            (have >= need ? '' : ' <span class="need">缺</span>');
        }).join(' · ');
        const can = haveZombie && s.bigZombies.length < LG.CFG.BAL.bigZombieLimit &&
          Object.keys(r.need).every(id => (s.bag[id] || 0) >= r.need[id]);
        rows.push(
          '<div style="border-bottom:1px solid rgba(170,190,182,.1);padding:8px 0;">' +
          '<div style="color:' + r.color + ';font-weight:bold;">' + r.icon + ' ' + r.name + ' · 异能【' + r.abilityName + '】</div>' +
          '<div class="desc">' + r.abilityDesc + '</div>' +
          '<div class="desc">' + r.desc + '</div>' +
          '<div class="desc">所需：驯养丧尸 ×1 · ' + materials + '</div>' +
          '<button class="mbtn' + (can ? ' primary' : '') + '" data-synth="' + key + '"' + (can ? '' : ' disabled') + '>🔮 合成</button>' +
          '</div>'
        );
      }
      // 已有大丧尸
      if (s.bigZombies.length > 0) {
        rows.push('<div style="margin-top:10px;font-size:13px;color:#e6ece9;">现有异能大丧尸：</div>');
        s.bigZombies.forEach((bz, i) => {
          const r = LG.CFG.SYNTH[bz.type];
          rows.push('<div class="desc">' + r.icon + ' <strong>' + bz.name + '</strong>（' + r.name + '）· ' +
            (bz.companion ? '<span style="color:#9fd8b4;">跟随中</span>' : '驻守基地') +
            '</div><button class="mbtn" data-companion="' + i + '">' + (bz.companion ? '转为驻守' : '设为跟随（搜索时同行）') + '</button>');
        });
      }
      LG.UI.modal('🔮 合成台', rows.join(''), [
        { label: '离开', cb: () => {} },
      ]);
      const body = document.getElementById('modal-body');
      body.querySelectorAll('[data-synth]').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); this.doSynth(b.dataset.synth); }));
      body.querySelectorAll('[data-companion]').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); this.setCompanion(parseInt(b.dataset.companion)); }));
    },

    doSynth(key) {
      const s = LG.State.s;
      const r = LG.CFG.SYNTH[key];
      if (s.tamed.length === 0) { LG.UI.toast('需要一个驯养丧尸', 'warn'); return; }
      if (s.bigZombies.length >= LG.CFG.BAL.bigZombieLimit) { LG.UI.toast('异能大丧尸数量已达上限', 'warn'); return; }
      for (const id in r.need) {
        if ((s.bag[id] || 0) < r.need[id]) { LG.UI.toast('材料不足', 'warn'); return; }
      }
      s.tamed.shift(); // 消耗一只驯养丧尸
      for (const id in r.need) LG.State.removeItem(id, r.need[id]);
      s.bigZombies.push({ id: LG.Utils.uid('bz'), name: r.name, type: key, hp: r.hp, maxHp: r.hp, companion: false });
      s.stats.synths++;
      LG.State.autosave();
      LG.Audio.sfx('synth');
      const bz = s.bigZombies[s.bigZombies.length - 1];
      LG.UI.toast(r.icon + ' ' + r.name + ' 站了起来。它胸腔里的光，像一盏为你点的灯。', 'purple');
      this.buildYardCreatures();
      // 粒子特效
      const pt = this.synthDoorPoint();
      this.particles.spawnFlame(pt.x, pt.y - 20, 20);
    },

    setCompanion(i) {
      const s = LG.State.s;
      const bz = s.bigZombies[i];
      if (!bz) return;
      const was = bz.companion;
      s.bigZombies.forEach(b => b.companion = false);
      if (!was) bz.companion = true;
      LG.State.autosave();
      LG.UI.toast(was ? bz.name + ' 留下驻守基地。' : bz.name + ' 将跟随你外出搜索。', '');
      this.synthPanel();
    },

    /* ================= 医疗站 ================= */
    medPanel() {
      const s = LG.State.s;
      const meds = Object.keys(s.bag).filter(id => LG.CFG.ITEMS[id] && LG.CFG.ITEMS[id].cat === 'med' && s.bag[id] > 0);
      const rows = ['<div class="desc">生命 ' + Math.ceil(s.hp) + '/' + LG.State.effectiveMaxHp() + ' · 感染 ' + Math.ceil(s.infection) + '%</div>'];
      if (meds.length === 0) {
        rows.push('<div class="desc" style="margin-top:10px;">药品柜是空的。旧城区和科研所里或许能找到抗生素。</div>');
      } else {
        meds.forEach(id => {
          const it = LG.CFG.ITEMS[id];
          rows.push('<button class="mbtn" data-med="' + id + '">' + it.icon + ' ' + it.name + '（' +
            (it.heal ? '治疗' + it.heal + ' ' : '') + (it.infection ? '感染' + (it.infection < 0 ? '' : '+') + it.infection + ' ' : '') +
            '）×' + s.bag[id] + '</button>');
        });
      }
      LG.UI.modal('⛑️ 医疗站', rows.join(''), [{ label: '离开', cb: () => {} }]);
      const body = document.getElementById('modal-body');
      body.querySelectorAll('[data-med]').forEach(b => b.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = b.dataset.med;
        LG.State.removeItem(id, 1);
        LG.State.useMed(id);
        LG.State.autosave();
        this.medPanel();
      }));
    },

    /* ================= 篝火 ================= */
    firePanel() {
      const s = LG.State.s;
      const rawMeat = s.bag.rawMeat || 0;
      const btns = [
        { label: '🛌 休息一晚（点击立即进入下一天）', cls: 'primary', cb: () => {
          // 点击选项后立马前往下一天：不弹确认，直接度过
          LG.State.passDay();
          LG.UI.updateHUD();
          // 新一天小结
          const w = LG.CFG.WEATHER.find(x => x.id === s.weather);
          const readyCrops = s.crops.filter(c => c.growth >= (LG.CFG.CROPS[c.crop] || { days: 99 }).days).length;
          LG.UI.toast('第 ' + s.day + ' 天 · 今日天气：' + (w ? w.name : '?') + (readyCrops > 0 ? ' · ' + readyCrops + ' 块作物成熟了' : ''), '');
          this.buildYardCreatures();
        } },
        { label: '🍖 烤肉（生肉×1 → 烤肉×1，体力10）' + (rawMeat > 0 ? '' : ' <span class="need">无生肉</span>'), disabled: rawMeat <= 0, cb: () => {
          if (s.energy < 10) { LG.UI.toast('体力不足', 'warn'); return; }
          LG.State.removeItem('rawMeat', 1);
          LG.State.addItem('cookedMeat', 1);
          LG.State.useEnergy(10);
          LG.State.autosave();
          LG.Audio.sfx('harvest');
          LG.UI.toast('肉在火上滋滋作响。这是废墟里最好的声音。', '');
        } },
        { label: '📻 听收音机', cb: () => { this.radioPlay(); } },
      ];
      // 主线：病毒解药
      if (s.cure && !s.ending) {
        btns.push({ label: '🫙 面对玻璃罐里的气体', cls: 'primary', cb: () => LG.State.cureModal() });
      }
      btns.push({ label: '离开', cb: () => {} });
      LG.UI.modal('🔥 篝火', '<div class="desc">火光把影子拉得很长。你听见夜风穿过栅栏的声音。</div>', btns);
    },

    /* ================= 收音机 ================= */
    radioPanel() {
      const s = LG.State.s;
      LG.UI.modal('📻 收音机',
        '<div class="desc">吱吱呀呀的收音机。阿岚留下的日记本放在旁边，纸页卷了边。</div>',
        [
          { label: '📻 听一段广播', cb: () => this.radioPlay() },
          { label: '📖 日记本（已找到 ' + s.diaryFound.length + '/' + LG.CFG.DIARY.length + ' 页）', cb: () => { LG.UI.closeModal(); LG.UI.showDiary(); } },
          { label: '离开', cb: () => {} },
        ]);
    },

    radioPlay() {
      const s = LG.State.s;
      s.flags.radioHeard = (parseInt(s.flags.radioHeard) || 0) + 1;
      const len = LG.CFG.RADIO.length;
      const idx = ((s.flags.radioHeard - 1) % len + len) % len;
      let line = LG.CFG.RADIO[idx] || '滋滋……信号断了。';
      if (s.cure && LG.Utils.chance(0.5)) {
        line = '滋滋……广播里传来一句模糊的话：……它们……安静了……';
      } else if (!s.cure && s.day >= 20 && LG.Utils.chance(0.3)) {
        line = '滋滋……一个沙哑的声音：……听说科研所最深处……有个东西……';
      }
      LG.Audio.sfx('radio');
      LG.UI.modal('📻 收音机 · 频道 ' + (s.flags.radioHeard),
        '<div style="color:#8fa09b;font-style:italic;font-size:11px;">—— 滋滋……信号捕捉 ——</div><br>' +
        '<div style="font-size:15px;line-height:2;color:#dde5e2;">' + LG.Utils.escapeHtml(line) + '</div>',
        [
          { label: '📻 再听一段', cb: () => this.radioPlay() },
          { label: '📖 日记本（' + s.diaryFound.length + '/' + LG.CFG.DIARY.length + ' 页）', cb: () => { LG.UI.closeModal(); LG.UI.showDiary(); } },
          { label: '关掉它', cb: () => {} },
        ]);
    },

    /* ================= 大门（出发搜索） ================= */
    gatePanel() {
      const s = LG.State.s;
      const slots = s.flags.followerSlot2 ? 2 : 1;
      // 随从选择（异能大丧尸 + 驯养丧尸都可携带外出）
      const pending = s._followers = s._followers || [];
      const inPending = (kind, id) => pending.some(x => x && x.kind === kind && x.id === id);
      let followerHtml = '<div style="border-bottom:1px solid rgba(170,190,182,.1);padding:8px 0;">' +
        '<div style="color:#9fd8b4;font-weight:bold;">🧟 随从（' + pending.length + '/' + slots + ' 位）</div>' +
        '<div class="desc">外出可携带异能大丧尸或驯养丧尸同行。默认 1 位，看广告可解锁第 2 位。</div>';
      if (s.bigZombies.length === 0 && s.tamed.length === 0) {
        followerHtml += '<div class="desc" style="color:#66756f;">还没有可随行的伙伴。去合成台或畜栏看看吧。</div>';
      } else {
        s.bigZombies.forEach((bz, i) => {
          const r = LG.CFG.SYNTH[bz.type];
          const selected = inPending('bz', bz.id);
          followerHtml += '<button class="mbtn' + (selected ? ' primary' : '') + '" data-flbz="' + i + '">' +
            r.icon + ' ' + bz.name + (selected ? ' ✅ 随行' : '  👣 留守') + '</button>';
        });
        s.tamed.forEach((td, i) => {
          const tz = LG.CFG.ZOMBIES[td.type] || LG.CFG.ZOMBIES.walker;
          const selected = inPending('t', td.id);
          followerHtml += '<button class="mbtn' + (selected ? ' primary' : '') + '" data-flt="' + i + '">' +
            tz.icon + ' ' + td.name + '（驯养）' + (selected ? ' ✅ 随行' : '  👣 留守') + '</button>';
        });
      }
      if (!s.flags.followerSlot2) {
        followerHtml += '<button class="mbtn" data-follow-ad>📺 看广告解锁第二随从位</button>';
      }
      followerHtml += '</div>';

      // 区域列表
      const rows = [];
      const order = ['wild', 'mall', 'oldtown', 'metro', 'lab'];
      order.forEach(zid => {
        const z = LG.CFG.ZONES[zid];
        const unlocked = s.day >= z.unlockDay;
        const stars = '★'.repeat(z.difficulty) + '☆'.repeat(Math.max(0, 5 - z.difficulty));
        rows.push(
          '<div style="border-bottom:1px solid rgba(170,190,182,.1);padding:8px 0;">' +
          '<div style="font-size:15px;color:#e6ece9;">' + z.icon + ' ' + z.name + ' <span style="color:' + z.color + ';font-size:11px;">' + stars + '</span></div>' +
          '<div class="desc">' + z.desc + '</div>' +
          (unlocked
            ? '<button class="mbtn primary" data-go="' + zid + '">🚪 出发（耗时一天）</button>'
            : '<div class="need" style="font-size:12px;">第 ' + z.unlockDay + ' 天解锁</div>') +
          '</div>'
        );
      });
      LG.UI.modal('🚪 大门',
        '<div class="desc">推开这扇门，今天或许就是最后一天。搜到的物资会带回来，如果回得来的话。</div>' +
        '<button class="mbtn" data-supply>🎬 看广告领出发补给（物资礼包）</button>' +
        followerHtml + rows.join(''),
        [{ label: '转身回院子', cb: () => {} }]);
      const body = document.getElementById('modal-body');
      // 随从切换（异能大丧尸）
      body.querySelectorAll('[data-flbz]').forEach(b => b.addEventListener('click', (e) => {
        e.stopPropagation();
        const bz = s.bigZombies[parseInt(b.dataset.flbz)];
        if (!bz) return;
        const idx = pending.findIndex(x => x && x.kind === 'bz' && x.id === bz.id);
        if (idx >= 0) pending.splice(idx, 1);
        else {
          if (pending.length >= slots) { LG.UI.toast('随从位已满（' + slots + ' 位）', 'warn'); return; }
          pending.push({ kind: 'bz', id: bz.id });
        }
        LG.Audio.sfx('ui');
        this.gatePanel();
      }));
      // 随从切换（驯养丧尸）
      body.querySelectorAll('[data-flt]').forEach(b => b.addEventListener('click', (e) => {
        e.stopPropagation();
        const td = s.tamed[parseInt(b.dataset.flt)];
        if (!td) return;
        const idx = pending.findIndex(x => x && x.kind === 't' && x.id === td.id);
        if (idx >= 0) pending.splice(idx, 1);
        else {
          if (pending.length >= slots) { LG.UI.toast('随从位已满（' + slots + ' 位）', 'warn'); return; }
          pending.push({ kind: 't', id: td.id });
        }
        LG.Audio.sfx('ui');
        this.gatePanel();
      }));
      // 广告解锁第二随从位
      const fa = body.querySelector('[data-follow-ad]');
      if (fa) fa.addEventListener('click', (e) => {
        e.stopPropagation();
        LG.UI.closeModal();
        LG.UI.toast('正在播放广告…', '');
        LG.TapSDK.showRewardedVideo().then(r => {
          if (r.ok && r.rewarded) {
            s.flags.followerSlot2 = true;
            LG.State.autosave();
            LG.TapSDK.trackEvent('unlock_follower2', {});
            LG.UI.toast('📺 第二随从位已解锁（上限 2 名）', 'purple');
          } else {
            LG.UI.toast('广告未完成', 'warn');
          }
          setTimeout(() => this.gatePanel(), 300);
        });
      });
      // 出发前补给
      const sup = body.querySelector('[data-supply]');
      if (sup) sup.addEventListener('click', (e) => {
        e.stopPropagation();
        LG.UI.closeModal();
        LG.UI.taptapSupplyPack();
        setTimeout(() => this.gatePanel(), 400);
      });
      // 出发 → 确认页
      body.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', (e) => {
        e.stopPropagation();
        const zid = b.dataset.go;
        const z = LG.CFG.ZONES[zid];
        const w = LG.CFG.WEATHER.find(x => x.id === s.weather);
        const flNames = pending.map(f => {
          if (!f) return '';
          if (f.kind === 'bz') {
            const bz = s.bigZombies.find(x => x.id === f.id);
            return bz ? (LG.CFG.SYNTH[bz.type].icon + bz.name) : '';
          }
          if (f.kind === 't') {
            const td = s.tamed.find(x => x.id === f.id);
            if (!td) return '';
            const tz = LG.CFG.ZOMBIES[td.type] || LG.CFG.ZOMBIES.walker;
            return tz.icon + td.name;
          }
          return '';
        }).filter(Boolean).join('、') || '无';
        LG.UI.modal('确认出发',
          '<div style="line-height:2;">' +
          '🚪 区域：' + z.icon + ' ' + z.name + '<br>' +
          '🌦️ 今日天气：' + (w ? w.name : '?') + '<br>' +
          '🧟 携带随从：' + (pending.length || 0) + ' 位' + (pending.length ? '（' + flNames + '）' : '') + '<br>' +
          '<span class="desc">耗时一天。搜到的物资会带回来，如果回得来的话。</span></div>',
          [
            { label: '🚪 出发！', cls: 'primary', cb: () => {
              LG.Scenes.go('scavenge', { zone: zid, followers: pending.slice() });
            } },
            { label: '再想想', cb: () => { this.gatePanel(); } },
          ]);
      }));
    },


    /* ================= 猫 ================= */
    catPanel() {
      const s = LG.State.s;
      const fed = s.flags.catFed || 0;
      const foods = ['rawMeat', 'potato', 'corn', 'can'].filter(id => s.bag[id] > 0);
      const btns = [];
      if (fed === 0) {
        btns.push({ label: '🍖 喂它（它好像认得你）', cb: () => {
          if (foods.length === 0) { LG.UI.toast('没有它能吃的东西……', 'warn'); return; }
          s.flags.catFed = 1;
          LG.State.removeItem(foods[0], 1);
          LG.State.autosave();
          LG.UI.toast('老橘蹭了蹭你的手，然后跳上墙头，叼回一张发黄的纸。', '');
          const diaryId = 'd7';
          if (LG.State.addDiary(diaryId)) {
            LG.UI.toast('【日记碎片·老橘】已收录', 'purple');
          }
        } });
      }
      const catLines = [
        '老橘看了你一眼，继续打盹。',
        '老橘的尾巴轻轻扫过地面。它什么都不缺。',
        '你蹲下来，老橘把头埋进你的手心。末日里，只有它不问你是谁。',
        '老橘蹲在墙头，望着大门的方向。它在等什么？',
      ];
      btns.push({ label: '👀 静静看着它', cb: () => {
        LG.UI.toast(LG.Utils.choice(catLines), '');
      } });
      if (foods.length > 0 && fed > 0) {
        btns.push({ label: '🍖 喂它', cb: () => {
          LG.State.removeItem(foods[0], 1);
          LG.State.autosave();
          LG.UI.toast(LG.Utils.choice(['老橘吃得很慢，像在品味这顿来之不易的晚餐。', '它吃完了，舔了舔爪子，算是道谢。']), '');
        } });
      }
      btns.push({ label: '离开', cb: () => {} });
      LG.UI.modal('🐈 老橘', '<div class="desc">一只橘猫。不知道它怎么活下来的，但它活得比谁都从容。</div>', btns);
    },

    /* ================= 工作台（制造） ================= */
    benchPanel() {
      const s = LG.State.s;
      // 材料统计（背包 + 储物箱）
      const have = (id) => (s.bag[id] || 0) + (s.storage[id] || 0);
      const rows = [];
      // 配方表：[id, 名称, 图标, 消耗, 体力, 描述, 已拥有标记]
      const owned = (id) => (s.bag[id] || 0) > 0 || LG.State.hasEquip(id);
      const recipes = [
        ['lantern', '灯笼', '🏮', { scrap: 3, cloth: 2 }, 8, '搜索时视野大幅扩大', () => (s.bag.lantern || 0) > 0],
        ['torch', '火把', '🔥', { cloth: 1, gasoline: 1 }, 5, '视野小幅扩大（黑夜的火光）', () => (s.bag.torch || 0) > 0],
        ['bandage', '绷带', '🩹', { cloth: 2 }, 5, '止血，治疗 18 生命', () => false],
        ['medkit', '药箱', '💊', { bandage: 2, scrap: 1 }, 8, '治疗 45 生命，压制感染', () => false],
        ['gasoline', '汽油', '⛽', { venom: 1, scrap: 1 }, 5, '易燃的燃料（合成焰尸/给电锯）', () => false],
        ['gun', '土枪', '💥', { scrap: 4, battery: 1, cloth: 1 }, 10, '远程武器！每发消耗 1 弹药', () => (s.bag.gun || 0) > 0],
        ['catToy', '逗猫棒', '🪄', { cloth: 2, scrap: 1 }, 5, '装备后可在营地引诱所有动物', () => owned('catToy')],
        ['crown', '尸王之冠', '👑', { bossBone: 1, core: 3 }, 10, '头部装备：最大生命 +15', () => owned('crown')],
        ['hideArmor', '硬化皮甲', '🦺', { bruteHide: 2, cloth: 2 }, 10, '身体装备：受到的伤害 -15%', () => owned('hideArmor')],
        ['swiftBoots', '迅捷之靴', '🥾', { runnerTendon: 2, cloth: 2 }, 10, '腿部装备：移动速度 +15%', () => owned('swiftBoots')],
        ['mistCloak', '雾纱披风', '🧣', { mistVeil: 1, cloth: 2 }, 10, '饰品：视野扩大', () => owned('mistCloak')],
        ['windFeather', '风之羽饰', '🪶', { galeFeather: 1, cloth: 1 }, 10, '饰品：冲刺冷却 -0.8 秒', () => owned('windFeather')],
        ['deepPendant', '深水坠饰', '📿', { deepOrb: 1, cloth: 1 }, 10, '饰品：感染漂移减缓', () => owned('deepPendant')],
      ];
      for (const [id, name, icon, cost, energy, desc, made] of recipes) {
        const costStr = Object.keys(cost).map(mid =>
          LG.CFG.ITEMS[mid].icon + ' ' + LG.CFG.ITEMS[mid].name + ' ' + have(mid) + '/' + cost[mid]
        ).join(' · ');
        const done = made();
        rows.push('<div style="border-bottom:1px solid rgba(170,190,182,.1);padding:8px 0;">' +
          '<div style="color:#d9b44a;font-weight:bold;">' + icon + ' ' + name + '</div>' +
          '<div class="desc">' + costStr + ' → ' + desc + '（体力' + energy + '）</div>' +
          '<button class="mbtn' + (done ? '' : ' primary') + '" data-craft="' + id + '"' + (done ? ' disabled' : '') + '>' +
          (done ? '✅ 已制作' : '🔨 制造' + name) + '</button></div>');
      }
      LG.UI.modal('🛠️ 工作台', '<div class="desc">篝火旁的工作台。铁锤、钳子、针线，都是上一任主人留下的。<br><span class="desc">材料会自动从背包与储物箱中扣除。</span></div>' + rows.join(''), [
        { label: '离开', cb: () => {} },
      ]);
      const body = document.getElementById('modal-body');
      body.querySelectorAll('[data-craft]').forEach(b => b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.doCraft(b.dataset.craft);
      }));
    },

    doCraft(what) {
      const s = LG.State.s;
      const costMap = {
        lantern: { scrap: 3, cloth: 2 },
        torch: { cloth: 1, gasoline: 1 },
        bandage: { cloth: 2 },
        medkit: { bandage: 2, scrap: 1 },
        gasoline: { venom: 1, scrap: 1 },
        gun: { scrap: 4, battery: 1, cloth: 1 },
        catToy: { cloth: 2, scrap: 1 },
        crown: { bossBone: 1, core: 3 },
        hideArmor: { bruteHide: 2, cloth: 2 },
        swiftBoots: { runnerTendon: 2, cloth: 2 },
        mistCloak: { mistVeil: 1, cloth: 2 },
        windFeather: { galeFeather: 1, cloth: 1 },
        deepPendant: { deepOrb: 1, cloth: 1 },
      };
      const energyMap = { lantern: 8, torch: 5, bandage: 5, medkit: 8, gasoline: 5, gun: 10, catToy: 5, crown: 10, hideArmor: 10, swiftBoots: 10, mistCloak: 10, windFeather: 10, deepPendant: 10 };
      const resultMap = { lantern: 'lantern', torch: 'torch', bandage: 'bandage', medkit: 'medkit', gasoline: 'gasoline', gun: 'gun', catToy: 'catToy', crown: 'crown', hideArmor: 'hideArmor', swiftBoots: 'swiftBoots', mistCloak: 'mistCloak', windFeather: 'windFeather', deepPendant: 'deepPendant' };
      const cost = costMap[what];
      if (!cost) return;
      // 统计背包 + 储物箱
      const have = (id) => (s.bag[id] || 0) + (s.storage[id] || 0);
      for (const id in cost) {
        if (have(id) < cost[id]) { LG.UI.toast('材料不足', 'warn'); return; }
      }
      if (s.energy < energyMap[what]) { LG.UI.toast('体力不足', 'warn'); return; }
      // 先从背包扣，不够再从储物箱扣
      for (const id in cost) {
        let need = cost[id];
        const fromBag = Math.min(s.bag[id] || 0, need);
        if (fromBag > 0) LG.State.removeItem(id, fromBag);
        need -= fromBag;
        if (need > 0) LG.Utils.takeItems(s.storage, id, need);
      }
      LG.State.useEnergy(energyMap[what]);
      LG.State.addItem(resultMap[what], 1);
      LG.State.autosave();
      LG.Audio.sfx('synth');
      const names = { lantern: '🏮 灯笼做好了。黑暗会退远一些。', torch: '🔥 火把点燃了，噼啪作响。', bandage: '🩹 绷带缠好了，干净又结实。', medkit: '💊 药箱组装完成。', gasoline: '⛽ 汽油灌进了瓶子，味道刺鼻但安心。', gun: '💥 土枪装好了。膛线歪了点，但能用。', catToy: '🪄 逗猫棒做好了。摇一摇，毛球在晃。', crown: '👑 尸王之冠戴在头上，凉丝丝的。', hideArmor: '🦺 硬化皮甲穿上了，硬邦邦的。', swiftBoots: '🥾 迅捷之靴，脚下一轻。', mistCloak: '🧣 雾纱披风披上，世界清晰了一点。', windFeather: '🪶 风之羽饰别在衣领上。', deepPendant: '📿 深水坠饰挂在脖子上，凉意传来。' };
      LG.UI.toast(names[what] || '做好了。', '');
      // 仅当工作台面板确实打开时才重开（避免干扰其他弹窗）
      if (LG.UI.modalOpen && document.getElementById('modal-title').textContent.indexOf('工作台') >= 0) {
        setTimeout(() => this.benchPanel(), 150);
      }
    },

    /* ================= 遮雨棚 ================= */
    shelterPanel() {
      const s = LG.State.s;
      const raining = s.weather === 'rain';
      LG.UI.modal('☔ 遮雨棚',
        '<div class="desc">四根木桩撑起一块铁皮。下雨的时候，这里是院子里唯一干的地方。</div><br>' +
        (raining
          ? '雨点打在铁皮上，噼里啪啦。你在棚下躲了一会儿雨。'
          : '棚下空空的，只有风穿过铁皮的声音。'),
        [
          raining ? { label: '🌧️ 在棚下躲雨（体力 +10）', cls: 'primary', cb: () => {
            if (s.energy >= s.maxEnergy) { LG.UI.toast('你不累。雨声反而让人清醒。', ''); return; }
            LG.State.useEnergy(-10); // 恢复体力
            LG.Audio.sfx('heal');
            LG.UI.toast('雨声渐渐变得像催眠曲。体力恢复了一些。', '');
            LG.State.autosave();
          } } : { label: '👀 听风', cb: () => { LG.UI.toast('风穿过铁皮的缝隙，呜呜地响。', ''); } },
          { label: '离开', cb: () => {} },
        ]);
    },

    /* ================= 储物箱（真正的存取） ================= */
    storagePanel() {
      const s = LG.State.s;
      const rows = ['<div class="desc">储物箱（' + LG.Utils.bagTotal(s.storage) + '/' + LG.CFG.BAL.maxStorage + '）· 背包（' + LG.State.bagTotal() + '/' + LG.State.effectiveMaxCarry() + '）</div>',
        '<button class="mbtn primary" data-storeall>📥 一键存入所有（除装备）</button>' +
        '<button class="mbtn" data-takeall>📤 一键取出所有</button>'];
      // 背包 → 存入
      const bagIds = Object.keys(s.bag).filter(id => s.bag[id] > 0);
      if (bagIds.length === 0) rows.push('<div class="desc" style="margin-top:8px;">背包是空的。</div>');
      bagIds.forEach(id => {
        const it = LG.CFG.ITEMS[id];
        if (!it) return;
        const equipped = id === s.weapon;
        const canStore = LG.Utils.bagTotal(s.storage) < LG.CFG.BAL.maxStorage;
        rows.push('<div style="margin-top:6px;">' + it.icon + ' ' + it.name + ' ×' + s.bag[id] +
          ' <button class="mbtn" data-store="' + id + '"' + ((!canStore || equipped) ? ' disabled' : '') + '>' +
          (equipped ? '已装备' : '存入') + '</button></div>');
      });
      rows.push('<div style="margin:10px 0;border-bottom:1px solid rgba(170,190,182,.1);"></div>');
      // 储物箱 → 取出
      const stIds = Object.keys(s.storage).filter(id => s.storage[id] > 0);
      if (stIds.length === 0) rows.push('<div class="desc">储物箱空空的。</div>');
      stIds.forEach(id => {
        const it = LG.CFG.ITEMS[id];
        if (!it) return;
        const canTake = LG.State.canCarry(1);
        rows.push('<div style="margin-top:6px;">' + it.icon + ' ' + it.name + ' ×' + s.storage[id] +
          ' <button class="mbtn" data-take="' + id + '"' + (canTake ? '' : ' disabled') + '>取出</button></div>');
      });
      LG.UI.modal('📦 储物箱', rows.join(''), [
        { label: '离开', cb: () => {} },
      ]);
      const body = document.getElementById('modal-body');
      body.querySelectorAll('[data-store]').forEach(b => b.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = b.dataset.store;
        if (LG.Utils.bagTotal(s.storage) >= LG.CFG.BAL.maxStorage) return;
        LG.State.removeItem(id, 1);
        LG.Utils.addItems(s.storage, id, 1);
        LG.State.autosave();
        LG.Audio.sfx('ui');
        this.storagePanel();
      }));
      body.querySelectorAll('[data-take]').forEach(b => b.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = b.dataset.take;
        if (!LG.State.canCarry(1)) { LG.UI.toast('背包满了', 'warn'); return; }
        LG.Utils.takeItems(s.storage, id, 1);
        LG.State.addItem(id, 1);
        LG.State.autosave();
        LG.Audio.sfx('ui');
        this.storagePanel();
      }));
      // 一键存入所有（保留已装备武器）
      const storeAllBtn = body.querySelector('[data-storeall]');
      if (storeAllBtn) storeAllBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.storageStoreAll();
        this.storagePanel();
      });
      // 一键取出所有（直到背包满）
      const takeAllBtn = body.querySelector('[data-takeall]');
      if (takeAllBtn) takeAllBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.storageTakeAll();
        this.storagePanel();
      });
    },

    storageStoreAll() {
      const s = LG.State.s;
      const ids = Object.keys(s.bag).filter(id => s.bag[id] > 0 && id !== s.weapon);
      let moved = 0;
      for (const id of ids) {
        while (s.bag[id] > 0 && LG.Utils.bagTotal(s.storage) < LG.CFG.BAL.maxStorage) {
          s.bag[id]--;
          LG.Utils.addItems(s.storage, id, 1);
          moved++;
        }
        if (s.bag[id] <= 0) delete s.bag[id];
      }
      LG.State.autosave();
      LG.Audio.sfx('ui');
      LG.UI.toast(moved > 0 ? '存入 ' + moved + ' 件物品。' : '没有可存入的物品', '');
    },

    storageTakeAll() {
      const s = LG.State.s;
      const ids = Object.keys(s.storage);
      let moved = 0;
      for (const id of ids) {
        while (s.storage[id] > 0 && LG.State.canCarry(1)) {
          s.storage[id]--;
          LG.State.addItem(id, 1);
          moved++;
        }
        if (s.storage[id] <= 0) delete s.storage[id];
      }
      LG.State.autosave();
      LG.Audio.sfx('ui');
      LG.UI.toast(moved > 0 ? '取出 ' + moved + ' 件物品。' : '储物箱是空的', '');
    },

    /* ================= 家具（移动/摆放） ================= */
    furniturePanel(f) {
      if (!f) return;
      const fc = LG.CFG.FURNITURE[f.type];
      LG.UI.modal(fc.icon + ' ' + fc.name,
        '<div class="desc">' + fc.desc + '</div><br>你可以把它搬到院子里的任何地方。',
        [
          { label: '📦 移动摆放', cls: 'primary', cb: () => this.startMoveFurniture(f) },
          { label: '算了', cb: () => {} },
        ]);
    },

    startMoveFurniture(f) {
      this.movingFurniture = f;
      LG.UI.toast('点击地面放置家具（再按 ✋ 取消）', '');
    },

    placeFurniture(wx, wy) {
      const f = this.movingFurniture;
      if (!f) return;
      const T = this.T;
      // 对齐到格，限制在院子内
      let x = LG.Utils.clamp(wx, T * 1.5, this.worldW - T * 1.5);
      let y = LG.Utils.clamp(wy, T * 1.5, this.worldH - T * 1.5);
      // 不能放在建筑/田垄/大门等碰撞体上
      const insideSolid = this.solids.some(s => {
        if (s.door) {
          const d = s.door;
          if (x > d.x - 12 && x < d.x + d.w + 12 && y > d.y - 12 && y < d.y + d.h + 12) return false;
        }
        return x > s.x - 12 && x < s.x + s.w + 12 && y > s.y - 12 && y < s.y + s.h + 12;
      }) || this.plots.some(p => x > p.x - 12 && x < p.x + p.w + 12 && y > p.y - 12 && y < p.y + p.h + 12);
      if (insideSolid) { LG.UI.toast('这里放不下', 'warn'); return; }
      f.x = Math.round(x / T) * T + T / 2;
      f.y = Math.round(y / T) * T + T / 2;
      this.movingFurniture = null;
      LG.State.autosave();
      LG.Audio.sfx('pickup');
      LG.UI.toast('家具摆好了。', '');
    },

    /* ================= 宠物 ================= */
    petPanel(pt) {
      if (!pt) return;
      const pcfg = pt.cfg || (pt.ref && LG.CFG.PETS[pt.ref.zone]) || { name: '宠物', icon: '🐾', buff: '' };
      LG.UI.modal(pcfg.icon + ' ' + pcfg.name,
        '<div class="desc">' + pcfg.name + '住在你的院子里，偶尔在废墟和院子之间走动。</div><br>' +
        '<div style="color:#9fd8b4;">特性：' + pcfg.buff + '</div>',
        [
          { label: '摸摸它', cb: () => {
            LG.UI.toast(LG.Utils.choice([
              pcfg.name + '蹭了蹭你的手。',
              pcfg.name + '安静地靠在你脚边。',
              '你摸了摸' + pcfg.name + '。末世里，这点温度很珍贵。',
            ]), '');
          } },
          { label: '离开', cb: () => {} },
        ]);
    },

    /* ================= 艾巳 ================= */
    aiShiPanel() {
      const ai = LG.CFG.AI_SHI;
      LG.UI.modal(ai.icon + ' ' + ai.name,
        '<div class="desc">' + ai.desc + '</div><br>' +
        '<div style="color:#9fd8b4;">每日会生产医疗用品（绷带/药箱）放进储物箱。</div><br>' +
        LG.Utils.choice(ai.lines),
        [
          { label: '离开', cb: () => {} },
        ]);
    },

    /* ================= 变异植物宠物 ================= */
    plantPetPanel(pp) {
      if (!pp) return;
      const pcfg = LG.CFG.PLANT_PETS[pp.ref.crop];
      if (!pcfg) return;
      LG.UI.modal(pcfg.icon + ' ' + pcfg.name,
        '<div class="desc">从农田里长出来的变异植物，会走路，会看你。</div><br>' +
        '<div style="color:#9fd8b4;">特性：' + pcfg.buff + '</div>',
        [
          { label: '摸摸它', cb: () => {
            LG.UI.toast(LG.Utils.choice([
              pcfg.name + '的叶片轻轻蹭了蹭你的手。',
              pcfg.name + '晃了晃，像是在点头。',
              '你摸了摸' + pcfg.name + '。它是这片田里最安静的活物。',
            ]), '');
          } },
          { label: '离开', cb: () => {} },
        ]);
    },

    /* 变异植物宠物渲染（会轻轻摇晃的植物） */
    renderPlantPet(ctx, pp) {
      const pcfg = LG.CFG.PLANT_PETS[pp.ref.crop];
      if (!pcfg) return;
      const sway = Math.sin(pp.bob * 1.6) * 0.12;
      const x = pp.x, y = pp.y;
      LG.Entities.Draw.shadow(ctx, x, y + 10, 7);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(sway);
      // 茎
      ctx.strokeStyle = '#4a8a4a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, 8);
      ctx.quadraticCurveTo(2, 2, 0, -6);
      ctx.stroke();
      // 叶片
      ctx.fillStyle = '#5a9a4a';
      ctx.beginPath();
      ctx.ellipse(-6, 1, 6, 3, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(6, 3, 5, 2.5, 0.5, 0, Math.PI * 2);
      ctx.fill();
      // 果/头（植物宠物的"脸"）
      ctx.fillStyle = pcfg.crop === 'mtomato' ? '#a84a6a' : (pcfg.crop === 'mushroom' ? '#8a9ab0' : (pcfg.crop === 'corn' ? '#d9b44a' : '#b09a5a'));
      ctx.beginPath();
      ctx.arc(0, -8, 6.5, 0, Math.PI * 2);
      ctx.fill();
      // 眼睛
      ctx.fillStyle = '#1a2a1a';
      ctx.beginPath(); ctx.arc(-2.5, -8, 1.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(2.5, -8, 1.2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(190,220,190,0.6)';
      ctx.fillText(pcfg.icon + ' ' + pcfg.name, x, y + 20);
    },

    /* 艾巳渲染 */
    renderYardAiShi(ctx) {
      const a = this.yardAiShi;
      const bob = Math.sin(a.bob * 2) * 2;
      const x = a.x, y = a.y + bob;
      LG.Entities.Draw.shadow(ctx, a.x, a.y + 10, 9);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a.dir);
      ctx.fillStyle = '#c8d0c8';
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e04830';
      ctx.fillRect(-12, -3, 7, 7);
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(-12, -1.5, 7, 1.5);
      ctx.fillStyle = '#d8b888';
      ctx.beginPath();
      ctx.arc(7, -4, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4a3a2a';
      ctx.beginPath();
      ctx.arc(7, -5.5, 4.5, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath(); ctx.arc(8, -4, 1.1, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(10.5, -4, 1.1, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(200,220,210,0.7)';
      ctx.fillText('👩 艾巳', x, y - 14);
    },

    /* ---------- 渲染 ---------- */
    render(ctx, w, h) {
      const T = this.T;
      const s = LG.State.s;
      ctx.save();
      ctx.translate(-this.camX, -this.camY);

      // 地面
      this.renderFloor(ctx);
      // 建筑
      this.renderBuildings(ctx);
      // 农田
      this.renderFarm(ctx);
      // 畜栏栅栏
      this.renderPen(ctx);
      // 篝火
      this.renderFire(ctx);
      // 收音机
      this.renderRadio(ctx);
      // 遮雨棚
      this.renderShelter(ctx);
      // 大门
      this.renderGate(ctx);
      // 家具
      this.renderFurniture(ctx);
      // 驯养丧尸
      for (const z of this.yardZombies) this.renderTamedZombie(ctx, z);
      // 异能大丧尸
      for (const z of this.bigZombies) this.renderBigZombie(ctx, z);
      // 宠物
      for (const pt of this.yardPets) this.renderYardPet(ctx, pt);
      // 变异植物宠物
      for (const pp of this.plantPetEnts) this.renderPlantPet(ctx, pp);
      // 艾巳
      if (this.yardAiShi) this.renderYardAiShi(ctx);
      // 猫
      this.renderCat(ctx);
      // 玩家
      LG.Entities.Draw.player(ctx, this.player, this.t);
      // 粒子
      this.particles.render(ctx);

      // 交互提示
      if (this.nearestHint) {
        this.hintPulse += 0.06;
        const h = this.nearestHint;
        const bob = Math.sin(this.hintPulse * 3) * 4;
        ctx.fillStyle = 'rgba(232,178,106,0.9)';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('✋', h.x, h.y - 26 + bob);
        ctx.font = '11px sans-serif';
        ctx.fillStyle = 'rgba(230,235,230,0.8)';
        ctx.fillText(h.name, h.x, h.y - 10 + bob);
      }

      ctx.restore();

      // 光照
      this.renderLight(ctx, w, h);
      // 天气
      this.renderWeather(ctx, w, h);
      // 暗角
      const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.5)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);
    },

    renderFloor(ctx) {
      const T = this.T;
      const rnd = LG.Utils.mulberry32(this.floorSeed);
      const x0 = Math.max(0, Math.floor(this.camX / T) - 1), x1 = Math.min(LG.CFG.BASE_LAYOUT.mapW, Math.ceil((this.camX + window.innerWidth) / T) + 1);
      const y0 = Math.max(0, Math.floor(this.camY / T) - 1), y1 = Math.min(LG.CFG.BASE_LAYOUT.mapH, Math.ceil((this.camY + window.innerHeight) / T) + 1);
      for (let ty = y0; ty < y1; ty++) {
        for (let tx = x0; tx < x1; tx++) {
          const v = rnd();
          const shade = v > 0.5 ? '#181d1c' : '#161b1a';
          ctx.fillStyle = shade;
          ctx.fillRect(tx * T, ty * T, T, T);
          // 细节
          if (v < 0.08) {
            ctx.fillStyle = 'rgba(120,130,110,0.12)';
            ctx.fillRect(tx * T + 8 + v * 20, ty * T + 8 + v * 10, 4, 4);
          } else if (v > 0.93) {
            ctx.fillStyle = 'rgba(80,90,80,0.15)';
            ctx.fillRect(tx * T + v * 25, ty * T + 12, 3, 2);
          }
        }
      }
      // 草地斑块
      const grass = LG.Utils.mulberry32(this.floorSeed + 7);
      for (let i = 0; i < 26; i++) {
        const gx = grass() * this.worldW, gy = grass() * this.worldH;
        ctx.fillStyle = 'rgba(70,90,60,0.16)';
        ctx.beginPath();
        ctx.ellipse(gx, gy, 30 + grass() * 50, 16 + grass() * 20, grass() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    },

    renderBuildings(ctx) {
      const B = LG.CFG.BASE_LAYOUT.buildings;
      const draw = (id, floorColor, wallColor) => {
        const r = this.tileRect(B[id]);
        // 地板
        ctx.fillStyle = floorColor;
        ctx.fillRect(r.x, r.y, r.w, r.h);
        // 墙体
        ctx.fillStyle = wallColor;
        ctx.fillRect(r.x, r.y, r.w, 8);
        ctx.fillRect(r.x, r.y + r.h - 8, r.w, 8);
        ctx.fillRect(r.x, r.y, 8, r.h);
        ctx.fillRect(r.x + r.w - 8, r.y, 8, r.h);
        // 门
        const door = r.x + r.w / 2 - this.T / 2;
        ctx.fillStyle = 'rgba(30,26,20,0.9)';
        ctx.fillRect(door, r.y + r.h - 14, this.T, 14);
        // 窗户
        ctx.fillStyle = 'rgba(120,150,140,0.16)';
        ctx.fillRect(r.x + 14, r.y + 16, 22, 14);
        ctx.fillRect(r.x + r.w - 36, r.y + 16, 22, 14);
        // 名牌
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(210,220,215,0.55)';
        ctx.fillText(B[id].icon + ' ' + B[id].name, r.x + r.w / 2, r.y + r.h - 20);
      };
      draw('storage', '#1e221c', '#2a2e26');
      draw('synth', '#221a22', '#2e2430');
      draw('med', '#1a2228', '#242e36');
      // 工作台（开放式长桌，篝火旁）
      const br = this.benchRect;
      ctx.fillStyle = '#33291c';
      ctx.fillRect(br.x, br.y, br.w, br.h);
      ctx.fillStyle = '#4a3c28';
      ctx.fillRect(br.x + 8, br.y + 8, br.w - 16, 18);
      ctx.strokeStyle = 'rgba(150,120,70,0.5)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(br.x + 8, br.y + 8, br.w - 16, 18);
      // 工具
      ctx.fillStyle = '#8a8f92';
      ctx.fillRect(br.x + 16, br.y + 2, 18, 5);
      ctx.fillRect(br.x + br.w - 40, br.y + 2, 20, 5);
      ctx.fillStyle = 'rgba(180,160,120,0.6)';
      ctx.fillRect(br.x + 14, br.y + 30, 8, 8);
      ctx.fillRect(br.x + br.w - 24, br.y + 30, 8, 8);
      // 名牌
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(210,220,215,0.55)';
      ctx.fillText(B.bench.icon + ' ' + B.bench.name, br.x + br.w / 2, br.y + br.h - 8);
      // 合成台细节
      const sr = this.tileRect(B.synth);
      ctx.fillStyle = 'rgba(167,90,217,0.35)';
      ctx.beginPath();
      ctx.arc(sr.x + sr.w / 2, sr.y + 20, 6 + Math.sin(this.t * 2) * 1.5, 0, Math.PI * 2);
      ctx.fill();
    },

    /* 家具渲染 */
    renderFurniture(ctx) {
      const s = LG.State.s;
      for (const f of s.furniture) {
        const fc = LG.CFG.FURNITURE[f.type];
        if (!fc) continue;
        const bob = Math.sin(this.t * 1.5 + f.x) * 1.2;
        const x = f.x, y = f.y + bob;
        LG.Entities.Draw.shadow(ctx, f.x, f.y + 14, 13);
        // 家具底座
        ctx.fillStyle = 'rgba(70,58,40,0.9)';
        ctx.fillRect(x - 16, y - 8, 32, 20);
        ctx.strokeStyle = 'rgba(0,0,0,0.45)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x - 16, y - 8, 32, 20);
        // 图标
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(fc.icon, x, y + 8);
        // 名称（靠近时）
        const d = LG.Utils.dist(this.player.x, this.player.y, f.x, f.y);
        if (d < 120) {
          ctx.font = '10px sans-serif';
          ctx.fillStyle = 'rgba(220,225,220,0.6)';
          ctx.fillText(fc.name, x, y - 14);
        }
      }
      // 摆放中的家具（跟随玩家，半透明）
      if (this.movingFurniture) {
        const fc = LG.CFG.FURNITURE[this.movingFurniture.type];
        ctx.globalAlpha = 0.55;
        ctx.font = '26px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(fc.icon, this.player.x, this.player.y - 26);
        ctx.globalAlpha = 1;
        // 提示线
        ctx.strokeStyle = 'rgba(232,178,106,0.5)';
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(this.player.x, this.player.y - 14);
        ctx.lineTo(this.player.x, this.player.y + 30);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    },

    /* 宠物渲染 */
    renderYardPet(ctx, pt) {
      const pcfg = pt.cfg;
      if (!pcfg) return;
      const bob = Math.sin((pt.bob || 0) * 2) * 2;
      const x = pt.x, y = pt.y + bob;
      LG.Entities.Draw.shadow(ctx, pt.x, pt.y + 10, 9);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(pt.dir);
      ctx.fillStyle = pcfg.type === 'crow' ? '#3a3a44' : (pcfg.type === 'rabbit' ? '#d8d0c0' : (pcfg.type === 'hamster' ? '#c9a86a' : '#b8a878'));
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(7, -3, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      if (pcfg.type === 'rabbit') {
        ctx.moveTo(5, -7); ctx.lineTo(6, -13); ctx.lineTo(8, -7); ctx.fill();
        ctx.moveTo(9, -7); ctx.lineTo(11, -13); ctx.lineTo(12, -7); ctx.fill();
      } else if (pcfg.type === 'crow') {
        ctx.beginPath(); ctx.moveTo(11, -5); ctx.lineTo(17, -6); ctx.lineTo(11, -1); ctx.fill();
      } else {
        ctx.moveTo(5, -7); ctx.lineTo(6.5, -11); ctx.lineTo(8, -7); ctx.fill();
        ctx.moveTo(8, -7); ctx.lineTo(10, -11); ctx.lineTo(11, -7); ctx.fill();
      }
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath(); ctx.arc(8, -3.5, 1.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(11, -3.5, 1.2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(220,230,225,0.55)';
      ctx.fillText(pcfg.icon + ' ' + pcfg.name, x, y - 14);
    },

    renderFarm(ctx) {
      const f = this.farmRect;
      // 田地
      ctx.fillStyle = '#23241c';
      ctx.fillRect(f.x, f.y, f.w, f.h);
      ctx.strokeStyle = 'rgba(120,110,80,0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(f.x + 2, f.y + 2, f.w - 4, f.h - 4);
      // 垄
      for (const p of this.plots) {
        ctx.fillStyle = '#2e2a1e';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.strokeStyle = 'rgba(90,80,55,0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(p.x, p.y, p.w, p.h);
      }
      // 作物
      const s = LG.State.s;
      for (const c of s.crops) {
        const p = this.plots[c.plot];
        if (!p) continue;
        const cc = LG.CFG.CROPS[c.crop];
        const prog = LG.Utils.clamp(c.growth / cc.days, 0, 1);
        const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
        if (prog < 0.34) {
          ctx.strokeStyle = '#5a7a4a';
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(cx, cy + 5); ctx.lineTo(cx, cy - 3); ctx.stroke();
        } else if (prog < 0.7) {
          ctx.strokeStyle = '#5a8a4a';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(cx - 4, cy + 5); ctx.lineTo(cx - 4, cy - 2); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(cx + 4, cy + 5); ctx.lineTo(cx + 4, cy - 2); ctx.stroke();
        } else {
          ctx.fillStyle = '#4a7a3a';
          ctx.beginPath(); ctx.ellipse(cx, cy - 2, 9, 7, 0, 0, Math.PI * 2); ctx.fill();
          if (prog >= 1) {
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(cc.icon, cx, cy + 2);
            // 成熟微光
            ctx.fillStyle = 'rgba(220,210,150,' + (0.2 + 0.15 * Math.sin(this.t * 2 + cx)) + ')';
            ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.fill();
          }
        }
        // 浇水标记
        if (c.watered) {
          ctx.fillStyle = 'rgba(120,170,220,0.7)';
          ctx.font = '9px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('💧', cx, p.y - 4);
        }
      }
    },

    renderPen(ctx) {
      const p = this.penRect;
      ctx.fillStyle = '#1a1e22';
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = 'rgba(150,150,160,0.45)';
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x, p.y, p.w, p.h);
      // 栅栏立柱
      ctx.fillStyle = '#4a4438';
      for (let x = p.x + 6; x < p.x + p.w - 4; x += 22) {
        ctx.fillRect(x, p.y - 4, 4, 10);
        ctx.fillRect(x, p.y + p.h - 6, 4, 10);
      }
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(210,220,215,0.45)';
      ctx.fillText('🐾 畜栏', p.x + p.w / 2, p.y + p.h - 6);
    },

    renderFire(ctx) {
      const f = this.fireRect;
      const fx = f.x + f.w / 2, fy = f.y + f.h / 2 + 6;
      // 火堆
      ctx.fillStyle = '#2a2018';
      ctx.beginPath();
      ctx.arc(fx, fy, 14, 0, Math.PI * 2);
      ctx.fill();
      // 火焰
      const fl = 0.7 + Math.sin(this.t * 9) * 0.25 + Math.sin(this.t * 15 + 2) * 0.12;
      ctx.fillStyle = '#e8833a';
      ctx.beginPath();
      ctx.moveTo(fx, fy - 16 * fl);
      ctx.quadraticCurveTo(fx + 8, fy - 2, fx + 10, fy + 4);
      ctx.quadraticCurveTo(fx, fy + 8, fx - 10, fy + 4);
      ctx.quadraticCurveTo(fx - 8, fy - 2, fx, fy - 16 * fl);
      ctx.fill();
      ctx.fillStyle = '#f0c86a';
      ctx.beginPath();
      ctx.moveTo(fx, fy - 9 * fl);
      ctx.quadraticCurveTo(fx + 4, fy - 1, fx + 5, fy + 2);
      ctx.quadraticCurveTo(fx, fy + 4, fx - 5, fy + 2);
      ctx.quadraticCurveTo(fx - 4, fy - 1, fx, fy - 9 * fl);
      ctx.fill();
      // 木柴
      ctx.strokeStyle = '#4a3828';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(fx - 8, fy + 5); ctx.lineTo(fx + 6, fy - 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(fx + 8, fy + 5); ctx.lineTo(fx - 6, fy - 2); ctx.stroke();
      // 名牌
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(210,220,215,0.5)';
      ctx.fillText('🔥 篝火', fx, f.y + f.h + 2);
    },

    renderShelter(ctx) {
      const r = this.shelterRect;
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      // 地面
      ctx.fillStyle = '#1e2422';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      // 四根立柱
      ctx.fillStyle = '#4a4438';
      ctx.fillRect(r.x + 6, r.y, 5, r.h);
      ctx.fillRect(r.x + r.w - 11, r.y, 5, r.h);
      // 铁皮棚顶
      ctx.fillStyle = '#4a5552';
      ctx.fillRect(r.x - 6, r.y - 6, r.w + 12, 10);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(r.x - 6, r.y - 6, r.w + 12, 10);
      // 棚顶铁皮纹
      ctx.strokeStyle = 'rgba(120,140,135,0.35)';
      ctx.beginPath();
      ctx.moveTo(r.x - 2, r.y - 6); ctx.lineTo(r.x + 6, r.y + 4);
      ctx.moveTo(r.x + 8, r.y - 6); ctx.lineTo(r.x + 16, r.y + 4);
      ctx.moveTo(r.x + 18, r.y - 6); ctx.lineTo(r.x + 26, r.y + 4);
      ctx.stroke();
      // 滴水（雨天）
      const s = LG.State.s;
      if (s.weather === 'rain') {
        ctx.strokeStyle = 'rgba(140,170,200,0.5)';
        ctx.lineWidth = 1.5;
        const drop = (this.t * 40) % 18;
        ctx.beginPath();
        ctx.moveTo(r.x - 2, r.y + drop);
        ctx.lineTo(r.x - 2, r.y + drop + 8);
        ctx.moveTo(r.x + r.w - 6, r.y + drop);
        ctx.lineTo(r.x + r.w - 6, r.y + drop + 8);
        ctx.stroke();
      }
      // 名牌
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(210,220,215,0.5)';
      ctx.fillText('☔ 遮雨棚', cx, r.y + r.h + 2);
    },

    renderRadio(ctx) {      const r = this.radioRect;
      const rx = r.x + r.w / 2, ry = r.y + r.h / 2;
      ctx.fillStyle = '#2e2a30';
      ctx.fillRect(rx - 12, ry - 8, 24, 16);
      ctx.fillStyle = '#3a3640';
      ctx.fillRect(rx - 12, ry - 2, 24, 8);
      ctx.fillStyle = 'rgba(160,180,170,0.5)';
      ctx.fillRect(rx - 8, ry - 5, 4, 2);
      ctx.fillRect(rx - 2, ry - 5, 4, 2);
      ctx.fillRect(rx + 4, ry - 5, 4, 2);
      // 天线
      ctx.strokeStyle = 'rgba(160,170,165,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(rx + 6, ry - 8); ctx.lineTo(rx + 12, ry - 18); ctx.stroke();
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(210,220,215,0.45)';
      ctx.fillText('📻 收音机', rx, r.y + r.h + 2);
    },

    renderGate(ctx) {
      const g = this.gateRect;
      // 门柱
      ctx.fillStyle = '#3a3228';
      ctx.fillRect(g.x - 8, g.y - 8, 10, g.h + 12);
      ctx.fillRect(g.x + g.w - 2, g.y - 8, 10, g.h + 12);
      // 半掩的门
      ctx.fillStyle = '#4a3e2e';
      ctx.fillRect(g.x + 4, g.y, g.w / 2 - 8, g.h - 6);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 1;
      ctx.strokeRect(g.x + 4, g.y, g.w / 2 - 8, g.h - 6);
      // 门外是深色（通往废墟）
      ctx.fillStyle = 'rgba(5,7,10,0.85)';
      ctx.fillRect(g.x + g.w / 2 + 2, g.y, g.w / 2 - 6, g.h - 6);
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(232,178,106,0.6)';
      ctx.fillText('🚪 大门', g.x + g.w / 2, g.y + g.h - 4);
    },

    renderTamedZombie(ctx, z) {
      const bob = Math.sin(z.timer * 2) * 1.5;
      const x = z.x, y = z.y + bob;
      const zc = LG.CFG.ZOMBIES[z.ref.type] || LG.CFG.ZOMBIES.walker;
      const r = 11;
      LG.Entities.Draw.shadow(ctx, z.x, z.y + 10, 10);
      // 特殊丧尸驯养后保留专属外观（水蓝/惨白/铅灰）
      let bodyColor = '#5a665e';
      if (z.ref.type === 'drowner') bodyColor = '#3a6a72';
      if (z.ref.type === 'mistwalker') bodyColor = '#a8b0b8';
      if (z.ref.type === 'gale') bodyColor = '#9a9aa8';
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.stroke();
      // 项圈（驯养标记）
      ctx.strokeStyle = '#c9a83a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x, y, r, -0.4, 0.9);
      ctx.stroke();
      // 眼睛
      const ex = Math.cos(z.dir), ey = Math.sin(z.dir);
      ctx.fillStyle = '#c8d2c0';
      ctx.beginPath(); ctx.arc(x + ex * 5 - 4, y + ey * 5 - 2, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + ex * 5 + 4, y + ey * 5 - 2, 2, 0, Math.PI * 2); ctx.fill();
      // 名字
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(220,230,225,0.55)';
      ctx.fillText(z.ref.name, x, y - r - 6);
    },

    renderBigZombie(ctx, z) {
      const e = new LG.Entities.BigZombie(z.ref.type, z.x, z.y, z.ref.name);
      e.bobT = z.timer * 3;
      e.render(ctx, this.t, { showName: true });
    },

    renderCat(ctx) {
      const c = this.cat;
      const bob = c.state === 'walk' ? Math.sin(c.bob * 12) * 1.2 : Math.sin(c.bob * 2) * 0.6;
      const x = c.x, y = c.y + bob;
      LG.Entities.Draw.shadow(ctx, c.x, c.y + 8, 9);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(c.dir);
      // 身体
      ctx.fillStyle = '#b06a2a';
      ctx.beginPath();
      ctx.ellipse(0, 0, 9, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // 头
      ctx.beginPath();
      ctx.arc(8, -3, 5.5, 0, Math.PI * 2);
      ctx.fill();
      // 耳
      ctx.beginPath();
      ctx.moveTo(5, -7); ctx.lineTo(7, -12); ctx.lineTo(9, -7);
      ctx.fill();
      // 尾
      ctx.strokeStyle = '#b06a2a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-9, 0);
      ctx.quadraticCurveTo(-15, -2, -13, -8);
      ctx.stroke();
      // 眼
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath(); ctx.arc(10, -4, 1.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(13, -4, 1.3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    },

    renderLight(ctx, w, h) {
      // 夜色（径向渐变挖洞：玩家周围亮）
      const px = this.player.x - this.camX, py = this.player.y - this.camY;
      const s = LG.State.s;
      const lantern = (s && (s.bag.lantern || 0) > 0) ? 130 : 0;
      const torch = (s && (s.bag.torch || 0) > 0) ? 80 : 0;
      const eqVision = LG.State.equipBonus ? LG.State.equipBonus('vision') : 0;
      const g = ctx.createRadialGradient(px, py, 40, px, py, 340 + lantern + torch + eqVision);
      g.addColorStop(0, 'rgba(6,9,14,0)');
      g.addColorStop(0.55, 'rgba(6,9,14,0.36)');
      g.addColorStop(1, 'rgba(6,9,14,0.72)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      // 灯笼暖光
      if (lantern) {
        const lg = ctx.createRadialGradient(px, py, 20, px, py, 100);
        lg.addColorStop(0, 'rgba(232,180,90,0.1)');
        lg.addColorStop(1, 'rgba(232,180,90,0)');
        ctx.fillStyle = lg;
        ctx.fillRect(0, 0, w, h);
      }
      // 篝火光
      const f = this.fireRect;
      const fl = 0.5 + Math.sin(this.t * 6) * 0.15;
      const fg = ctx.createRadialGradient(f.x + f.w / 2 - this.camX, f.y + f.h / 2 + 6 - this.camY, 10, f.x + f.w / 2 - this.camX, f.y + f.h / 2 + 6 - this.camY, 190);
      fg.addColorStop(0, 'rgba(232,131,58,' + fl * 0.32 + ')');
      fg.addColorStop(1, 'rgba(232,131,58,0)');
      ctx.fillStyle = fg;
      ctx.fillRect(0, 0, w, h);
    },

    renderWeather(ctx, w, h) {
      const s = LG.State.s;
      if (s.weather === 'rain') {
        ctx.strokeStyle = 'rgba(140,160,190,0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const r of this.rainDrops) {
          const x = r.x * w, y = r.y * h;
          ctx.moveTo(x, y);
          ctx.lineTo(x - 3, y + r.l);
        }
        ctx.stroke();
      } else if (s.weather === 'wind' || s.weather === 'overcast') {
        ctx.fillStyle = 'rgba(180,170,140,0.2)';
        for (const l of this.leaves) {
          const x = l.x * w, y = l.y * h;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(l.ph + this.t);
          ctx.fillRect(-2, -1, 4, 2);
          ctx.restore();
        }
      } else if (s.weather === 'fog') {
        const g = ctx.createLinearGradient(0, h * 0.5, 0, h);
        g.addColorStop(0, 'rgba(140,150,160,0)');
        g.addColorStop(1, 'rgba(140,150,160,0.16)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
    },
  };

  LG.Scenes = LG.Scenes || {};
  LG.Scenes.base = Base;
})();
