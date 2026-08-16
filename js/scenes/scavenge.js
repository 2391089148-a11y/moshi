/* =========================================================
 * 末世孤城 · 半感染者 —— 废墟搜索场景（搜 · 打 · 撤）
 * 程序化房间地图 / 战争迷雾 / 温顺丧尸 / 战斗 / 撤离
 * ========================================================= */
(function () {
  'use strict';
  const LG = window.LG = window.LG || {};

  const Scavenge = {
    name: 'scavenge',
    T: 34,
    zoneId: 'wild',
    zone: null,
    cols: 3, rows: 3,
    cellW: 10, cellH: 8,
    grid: [],          // [y][x] 0=floor 1=wall
    rooms: [],         // [{cx, cy, x0, y0, x1, y1, explored}]
    solids: [],        // 墙矩形（世界坐标）
    player: null,
    zombies: [],
    bigZombie: null,
    loots: [],         // LootNode
    drops: [],         // 地面掉落 {x,y,id,n,life,age}
    exit: null,
    particles: null,
    floats: [],        // 飘字
    explored: 0,
    camX: 0, camY: 0,
    shakeT: 0, shakeMag: 0,
    introText: '', introTimer: 0,
    lootGained: {},    // 本次获得统计
    diaryNode: null,
    weatherSeed: Math.random() * 100,
    rainDrops: [],
    leaves: [],
    t: 0,

    /* ---------- 进入 ---------- */
    enter(param) {
      LG.State.scene = 'scavenge';
      const s = LG.State.s;
      if (!s) return;
      document.getElementById('hud').classList.remove('hidden');
      document.getElementById('controls').classList.remove('hidden');

      // 参数兼容：字符串=区域id；对象={zone, followers:[大丧尸id]}
      this.zoneId = (typeof param === 'string' ? param : (param && param.zone)) || 'wild';
      this.followerIds = (param && Array.isArray(param.followers)) ? param.followers : [];
      this.zone = LG.CFG.ZONES[this.zoneId];
      this.t = 0;
      this.explored = 0;
      this.atExit = false;
      this.lootGained = {};
      this.floats = [];
      this.drops = [];
      this.particles = new LG.Entities.Particles();
      this.rainDrops = [];
      this.leaves = [];
      for (let i = 0; i < 24; i++) this.leaves.push({ x: Math.random(), y: Math.random(), s: Math.random() * 3 + 2, v: Math.random() * 40 + 20, ph: Math.random() * 6 });

      this.generate();
      this.spawnEntities();

      LG.Audio.setWeather(s.weather);
      if (this.zoneId === 'lab' && !s.cure) {
        this.introText = '🔬 科研所 —— 最深处，藏着最后的答案。';
        this.introTimer = 4.5;
      } else {
        this.introText = this.zone.icon + ' ' + this.zone.name + ' —— 找到出口，活着回来。';
        this.introTimer = 4;
      }

      // 特殊天气：出现特殊丧尸
      if (s.weather === 'rain') {
        this.introText = '🌧️ 雨夜 · ' + this.zone.name + ' —— 水洼里有东西在动。';
      } else if (s.weather === 'fog') {
        this.introText = '🌫️ 浓雾 · ' + this.zone.name + ' —— 雾里的影子比雾还安静。';
      } else if (s.weather === 'wind') {
        this.introText = '💨 大风 · ' + this.zone.name + ' —— 风里有脚步声。';
      }

      // 显示战斗按钮
      document.getElementById('btn-atk').style.display = '';
      document.getElementById('btn-skill').style.display = '';

      setTimeout(() => {
        if (LG.State.scene === 'scavenge') {
          LG.UI.toast('丧尸不会主动攻击你。但它们被惊扰后会反击。', '');
          setTimeout(() => {
            if (LG.State.scene === 'scavenge') {
              if (s.weather === 'rain') LG.UI.toast('雨夜出没：溺尸', 'purple');
              else if (s.weather === 'fog') LG.UI.toast('浓雾出没：雾行者', 'purple');
              else if (s.weather === 'wind') LG.UI.toast('大风出没：暴风者', 'purple');
              else LG.UI.toast('按 🗡 或点击丧尸即可主动攻击；击杀会掉落战利品', '');
            }
          }, 3200);
        }
      }, 500);
      LG.UI.updateHUD();
      LG.TapSDK.trackEvent('scavenge_enter', { zone: this.zoneId, day: s.day });
    },

    exit() {
      // 撤离时已保存
    },

    /* ---------- 地图生成 ---------- */
    generate() {
      const r = this.zone.rooms;
      this.rows = 3;
      this.cols = Math.max(3, Math.ceil(r / 3));
      // 科研所：多出一格"最深处"（主线：病毒解药）
      this.isLab = this.zoneId === 'lab';
      if (this.isLab) this.cols += 1;
      const gw = this.cols * this.cellW, gh = this.rows * this.cellH;
      this.gw = gw; this.gh = gh;
      this.worldW = gw * this.T; this.worldH = gh * this.T;

      // 全地板
      this.grid = [];
      for (let y = 0; y < gh; y++) {
        const row = [];
        for (let x = 0; x < gw; x++) row.push(0);
        this.grid.push(row);
      }
      // 外墙
      for (let x = 0; x < gw; x++) { this.grid[0][x] = 1; this.grid[gh - 1][x] = 1; }
      for (let y = 0; y < gh; y++) { this.grid[y][0] = 1; this.grid[y][gw - 1] = 1; }
      // 内墙（单元格之间，留门洞）；同时记录门洞格（通道）供渲染使用
      this.doorTiles = [];
      const addDoor = (x, y) => {
        if (x > 0 && y > 0 && x < gw - 1 && y < gh - 1) this.doorTiles.push([x, y]);
      };
      for (let cy = 0; cy < this.rows; cy++) {
        for (let cx = 0; cx < this.cols - 1; cx++) {
          const wx = (cx + 1) * this.cellW - 2;
          const doorY = LG.Utils.randInt(cy * this.cellH + 2, (cy + 1) * this.cellH - 4);
          for (let y = cy * this.cellH; y < (cy + 1) * this.cellH; y++) {
            if (y >= doorY && y <= doorY + 1) { addDoor(wx, y); continue; }
            if (this.grid[y][wx] !== 1) this.grid[y][wx] = 1;
          }
        }
      }
      for (let cy = 0; cy < this.rows - 1; cy++) {
        for (let cx = 0; cx < this.cols; cx++) {
          const wy = (cy + 1) * this.cellH - 2;
          const doorX = LG.Utils.randInt(cx * this.cellW + 2, (cx + 1) * this.cellW - 4);
          for (let x = cx * this.cellW; x < (cx + 1) * this.cellW; x++) {
            if (x >= doorX && x <= doorX + 1) { addDoor(x, wy); continue; }
            if (this.grid[wy][x] !== 1) this.grid[wy][x] = 1;
          }
        }
      }
      // 房间内杂物墙（不影响门）
      this.rooms = [];
      for (let cy = 0; cy < this.rows; cy++) {
        for (let cx = 0; cx < this.cols; cx++) {
          const room = {
            cx, cy,
            x0: cx * this.cellW + 1,
            y0: cy * this.cellH + 1,
            x1: (cx + 1) * this.cellW - 3,
            y1: (cy + 1) * this.cellH - 3,
            explored: (cx === 0 && cy === 0),
          };
          this.rooms.push(room);
          // 杂物
          const debris = LG.Utils.randInt(0, 2);
          for (let d = 0; d < debris; d++) {
            const dx = LG.Utils.randInt(room.x0 + 1, room.x1 - 2);
            const dy = LG.Utils.randInt(room.y0 + 1, room.y1 - 1);
            if ((dx === 0 || dy === 0 || dx === gw - 1 || dy === gh - 1)) continue;
            this.grid[dy][dx] = 1;
            if (LG.Utils.chance(0.5) && dx + 1 < room.x1) this.grid[dy][dx + 1] = 1;
          }
        }
      }
      // 起点房间清空杂物
      const startRoom = this.roomAtCell(0, 0);
      // 撤离点：随机刷新在除起点外的三个边角之一（科研所保留最深处，撤离点在其两个对角中选）
      let exitCell;
      if (this.isLab) {
        exitCell = LG.Utils.choice([{ x: 0, y: this.rows - 1 }, { x: this.cols - 1, y: 0 }]);
      } else {
        exitCell = LG.Utils.choice([
          { x: 0, y: this.rows - 1 },
          { x: this.cols - 1, y: 0 },
          { x: this.cols - 1, y: this.rows - 1 },
        ]);
      }
      const exitRoom = this.roomAtCell(exitCell.x, exitCell.y);
      for (let y = startRoom.y0; y <= startRoom.y1; y++)
        for (let x = startRoom.x0; x <= startRoom.x1; x++) this.grid[y][x] = 0;

      // 世界坐标墙体矩形
      this.solids = [];
      for (let y = 0; y < gh; y++) {
        for (let x = 0; x < gw; x++) {
          if (this.grid[y][x] === 1) {
            this.solids.push({ x: x * this.T, y: y * this.T, w: this.T, h: this.T });
          }
        }
      }
      // 起点/终点
      this.startCell = { x: 0, y: 0 };
      this.exitRoom = exitRoom;
      // 科研所最深处（主线房间）
      this.deepRoom = this.isLab ? this.roomAtCell(this.cols - 1, this.rows - 1) : null;
      if (this.deepRoom) {
        // 清空杂物，保证通路
        for (let y = this.deepRoom.y0; y <= this.deepRoom.y1; y++)
          for (let x = this.deepRoom.x0; x <= this.deepRoom.x1; x++) this.grid[y][x] = 0;
      }
    },

    roomAtCell(cx, cy) {
      return this.rooms.find(r => r.cx === cx && r.cy === cy);
    },

    roomOfTile(tx, ty) {
      for (const r of this.rooms) {
        if (tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1) return r;
      }
      return null;
    },

    /* 该格子是否被迷雾遮住（与渲染的迷雾范围一致：已探索房间外扩 2 格） */
    isFoggedTile(tx, ty) {
      for (const r of this.rooms) {
        if (!r.explored) continue;
        if (tx >= r.x0 - 2 && tx <= r.x1 + 2 && ty >= r.y0 - 2 && ty <= r.y1 + 2) return false;
      }
      return true;
    },

    /* ---------- 实体生成 ---------- */
    spawnEntities() {
      const s = LG.State.s;
      const T = this.T;
      // 玩家
      const sr = this.roomAtCell(0, 0);
      const px = (sr.x0 + sr.x1) / 2 * T, py = (sr.y0 + sr.y1) / 2 * T;
      this.player = new LG.Entities.Player(px, py);
      this.player.dir = Math.PI / 2;

      // 战利品
      this.loots = [];
      this.diaryNode = null;
      const canDiary = s.diaryFound.length < LG.CFG.DIARY.length;
      // 乌鸦宠物：更容易找到日记
      const diaryChance = 0.75 + (s.pets.some(p => p.type === 'crow') ? 0.15 : 0);
      if (canDiary && LG.Utils.chance(diaryChance)) {
        this.diaryNode = this.rooms[LG.Utils.randInt(1, this.rooms.length - 1)];
      }
      const lootRooms = this.rooms.filter(r => !(r.cx === 0 && r.cy === 0));
      let count = 0;
      const target = this.zone.lootCount;
      let guard = 0;
      while (count < target && guard++ < 200) {
        const r = LG.Utils.choice(lootRooms);
        const lx = LG.Utils.randInt(r.x0, r.x1) * T, ly = LG.Utils.randInt(r.y0, r.y1) * T;
        // 不与其他节点重叠
        if (this.loots.some(l => LG.Utils.dist(l.x, l.y, lx, ly) < 60)) continue;
        // 出口房间最多 2 个
        if (r === this.exitRoom && this.loots.filter(l => this.roomOfTile(Math.floor(l.x / T), Math.floor(l.y / T)) === this.exitRoom).length >= 2) continue;
        const contents = [];
        const nItems = LG.Utils.randInt(1, 3);
        for (let i = 0; i < nItems; i++) {
          contents.push(LG.Utils.weightedPick(this.zone.loot));
        }
        // 家具掉落（不占背包，收集后直接放回家里）
        const furnPool = LG.CFG.ZONE_FURNITURE[this.zoneId];
        if (furnPool && furnPool.length && LG.Utils.chance(LG.CFG.BAL.furnitureNodeChance)) {
          contents.push('furn:' + LG.Utils.choice(furnPool));
        }
        if (this.diaryNode === r && contents.length > 0) {
          contents[0] = 'diary';
        }
        this.loots.push(new LG.Entities.LootNode(lx, ly, contents));
        count++;
      }
      // 确保日记节点有节点
      if (this.diaryNode && !this.loots.some(l => this.diaryNode && l.contents.indexOf('diary') >= 0)) {
        const r = this.diaryNode;
        this.loots.push(new LG.Entities.LootNode(
          (r.x0 + r.x1) / 2 * T + LG.Utils.randInt(-40, 40),
          (r.y0 + r.y1) / 2 * T + LG.Utils.randInt(-20, 20),
          ['diary', LG.Utils.weightedPick(this.zone.loot)]
        ));
      }

      // 丧尸
      this.zombies = [];
      for (const pair of this.zone.zombies) {
        const [type, n] = pair;
        for (let i = 0; i < n; i++) {
          const room = LG.Utils.choice(lootRooms.filter(r => r !== this.exitRoom || LG.Utils.chance(0.4)));
          const zx = LG.Utils.randInt(room.x0, room.x1) * T, zy = LG.Utils.randInt(room.y0, room.y1) * T;
          this.zombies.push(new LG.Entities.Zombie(type, zx, zy));
        }
      }
      // 特殊天气 → 特殊丧尸（随区域难度增加数量）
      const special = [];
      if (s.weather === 'rain') special.push(['drowner', 1 + Math.floor(this.zone.difficulty / 2)]);
      if (s.weather === 'fog') special.push(['mistwalker', 1 + Math.floor(this.zone.difficulty / 2)]);
      if (s.weather === 'wind') special.push(['gale', 1 + Math.floor(this.zone.difficulty / 3)]);
      for (const [type, n] of special) {
        for (let i = 0; i < n; i++) {
          const room = LG.Utils.choice(lootRooms.filter(r => r !== this.exitRoom));
          this.zombies.push(new LG.Entities.Zombie(
            type,
            LG.Utils.randInt(room.x0, room.x1) * T,
            LG.Utils.randInt(room.y0, room.y1) * T
          ));
        }
      }

      // 出口
      this.exit = {
        x: (this.exitRoom.x0 + this.exitRoom.x1) / 2 * T,
        y: (this.exitRoom.y0 + this.exitRoom.y1) / 2 * T,
        r: 26,
      };

      // 主线：科研所最深处 —— 病毒解药
      this.cureNode = null;
      if (this.deepRoom) {
        const cx = (this.deepRoom.x0 + this.deepRoom.x1) / 2 * T;
        const cy = (this.deepRoom.y0 + this.deepRoom.y1) / 2 * T;
        this.cureNode = new LG.Entities.LootNode(cx, cy, ['cure', 'gene', 'gene']);
        this.loots.push(this.cureNode);
        // 尸王镇守最深处
        const boss = this.zombies.find(z => z.type === 'boss');
        if (boss) {
          boss.x = cx + LG.Utils.randInt(-60, 60);
          boss.y = cy + LG.Utils.randInt(-30, 30);
        }
      }

      // 随从（异能大丧尸 + 驯养丧尸，最多 2 名）
      this.followers = [];
      this.tamedFollowers = [];
      let chosen = this.followerIds.length ? this.followerIds : [];
      if (!chosen.length) {
        const legacy = s.bigZombies.find(b => b.companion);
        if (legacy) chosen = [{ kind: 'bz', id: legacy.id }];
      }
      let fi = 0;
      for (const f of chosen) {
        if (this.followers.length + this.tamedFollowers.length >= 2) break;
        const kind = f && f.kind;
        const id = f && f.id;
        if (!kind && typeof f === 'string') {
          // 旧格式：字符串 = 大丧尸 id
          const bz = s.bigZombies.find(b => b.id === f);
          if (bz) { this.followers.push(new LG.Entities.BigZombie(bz.type, px + 60 + fi * 55, py + 30, bz.name)); fi++; }
          continue;
        }
        if (kind === 'bz') {
          const bz = s.bigZombies.find(b => b.id === id);
          if (bz) { this.followers.push(new LG.Entities.BigZombie(bz.type, px + 60 + fi * 55, py + 30, bz.name)); fi++; }
        } else if (kind === 't') {
          const td = s.tamed.find(t => t.id === id);
          if (td) {
            this.tamedFollowers.push({
              ref: td,
              x: px + 40 + fi * 50, y: py + 50,
              dir: 0, bob: Math.random() * 10,
            });
            fi++;
          }
        }
      }

      // 本区域宠物（每张地图一只；已收养则不再出现）
      this.pet = null;
      const petCfg = LG.CFG.PETS[this.zoneId];
      if (petCfg && !s.pets.some(p => p.zone === this.zoneId)) {
        const room = LG.Utils.choice(this.rooms.filter(r => !(r.cx === 0 && r.cy === 0) && r !== this.exitRoom));
        this.pet = {
          type: petCfg.type,
          icon: petCfg.icon,
          name: petCfg.name,
          x: (room.x0 + room.x1) / 2 * T + LG.Utils.randInt(-30, 30),
          y: (room.y0 + room.y1) / 2 * T + LG.Utils.randInt(-20, 20),
          dir: Math.random() * Math.PI * 2,
          bob: Math.random() * 10,
          wanderT: LG.Utils.rand(1, 3),
          target: null,
        };
      }

      // 敌对人类：随机刷新（难度越高越常见），使用远程武器攻击你和其他丧尸
      this.humans = [];
      const humanChance = 0.3 + this.zone.difficulty * 0.08;
      if (LG.Utils.chance(humanChance)) {
        const nHumans = 1 + Math.floor(this.zone.difficulty / 2);
        for (let i = 0; i < nHumans; i++) {
          const room = LG.Utils.choice(this.rooms.filter(r => !(r.cx === 0 && r.cy === 0)));
          this.humans.push(new LG.Entities.Human('raider',
            LG.Utils.randInt(room.x0, room.x1) * T,
            LG.Utils.randInt(room.y0, room.y1) * T));
        }
      }

      // 特殊人类：艾巳（未招募时随机出现在任意区域，招募后不再出现）
      this.aiShi = null;
      if (!s.humans || !s.humans.some(h => h.type === 'aishi')) {
        if (LG.Utils.chance(0.35)) {
          const room = LG.Utils.choice(this.rooms.filter(r => !(r.cx === 0 && r.cy === 0)));
          this.aiShi = {
            type: 'aishi',
            x: (room.x0 + room.x1) / 2 * T,
            y: (room.y0 + room.y1) / 2 * T,
            dir: 0, bob: Math.random() * 10, wanderT: LG.Utils.rand(1, 3), target: null,
          };
        }
      }

      // 子弹
      this.bullets = [];
    },

    /* ---------- 物理 ---------- */
    collide(px, py, r) {
      for (const s of this.solids) {
        const res = LG.Utils.resolveCircleRect(px, py, r, s);
        px = res.x; py = res.y;
      }
      return { x: px, y: py };
    },

    /* 防卡死：若实体仍卡在墙体格内，把它弹到最近的可行走格（修复怪物走进黑色墙体的 bug） */
    unstuckEntity(e, r) {
      const tx = Math.floor(e.x / this.T), ty = Math.floor(e.y / this.T);
      if (tx < 1 || ty < 1 || tx >= this.gw - 1 || ty >= this.gh - 1) return;
      if (this.grid[ty][tx] !== 1) return;
      for (let rad = 1; rad <= 5; rad++) {
        for (let dy = -rad; dy <= rad; dy++) {
          for (let dx = -rad; dx <= rad; dx++) {
            const nx = tx + dx, ny = ty + dy;
            if (nx < 1 || ny < 1 || nx >= this.gw - 1 || ny >= this.gh - 1) continue;
            if (this.grid[ny][nx] === 0) {
              e.x = nx * this.T + this.T / 2;
              e.y = ny * this.T + this.T / 2;
              return;
            }
          }
        }
      }
    },

    /* ---------- 更新 ---------- */
    update(dt) {
      if (LG.State.s && LG.State.s.ending) return;
      this.t += dt;
      const s = LG.State.s;
      if (!s) return;
      if (this.introTimer > 0) this.introTimer -= dt;
      if (this.shakeT > 0) this.shakeT -= dt;

      // 移动
      const vec = LG.Input.computeMove();
      this.player.move(dt, vec);

      // 外出时体力缓慢回复（优化攻击续航）
      s.energy = LG.Utils.clamp(s.energy + dt * 3.5, 0, s.maxEnergy);

      // 点击：攻击敌人 / 打开箱柜 / 走向目标
      const taps = LG.Input.takeTaps();
      if (taps) {
        for (const tap of taps) {
          const wx = tap.sx + this.camX, wy = tap.sy + this.camY;
          // 迷雾中的区域不可寻路/不可交互（修复自动走进未探索房间的问题）
          if (this.isFoggedTile(Math.floor(wx / this.T), Math.floor(wy / this.T))) {
            if (!this.fogTapToast) {
              this.fogTapToast = true;
              setTimeout(() => this.fogTapToast = false, 1500);
              LG.UI.toast('那边被雾遮住了……', 'warn');
            }
            continue;
          }
          // 敌人？（只锁定可见区域的目标，丧尸与人类都可攻击）
          let target = null, td = 130;
          for (const e of this.allEnemies()) {
            if (!e.alive) continue;
            if (this.isFoggedTile(Math.floor(e.x / this.T), Math.floor(e.y / this.T))) continue;
            const d = LG.Utils.dist(wx, wy, e.x, e.y);
            if (d < td) { td = d; target = e; }
          }
          if (target) {
            this.player.dir = Math.atan2(target.y - this.player.y, target.x - this.player.x);
            this.tryAttack(this.allEnemies());
            break;
          }
          // 箱柜？
          const node = this.loots.find(l => !l.opened && LG.Utils.dist(wx, wy, l.x, l.y) < 50);
          if (node && LG.Utils.dist(this.player.x, this.player.y, node.x, node.y) < 90) {
            this.openNode(node);
            break;
          }
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
      const pos = this.collide(this.player.x, this.player.y, 9);
      this.player.x = pos.x; this.player.y = pos.y;

      // 技能 / 冲刺
      if (LG.Input.takeSkill()) {
        const r = this.player.claw(this.allEnemies());
        if (r) {
          for (const e of r.hit) {
            if (!e.alive) continue;
            e.takeDamage(r.dmg, this);
            this.float(e.x, e.y - 20, '-' + r.dmg, '#c79aee');
            this.particles.spawnBlood(e.x, e.y, 8);
            if (!e.alive && e instanceof LG.Entities.Human) this.onHumanKilled(e);
          }
        }
      }
      // 🗡 攻击按钮：自动面向最近的敌人（丧尸或人类）并攻击
      if (LG.Input.takeAttack()) {
        let target = null, td = 180;
        for (const e of this.allEnemies()) {
          if (!e.alive) continue;
          const d = LG.Utils.dist(this.player.x, this.player.y, e.x, e.y);
          if (d < td) { td = d; target = e; }
        }
        if (target) {
          this.player.dir = Math.atan2(target.y - this.player.y, target.x - this.player.x);
        }
        this.tryAttack(this.allEnemies());
      }
      if (LG.Input.takeDash()) {
        const did = this.player.dash();
        if (did) this.particles.spawnDust(this.player.x, this.player.y, 8);
      }

      // 交互按钮
      if (LG.Input.takeInteract()) {
        const h = this.findInteractable();
        if (h) {
          if (h.kind === 'exit') this.extract();
          else if (h.kind === 'loot') this.openNode(h.obj);
          else if (h.kind === 'tame') this.tameModal(h.obj);
          else if (h.kind === 'pet') this.adoptModal();
          else if (h.kind === 'aishi') this.recruitModal();
        }
      }

      // 走到出口 → 自动弹出撤离确认（边缘触发）
      const onExit = LG.Utils.dist(this.player.x, this.player.y, this.exit.x, this.exit.y) < 34;
      if (onExit && !this.atExit && !LG.UI.modalOpen) {
        this.atExit = true;
        this.extract();
      }
      if (!onExit) this.atExit = false;

      // 更新丧尸
      for (const z of this.zombies) {
        if (!z.alive) continue;
        z.update(dt, this.player, this);
        // 丧尸墙体碰撞 + 防卡死（不会走进黑色墙体里）
        const zp = this.collide(z.x, z.y, Math.max(8, z.w / 2 - 2));
        z.x = zp.x; z.y = zp.y;
        this.unstuckEntity(z, Math.max(8, z.w / 2 - 2));
      }
      // 随从（异能大丧尸）
      for (const f of this.followers) {
        if (!f.alive) continue;
        f.update(dt, this.player, this);
        const p = this.collide(f.x, f.y, 15);
        f.x = p.x; f.y = p.y;
        this.unstuckEntity(f, 15);
      }
      // 驯养丧尸随从：跟着玩家走（温顺，不参战）
      for (const tf of this.tamedFollowers) {
        tf.bob += dt;
        const d = LG.Utils.dist(tf.x, tf.y, this.player.x, this.player.y);
        if (d > 130) {
          const ang = Math.atan2(this.player.y - tf.y, this.player.x - tf.x);
          tf.dir = ang;
          tf.x += Math.cos(ang) * 60 * dt;
          tf.y += Math.sin(ang) * 60 * dt;
        } else if (d < 50 && d > 1) {
          const ang = Math.atan2(this.player.y - tf.y, this.player.x - tf.x);
          tf.dir = ang;
          tf.x -= Math.cos(ang) * 40 * dt;
          tf.y -= Math.sin(ang) * 40 * dt;
        }
        const tp = this.collide(tf.x, tf.y, 9);
        tf.x = tp.x; tf.y = tp.y;
        this.unstuckEntity(tf, 9);
      }
      // 敌对人类：AI + 射击
      for (const h of this.humans) {
        if (!h.alive) continue;
        const shot = h.update(dt, this.player, this.zombies, this);
        const hp2 = this.collide(h.x, h.y, 8);
        h.x = hp2.x; h.y = hp2.y;
        this.unstuckEntity(h, 8);
        if (shot) {
          this.bullets.push(new LG.Entities.Bullet(
            h.x + Math.cos(shot.ang) * 12,
            h.y + Math.sin(shot.ang) * 12,
            shot.ang, h.cfg.projSpeed, h.cfg.dmg, 'human', h
          ));
          LG.Audio.sfx('swing');
          this.particles.spawnDust(h.x + Math.cos(shot.ang) * 14, h.y + Math.sin(shot.ang) * 14, 3);
        }
      }
      // 艾巳（温顺，漫游）
      if (this.aiShi) {
        this.updateAiShi(dt);
        const ap = this.collide(this.aiShi.x, this.aiShi.y, 8);
        this.aiShi.x = ap.x; this.aiShi.y = ap.y;
        this.unstuckEntity(this.aiShi, 8);
      }
      // 宠物（温顺，漫游；不穿墙）
      if (this.pet) {
        this.updatePet(dt);
        const pp = this.collide(this.pet.x, this.pet.y, 8);
        this.pet.x = pp.x; this.pet.y = pp.y;
        this.unstuckEntity(this.pet, 8);
      }
      // 子弹
      this.updateBullets(dt);
      // 宠物漫游
      if (this.pet) this.updatePet(dt);

      // 探索
      this.checkExplore();
      // 自动拾取地面掉落
      for (let i = this.drops.length - 1; i >= 0; i--) {
        const d = this.drops[i];
        d.age += dt;
        if (d.age > 30) { this.drops.splice(i, 1); continue; }
        if (LG.Utils.dist(this.player.x, this.player.y, d.x, d.y) < 26) {
          if (LG.State.canCarry(d.n)) {
            LG.State.addItem(d.id, d.n);
            this.addLootGained(d.id, d.n);
            this.float(d.x, d.y - 14, '+' + d.n + ' ' + LG.CFG.ITEMS[d.id].name, '#9fd8b4');
            this.particles.spawnPickup(d.x, d.y);
            this.drops.splice(i, 1);
          } else if (!this.bagFullToast) {
            this.bagFullToast = true;
            setTimeout(() => this.bagFullToast = false, 2500);
            LG.UI.toast('背包满了', 'warn');
          }
        }
      }
      // 飘字 / 粒子
      for (let i = this.floats.length - 1; i >= 0; i--) {
        const f = this.floats[i];
        f.life -= dt; f.y -= 26 * dt;
        if (f.life <= 0) this.floats.splice(i, 1);
      }
      this.particles.update(dt);

      // 天气粒子
      for (const l of this.leaves) {
        l.y -= l.v * dt / this.worldH;
        l.x += Math.sin(this.t + l.ph) * 0.3 * dt;
        if (l.y < -0.02) { l.y = 1.02; l.x = Math.random(); }
      }
      if (s.weather === 'rain') {
        while (this.rainDrops.length < 70) this.rainDrops.push({ x: Math.random(), y: Math.random(), l: Math.random() * 14 + 8 });
        for (const r of this.rainDrops) { r.y += dt * 0.55; r.x -= dt * 0.08; if (r.y > 1.02) { r.y = -0.02; r.x = Math.random(); } }
      } else this.rainDrops = [];

      // 死亡判定
      if (s.hp <= 0) { this.die(); return; }

      this.updateCamera();
      LG.UI.updateHUD();
      LG.Audio.updateAmbient(dt);
    },

    applyHits(hit) {
      for (const e of hit) {
        if (!e.alive) continue;
        const w = this.player.weapon();
        e.takeDamage(w.dmg, this);
        this.float(e.x, e.y - 20, '-' + w.dmg, '#e8d9b8');
        this.particles.spawnBlood(e.x, e.y, 6);
        this.shake(2);
        if (!e.alive && e instanceof LG.Entities.Human) this.onHumanKilled(e);
      }
      if (hit.length > 0) this.player.attackTimer = 0.22;
    },

    /* 所有敌对目标：丧尸 + 人类 */
    allEnemies() {
      return this.zombies.concat(this.humans);
    },

    /* 统一攻击入口：远程武器（土枪/手枪）发射子弹；否则近战挥击 */
    tryAttack(enemies) {
      const w = this.player.weapon();
      const s = LG.State.s;
      if (w.ranged) {
        if (this.player.attackCd > 0) return;
        if ((s.bag.ammo || 0) < (w.ammoCost || 1)) { LG.UI.toast('没有弹药了（人类身上能找到）', 'warn'); return; }
        if (s.energy < LG.CFG.BAL.attackCost) { LG.UI.toast('体力不足', 'warn'); return; }
        LG.State.removeItem('ammo', w.ammoCost || 1);
        LG.State.useEnergy(LG.CFG.BAL.attackCost);
        this.player.attackCd = w.atkSpeed;
        this.player.attackTimer = 0.16;
        LG.Audio.sfx('swing');
        // 自动锁定最近的可见目标
        let ang = this.player.dir, target = null, td = w.range;
        for (const e of enemies) {
          if (!e.alive) continue;
          if (this.isFoggedTile(Math.floor(e.x / this.T), Math.floor(e.y / this.T))) continue;
          const d = LG.Utils.dist(this.player.x, this.player.y, e.x, e.y);
          if (d < td) { td = d; target = e; }
        }
        if (target) ang = Math.atan2(target.y - this.player.y, target.x - this.player.x);
        this.player.dir = ang;
        this.bullets.push(new LG.Entities.Bullet(
          this.player.x + Math.cos(ang) * 14,
          this.player.y + Math.sin(ang) * 14,
          ang, 280, w.dmg, 'player'
        ));
        this.particles.spawnDust(this.player.x + Math.cos(ang) * 16, this.player.y + Math.sin(ang) * 16, 4);
        return;
      }
      const hit = this.player.attack(enemies);
      if (hit && hit.length) this.applyHits(hit);
    },

    onZombieKilled(z) {
      const s = LG.State.s;
      s.stats.kills++;
      LG.TapSDK.trackEvent('zombie_kill', { type: z.type, zone: this.zoneId });
      // 按丧尸类型的战利品表：[物品, 最小, 最大, 概率(可选)]
      const lootTable = {
        walker:     [['core', 1, 1], ['rawMeat', 1, 1, 0.5], ['cloth', 1, 1, 0.25]],
        runner:     [['core', 1, 1], ['runnerTendon', 1, 1, 0.35], ['rawMeat', 1, 1, 0.35], ['battery', 1, 1, 0.2]],
        brute:      [['core', 2, 2], ['bruteHide', 1, 1, 0.35], ['rawMeat', 1, 2, 0.6], ['scrap', 1, 2, 0.4]],
        spitter:    [['core', 2, 2], ['venom', 1, 2, 0.55], ['rawMeat', 1, 1, 0.3]],
        drowner:    [['core', 2, 2], ['deepOrb', 1, 1, 0.4], ['water', 1, 2, 0.5]],
        mistwalker: [['core', 2, 2], ['mistVeil', 1, 1, 0.4], ['cloth', 1, 2, 0.4]],
        gale:       [['core', 1, 2], ['galeFeather', 1, 1, 0.4], ['rawMeat', 1, 1, 0.3]],
        boss:       [['core', 6, 6], ['bossBone', 1, 1], ['gene', 1, 2], ['antibiotic', 1, 1, 0.8], ['chainsaw', 1, 1, 0.12]],
      };
      const table = lootTable[z.type] || lootTable.walker;
      for (const [id, min, max, chance] of table) {
        if (chance !== undefined && !LG.Utils.chance(chance)) continue;
        const n = min === max ? min : LG.Utils.randInt(min, max);
        this.drops.push({
          x: z.x + LG.Utils.randInt(-14, 14),
          y: z.y + LG.Utils.randInt(-8, 8),
          id, n, age: 0,
        });
      }
      this.shake(3);
      this.particles.spawnBlood(z.x, z.y, 14);
    },

    onPlayerHit(z, msg) {
      this.shake(5);
      this.particles.spawnBlood(this.player.x, this.player.y, 8);
      this.float(this.player.x, this.player.y - 24, msg || '被咬了', '#e04830');
    },

    checkExplore() {
      const tx = Math.floor(this.player.x / this.T), ty = Math.floor(this.player.y / this.T);
      const room = this.roomOfTile(tx, ty);
      if (room && !room.explored) {
        room.explored = true;
        this.explored++;
        LG.Audio.sfx('ui');
        if (room === this.exitRoom) {
          LG.UI.toast('你找到了出口。', '');
        }
      }
    },

    findInteractable() {
      const p = this.player;
      // 出口
      if (LG.Utils.dist(p.x, p.y, this.exit.x, this.exit.y) < 70) return { kind: 'exit' };
      // 宠物（可收养）
      if (this.pet && LG.Utils.dist(p.x, p.y, this.pet.x, this.pet.y) < 70) return { kind: 'pet' };
      // 艾巳（可招募）
      if (this.aiShi && LG.Utils.dist(p.x, p.y, this.aiShi.x, this.aiShi.y) < 70) return { kind: 'aishi' };
      // 可驯服的丧尸（温顺、非尸王、身上有生肉、畜栏未满）
      const s = LG.State.s;
      if ((s.bag.rawMeat || 0) >= LG.CFG.BAL.tamedFeedCost && s.tamed.length < LG.CFG.BAL.penSlots) {
        let best = null, bd = 70;
        for (const z of this.zombies) {
          if (!z.alive || z.state !== 'docile' || z.type === 'boss') continue;
          const d = LG.Utils.dist(p.x, p.y, z.x, z.y);
          if (d < bd) { bd = d; best = z; }
        }
        if (best) return { kind: 'tame', obj: best };
      }
      // 未开启箱柜
      let best = null, bd = 70;
      for (const l of this.loots) {
        if (l.opened) continue;
        const d = LG.Utils.dist(p.x, p.y, l.x, l.y);
        if (d < bd) { bd = d; best = { kind: 'loot', obj: l }; }
      }
      return best;
    },

    openNode(node) {
      const drops = node.open(this);
      for (const id of drops) {
        // 家具：不占背包，收集后直接放回家里
        if (id.indexOf('furn:') === 0) {
          const ftype = id.slice(5);
          const fc = LG.CFG.FURNITURE[ftype];
          if (fc) {
            LG.State.s.furniture.push({
              id: LG.Utils.uid('f'),
              type: ftype,
              // 先放在篝火附近，回基地后可自由移动
              x: 0, y: 0,
            });
            this.float(node.x, node.y - 20, '🪑 ' + fc.name, '#d9c98a');
            LG.UI.toast('收集到家具：' + fc.icon + ' ' + fc.name + '（已送回家里，可自由摆放）', '');
            this.particles.spawnPickup(node.x, node.y);
            LG.TapSDK.trackEvent('furniture_get', { type: ftype });
          }
          continue;
        }
        if (id === 'diary') {
          // 找到下一份日记
          const next = LG.CFG.DIARY.find(d => LG.State.s.diaryFound.indexOf(d.id) < 0);
          if (next && LG.State.addDiary(next.id)) {
            this.float(node.x, node.y - 20, '📜 日记碎片', '#c79aee');
            LG.UI.toast('捡到一张发黄的纸——【第 ' + next.day + ' 天 · 阿岚】', 'purple');
            this.addLootGained('diary', 1);
          }
          continue;
        }
        if (id === 'cure') {
          // 主线：病毒解药
          if (!LG.State.s.cure) {
            LG.State.s.cure = true;
            LG.State.autosave();
            this.float(node.x, node.y - 20, '🫙 病毒解药', '#9fd8b4');
            LG.Audio.sfx('synth');
            LG.TapSDK.trackEvent('cure_found', { day: LG.State.s.day });
            LG.UI.toast('玻璃罐入手。淡绿色的气体在里面安静地旋转。', 'purple');
            setTimeout(() => LG.State.cureModal(), 700);
          }
          continue;
        }
        if (LG.State.canCarry(1)) {
          LG.State.addItem(id, 1);
          this.addLootGained(id, 1);
          this.float(node.x, node.y - 20, '+' + LG.CFG.ITEMS[id].name, '#9fd8b4');
        } else {
          this.drops.push({ x: node.x + LG.Utils.rand(-20, 20), y: node.y + LG.Utils.rand(-10, 10), id, n: 1, age: 0 });
          LG.UI.toast('背包满了，东西掉在了地上', 'warn');
        }
      }
      this.particles.spawnPickup(node.x, node.y);
    },

    addLootGained(id, n) {
      this.lootGained[id] = (this.lootGained[id] || 0) + n;
    },

    updatePet(dt) {
      const pet = this.pet;
      pet.bob += dt;
      pet.wanderT -= dt;
      if (pet.target) {
        const d = LG.Utils.dist(pet.x, pet.y, pet.target.x, pet.target.y);
        if (d < 8) { pet.target = null; pet.wanderT = LG.Utils.rand(2, 5); }
        else {
          pet.dir = Math.atan2(pet.target.y - pet.y, pet.target.x - pet.x);
          pet.x += Math.cos(pet.dir) * 40 * dt;
          pet.y += Math.sin(pet.dir) * 40 * dt;
        }
      } else if (pet.wanderT <= 0) {
        pet.wanderT = LG.Utils.rand(2, 5);
        if (LG.Utils.chance(0.7)) {
          const ang = Math.random() * Math.PI * 2;
          pet.target = { x: pet.x + Math.cos(ang) * 70, y: pet.y + Math.sin(ang) * 70 };
        }
      }
      // 玩家靠近时看向玩家
      const dp = LG.Utils.dist(pet.x, pet.y, this.player.x, this.player.y);
      if (dp < 140) {
        pet.dir = LG.Utils.lerp(pet.dir, Math.atan2(this.player.y - pet.y, this.player.x - pet.x), 0.1);
      }
    },

    /* 艾巳漫游（温顺人类） */
    updateAiShi(dt) {
      const a = this.aiShi;
      a.bob += dt;
      a.wanderT -= dt;
      if (a.target) {
        const d = LG.Utils.dist(a.x, a.y, a.target.x, a.target.y);
        if (d < 8) { a.target = null; a.wanderT = LG.Utils.rand(2, 5); }
        else {
          a.dir = Math.atan2(a.target.y - a.y, a.target.x - a.x);
          a.x += Math.cos(a.dir) * 36 * dt;
          a.y += Math.sin(a.dir) * 36 * dt;
        }
      } else if (a.wanderT <= 0) {
        a.wanderT = LG.Utils.rand(2, 5);
        if (LG.Utils.chance(0.6)) {
          const ang = Math.random() * Math.PI * 2;
          a.target = { x: a.x + Math.cos(ang) * 70, y: a.y + Math.sin(ang) * 70 };
        }
      }
      const dp = LG.Utils.dist(a.x, a.y, this.player.x, this.player.y);
      if (dp < 150) a.dir = LG.Utils.lerp(a.dir, Math.atan2(this.player.y - a.y, this.player.x - a.x), 0.08);
    },

    /* 子弹：移动 + 撞墙 + 命中判定 */
    updateBullets(dt) {
      for (let i = this.bullets.length - 1; i >= 0; i--) {
        const b = this.bullets[i];
        if (!b.update(dt)) { this.bullets.splice(i, 1); continue; }
        // 撞墙
        const tx = Math.floor(b.x / this.T), ty = Math.floor(b.y / this.T);
        if (tx < 0 || ty < 0 || tx >= this.gw || ty >= this.gh || this.grid[ty][tx] === 1) {
          this.bullets.splice(i, 1);
          this.particles.spawnDust(b.x, b.y, 4);
          continue;
        }
        let hitSomething = false;
        if (b.from === 'human') {
          // 打玩家
          if (LG.Utils.dist(b.x, b.y, this.player.x, this.player.y) < 14) {
            this.bullets.splice(i, 1);
            if (this.player.takeDamage(b.dmg)) this.onPlayerHit(null, '被击中了');
            this.particles.spawnBlood(this.player.x, this.player.y, 5);
            continue;
          }
          // 打丧尸（人类攻击丧尸 → 丧尸会锁敌该人类）
          for (const z of this.zombies) {
            if (!z.alive) continue;
            if (LG.Utils.dist(b.x, b.y, z.x, z.y) < z.w / 2 + 4) {
              z.takeDamage(b.dmg, this, b.shooter);
              this.particles.spawnBlood(z.x, z.y, 4);
              hitSomething = true;
              break;
            }
          }
          if (!hitSomething) {
            for (const f of this.followers) {
              if (!f.alive) continue;
              if (LG.Utils.dist(b.x, b.y, f.x, f.y) < 18) {
                f.takeDamage(b.dmg);
                hitSomething = true;
                break;
              }
            }
          }
        } else {
          // 玩家子弹：打人类优先，其次丧尸
          for (const h of this.humans) {
            if (!h.alive) continue;
            if (LG.Utils.dist(b.x, b.y, h.x, h.y) < 12) {
              h.takeDamage(b.dmg);
              this.particles.spawnBlood(h.x, h.y, 4);
              this.float(h.x, h.y - 20, '-' + b.dmg, '#e8d9b8');
              if (!h.alive) this.onHumanKilled(h);
              hitSomething = true;
              break;
            }
          }
          if (!hitSomething) {
            for (const z of this.zombies) {
              if (!z.alive) continue;
              if (LG.Utils.dist(b.x, b.y, z.x, z.y) < z.w / 2 + 4) {
                z.takeDamage(b.dmg, this);
                this.particles.spawnBlood(z.x, z.y, 4);
                hitSomething = true;
                break;
              }
            }
          }
        }
        if (hitSomething) this.bullets.splice(i, 1);
      }
    },

    /* 人类被击杀掉落 */
    onHumanKilled(h) {
      const s = LG.State.s;
      s.stats.kills++;
      LG.TapSDK.trackEvent('human_kill', { zone: this.zoneId });
      const drop = h.cfg.drop;
      for (const id in drop) {
        const v = drop[id];
        if (v >= 1 || LG.Utils.chance(v)) {
          this.drops.push({
            x: h.x + LG.Utils.randInt(-12, 12),
            y: h.y + LG.Utils.randInt(-8, 8),
            id, n: v >= 1 ? v : 1, age: 0,
          });
        }
      }
      this.shake(3);
      this.particles.spawnBlood(h.x, h.y, 12);
      this.float(h.x, h.y - 24, '人类被消灭', '#e04830');
      LG.UI.toast('你干掉了这个人类。他身上掉出了些东西。', '');
    },

    /* ---------- 驯服丧尸 ---------- */
    tameModal(z) {
      const s = LG.State.s;
      const cost = LG.CFG.BAL.tamedFeedCost;
      const chance = Math.round(LG.State.tamedChance() * 100);
      const zc = LG.CFG.ZOMBIES[z.type];
      LG.UI.modal('🐾 驯服 · ' + zc.name,
        '<div class="desc">' + zc.desc + '</div><br>' +
        '它歪着头看你，没有躲开。<br>' +
        '喂它 ' + cost + ' 块生肉，它可能会跟你回家。<br>' +
        '<div style="margin-top:8px;">驯服成功率：<span class="need" style="font-size:18px;">' + chance + '%</span>' +
        (s.infection >= 50 ? ' <span class="desc">（半感染者体质加成）</span>' : '') + '</div>' +
        '<div class="desc">需要：🍖 生肉 ×' + cost + '（持有 ' + (s.bag.rawMeat || 0) + '）</div>',
        [
          { label: '喂它生肉（' + chance + '% 成功）', cls: 'primary', cb: () => this.doTame(z, chance) },
          { label: '算了，走吧', cb: () => {} },
        ]);
    },

    doTame(z, chance) {
      const s = LG.State.s;
      const cost = LG.CFG.BAL.tamedFeedCost;
      if ((s.bag.rawMeat || 0) < cost) { LG.UI.toast('生肉不够了', 'warn'); return; }
      if (s.tamed.length >= LG.CFG.BAL.penSlots) { LG.UI.toast('畜栏满了', 'warn'); return; }
      LG.State.removeItem('rawMeat', cost);
      if (LG.Utils.chance(chance / 100)) {
        // 成功：带回家
        s.tamed.push({
          id: LG.Utils.uid('t'),
          name: this.randomTamedName(),
          type: z.type,
          hp: z.cfg.hp, maxHp: z.cfg.hp,
          hungry: 70,
        });
        s.stats.tames++;
        z.alive = false;
        LG.Audio.sfx('pickup');
        LG.UI.toast('它犹豫了一下，然后跟在了你身后。', 'purple');
        LG.UI.toast('【已驯养】回到基地后去畜栏看看它', '');
        this.float(z.x, z.y - 24, '🐾 驯服成功', '#9fd8b4');
        LG.State.autosave();
        LG.TapSDK.trackEvent('zombie_tame', { type: z.type });
      } else {
        // 失败：肉没了，它走远了
        z.wanderTarget = null;
        z.wanderTimer = 0.1;
        LG.Audio.sfx('ui');
        LG.UI.toast('它叼走了肉，转身走远了……', 'warn');
        this.float(z.x, z.y - 24, '驯服失败', '#e8b26a');
      }
    },

    randomTamedName() {
      const names = ['小灰', '阿呆', '慢吞吞', '铁柱', '老蔫', '跟班', '灰灰', '大个'];
      return LG.Utils.choice(names) + '-' + LG.Utils.randInt(1, 99);
    },

    /* ---------- 特殊人类：艾巳招募 ---------- */
    recruitModal() {
      const s = LG.State.s;
      const ai = LG.CFG.AI_SHI;
      const hasWater = (s.bag.water || 0) >= ai.cost.water;
      const hasCan = (s.bag.can || 0) >= ai.cost.can;
      LG.UI.modal(ai.icon + ' ' + ai.name,
        '<div class="desc">' + ai.desc + '</div><br>' +
        '她看着你："带我回你的院子。我可以照顾伤员——每天都能做出一点医疗用品。"<br>' +
        '需要：💧 清水 ×' + ai.cost.water + '（持有 ' + (s.bag.water || 0) + '）<br>🥫 罐头 ×' + ai.cost.can + '（持有 ' + (s.bag.can || 0) + '）',
        [
          { label: '🤝 招募她（' + ai.cost.water + ' 清水 + ' + ai.cost.can + ' 罐头）', cls: 'primary', cb: () => {
            if (!hasWater || !hasCan) { LG.UI.toast('物资不够', 'warn'); return; }
            LG.State.removeItem('water', ai.cost.water);
            LG.State.removeItem('can', ai.cost.can);
            s.humans = s.humans || [];
            s.humans.push({ type: 'aishi', name: ai.name });
            this.aiShi = null;
            LG.State.autosave();
            LG.Audio.sfx('harvest');
            LG.UI.toast('👩 艾巳跟你回了孤城。她说："以后有我在，伤口不用怕。"', 'purple');
            LG.TapSDK.trackEvent('recruit_aishi', {});
          } },
          { label: '再想想', cb: () => {} },
        ]);
    },

    /* ---------- 宠物 ---------- */
    adoptModal() {
      const s = LG.State.s;
      if (!this.pet) return;
      const pcfg = LG.CFG.PETS[this.zoneId];
      if (!pcfg) return;
      LG.UI.modal(pcfg.icon + ' 收养 · ' + pcfg.name,
        '<div class="desc">' + pcfg.name + '在废墟里游荡了很久。它看着你，没有跑。</div><br>' +
        '<div style="color:#9fd8b4;">特性：' + pcfg.buff + '</div><br>' +
        '带它回孤城吗？它会住在院子里。',
        [
          { label: '🐾 收养它', cls: 'primary', cb: () => {
            s.pets.push({ zone: this.zoneId, type: pcfg.type, name: pcfg.name });
            this.pet = null;
            LG.State.autosave();
            LG.Audio.sfx('harvest');
            LG.UI.toast(pcfg.icon + ' ' + pcfg.name + ' 跟你回了家。', 'purple');
            LG.TapSDK.trackEvent('pet_adopt', { zone: this.zoneId, type: pcfg.type });
            // 彩蛋结局：集齐全部 5 只宠物
            if (s.pets.length >= Object.keys(LG.CFG.PETS).length && !s.ending) {
              LG.State.autosave();
              setTimeout(() => {
                if (LG.State.s.ending) return;
                LG.UI.modal('🐾 宠物王朝？',
                  '<div class="desc">土狗、暹罗猫、乌鸦、仓鼠、变异兔——所有宠物都跟你回家了。</div><br>' +
                  '它们围着你，像是在等一个决定。<br>' +
                  '<div style="color:#9fd8b4;">是否决定在末日建立宠物王朝？</div>',
                  [
                    { label: '👑 建立宠物王朝（结局）', cls: 'primary', cb: () => LG.State.triggerEnding('pets') },
                    { label: '再等等，让它们陪我再走一段', cb: () => { LG.UI.toast('它们不急。你也不急。', ''); } },
                  ]);
              }, 900);
            }
          } },
          { label: '让它继续流浪', cb: () => {} },
        ]);
    },

    /* ---------- 撤离 / 死亡 ---------- */
    extract() {
      const s = LG.State.s;
      const items = Object.keys(this.lootGained);
      let summary = '';
      if (items.length === 0) summary = '你空着手回来了。至少你还活着。';
      else {
        summary = items.map(id => LG.CFG.ITEMS[id].icon + ' ' + LG.CFG.ITEMS[id].name + ' ×' + this.lootGained[id]).join('，');
        summary = '带回了：' + summary;
      }
      // 未收养宠物提醒
      let petWarn = '';
      if (this.pet) {
        petWarn = '<div class="need" style="margin-top:8px;">⚠️ 本区域还有一只宠物（' + this.pet.icon + this.pet.name + '）没有收养</div>';
      }
      LG.UI.modal('撤离点',
        '<div style="line-height:2;">你走到了撤离点。\n' + summary + petWarn + '</div>',
        [
          { label: '🚪 撤离，回到院子（度过一天）', cls: 'primary', cb: () => {
            s.stats.scavenges++;
            LG.Save.addStats({ runs: 1, totalDays: 1 });
            LG.TapSDK.trackEvent('scavenge_extract', { zone: this.zoneId, loot: items.length });
            LG.State.passDay();
            LG.Audio.sfx('heal');
            LG.Scenes.go('base');
          } },
          { label: '✋ 再搜一会儿（取消撤离）', cb: () => {
            LG.UI.toast('你决定再搜一会儿。', '');
          } },
        ]);
    },

    die() {
      const s = LG.State.s;
      s.stats.deaths++;
      LG.TapSDK.trackEvent('scavenge_death', { zone: this.zoneId, day: s.day });
      // 丢失 60% 携带物品
      const bagIds = Object.keys(s.bag).filter(id => s.bag[id] > 0);
      const toLose = Math.floor(bagIds.length * LG.CFG.BAL.loseLootOnDeath);
      for (let i = 0; i < toLose; i++) {
        const id = bagIds[Math.floor(Math.random() * bagIds.length)];
        if (id === s.weapon || id === 'diary') continue; // 武器和日记不丢
        LG.State.removeItem(id, 1);
      }
      s.hp = 25;
      s.energy = 30;
      LG.State.addInfection(10);
      LG.UI.modal('你倒在了废墟里', '<div style="line-height:2;">视线模糊。你听见丧尸围拢过来的脚步声，它们没有碰你，只是低头看着你……\n\n再醒来时，你躺在院子的泥地上。身上的东西少了大半，伤口在疼，感染在加深。\n\n<strong>它们没有杀你。</strong>也许它们还记得，你也是它们的一部分。</div>', [
        { label: '挣扎着站起来', cls: 'primary', cb: () => {
          LG.State.passDay();
          LG.Audio.sfx('dead');
          LG.Scenes.go('base');
        } },
      ]);
    },

    updateCamera() {
      const w = window.innerWidth, h = window.innerHeight;
      let sx = 0, sy = 0;
      if (this.shakeT > 0) {
        sx = (Math.random() - 0.5) * this.shakeMag * (this.shakeT / 0.3);
        sy = (Math.random() - 0.5) * this.shakeMag * (this.shakeT / 0.3);
      }
      // 世界小于视口时居中（横屏适配）
      const minX = Math.min(0, this.worldW - w), maxX = Math.max(0, this.worldW - w);
      const minY = Math.min(0, this.worldH - h), maxY = Math.max(0, this.worldH - h);
      this.camX = LG.Utils.clamp(this.player.x - w / 2 + sx, minX, maxX);
      this.camY = LG.Utils.clamp(this.player.y - h / 2 + sy, minY, maxY);
    },

    shake(mag) {
      this.shakeMag = Math.max(this.shakeMag, mag);
      this.shakeT = 0.3;
    },

    float(x, y, text, color) {
      this.floats.push({ x, y, text, color: color || '#e8d9b8', life: 1.2 });
    },

    /* ---------- 渲染 ---------- */
    render(ctx, w, h) {
      const T = this.T;
      ctx.save();
      ctx.translate(-this.camX, -this.camY);

      this.renderTiles(ctx);
      // 出口
      this.renderExit(ctx);
      // 地面掉落
      for (const d of this.drops) {
        const it = LG.CFG.ITEMS[d.id];
        ctx.globalAlpha = Math.min(1, (30 - d.age) / 8);
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(it.icon, d.x, d.y);
        ctx.globalAlpha = 1;
      }
      // 箱柜
      for (const l of this.loots) l.render(ctx, this.t);
      // 丧尸
      for (const z of this.zombies) if (z.alive) z.render(ctx, this.t);
      // 随从（异能大丧尸）
      for (const f of this.followers) {
        if (f.alive) f.render(ctx, this.t, { showName: true });
      }
      // 驯养丧尸随从
      for (const tf of this.tamedFollowers) this.renderTamedFollower(ctx, tf);
      // 宠物
      if (this.pet) this.renderPet(ctx);
      // 敌对人类
      for (const h of this.humans) if (h.alive) h.render(ctx, this.t);
      // 艾巳
      if (this.aiShi) this.renderAiShi(ctx);
      // 玩家
      LG.Entities.Draw.player(ctx, this.player, this.t);
      // 飘字
      for (const f of this.floats) {
        ctx.globalAlpha = Math.min(1, f.life);
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, f.y);
        ctx.globalAlpha = 1;
      }
      // 粒子
      this.particles.render(ctx);
      // 子弹
      for (const b of this.bullets) b.render(ctx);
      // 战争迷雾（盖住未探索房间，之后用光照"挖开"）
      this.renderFog(ctx);
      // 交互提示
      const hint = this.findInteractable();
      if (hint) {
        const bob = Math.sin(this.t * 3) * 4;
        let hx, hy, label;
        if (hint.kind === 'exit') { hx = this.exit.x; hy = this.exit.y - 40; label = '撤离'; }
        else if (hint.kind === 'pet') { hx = this.pet.x; hy = this.pet.y - 26; label = '收养 ' + this.pet.name; }
        else if (hint.kind === 'aishi') { hx = this.aiShi.x; hy = this.aiShi.y - 26; label = '对话（可招募）'; }
        else if (hint.kind === 'tame') {
          hx = hint.obj.x; hy = hint.obj.y - 26;
          label = '驯服 ' + Math.round(LG.State.tamedChance() * 100) + '%';
        }
        else { hx = hint.obj.x; hy = hint.obj.y - 26; label = '搜索'; }
        ctx.fillStyle = 'rgba(232,178,106,0.9)';
        ctx.font = '15px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('✋', hx, hy + bob);
        ctx.font = '11px sans-serif';
        ctx.fillStyle = 'rgba(230,235,230,0.8)';
        ctx.fillText(label, hx, hy - 8 + bob);
      }

      ctx.restore();

      // 光照（废墟更暗）
      this.renderLight(ctx, w, h);
      // 天气
      this.renderWeather(ctx, w, h);
      // 暗角
      const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.8);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.62)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);
      // 通道强光（最显眼：画在光照之上，永远醒目）
      this.renderPassageGlow(ctx, w, h);

      // 区域标题
      if (this.introTimer > 0) {
        ctx.globalAlpha = Math.min(1, this.introTimer);
        ctx.fillStyle = 'rgba(230,235,230,0.9)';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(this.introText, w / 2, h * 0.22);
        ctx.globalAlpha = 1;
      }
      // 出口方向指示（探索过半后）
      if (this.explored >= this.rooms.length * 0.5) {
        const ex = this.exit.x - this.player.x, ey = this.exit.y - this.player.y;
        const ang = Math.atan2(ey, ex);
        const ax = w / 2 + Math.cos(ang) * 60, ay = h * 0.14 + Math.sin(ang) * 20;
        ctx.save();
        ctx.translate(w / 2, h * 0.14);
        ctx.rotate(ang);
        ctx.fillStyle = 'rgba(159,216,180,0.55)';
        ctx.beginPath();
        ctx.moveTo(34, 0); ctx.lineTo(20, -7); ctx.lineTo(20, 7);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = 'rgba(159,216,180,0.5)';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('出口', w / 2, h * 0.14 + 16);
      }
    },

    renderTiles(ctx) {
      const T = this.T;
      const rnd = LG.Utils.mulberry32(this.zoneId.length * 131 + LG.State.s.day * 7);
      const x0 = Math.max(0, Math.floor(this.camX / T) - 1);
      const x1 = Math.min(this.gw, Math.ceil((this.camX + window.innerWidth) / T) + 1);
      const y0 = Math.max(0, Math.floor(this.camY / T) - 1);
      const y1 = Math.min(this.gh, Math.ceil((this.camY + window.innerHeight) / T) + 1);
      for (let ty = y0; ty < y1; ty++) {
        for (let tx = x0; tx < x1; tx++) {
          const tile = this.grid[ty][tx];
          if (tile === 1) {
            // 墙
            ctx.fillStyle = '#23262a';
            ctx.fillRect(tx * T, ty * T, T, T);
            ctx.strokeStyle = 'rgba(0,0,0,0.4)';
            ctx.lineWidth = 1;
            ctx.strokeRect(tx * T + 1, ty * T + 1, T - 2, T - 2);
            // 砖缝
            ctx.strokeStyle = 'rgba(90,95,100,0.25)';
            ctx.beginPath();
            ctx.moveTo(tx * T, ty * T + T / 2); ctx.lineTo(tx * T + T, ty * T + T / 2);
            ctx.moveTo(tx * T + T / 2, ty * T); ctx.lineTo(tx * T + T / 2, ty * T + T / 2);
            ctx.stroke();
          } else {
            const room = this.roomOfTile(tx, ty);
            let base = '#191d1c';
            if (room) base = '#171b1a';
            const v = rnd();
            ctx.fillStyle = v > 0.5 ? base : '#151918';
            ctx.fillRect(tx * T, ty * T, T, T);
            // 地面细节
            if (v < 0.06) {
              ctx.fillStyle = 'rgba(120,110,100,0.12)';
              ctx.fillRect(tx * T + 8 + v * 30, ty * T + 10, 4, 3);
            } else if (v > 0.94) {
              ctx.fillStyle = 'rgba(90,80,70,0.15)';
              ctx.beginPath();
              ctx.arc(tx * T + 12 + v * 10, ty * T + 12, 2, 0, Math.PI * 2);
              ctx.fill();
            }
            // 区域色调
            if (room) {
              const tint = this.zone.color;
              ctx.fillStyle = tint;
              ctx.globalAlpha = 0.035;
              ctx.fillRect(tx * T, ty * T, T, T);
              ctx.globalAlpha = 1;
            }
            // 科研所最深处：紫色呼吸光
            if (this.deepRoom && room === this.deepRoom) {
              const glow = 0.1 + 0.07 * Math.sin(this.t * 2 + tx + ty);
              ctx.fillStyle = 'rgba(167,90,217,' + glow + ')';
              ctx.fillRect(tx * T, ty * T, T, T);
              // 中央光柱
              if (tx === Math.floor((this.deepRoom.x0 + this.deepRoom.x1) / 2) && ty === Math.floor((this.deepRoom.y0 + this.deepRoom.y1) / 2)) {
                ctx.fillStyle = 'rgba(200,150,255,0.25)';
                ctx.fillRect(tx * T + 6, ty * T + 6, T - 12, T - 12);
              }
            }
          }
        }
      }
      // 房间之间的通道：亮黄色地面 + 脉冲光（让通路非常显眼）
      for (const [dx, dy] of this.doorTiles) {
        const px0 = dx * T, py0 = dy * T;
        ctx.fillStyle = '#d9b44a';
        ctx.fillRect(px0 + 2, py0 + 2, T - 4, T - 4);
        ctx.fillStyle = '#f2dd8a';
        ctx.fillRect(px0 + 6, py0 + 6, T - 12, T - 12);
        // 脉冲微光（呼吸感）
        const pulse = 0.14 + 0.1 * Math.sin(this.t * 2.4 + dx * 2 + dy);
        ctx.fillStyle = 'rgba(242,221,138,' + pulse + ')';
        ctx.fillRect(px0, py0, T, T);
      }
    },

    renderTamedFollower(ctx, tf) {
      const bob = Math.sin(tf.bob * 2) * 1.5;
      const x = tf.x, y = tf.y + bob;
      const zc = LG.CFG.ZOMBIES[tf.ref.type] || LG.CFG.ZOMBIES.walker;
      const r = 10;
      LG.Entities.Draw.shadow(ctx, tf.x, tf.y + 10, 10);
      // 特殊丧尸随从保留专属外观
      let bodyColor = '#5a665e';
      if (tf.ref.type === 'drowner') bodyColor = '#3a6a72';
      if (tf.ref.type === 'mistwalker') bodyColor = '#a8b0b8';
      if (tf.ref.type === 'gale') bodyColor = '#9a9aa8';
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
      const ex = Math.cos(tf.dir), ey = Math.sin(tf.dir);
      ctx.fillStyle = '#c8d2c0';
      ctx.beginPath(); ctx.arc(x + ex * 5 - 4, y + ey * 5 - 2, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + ex * 5 + 4, y + ey * 5 - 2, 2, 0, Math.PI * 2); ctx.fill();
      // 名字
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(220,230,225,0.6)';
      ctx.fillText(zc.icon + ' ' + tf.ref.name, x, y - r - 6);
    },

    /* 通道强光：在光照与迷雾之上叠加亮黄色呼吸光，保证通道永远醒目 */
    renderPassageGlow(ctx, w, h) {
      const T = this.T;
      for (const [tx, ty] of this.doorTiles) {
        if (this.isFoggedTile(tx, ty)) continue;   // 未探索区域不显示
        const sx = tx * T - this.camX, sy = ty * T - this.camY;
        if (sx < -T || sx > w + T || sy < -T || sy > h + T) continue;
        const cx = sx + T / 2, cy = sy + T / 2;
        const pulse = 0.5 + 0.3 * Math.sin(this.t * 2.6 + tx * 2 + ty);
        // 亮黄光晕
        const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, T * 1.15);
        g.addColorStop(0, 'rgba(242,221,138,' + (0.5 * pulse) + ')');
        g.addColorStop(1, 'rgba(242,221,138,0)');
        ctx.fillStyle = g;
        ctx.fillRect(sx - T, sy - T, T * 3, T * 3);
        // 亮黄地面
        ctx.fillStyle = '#f2dd8a';
        ctx.fillRect(sx + 3, sy + 3, T - 6, T - 6);
      }
    },

    renderFog(ctx) {
      const T = this.T;
      // 用 evenodd 填充"带洞矩形"：全图黑雾，已探索房间（外扩 2 格揭示走廊与房门）为洞
      ctx.beginPath();
      ctx.rect(0, 0, this.worldW, this.worldH);
      const pad = 2 * T;
      for (const r of this.rooms) {
        if (!r.explored) continue;
        ctx.rect(
          Math.max(0, r.x0 * T - pad),
          Math.max(0, r.y0 * T - pad),
          (r.x1 - r.x0 + 1) * T + pad * 2,
          (r.y1 - r.y0 + 1) * T + pad * 2
        );
      }
      ctx.fillStyle = 'rgba(4,6,8,0.97)';
      ctx.fill('evenodd');
    },

    renderExit(ctx) {
      const e = this.exit;
      const pulse = 0.6 + 0.3 * Math.sin(this.t * 2.4);
      ctx.fillStyle = 'rgba(120,220,160,' + pulse * 0.25 + ')';
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + Math.sin(this.t * 2) * 4, 0, Math.PI * 2);
      ctx.fill();
      // 门框
      ctx.strokeStyle = 'rgba(120,220,160,0.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect(e.x - 20, e.y - 26, 40, 52);
      ctx.fillStyle = 'rgba(60,120,90,0.5)';
      ctx.fillRect(e.x - 20, e.y - 26, 40, 52);
      ctx.fillStyle = 'rgba(220,255,235,0.9)';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('出口', e.x, e.y + 40);
    },

    renderPet(ctx) {
      const pet = this.pet;
      const bob = Math.sin(pet.bob * 2) * 2;
      const x = pet.x, y = pet.y + bob;
      LG.Entities.Draw.shadow(ctx, pet.x, pet.y + 10, 9);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(pet.dir);
      // 简单宠物形象：圆身体 + 头 + 耳朵
      ctx.fillStyle = '#b8a878';
      if (pet.type === 'crow') ctx.fillStyle = '#3a3a44';
      if (pet.type === 'rabbit') ctx.fillStyle = '#d8d0c0';
      if (pet.type === 'hamster') ctx.fillStyle = '#c9a86a';
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(7, -3, 4.5, 0, Math.PI * 2);
      ctx.fill();
      // 耳朵
      ctx.beginPath();
      if (pet.type === 'rabbit') {
        ctx.moveTo(5, -7); ctx.lineTo(6, -13); ctx.lineTo(8, -7); ctx.fill();
        ctx.moveTo(9, -7); ctx.lineTo(11, -13); ctx.lineTo(12, -7); ctx.fill();
      } else if (pet.type === 'crow') {
        ctx.beginPath(); ctx.moveTo(11, -5); ctx.lineTo(17, -6); ctx.lineTo(11, -1); ctx.fill();
      } else {
        ctx.moveTo(5, -7); ctx.lineTo(6.5, -11); ctx.lineTo(8, -7); ctx.fill();
        ctx.moveTo(8, -7); ctx.lineTo(10, -11); ctx.lineTo(11, -7); ctx.fill();
      }
      // 眼
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath(); ctx.arc(8, -3.5, 1.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(11, -3.5, 1.2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // 名字
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(220,230,225,0.6)';
      ctx.fillText(pet.icon + ' ' + pet.name, x, y - 16);
    },

    renderAiShi(ctx) {
      const a = this.aiShi;
      const bob = Math.sin(a.bob * 2) * 2;
      const x = a.x, y = a.y + bob;
      LG.Entities.Draw.shadow(ctx, a.x, a.y + 10, 9);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a.dir);
      // 身体（白大褂感）
      ctx.fillStyle = '#c8d0c8';
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // 医药箱
      ctx.fillStyle = '#e04830';
      ctx.fillRect(-12, -3, 7, 7);
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(-12, -1.5, 7, 1.5);
      // 头
      ctx.fillStyle = '#d8b888';
      ctx.beginPath();
      ctx.arc(7, -4, 4.5, 0, Math.PI * 2);
      ctx.fill();
      // 发
      ctx.fillStyle = '#4a3a2a';
      ctx.beginPath();
      ctx.arc(7, -5.5, 4.5, Math.PI, Math.PI * 2);
      ctx.fill();
      // 眼
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath(); ctx.arc(8, -4, 1.1, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(10.5, -4, 1.1, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(200,220,210,0.75)';
      ctx.fillText('👩 艾巳（可招募）', x, y - 16);
    },

    renderLight(ctx, w, h) {
      // 径向渐变"挖洞"：玩家周围亮，远处暗（不用 destination-out，避免底色被擦掉）
      const px = this.player.x - this.camX, py = this.player.y - this.camY;
      const s = LG.State.s;
      const fog = s && s.weather === 'fog';
      // 灯笼/火把/雾纱披风：扩大视野
      const lantern = (s && (s.bag.lantern || 0) > 0) ? 130 : 0;
      const torch = (s && (s.bag.torch || 0) > 0) ? 80 : 0;
      const eqVision = (LG.State && LG.State.equipBonus) ? LG.State.equipBonus('vision') : 0;
      const radius = (fog ? 165 : 300) + lantern + torch + eqVision;
      const g = ctx.createRadialGradient(px, py, 30, px, py, radius);
      g.addColorStop(0, 'rgba(5,8,12,0)');
      g.addColorStop(0.5, 'rgba(5,8,12,' + (fog ? 0.55 : 0.42) + ')');
      g.addColorStop(1, 'rgba(5,8,12,' + (fog ? 0.88 : 0.8) + ')');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      // 灯笼微光
      if (lantern) {
        const lg = ctx.createRadialGradient(px, py, 20, px, py, 90);
        lg.addColorStop(0, 'rgba(232,180,90,0.12)');
        lg.addColorStop(1, 'rgba(232,180,90,0)');
        ctx.fillStyle = lg;
        ctx.fillRect(0, 0, w, h);
      }
      // 出口微光
      const eg = ctx.createRadialGradient(this.exit.x - this.camX, this.exit.y - this.camY, 10, this.exit.x - this.camX, this.exit.y - this.camY, 110);
      eg.addColorStop(0, 'rgba(120,220,160,0.18)');
      eg.addColorStop(1, 'rgba(120,220,160,0)');
      ctx.fillStyle = eg;
      ctx.fillRect(0, 0, w, h);
    },

    renderWeather(ctx, w, h) {
      const s = LG.State.s;
      if (s.weather === 'rain') {
        ctx.strokeStyle = 'rgba(140,160,190,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const r of this.rainDrops) {
          ctx.moveTo(r.x * w, r.y * h);
          ctx.lineTo(r.x * w - 3, r.y * h + r.l);
        }
        ctx.stroke();
      } else if (s.weather === 'wind' || s.weather === 'overcast') {
        ctx.fillStyle = 'rgba(180,170,140,0.16)';
        for (const l of this.leaves) {
          ctx.save();
          ctx.translate(l.x * w, l.y * h);
          ctx.rotate(l.ph + this.t);
          ctx.fillRect(-2, -1, 4, 2);
          ctx.restore();
        }
      } else if (s.weather === 'fog') {
        // 雾：底部更浓的流动雾层
        const g = ctx.createLinearGradient(0, h * 0.45, 0, h);
        g.addColorStop(0, 'rgba(150,160,170,0)');
        g.addColorStop(1, 'rgba(150,160,170,0.22)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        // 流动雾团
        ctx.fillStyle = 'rgba(160,170,180,0.05)';
        for (let i = 0; i < 4; i++) {
          const fx = ((this.t * (6 + i * 2) + i * 190) % (w + 300)) - 150;
          const fy = h * (0.55 + (i % 2) * 0.2);
          ctx.beginPath();
          ctx.ellipse(fx, fy, 160 + i * 40, 30, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
  };

  LG.Scenes = LG.Scenes || {};
  LG.Scenes.scavenge = Scavenge;
})();
