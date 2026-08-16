/* =========================================================
 * 末世孤城 · 半感染者 —— 实体系统
 * 玩家 / 丧尸（温顺，不主动攻击）/ 异能大丧尸 / 战利品 / 粒子
 * ========================================================= */
(function () {
  'use strict';
  const LG = window.LG = window.LG || {};

  /* ================= 玩家 ================= */
  class Player {
    constructor(x, y) {
      this.x = x; this.y = y;
      this.w = 22; this.h = 22;
      this.dir = -Math.PI / 2;      // 面朝方向（默认朝上）
      this.velX = 0; this.velY = 0;
      this.attackTimer = 0;         // 攻击动画
      this.attackCd = 0;
      this.dashTimer = 0;
      this.dashCd = 0;
      this.skillCd = 0;
      this.flash = 0;               // 受击闪白
      this.invuln = 0;              // 受击无敌
      this.attackHit = false;       // 本次挥击是否已结算
      this.swingAngle = 0;
      this.bobT = Math.random() * 10;
    }

    weapon() {
      const s = LG.State.s;
      return LG.CFG.ITEMS[s.weapon] || LG.CFG.ITEMS.pipe;
    }

    /* 移动 */
    move(dt, vec, speed) {
      if (this.dashTimer > 0) {
        this.dashTimer -= dt;
        this.x += this.velX * dt;
        this.y += this.velY * dt;
        return;
      }
      const sp = speed || LG.CFG.BAL.baseMoveSpeed;
      // 持械减速
      const w = this.weapon();
      let mult = w.name === '电锯' ? 0.72 : 1;
      // 迅捷之靴：移速加成
      if (LG.State && LG.State.equipBonus) mult *= (1 + LG.State.equipBonus('speed'));
      this.velX = vec.x * sp * mult;
      this.velY = vec.y * sp * mult;
      this.x += this.velX * dt;
      this.y += this.velY * dt;
      if (vec.x !== 0 || vec.y !== 0) {
        this.dir = Math.atan2(vec.y, vec.x);
        this.bobT += dt * 9;
      } else {
        this.bobT += dt * 3;
      }
      if (this.attackCd > 0) this.attackCd -= dt;
      if (this.attackTimer > 0) this.attackTimer -= dt;   // 挥击动画计时（修复一直伸直手的 bug）
      if (this.dashCd > 0) this.dashCd -= dt;
      if (this.skillCd > 0) this.skillCd -= dt;
      if (this.flash > 0) this.flash -= dt;
      if (this.invuln > 0) this.invuln -= dt;
    }

    dash() {
      if (this.dashCd > 0 || this.dashTimer > 0) return false;
      const len = Math.sqrt(this.velX * this.velX + this.velY * this.velY);
      let dx = this.velX, dy = this.velY;
      if (len < 1) { dx = Math.cos(this.dir); dy = Math.sin(this.dir); }
      else { dx /= len; dy /= len; }
      this.velX = dx * LG.CFG.BAL.dashSpeed;
      this.velY = dy * LG.CFG.BAL.dashSpeed;
      this.dashTimer = LG.CFG.BAL.dashTime;
      // 风之羽饰：冲刺冷却缩短
      const dashBonus = (LG.State && LG.State.equipBonus) ? LG.State.equipBonus('dashCd') : 0;
      this.dashCd = Math.max(0.4, LG.CFG.BAL.dashCooldown - dashBonus);
      this.invuln = Math.max(this.invuln, 0.25);
      LG.Audio.sfx('dash');
      return true;
    }

    /* 挥击。返回命中的敌人列表 */
    attack(enemies) {
      if (this.attackCd > 0) return null;
      const w = this.weapon();
      if (LG.State.s.energy < LG.CFG.BAL.attackCost) {
        LG.UI.toast('体力不足', 'warn');
        return null;
      }
      LG.State.useEnergy(LG.CFG.BAL.attackCost);
      this.attackCd = w.atkSpeed;
      this.attackTimer = 0.22;
      this.attackHit = false;
      this.swingAngle = this.dir;
      LG.Audio.sfx('swing');
      const hit = [];
      for (const e of enemies) {
        if (!e.alive) continue;
        const d = LG.Utils.dist(this.x, this.y, e.x, e.y);
        if (d <= w.range + e.w / 2) {
          // 扇形判定：与面朝方向夹角 < 70°
          const ang = Math.atan2(e.y - this.y, e.x - this.x);
          const diff = Math.abs(LG.Utils.normAngle(ang - this.dir));
          if (diff < 1.22) hit.push(e);
        }
      }
      return hit;
    }

    /* 尸化之爪：感染 >= 40 解锁。范围更大的爆发攻击 */
    claw(enemies) {
      const s = LG.State.s;
      if (s.infection < 40) { LG.UI.toast('感染不够深，爪不出这把力量', 'warn'); return null; }
      if (this.skillCd > 0) return null;
      if (s.energy < LG.CFG.BAL.clawCost) { LG.UI.toast('体力不足', 'warn'); return null; }
      LG.State.useEnergy(LG.CFG.BAL.clawCost);
      LG.State.addInfection(LG.CFG.BAL.clawInfection);
      this.skillCd = 3.5;
      this.attackTimer = 0.3;
      this.swingAngle = this.dir;
      const dmg = 12 + Math.floor(s.infection / 10);
      const hit = [];
      for (const e of enemies) {
        if (!e.alive) continue;
        const d = LG.Utils.dist(this.x, this.y, e.x, e.y);
        if (d <= 120 + e.w / 2) hit.push(e);
      }
      LG.Audio.sfx('roar');
      return { hit, dmg };
    }

    /* 受击 */
    takeDamage(n) {
      if (this.invuln > 0) return false;
      if (LG.State.s.hp <= 0) return false;
      // 硬化皮甲：伤害减免
      const dmgRed = (LG.State && LG.State.equipBonus) ? LG.State.equipBonus('dmgRed') : 0;
      if (dmgRed > 0) n = Math.max(1, Math.round(n * (1 - dmgRed)));
      LG.State.damage(n);
      this.flash = 0.25;
      this.invuln = 0.5;
      LG.State.addInfection(LG.CFG.BAL.infectionGainPerBite);
      LG.Audio.sfx('bite');
      return true;
    }
  }

  /* ================= 丧尸 =================
   * 核心设定：丧尸不会主动攻击。
   * 它们漫游、驻足、有时远远地看着你。只有被你攻击后才会反击。
   */
  class Zombie {
    constructor(type, x, y) {
      const cfg = LG.CFG.ZOMBIES[type] || LG.CFG.ZOMBIES.walker;
      this.type = type;
      this.cfg = cfg;
      this.x = x; this.y = y;
      this.w = type === 'brute' || type === 'boss' ? 30 : 22;
      this.h = this.w;
      this.hp = cfg.hp;
      this.maxHp = cfg.hp;
      this.alive = true;
      this.state = 'docile';        // docile | hostile
      this.speed = cfg.speed;
      this.wanderTarget = null;
      this.wanderTimer = LG.Utils.rand(0, 3);
      this.stareTimer = 0;
      this.biteCd = 0;
      this.hostileTimer = 0;
      this.hitFlash = 0;
      this.stun = 0;
      this.bobT = Math.random() * 10;
      this.dir = Math.random() * Math.PI * 2;
      this.aggroRange = 260;        // 被惊扰时波及范围
      this.calmRange = 420;         // 玩家离开多远、多久后冷静
      this.tauntTarget = null;      // 岩尸嘲讽目标
      this.aggroTarget = null;      // 攻击者（人类攻击丧尸后，丧尸会追人类而不是玩家）
    }

    takeDamage(dmg, scene, attacker) {
      this.hp -= dmg;
      this.hitFlash = 0.18;
      this.setHostile(scene);
      // 记录攻击者：谁打的它，它就追谁（人类攻击 → 丧尸锁敌人类）
      if (attacker && attacker.alive !== undefined) this.aggroTarget = attacker;
      LG.Audio.sfx('zombieHit');
      if (this.hp <= 0) {
        this.alive = false;
        if (scene) scene.onZombieKilled(this);
      }
    }

    setHostile(scene) {
      if (this.state === 'hostile') { this.hostileTimer = 9; return; }
      this.state = 'hostile';
      this.hostileTimer = 9;
      // 惊动附近同伴
      if (scene) {
        for (const z of scene.zombies) {
          if (z === this || !z.alive || z.state === 'hostile') continue;
          if (LG.Utils.dist(this.x, this.y, z.x, z.y) < this.aggroRange) {
            z.state = 'hostile';
            z.hostileTimer = 9;
          }
        }
      }
      this.roarTimer = 0.1;
    }

    update(dt, player, scene) {
      this.bobT += dt;
      if (this.hitFlash > 0) this.hitFlash -= dt;
      if (this.stun > 0) { this.stun -= dt; return; }
      if (this.biteCd > 0) this.biteCd -= dt;

      if (this.state === 'hostile') {
        this.hostileTimer -= dt;
        // 玩家跑远了 → 冷静，回归温顺
        if (LG.Utils.dist(this.x, this.y, player.x, player.y) > this.calmRange) {
          if (this.hostileTimer <= 0) { this.state = 'docile'; this.tauntTarget = null; this.aggroTarget = null; return; }
        }
        // 追击目标：嘲讽目标 > 攻击者（人类） > 玩家
        let chase = player;
        if (this.tauntTarget && this.tauntTarget.alive) chase = this.tauntTarget;
        else if (this.aggroTarget && this.aggroTarget.alive) chase = this.aggroTarget;
        const dx = chase.x - this.x, dy = chase.y - this.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 1) { this.dir = Math.atan2(dy, dx); }
        const sp = this.speed * (this.type === 'boss' ? 0.9 : 1);
        this.x += Math.cos(this.dir) * sp * dt;
        this.y += Math.sin(this.dir) * sp * dt;
        // 撕咬（只有反击时才攻击）
        const chaseW = chase.w || 20;
        if (d < this.w / 2 + chaseW / 2 + 6 && this.biteCd <= 0) {
          this.biteCd = 1.1;
          if (chase === player) {
            if (player.takeDamage(this.cfg.dmg)) {
              if (scene) scene.onPlayerHit(this);
            }
          } else {
            chase.takeDamage(this.cfg.dmg);
          }
        }
        // 尸王咆哮（气氛）
        if (this.type === 'boss' && this.roarTimer > 0) {
          this.roarTimer -= dt;
          if (this.roarTimer <= 0) LG.Audio.sfx('roar');
        }
      } else {
        /* 温顺行为：漫游 / 驻足 / 远远注视你 */
        this.wanderTimer -= dt;
        if (!this.wanderTarget && this.wanderTimer <= 0) {
          // 选择漫游目标
          this.wanderTimer = LG.Utils.rand(2, 6);
          if (LG.Utils.chance(0.6)) {
            const ang = Math.random() * Math.PI * 2;
            const r = LG.Utils.rand(20, 120);
            this.wanderTarget = { x: this.x + Math.cos(ang) * r, y: this.y + Math.sin(ang) * r };
          } else {
            this.wanderTarget = null; // 驻足
            this.stareTimer = LG.Utils.rand(1, 3);
          }
        }
        if (this.wanderTarget) {
          const dx = this.wanderTarget.x - this.x, dy = this.wanderTarget.y - this.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 8) { this.wanderTarget = null; this.wanderTimer = LG.Utils.rand(2, 5); }
          else {
            this.dir = Math.atan2(dy, dx);
            this.x += Math.cos(this.dir) * this.speed * 0.35 * dt;
            this.y += Math.sin(this.dir) * this.speed * 0.35 * dt;
          }
        }
        // 玩家靠近 → 停下，转身"看"你
        const dp = LG.Utils.dist(this.x, this.y, player.x, player.y);
        if (dp < 110 && this.stareTimer <= 0) {
          this.stareTimer = LG.Utils.rand(1.5, 4);
          const ang = Math.atan2(player.y - this.y, player.x - this.x);
          // 慢慢转头
          this.dir = LG.Utils.lerp(this.dir, ang, 0.08);
          // 偶尔发出低沉的叹息
          if (LG.Utils.chance(0.002)) LG.Audio.sfx('roar');
        } else if (this.stareTimer > 0) {
          this.stareTimer -= dt;
        }
      }
    }

    render(ctx, t) {
      const c = this.cfg;
      const bob = Math.sin(this.bobT * 2.2) * 2;
      const x = this.x, y = this.y + bob;
      const r = this.w / 2;
      // 影子
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(this.x, this.y + this.h / 2 - 2, r * 0.8, r * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      // 身体（特殊天气丧尸有专属配色，明显区分于普通丧尸）
      const hostile = this.state === 'hostile';
      let base = this.type === 'boss' ? '#6a5a6a' : '#6b7268';
      if (this.type === 'drowner') base = '#3a6a72';        // 溺尸：水蓝
      if (this.type === 'mistwalker') base = '#a8b0b8';    // 雾行者：惨白
      if (this.type === 'gale') base = '#9a9aa8';          // 暴风者：铅灰
      if (hostile) base = '#7a6a5a';
      // 雾行者半透明（像雾一样）
      ctx.globalAlpha = this.type === 'mistwalker' ? 0.78 : 1;
      ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : base;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
      // 暴风者：身后拖出运动残影
      if (this.type === 'gale') {
        ctx.strokeStyle = 'rgba(180,180,200,0.35)';
        ctx.lineWidth = 2;
        for (let i = 1; i <= 3; i++) {
          const bx = x - Math.cos(this.dir) * i * 9, by = y - Math.sin(this.dir) * i * 9;
          ctx.beginPath();
          ctx.moveTo(bx - 4, by);
          ctx.lineTo(bx + 4, by);
          ctx.stroke();
        }
      }
      // 溺尸：身上滴水
      if (this.type === 'drowner') {
        ctx.fillStyle = 'rgba(120,190,210,0.6)';
        ctx.beginPath();
        ctx.arc(x - r * 0.5, y + r * 0.5, 1.6, 0, Math.PI * 2);
        ctx.arc(x + r * 0.3, y + r * 0.8, 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(140,210,230,0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + r * 0.5, y + r * 0.2);
        ctx.lineTo(x + r * 0.5, y + r * 0.7);
        ctx.stroke();
      }
      // 雾行者：雾气环绕
      if (this.type === 'mistwalker') {
        ctx.fillStyle = 'rgba(200,210,220,0.18)';
        ctx.beginPath();
        ctx.arc(x, y, r + 5, 0, Math.PI * 2);
        ctx.fill();
      }
      // 眼睛（无神地看着你；特殊丧尸用专属瞳色）
      const ex = Math.cos(this.dir) * r * 0.45, ey = Math.sin(this.dir) * r * 0.45;
      let eyeC = hostile ? '#e04830' : '#c8d2c0';
      if (this.type === 'drowner') eyeC = hostile ? '#ff6040' : '#7ad8e8';
      if (this.type === 'mistwalker') eyeC = hostile ? '#ff6040' : '#e8f0f8';
      if (this.type === 'gale') eyeC = hostile ? '#ff6040' : '#e8e888';
      ctx.fillStyle = eyeC;
      ctx.beginPath(); ctx.arc(x + ex - 4, y + ey - 2, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + ex + 4, y + ey - 2, 2.2, 0, Math.PI * 2); ctx.fill();
      // 伤痕
      if (this.type === 'brute' || this.type === 'boss') {
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x - r * 0.6, y - r * 0.1);
        ctx.lineTo(x + r * 0.2, y + r * 0.5);
        ctx.lineTo(x + r * 0.6, y + r * 0.1);
        ctx.stroke();
      }
      // 血条（受伤时）
      if (this.hp < this.maxHp) {
        const bw = r * 2, bh = 3;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(x - bw / 2, y - r - 8, bw, bh);
        ctx.fillStyle = hostile ? '#e04830' : '#8aa88a';
        ctx.fillRect(x - bw / 2, y - r - 8, bw * Math.max(0, this.hp / this.maxHp), bh);
      }
      // 尸核微光（半感染者的"尸感"能看见）
      const inf = LG.State.s ? LG.State.s.infection : 0;
      if (inf >= 60) {
        ctx.fillStyle = 'rgba(150,220,180,' + (0.35 + 0.3 * Math.sin(t * 3 + x)) + ')';
        ctx.beginPath();
        ctx.arc(x, y + r * 0.3, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /* ================= 敌对人类 =================
   * 活人比丧尸危险：他们用远程武器攻击你，也会攻击丧尸。
   */
  class Human {
    constructor(type, x, y) {
      const cfg = LG.CFG.HUMAN[type] || LG.CFG.HUMAN.raider;
      this.type = type;
      this.cfg = cfg;
      this.x = x; this.y = y;
      this.w = 20; this.h = 20;
      this.hp = cfg.hp;
      this.maxHp = cfg.hp;
      this.alive = true;
      this.speed = cfg.speed;
      this.dir = Math.random() * Math.PI * 2;
      this.shootCd = LG.Utils.rand(0.5, 1.5);
      this.target = null;
      this.wanderT = LG.Utils.rand(0, 2);
      this.wanderTarget = null;
      this.hitFlash = 0;
      this.bobT = Math.random() * 10;
      this.stun = 0;
    }

    takeDamage(dmg) {
      this.hp -= dmg;
      this.hitFlash = 0.18;
      if (this.hp <= 0) this.alive = false;
    }

    /* 返回是否开枪；子弹由场景生成 */
    update(dt, player, zombies, scene) {
      this.bobT += dt;
      if (this.hitFlash > 0) this.hitFlash -= dt;
      if (this.stun > 0) { this.stun -= dt; return null; }
      if (this.shootCd > 0) this.shootCd -= dt;
      // 找目标：优先攻击身边的丧尸（只要射程内有丧尸，先打丧尸）；
      // 身边没有丧尸时，才攻击玩家。
      let target = null;
      let zombieTarget = null, zd = this.cfg.aggro;
      for (const z of zombies) {
        if (!z.alive) continue;
        const d = LG.Utils.dist(this.x, this.y, z.x, z.y);
        if (d < zd) { zd = d; zombieTarget = z; }
      }
      if (zombieTarget) {
        target = zombieTarget;
      } else {
        const dp = LG.Utils.dist(this.x, this.y, player.x, player.y);
        if (dp < this.cfg.aggro) target = player;
      }
      this.target = target;
      if (target) {
        // 交战：面向目标，保持距离，射击
        const ang = Math.atan2(target.y - this.y, target.x - this.x);
        this.dir = LG.Utils.lerp(this.dir, ang, 0.15);
        const d = LG.Utils.dist(this.x, this.y, target.x, target.y);
        if (d < 90) {
          // 太近会后退
          this.x -= Math.cos(ang) * this.speed * 0.8 * dt;
          this.y -= Math.sin(ang) * this.speed * 0.8 * dt;
        } else if (d > this.cfg.range * 0.8) {
          this.x += Math.cos(ang) * this.speed * dt;
          this.y += Math.sin(ang) * this.speed * dt;
        }
        if (this.shootCd <= 0) {
          this.shootCd = this.cfg.shootCd;
          return { target, ang };
        }
        return null;
      }
      // 巡逻漫游
      this.wanderT -= dt;
      if (!this.wanderTarget && this.wanderT <= 0) {
        this.wanderT = LG.Utils.rand(2, 5);
        if (LG.Utils.chance(0.6)) {
          const a = Math.random() * Math.PI * 2;
          this.wanderTarget = { x: this.x + Math.cos(a) * 80, y: this.y + Math.sin(a) * 80 };
        }
      }
      if (this.wanderTarget) {
        const d = LG.Utils.dist(this.x, this.y, this.wanderTarget.x, this.wanderTarget.y);
        if (d < 8) { this.wanderTarget = null; this.wanderT = LG.Utils.rand(2, 4); }
        else {
          this.dir = Math.atan2(this.wanderTarget.y - this.y, this.wanderTarget.x - this.x);
          this.x += Math.cos(this.dir) * this.speed * 0.5 * dt;
          this.y += Math.sin(this.dir) * this.speed * 0.5 * dt;
        }
      }
      return null;
    }

    render(ctx, t) {
      const bob = Math.sin(this.bobT * 2.2) * 1.6;
      const x = this.x, y = this.y + bob;
      const r = 9;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(this.x, this.y + 11, 9, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // 身体
      ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : '#4a5248';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // 背包轮廓
      ctx.fillStyle = '#3a4038';
      ctx.fillRect(x - 3, y + 3, 6, 5);
      // 枪（朝向方向）
      const gx = Math.cos(this.dir), gy = Math.sin(this.dir);
      ctx.strokeStyle = '#2a2a2a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x + gx * 8 - gy * 5, y + gy * 8 + gx * 5);
      ctx.lineTo(x + gx * 20 - gy * 5, y + gy * 20 + gx * 5);
      ctx.stroke();
      // 头 + 红色目标标记（敌对）
      ctx.fillStyle = '#c8a878';
      ctx.beginPath();
      ctx.arc(x + gx * 6 - gy * 5, y + gy * 6 + gx * 5, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e04830';
      ctx.beginPath();
      ctx.arc(x + gx * 6 - gy * 5, y + gy * 6 + gx * 5, 1.6, 0, Math.PI * 2);
      ctx.fill();
      // 血条
      if (this.hp < this.maxHp) {
        const bw = 22, bh = 3;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(x - bw / 2, y - r - 8, bw, bh);
        ctx.fillStyle = '#e04830';
        ctx.fillRect(x - bw / 2, y - r - 8, bw * Math.max(0, this.hp / this.maxHp), bh);
      }
      // 名字
      ctx.fillStyle = 'rgba(230,120,90,0.8)';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚠ 人类', x, y - r - 12);
    }
  }

  /* ================= 子弹 ================= */
  class Bullet {
    constructor(x, y, ang, speed, dmg, from, shooter) {
      this.x = x; this.y = y;
      this.vx = Math.cos(ang) * speed;
      this.vy = Math.sin(ang) * speed;
      this.dmg = dmg;
      this.from = from;         // 'human' | 'player'
      this.shooter = shooter;   // 射击者实体（用于丧尸锁敌）
      this.life = 1.4;
      this.trail = [];
    }
    update(dt) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.life -= dt;
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > 5) this.trail.shift();
      return this.life > 0;
    }
    render(ctx) {
      for (let i = 0; i < this.trail.length; i++) {
        const tr = this.trail[i];
        ctx.globalAlpha = (i / this.trail.length) * 0.6;
        ctx.fillStyle = this.from === 'player' ? '#f0d878' : '#ff8060';
        ctx.beginPath();
        ctx.arc(tr.x, tr.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  /* ================= 异能大丧尸（同伴/守卫） ================= */
  class BigZombie {
    constructor(type, x, y, name) {
      const cfg = LG.CFG.SYNTH[type];
      this.type = type;
      this.cfg = cfg;
      this.name = name || cfg.name;
      this.x = x; this.y = y;
      this.w = 34; this.h = 34;
      this.hp = cfg.hp;
      this.maxHp = cfg.hp;
      this.alive = true;
      this.speed = cfg.speed;
      this.abilityCd = 0;
      this.bobT = Math.random() * 10;
      this.aura = 0;
    }

    update(dt, player, scene) {
      this.bobT += dt;
      if (this.abilityCd > 0) this.abilityCd -= dt;
      if (this.aura > 0) this.aura -= dt;
      // 跟随玩家，保持 70~110 距离
      const d = LG.Utils.dist(this.x, this.y, player.x, player.y);
      if (d > 120) {
        const ang = Math.atan2(player.y - this.y, player.x - this.x);
        this.x += Math.cos(ang) * this.speed * dt;
        this.y += Math.sin(ang) * this.speed * dt;
      } else if (d < 55 && d > 1) {
        const ang = Math.atan2(player.y - this.y, player.x - this.x);
        this.x -= Math.cos(ang) * this.speed * 0.6 * dt;
        this.y -= Math.sin(ang) * this.speed * 0.6 * dt;
      }
      // 攻击附近的敌对丧尸
      if (scene) {
        for (const z of scene.zombies) {
          if (!z.alive || z.state !== 'hostile') continue;
          if (LG.Utils.dist(this.x, this.y, z.x, z.y) < 100) {
            z.takeDamage(this.cfg.dmg, scene);
            break;
          }
        }
        // 异能
        if (this.abilityCd <= 0) this.useAbility(scene);
      }
      // 藤尸持续治疗
      if (this.type === 'vine' && LG.Utils.chance(dt * 2)) {
        LG.State.heal(1);
        this.aura = 0.3;
      }
    }

    useAbility(scene) {
      const p = scene.player;
      switch (this.type) {
        case 'fire': {
          let n = 0;
          for (const z of scene.zombies) {
            if (!z.alive || z.state !== 'hostile') continue;
            if (LG.Utils.dist(this.x, this.y, z.x, z.y) < 160) {
              z.takeDamage(26, scene);
              n++;
            }
          }
          this.abilityCd = 8;
          scene.particles.spawnFlame(this.x, this.y, 18);
          if (n > 0) LG.Audio.sfx('synth');
          break;
        }
        case 'thunder': {
          let n = 0;
          for (const z of scene.zombies) {
            if (!z.alive || z.state !== 'hostile') continue;
            if (LG.Utils.dist(this.x, this.y, z.x, z.y) < 170) {
              z.takeDamage(16, scene);
              z.stun = Math.max(z.stun, 1.8);
              n++;
            }
          }
          this.abilityCd = 9;
          scene.particles.spawnSparks(this.x, this.y, 20);
          if (n > 0) LG.Audio.sfx('dash');
          break;
        }
        case 'rock': {
          // 嘲讽：敌对丧尸转向攻击岩尸
          for (const z of scene.zombies) {
            if (!z.alive || z.state !== 'hostile') continue;
            if (LG.Utils.dist(this.x, this.y, z.x, z.y) < 220) {
              z.tauntTarget = this;
            }
          }
          this.abilityCd = 10;
          scene.particles.spawnDust(this.x, this.y, 16);
          LG.Audio.sfx('hit');
          break;
        }
        case 'vine': {
          LG.State.heal(18);
          this.abilityCd = 9;
          scene.particles.spawnHeal(this.x, this.y, 14);
          LG.Audio.sfx('heal');
          break;
        }
      }
    }

    takeDamage(n) {
      // 岩尸减伤
      if (this.type === 'rock') n *= 0.3;
      this.hp -= n;
      this.aura = 0.2;
      if (this.hp <= 0) this.alive = false;
    }

    render(ctx, t, opts) {
      const cfg = this.cfg;
      const bob = Math.sin(this.bobT * 2) * 2.5;
      const x = this.x, y = this.y + bob;
      const r = this.w / 2;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(this.x, this.y + this.h / 2 - 2, r * 0.9, r * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      // 异能光晕
      const glow = this.aura > 0 ? 0.5 : 0.22 + 0.1 * Math.sin(t * 3 + x);
      ctx.fillStyle = cfg.color;
      ctx.globalAlpha = glow * 0.5;
      ctx.beginPath();
      ctx.arc(x, y, r + 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      // 身体
      ctx.fillStyle = '#5a5a52';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = cfg.color;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      // 眼睛
      ctx.fillStyle = cfg.color;
      ctx.beginPath(); ctx.arc(x - 6, y - 3, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 6, y - 3, 2.6, 0, Math.PI * 2); ctx.fill();
      // 名字
      if (opts && opts.showName) {
        ctx.fillStyle = 'rgba(220,230,225,0.75)';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(this.name, x, y - r - 10);
      }
      // 血条
      if (this.hp < this.maxHp) {
        const bw = r * 2, bh = 3;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(x - bw / 2, y - r - 16, bw, bh);
        ctx.fillStyle = cfg.color;
        ctx.fillRect(x - bw / 2, y - r - 16, bw * Math.max(0, this.hp / this.maxHp), bh);
      }
    }
  }

  /* ================= 战利品节点（箱柜） ================= */
  class LootNode {
    constructor(x, y, contents) {
      this.x = x; this.y = y;
      this.w = 18; this.h = 18;
      this.contents = contents || [];
      this.opened = false;
      this.bobT = Math.random() * 10;
      this.glowT = 0;
    }

    open(scene) {
      if (this.opened) return [];
      this.opened = true;
      this.glowT = 0.6;
      LG.Audio.sfx('pickup');
      const drops = [];
      for (const id of this.contents) drops.push(id);
      return drops;
    }

    render(ctx, t) {
      const bob = Math.sin(this.bobT * 2.4) * 1.5;
      const x = this.x, y = this.y + bob;
      if (!this.opened) {
        // 未开启：发光的箱子
        const g = 0.25 + 0.15 * Math.sin(t * 2.5 + x);
        ctx.fillStyle = 'rgba(200,190,140,' + g + ')';
        ctx.beginPath();
        ctx.arc(x, y, 16, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = this.opened ? 'rgba(60,55,40,0.9)' : '#8a7a50';
      ctx.fillRect(x - 8, y - 6, 16, 12);
      ctx.strokeStyle = '#3a3320';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - 8, y - 6, 16, 12);
      if (this.opened) {
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath(); ctx.moveTo(x - 8, y - 6); ctx.lineTo(x + 8, y + 6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + 8, y - 6); ctx.lineTo(x - 8, y + 6); ctx.stroke();
      } else {
        ctx.fillStyle = '#d9c98a';
        ctx.fillRect(x - 3, y - 8, 6, 4);
      }
    }
  }

  /* ================= 粒子系统 ================= */
  class Particles {
    constructor() {
      this.list = [];
    }
    clear() { this.list = []; }
    spawn(x, y, opts) {
      for (let i = 0; i < (opts.n || 1); i++) {
        this.list.push({
          x, y,
          vx: opts.vx !== undefined ? opts.vx : LG.Utils.rand(-30, 30),
          vy: opts.vy !== undefined ? opts.vy : LG.Utils.rand(-40, 10),
          life: opts.life !== undefined ? opts.life : LG.Utils.rand(0.4, 1),
          maxLife: 1,
          size: opts.size !== undefined ? opts.size : LG.Utils.rand(1.5, 3.5),
          color: opts.color || '#c9c2a8',
          grav: opts.grav !== undefined ? opts.grav : 0,
          shape: opts.shape || 'dot',
        });
        this.list[this.list.length - 1].maxLife = this.list[this.list.length - 1].life;
      }
    }
    spawnDust(x, y, n) { this.spawn(x, y, { n, color: 'rgba(150,140,120,0.5)', life: 0.8, size: 2 }); }
    spawnBlood(x, y, n) { this.spawn(x, y, { n, color: '#8a2a1a', life: 0.7, grav: 120, size: 2.5 }); }
    spawnFlame(x, y, n) { this.spawn(x, y, { n, color: '#e8833a', life: 0.9, grav: -40, size: 3 }); }
    spawnSparks(x, y, n) { this.spawn(x, y, { n, color: '#c9d9ff', life: 0.5, size: 1.8 }); }
    spawnHeal(x, y, n) { this.spawn(x, y, { n, color: '#7ae0a0', life: 1.2, grav: -30, size: 2.5 }); }
    spawnPickup(x, y) { this.spawn(x, y, { n: 6, color: '#d9c98a', life: 0.6, size: 2 }); }
    spawnLeaf(x, y, n) { this.spawn(x, y, { n, color: 'rgba(160,150,120,0.4)', life: 2.2, size: 1.6 }); }

    update(dt) {
      for (let i = this.list.length - 1; i >= 0; i--) {
        const p = this.list[i];
        p.life -= dt;
        if (p.life <= 0) { this.list.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.grav) p.vy += p.grav * dt;
      }
    }

    render(ctx) {
      for (const p of this.list) {
        const a = Math.max(0, p.life / p.maxLife);
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.6 + 0.4 * a), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  /* ================= 场景共享的绘制工具 ================= */
  const Draw = {
    /* 玩家 */
    player(ctx, p, t) {
      const bob = Math.sin(p.bobT) * 1.6;
      const x = p.x, y = p.y + bob;
      const r = 11;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 12, 11, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      // 挥击动画
      if (p.attackTimer > 0) {
        const w = p.weapon();
        const prog = 1 - p.attackTimer / 0.22;
        const ang = p.swingAngle + (prog - 0.5) * 1.6;
        ctx.strokeStyle = 'rgba(230,220,190,0.85)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(ang) * 8, y + Math.sin(ang) * 8);
        ctx.lineTo(x + Math.cos(ang) * (8 + w.range * 0.8), y + Math.sin(ang) * (8 + w.range * 0.8));
        ctx.stroke();
        ctx.fillStyle = 'rgba(230,220,190,0.6)';
        ctx.beginPath();
        ctx.arc(x + Math.cos(ang) * (8 + w.range * 0.8), y + Math.sin(ang) * (8 + w.range * 0.8), 3, 0, Math.PI * 2);
        ctx.fill();
      }
      // 身体
      const flash = p.flash > 0;
      ctx.fillStyle = flash ? '#ffffff' : '#b8a878';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // 背包/轮廓细节
      ctx.fillStyle = '#8a7a5a';
      ctx.fillRect(x - 3, y + 4, 6, 4);
      // 头灯（面朝方向）
      const fx = Math.cos(p.dir), fy = Math.sin(p.dir);
      ctx.fillStyle = '#e8e0c8';
      ctx.beginPath();
      ctx.arc(x + fx * 7 - fy * 4, y + fy * 7 + fx * 4, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + fx * 7 + fy * 4, y + fy * 7 - fx * 4, 3, 0, Math.PI * 2);
      ctx.fill();
      // 感染 > 60：眼睛泛紫
      const inf = LG.State.s ? LG.State.s.infection : 0;
      if (inf >= 60) {
        ctx.fillStyle = 'rgba(180,120,220,' + (0.4 + 0.3 * Math.sin(t * 4)) + ')';
        ctx.beginPath();
        ctx.arc(x + fx * 4 - fy * 3, y + fy * 4 + fx * 3, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + fx * 4 + fy * 3, y + fy * 4 - fx * 3, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      // 无敌闪避残影
      if (p.invuln > 0 && p.dashTimer > 0) {
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#8a9a8a';
        ctx.beginPath();
        ctx.arc(x - p.velX * 0.04, y - p.velY * 0.04, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    },

    /* 圆形阴影辅助 */
    shadow(ctx, x, y, w) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(x, y, w, w * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
    },
  };

  LG.Entities = { Player, Zombie, Human, Bullet, BigZombie, LootNode, Particles, Draw };
})();
