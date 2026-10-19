/* ============================================================
 * 主游戏逻辑 - 状态机 / 波次 / 输入 / 渲染 / UI
 * ============================================================ */
(function (root) {
  'use strict';
  const GardenGame = root.GardenGame || (root.GardenGame = {});
  const VIEW = GardenGame.V, FIELD = GardenGame.FIELD, UI = GardenGame.UI;
  const rr = GardenGame.rr, ell = GardenGame.ell, dot = GardenGame.dot;

  const FONT = GardenGame.FONT;

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function inRect(x, y, r) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }
  function ellPath(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  }

  class Game {
    constructor(canvas) {
      this.canvas = canvas || null;
      this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
      this.audio = new GardenGame.Audio();
      this.state = 'menu';            // menu | playing | paused | win | over
      this.diffKey = 'normal';
      this.diff = GardenGame.DIFFICULTIES.normal;
      this.mouse = { x: -99, y: -99 };
      this.selected = null;
      this.shovelMode = false;
      this.time = 0;
      this.rnd = Math.random;
      /* 交互反馈状态 */
      this.hoverUI = null;            // 悬停的卡片/按钮 id
      this.pressUI = null;            // 按下的按钮
      this.cardErr = null;            // { key, t } 卡片出错抖动
      this.sunBounce = 0;             // 阳光罐回弹
      this.reduced = GardenGame.reducedMotion();
      this.dpr = 1;
      this.debugGrid = false;
      if (this.canvas) this.setupCanvas();
      this.resetCommon();
      this.genGrass();
      this.addDecor();
      if (this.canvas) {
        this.bind();
        this.bg = GardenGame.buildBackground();   // 静态场景兜底(只建一次, 图片加载失败时使用)
        this.amb = GardenGame.buildAmbient();
      }
      /* 手绘背景大图( assets/backgrounds/lawn.jpg, 与逻辑网格对齐 );
       * 预加载复用, 不在每帧创建; 加载中/失败时回落到程序化场景 */
      this.bgReady = false;
      this.bgImg = null;
      if (typeof Image === 'function') {
        const img = new Image();
        img.onload = () => {
          this.bgImg = img;
          this.bgCalibrated = GardenGame.calibrateBackground(img);
          this.bgReady = true;
        };
        img.src = GardenGame.BACKGROUND.src;
      }
      if (typeof document !== 'undefined') this.bindOverlay();
      this.showOverlay('menu');
      this._tick = this._tick.bind(this);
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(this._tick);
    }

    /* 高分屏: 逻辑坐标固定 1000x620, 实际像素 = 逻辑x dpr */
    setupCanvas() {
      const cv = this.canvas;
      const fit = () => {
        const dpr = Math.max(1, Math.min(3, root.devicePixelRatio || 1));
        const w = Math.round(VIEW.W * dpr), h = Math.round(VIEW.H * dpr);
        if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
        this.dpr = dpr;
      };
      fit();
      if (typeof root.addEventListener === 'function') root.addEventListener('resize', fit);
    }

    /* ---------- 生命周期 ---------- */
    resetCommon() {
      this.plants = [];
      this.zombies = [];
      this.peas = [];
      this.suns = [];
      this.particles = [];
      this.mowers = [];
      for (let r = 0; r < FIELD.rows; r++) this.mowers.push(new GardenGame.Mower(r));
      this.cds = {};
      for (const k in GardenGame.PLANTS) this.cds[k] = 0;
      this.sunCount = 0;
      this.stats = { kills: 0, sun: 0, t: 0 };
      this.shake = 0;
      this.banner = null;
      this.sunTimer = 5;
      this.spawnQueue = [];
      this.wave = 0;
      this.waveTimer = 0;
      this.time = 0;
      this.et = 0;          // 战斗时间: 仅 playing 时推进, 驱动实体序列帧(暂停即冻结)
      this.sunFlash = 0;
      this.sunBounce = 0;
      this.cardErr = null;
      this.selected = null;
      this.shovelMode = false;
    }
    genGrass() {
      const rnd = mulberry32(20240617);
      this.blades = [];
      for (let i = 0; i < 170; i++) {
        this.blades.push({
          x: FIELD.x + rnd() * (FIELD.right - FIELD.x),
          y: FIELD.y + rnd() * (FIELD.bottom - FIELD.y),
          h: 4 + rnd() * 5,
          p: rnd() * 6.28,
          c: rnd() < 0.5 ? 'rgba(255,255,255,.14)' : 'rgba(0,40,0,.10)'
        });
      }
      this.flowers = [];
      for (let i = 0; i < 16; i++) {
        this.flowers.push({
          x: FIELD.x + 14 + rnd() * (FIELD.right - FIELD.x - 28),
          y: FIELD.y + 14 + rnd() * (FIELD.bottom - FIELD.y - 28),
          c: ['#ff8fa3', '#ffd23f', '#f2f2f2', '#c9a0ff'][Math.floor(rnd() * 4)]
        });
      }
    }
    newGame(diffKey) {
      this.diffKey = diffKey;
      this.diff = GardenGame.DIFFICULTIES[diffKey];
      this.resetCommon();
      this.genGrass();
      this.sunCount = this.diff.startSun;
      this.state = 'playing';
      this.selected = null;
      this.shovelMode = false;
      this.waveTimer = GardenGame.WAVES.prepFirst;
      this.audio.ensure();
      this.audio.play('start');
      this.showOverlay(null);
    }
    goMenu() {
      this.state = 'menu';
      this.resetCommon();
      this.genGrass();
      this.addDecor();
      this.showOverlay('menu');
    }
    /* 主菜单背景装饰 */
    addDecor() {
      const demo = [['sunflower', 0, 2], ['sunflower', 1, 0], ['sunflower', 2, 1], ['peashooter', 3, 3], ['peashooter', 4, 4], ['snowpea', 3, 2], ['wallnut', 4, 0], ['repeater', 2, 4]];
      for (const [k, c, r] of demo) this.plants.push(new GardenGame.Plant(k, c, r, this));
      this.decorZombie = new GardenGame.Zombie('normal', 3, this);
      this.decorZombie.x = 880;
    }
    setPaused(v) {
      if (this.state === 'playing' && v) { this.state = 'paused'; this.showOverlay('paused'); }
      else if (this.state === 'paused' && !v) { this.state = 'playing'; this.showOverlay(null); }
    }
    togglePause() {
      if (this.state === 'playing') this.setPaused(true);
      else if (this.state === 'paused') this.setPaused(false);
    }
    win() {
      if (this.state !== 'playing') return;
      this.state = 'win';
      this.audio.play('win');
      for (let i = 0; i < 80; i++) {
        this.particles.push(new GardenGame.Particle(30 + this.rnd() * 940, this.rnd() * 200,
          40 + this.rnd() * 80, 60 + this.rnd() * 120, 3, ['#ffd23f', '#ff8fa3', '#8ed45f', '#7fd4e8'][Math.floor(this.rnd() * 4)], 4, 120, 'dot'));
      }
      this.showOverlay('win');
    }
    lose() {
      if (this.state !== 'playing') return;
      this.state = 'over';
      this.audio.play('lose');
      this.showOverlay('over');
    }

    /* ---------- 主循环 ---------- */
    _tick(ts) {
      const now = ts || 0;
      if (!this._last) this._last = now;
      let dt = (now - this._last) / 1000;
      this._last = now;
      if (dt > 0.05) dt = 0.05;
      if (dt > 0) this.update(dt);
      this.draw();
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(this._tick);
    }

    update(dt) {
      /* 氛围时间: 菜单/暂停界面的动画也走 */
      this.time += dt;
      /* 战斗时间: 驱动植物/小推车序列帧, 非 playing 一律冻结 */
      if (this.state === 'playing') this.et += dt;
      this.shake = Math.max(0, this.shake - dt * 30);
      this.sunFlash = Math.max(0, this.sunFlash - dt);
      this.sunBounce = Math.max(0, this.sunBounce - dt);
      if (this.cardErr) { this.cardErr.t -= dt; if (this.cardErr.t <= 0) this.cardErr = null; }
      if (this.pressUI) { this.pressUI.t -= dt; if (this.pressUI.t <= 0) this.pressUI = null; }
      /* 主菜单巡逻僵尸 */
      if (this.state === 'menu' && this.decorZombie) {
        const z = this.decorZombie;
        z.x -= z.speed * dt;
        z.walkPhase += dt * z.speed * 0.12;
        if (z.x < 470) z.x = GardenGame.ZOMBIE_SPAWN_X + 60;
      }
      this.updateParticles(dt);
      if (this.state !== 'playing') return;
      /* ---- 以下游戏状态, 暂停即冻结 ---- */
      this.stats.t += dt;
      if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }
      for (const k in this.cds) { if (this.cds[k] > 0) this.cds[k] = Math.max(0, this.cds[k] - dt); }

      /* -- 阳光(天空) -- */
      this.sunTimer -= dt;
      if (this.sunTimer <= 0) {
        const range = this.diff.sunFall;
        this.sunTimer = range[0] + this.rnd() * (range[1] - range[0]);
        const sx = 140 + this.rnd() * 700;
        this.suns.push(new GardenGame.Sun(sx, -20, 25, 'sky', this, 100 + this.rnd() * 430));
      }

      /* -- 波次调度 -- */
      if (this.wave < GardenGame.WAVES.total) {
        this.waveTimer -= dt;
        if (this.waveTimer <= 0) this.startWave();
      } else if (this.spawnQueue.length === 0 && this.zombies.length === 0) {
        this.win();
        return;
      }
      this.drainQueue();

      /* -- 实体 -- */
      for (const p of this.plants) p.update(dt, this);
      for (const z of this.zombies) z.update(dt, this);
      for (const pe of this.peas) pe.update(dt, this);
      for (const s of this.suns) s.update(dt, this);
      for (const m of this.mowers) m.update(dt, this);

      /* -- 防线判定 -- */
      for (const z of this.zombies) {
        if (z.dying) continue;
        if (z.front <= FIELD.x + 6) {          // 僵尸压到小推车即触发
          const m = this.mowers[z.row];
          if (m.state === 'idle') {
            m.state = 'run';
            this.audio.play('mower');
            this.shake = 7;
          }
        }
        if (z.front <= -12) { this.lose(); return; }
      }

      /* -- 清理 -- */
      this.plants = this.plants.filter(p => !p.dead || p.deathT > 0);
      this.zombies = this.zombies.filter(z => !(z.dying && z.dyingT <= 0));
      this.peas = this.peas.filter(pe => !pe.dead);
      this.suns = this.suns.filter(s => !s.dead);
      this.particles = this.particles.filter(pt => !pt.dead);
    }

    /* ---------- 波次 ---------- */
    pickType() {
      const w = this.wave;
      const pool = [];
      const add = (t, n) => { for (let i = 0; i < n; i++) pool.push(t); };
      add('normal', 12);
      if (w >= 3) add('conehead', w >= 8 ? 7 : 3);
      if (w >= 5) add('buckethead', w >= 9 ? 3 : 1);
      if (w >= 7) add('polevault', 3);
      if (w >= 9) add('newspaper', 4);
      if (w >= 12) add('football', w >= 16 ? 3 : 1);
      return pool[Math.floor(this.rnd() * pool.length)];
    }
    startWave() {
      this.wave++;
      const W = GardenGame.WAVES;
      const huge = W.huge.indexOf(this.wave) >= 0;
      const count = Math.max(1, Math.round((2 + this.wave * 0.55) * this.diff.countMul * (huge ? W.hugeMul : 1)));
      const list = [];
      for (let i = 0; i < count; i++) list.push(this.pickType());
      if (huge) list.unshift('flag');
      const spread = huge ? 4.2 : 7;
      let t = this.time + 0.2;
      for (const type of list) {
        this.spawnQueue.push({ t: t, type: type });
        t += spread * (0.4 + this.rnd() * 0.9);
      }
      this.waveTimer = huge ? W.hugeBreak : this.diff.waveInt;
      if (huge) {
        this.setBanner('一大波僵尸正在接近！', '#ff5a4a', 3.2);
        this.audio.play('huge');
        this.shake = 8;
      } else if (this.wave === W.total) {
        this.setBanner('最终一波，守住草坪！', '#ffb03a', 2.4);
      } else if (this.wave === 1) {
        this.setBanner('僵尸来了！', '#8ed45f', 1.6);
      }
    }
    drainQueue() {
      this.spawnQueue.sort((a, b) => a.t - b.t);
      while (this.spawnQueue.length && this.spawnQueue[0].t <= this.time) {
        const e = this.spawnQueue.shift();
        this.spawnZombie(e.type);
      }
    }
    spawnZombie(type) {
      const row = Math.floor(this.rnd() * FIELD.rows);
      const z = new GardenGame.Zombie(type, row, this);
      this.zombies.push(z);
      if (this.rnd() < 0.3) this.audio.play('groan');
    }

    /* ---------- 游戏行为 ---------- */
    spawnPea(row, x, y, dmg, speed, ice) {
      this.peas.push(new GardenGame.Pea(row, x, y, dmg, speed, ice));
    }
    spawnPlantSun(plant) {
      this.suns.push(new GardenGame.Sun(plant.x, plant.y - 58, 25, 'plant', this));
    }
    puff(x, y, color, n) {
      for (let i = 0; i < n; i++) {
        const a = this.rnd() * 6.28;
        const v = 40 + this.rnd() * 90;
        this.particles.push(new GardenGame.Particle(x, y, Math.cos(a) * v, Math.sin(a) * v - 40, 0.5 + this.rnd() * 0.4, color, 2.5 + this.rnd() * 2.5, 320, 'dot'));
      }
    }
    floatText(text, x, y, color, font) {
      this.particles.push(new GardenGame.Particle(x, y, 0, -38, 1.1, color || '#fff', 0, 0, 'text', font, text));
    }
    setBanner(text, color, dur) {
      this.banner = { text: text, color: color || '#fff', t: dur || 2, max: dur || 2 };
    }
    explode(cx, row, col, dmg, radius) {
      if(GardenGame.emitBlast)GardenGame.emitBlast(this,cx,GardenGame.rowFeet(row)-28,radius>=1?'cherry':'potato');
      for (const z of this.zombies) {
        if (z.dying) continue;
        if (Math.abs(z.row - row) <= radius && (radius >= 1 ? Math.abs(z.x - cx) <= 142 : z.front <= cx + 62 && z.x + 26 >= cx - 62 && !(z.vaultT > 0))) {
          z.takeDamage(dmg, this, false);
        }
      }
      const y = GardenGame.rowFeet(row) - 34;
      this.particles.push(new GardenGame.Particle(cx, y, 0, 0, 0.5, '#ffcf6b', 30, 0, 'ring'));
      for (let i = 0; i < 16; i++) {
        const a = this.rnd() * 6.28, v = 80 + this.rnd() * 160;
        this.particles.push(new GardenGame.Particle(cx, y, Math.cos(a) * v, Math.sin(a) * v, 0.5 + this.rnd() * 0.3,
          ['#ffb03a', '#ff6b4a', '#ffe98a'][Math.floor(this.rnd() * 3)], 3 + this.rnd() * 3.5, 200, 'dot'));
      }
      for (let i = 0; i < 8; i++) {
        this.particles.push(new GardenGame.Particle(cx + (this.rnd() - 0.5) * 60, y + (this.rnd() - 0.5) * 40, 20 - this.rnd() * 40, -40 - this.rnd() * 30, 1.2, '#9b9b9b', 5, -20, 'smoke'));
      }
      this.shake = 11;
      this.audio.play('explode');
    }
    collectSun(s) {
      if (s.dead || s.collectT > 0) return;
      s.collectT = 0.55;
      this.sunCount += s.value;
      this.stats.sun += s.value;
      this.floatText('+' + s.value, s.x, s.y - 14, '#ffe98a', 'bold 17px ' + FONT);
      this.audio.play('sun');
      for (let i = 0; i < 5; i++) {
        const a = this.rnd() * 6.28, v = 30 + this.rnd() * 60;
        this.particles.push(new GardenGame.Particle(s.x, s.y, Math.cos(a) * v, Math.sin(a) * v, 0.4, '#ffe98a', 2.4, 0, 'dot'));
      }
    }

    /* ---------- 查询 ---------- */
    cellAt(x, y) {
      const col = Math.floor((x - FIELD.x) / FIELD.cellW);
      const row = Math.floor((y - FIELD.y) / FIELD.cellH);
      if (col < 0 || col >= FIELD.cols || row < 0 || row >= FIELD.rows) return null;
      return { col: col, row: row };
    }
    plantAt(col, row) {
      for (const p of this.plants) if (!p.dead && p.col === col && p.row === row) return p;
      return null;
    }
    zombieTouchesPlant(z, p) {
      return !z.dying && !(z.vaultT > 0) && z.row === p.row
        && z.front <= p.x + 42 && z.front >= p.x - 50;
    }
    plantAtFront(z) {
      for (const p of this.plants) {
        if (p.dead || p.row !== z.row) continue;
        if (this.zombieTouchesPlant(z, p)) return p;
      }
      return null;
    }
    plantAhead(z) {
      let best = null;
      for (const p of this.plants) {
        if (p.dead || p.row !== z.row) continue;
        const d = z.x - p.x;
        if (d > 20 && d < 92 && (!best || p.x > best.x)) best = p;
      }
      return best;
    }
    zombieAhead(row, x) {
      for (const z of this.zombies) {
        if (z.dying || z.row !== row) continue;
        if (z.x > x - 10) return z;
      }
      return null;
    }
    zombieOnCell(col, row) {
      const cx = GardenGame.cellCX(col);
      for (const z of this.zombies) {
        if (z.dying || z.row !== row) continue;
        if (this.zombieTouchesPlant(z, { x: cx, row: row })) return z;
      }
      return null;
    }
    zombieHit(row, px) {
      let best = null;
      for (const z of this.zombies) {
        if (z.dying || z.row !== row) continue;
        if (px >= z.x - 18 && px <= z.x + 26 && (!best || z.x < best.x)) best = z;
      }
      return best;
    }

    /* ---------- 玩家操作 ---------- */
    tryPlant(key, col, row) {
      const def = GardenGame.PLANTS[key];
      const cx = GardenGame.cellCX(col), cy = GardenGame.rowFeet(row) - 24;
      const topY = GardenGame.rowTop(row) + 20;
      if (this.plantAt(col, row)) {
        this.audio.play('error');
        this.floatText('这里已经有植物了', cx, topY, '#ff9a8a', 'bold 14px ' + FONT);
        return;
      }
      if (this.cds[key] > 0) { this.audio.play('error'); return; }
      if (this.sunCount < def.cost) {
        this.audio.play('error');
        this.sunFlash = 0.8;
        this.floatText('阳光不足', cx, topY, '#ff6b5a', 'bold 15px ' + FONT);
        return;
      }
      this.sunCount -= def.cost;
      this.cds[key] = def.cd;
      const p = new GardenGame.Plant(key, col, row, this);
      p.pop = 1;                                  // 落地回弹
      this.plants.push(p);
      this.audio.play('plant');
      this.puff(cx, cy - 8, '#8a6b46', 6);
      this.particles.push(new GardenGame.Particle(cx, GardenGame.rowFeet(row) + 2, 0, 0, 0.5, '#7a5a36', 24, 0, 'ring'));
      this.floatText('-' + def.cost, cx, topY - 18, '#ffd9a0', 'bold 14px ' + FONT);
      this.selected = null;
    }
    digUp(col, row) {
      const p = this.plantAt(col, row);
      if (!p) return;
      p.dead = true;
      this.audio.play('shovel');
      this.puff(p.x, p.y - 16, '#cbb287', 10);
      this.particles.push(new GardenGame.Particle(p.x, GardenGame.rowFeet(p.row) + 2, 0, 0, 0.45, '#a98f63', 22, 0, 'ring'));
      this.floatText('已铲除', p.x, GardenGame.rowTop(p.row) + 20, '#e8d9b0', 'bold 13px ' + FONT);
    }
    cancelSelect() {
      this.selected = null;
      this.shovelMode = false;
    }
    selectPlant(key) {
      const def = GardenGame.PLANTS[key];
      if (this.cds[key] > 0) {
        this.audio.play('error');
        this.cardErr = { key: key, t: 0.35 };
        this.floatText('冷却中', GardenGame.cellCX(4), 120, '#cfe0ff', 'bold 13px ' + FONT);
        return;
      }
      if (this.sunCount < def.cost) {
        this.audio.play('error');
        this.cardErr = { key: key, t: 0.35 };
        this.sunFlash = 0.5;
        return;
      }
      this.selected = (this.selected === key) ? null : key;
      this.shovelMode = false;
      this.audio.play('select');
    }

    onPointerDown(x, y) {
      this.audio.ensure();
      if (y < GardenGame.BAR.h) { this.clickBar(x, y); return; }
      if (this.state !== 'playing') return;
      /* 阳光优先，扩大热区；重叠时选择距点击点最近的可收集阳光。 */
      let targetSun = null, bestDistance = Infinity;
      for (const s of this.suns) {
        if (s.dead || s.collectT > 0) continue;
        const visual = GardenGame.sunVisualPose(s, this.et);
        const distance = Math.hypot(visual.x - x, visual.y - y);
        if (distance <= GardenGame.SUN.hitRadius && distance < bestDistance) {
          targetSun = s; bestDistance = distance;
        }
      }
      if (targetSun) { this.collectSun(targetSun); return; }
      const c = this.cellAt(x, y);
      if (!c) return;
      if (this.shovelMode) {
        this.digUp(c.col, c.row);
        this.shovelMode = false;
        return;
      }
      if (this.selected) this.tryPlant(this.selected, c.col, c.row);
    }
    /* 返回悬停目标 id: 'plant:key' | 'shovel' | 'pause' | 'mute' | null */
    hitUI(x, y) {
      if (y >= GardenGame.BAR.h || y < 0) return null;
      if (inRect(x, y, UI.sunPanel)) return 'sun';
      for (let i = 0; i < GardenGame.PLANT_ORDER.length; i++) {
        if (inRect(x, y, GardenGame.packetRect(i))) return 'plant:' + GardenGame.PLANT_ORDER[i];
      }
      if (inRect(x, y, UI.shovel)) return 'shovel';
      if (inRect(x, y, UI.pause)) return 'pause';
      if (inRect(x, y, UI.mute)) return 'mute';
      return null;
    }
    onHover(x, y) {
      const id = this.hitUI(x, y);
      this.hoverUI = id;
      if (id) { this.canvas.style.cursor = 'pointer'; return; }
      const planting = this.state === 'playing' && (this.selected || this.shovelMode);
      this.canvas.style.cursor = planting ? 'crosshair' : 'default';
    }
    clickBar(x, y) {
      this.audio.ensure();
      if (inRect(x, y, UI.sunPanel)) return;
      GardenGame.PLANT_ORDER.forEach((key, i) => {
        if (inRect(x, y, GardenGame.packetRect(i))) {
          if (this.state === 'playing') { this.pressUI = { key: key, t: 0.12 }; this.selectPlant(key); }
        }
      });
      if (inRect(x, y, UI.shovel)) {
        if (this.state !== 'playing') return;
        this.shovelMode = !this.shovelMode;
        this.selected = null;
        this.pressUI = { key: 'shovel', t: 0.12 };
        this.audio.play('click');
      }
      if (inRect(x, y, UI.pause)) { if (this.state === 'playing' || this.state === 'paused') { this.pressUI = { key: 'pause', t: 0.12 }; this.togglePause(); } }
      if (inRect(x, y, UI.mute)) {
        this.pressUI = { key: 'mute', t: 0.12 };
        const m = this.audio.toggleMute();
        this.floatText(m ? '静音' : '音效开', UI.mute.x + UI.mute.w / 2, 100, '#fff', 'bold 15px ' + FONT);
      }
    }
    onKey(e) {
      /* 焦点在覆盖层按钮上时, 交给按钮自身处理, 避免双触发 */
      if (typeof document !== 'undefined' && e.target instanceof HTMLElement && e.target.tagName === 'BUTTON') return;
      const k = e.key;
      if (k === 'g' || k === 'G') { this.debugGrid = !this.debugGrid; return; }
      if (k >= '1' && k <= '7') {
        if (this.state === 'playing') this.selectPlant(GardenGame.PLANT_ORDER[+k - 1]);
        return;
      }
      if (k === 'Escape') this.cancelSelect();
      else if (k === 'p' || k === 'P') this.togglePause();
      else if (k === 'm' || k === 'M') { const m = this.audio.toggleMute(); }
      else if (k === 'r' || k === 'R') { if (this.state === 'win' || this.state === 'over') this.newGame(this.diffKey); }
      else if (k === 'Enter') { if (this.state === 'menu' || this.state === 'win' || this.state === 'over') this.newGame(this.diffKey); }
    }
    bind() {
      const cv = this.canvas;
      const toGame = (e) => {
        const r = cv.getBoundingClientRect();
        return {
          x: (e.clientX - r.left) * (VIEW.W / r.width),
          y: (e.clientY - r.top) * (VIEW.H / r.height)
        };
      };
      cv.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const p = toGame(e);
        this.mouse.x = p.x; this.mouse.y = p.y;
        this.onPointerDown(p.x, p.y);
      });
      cv.addEventListener('pointermove', (e) => {
        const p = toGame(e);
        this.mouse.x = p.x; this.mouse.y = p.y;
        this.onHover(p.x, p.y);
      });
      cv.addEventListener('contextmenu', (e) => { e.preventDefault(); this.cancelSelect(); });
      if (typeof window !== 'undefined') {
        window.addEventListener('keydown', (e) => this.onKey(e));
      }
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.hidden && this.state === 'playing') this.setPaused(true);
        });
      }
    }

    /* ---------- 覆盖层(菜单/暂停/结算) ---------- */
    bindOverlay() {
      const el = document.getElementById('overlay');
      if (!el) return;
      this.overlayEl = el;
      el.addEventListener('click', (e) => {
        const t = e.target;
        if (!(t instanceof HTMLElement)) return;
        const diff = t.getAttribute('data-diff');
        if (diff) {
          this.diffKey = diff;
          el.querySelectorAll('[data-diff]').forEach(b => b.classList.remove('on'));
          t.classList.add('on');
          this.audio.ensure();
          this.audio.play('click');
          return;
        }
        const act = t.getAttribute('data-action');
        if (!act) return;
        this.audio.ensure();
        this.audio.play('click');
        if (act === 'start' || act === 'restart' || act === 'again') this.newGame(this.diffKey);
        else if (act === 'resume') this.setPaused(false);
        else if (act === 'menu') this.goMenu();
      });
    }
    fmtTime(s) {
      const m = Math.floor(s / 60), ss = Math.floor(s % 60);
      return (m < 10 ? '0' + m : m) + ':' + (ss < 10 ? '0' + ss : ss);
    }
    statsHtml() {
      return '<div class="stats">击杀僵尸 <b>' + this.stats.kills + '</b> · 收集阳光 <b>' + this.stats.sun +
        '</b> · 坚持时间 <b>' + this.fmtTime(this.stats.t) + '</b></div>';
    }
    showOverlay(kind) {
      if (typeof document === 'undefined' || !this.overlayEl) return;
      const el = this.overlayEl;
      if (kind === null) { el.classList.add('hidden'); el.innerHTML = ''; return; }
      let html = '';
      if (kind === 'menu') {
        html = '<div class="panel">' +
          '<h1>阳光庭院塔防</h1>' +
          '<p class="sub">花园塔防 · 选择难度，守住你的草坪</p>' +
          '<div class="seg">' +
          '<button data-diff="easy">轻松</button>' +
          '<button data-diff="normal" class="' + (this.diffKey === 'normal' ? 'on' : '') + '">普通</button>' +
          '<button data-diff="hard">困难</button>' +
          '</div>' +
          '<button class="primary" data-action="start">开始游戏</button>' +
          '<div class="tips">' +
          '<p>点击卡片选择植物，再点击草坪种植；点击阳光收集；铲子可移除植物</p>' +
          '<p>快捷键：1-7 选植物 · Esc 取消 · P 暂停 · M 静音 · R 重开(结算页)</p>' +
          '</div></div>';
      } else if (kind === 'paused') {
        html = '<div class="panel"><h2>游戏暂停</h2>' + this.statsHtml() +
          '<div class="row"><button class="primary" data-action="resume">继续游戏</button>' +
          '<button data-action="restart">重新开始</button>' +
          '<button data-action="menu">返回主菜单</button></div></div>';
      } else if (kind === 'over') {
        html = '<div class="panel"><h2 class="bad">僵尸吃掉了你的脑子！</h2><p class="sub">' +
          '你在第 ' + this.wave + ' 波倒下了(' + this.diff.name + '难度)</p>' + this.statsHtml() +
          '<div class="row"><button class="primary" data-action="again">再来一局</button>' +
          '<button data-action="menu">返回主菜单</button></div></div>';
      } else if (kind === 'win') {
        html = '<div class="panel"><h2 class="good">胜利！草坪守住了 🏆</h2><p class="sub">你击败了全部 ' + GardenGame.WAVES.total + ' 波僵尸(' + this.diff.name + '难度)</p>' +
          this.statsHtml() +
          '<div class="row"><button class="primary" data-action="again">再来一局</button>' +
          '<button data-action="menu">返回主菜单</button></div></div>';
      }
      el.innerHTML = html;
      el.classList.remove('hidden');
    }

    /* ============================================================
     * 渲染
     * ============================================================ */
    updateParticles(dt) {
      for (const p of this.particles) p.update(dt);
    }
    draw() {
      const ctx = this.ctx;
      if (!ctx) return;
      /* 高分屏: 逻辑坐标 -> 实际像素 */
      const dpr = this.dpr || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.save();
      if (this.shake > 0.3) {
        ctx.translate((this.rnd() - 0.5) * this.shake, (this.rnd() - 0.5) * this.shake);
      }
      this.drawField(ctx);
      /* 深度排序: 脚底 y 越大越靠前, 消除跨行穿插 */
      const layers = [];
      for (const m of this.mowers) if (m.state !== 'done') layers.push({ y: m.feetY, f: () => GardenGame.drawMower(ctx, m, this.et) });
      for (const p of this.plants) if (!p.dead || p.deathT > 0) layers.push({ y: p.y, f: () => GardenGame.drawPlant(ctx, p.key, p.x, p.y, this.et + p.seed, p.opts()) });
      for (const z of this.zombies) layers.push({ y: z.feetY, f: () => GardenGame.drawZombie(ctx, z, this.et) });
      if (this.state === 'menu' && this.decorZombie) layers.push({ y: this.decorZombie.feetY, f: () => GardenGame.drawZombie(ctx, this.decorZombie, this.time) });
      layers.sort((a, b) => a.y - b.y);
      for (const l of layers) l.f();
      for (const pe of this.peas) GardenGame.drawPea(ctx, pe);
      for (const s of this.suns) GardenGame.drawSun(ctx, s, this.et);
      for (const pt of this.particles) GardenGame.drawParticle(ctx, pt, this.time);
      this.drawBanner(ctx);
      this.drawGhost(ctx);
      if (this.debugGrid) this.drawAlignmentGrid(ctx);
      ctx.restore();
      this.drawBar(ctx);
    }

    drawAlignmentGrid(ctx) {
      ctx.save();ctx.lineWidth=1;ctx.strokeStyle='rgba(255,255,255,.8)';
      for (let c=0;c<=FIELD.cols;c++) {
        const x=FIELD.x+c*FIELD.cellW;
        ctx.beginPath();ctx.moveTo(x,FIELD.y);ctx.lineTo(x,FIELD.bottom);ctx.stroke();
      }
      for (let r=0;r<=FIELD.rows;r++) {
        const y=FIELD.y+r*FIELD.cellH;
        ctx.beginPath();ctx.moveTo(FIELD.x,y);ctx.lineTo(FIELD.right,y);ctx.stroke();
      }
      ctx.font='11px '+FONT;ctx.textAlign='left';ctx.textBaseline='top';
      for (let r=0;r<FIELD.rows;r++) for (let c=0;c<FIELD.cols;c++) {
        const x=GardenGame.cellCX(c),y=GardenGame.rowFeet(r);
        ctx.fillStyle='#fff';ctx.fillText((c+1)+','+(r+1),GardenGame.colX(c)+4,GardenGame.rowTop(r)+4);
        ctx.strokeStyle='#ffdf55';ctx.beginPath();
        ctx.moveTo(x-5,y);ctx.lineTo(x+5,y);ctx.moveTo(x,y-5);ctx.lineTo(x,y+5);ctx.stroke();
      }
      ctx.fillStyle='#7df5ee';
      for (const m of this.mowers) {ctx.beginPath();ctx.arc(GardenGame.mowerParkX(),GardenGame.rowFeet(m.row)+4,4,0,Math.PI*2);ctx.fill();}
      ctx.fillStyle='rgba(0,0,0,.72)';ctx.fillRect(FIELD.x,FIELD.bottom+7,320,22);
      ctx.fillStyle='#fff';ctx.fillText('G 关闭网格 · 黄色为植物根部 · 蓝色为小推车',FIELD.x+7,FIELD.bottom+12);
      ctx.restore();
    }

    drawField(ctx) {
      /* 已校准的整张背景缓存。美术源文件保持原样。 */
      if (this.bgReady && this.bgImg) {
        ctx.drawImage(this.bgCalibrated, 0, 0, VIEW.W, VIEW.H);
        return;
      }
      /* 兜底: 程序化静态场景 + 动态草叶/光尘 */
      if (this.bg) GardenGame.drawAmbient(ctx, this.bg, this.amb, this.time, this.reduced);
      else {
        ctx.fillStyle = '#4f7a33';
        ctx.fillRect(0, GardenGame.BAR.h, VIEW.W, VIEW.H - GardenGame.BAR.h);
      }
    }

    drawBanner(ctx) {
      if (!this.banner) return;
      const b = this.banner;
      b.t -= 0;
      const k = 1 - b.t / b.max;
      const alpha = b.t < 0.5 ? b.t / 0.5 : Math.min(1, k * 4);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const scale = 1 + Math.sin(Math.min(k * 3, Math.PI)) * 0.12;
      ctx.translate(500, 300);
      ctx.scale(scale, scale);
      ctx.font = 'bold 44px ' + FONT;
      ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(0,0,0,.6)';
      ctx.strokeText(b.text, 0, 0);
      ctx.fillStyle = b.color;
      ctx.fillText(b.text, 0, 0);
      ctx.restore();
    }

    drawGhost(ctx) {
      if (this.state !== 'playing') return;
      if (!this.selected && !this.shovelMode) return;   // 无操作意图时不显示预览
      const m = this.mouse;
      if (m.x < FIELD.x || m.y < FIELD.y) return;
      const c = this.cellAt(m.x, m.y);
      if (!c) return;
      const cx = GardenGame.cellCX(c.col), cy = GardenGame.rowFeet(c.row);
      const X = GardenGame.colX(c.col), Y = GardenGame.rowTop(c.row);
      const occupied = this.plantAt(c.col, c.row);
      const def = this.selected ? GardenGame.PLANTS[this.selected] : null;
      const afford = def ? this.sunCount >= def.cost : false;
      const valid = !this.shovelMode && !!def && afford && !occupied;

      ctx.save();
      if (this.shovelMode) {
        /* 铲子预览: 挖掘十字纹 + 铲子跟手 */
        ctx.save();
        ctx.beginPath(); ctx.rect(X, Y, FIELD.cellW, FIELD.cellH); ctx.clip();
        ctx.fillStyle = 'rgba(60,40,16,.24)';
        ctx.fillRect(X, Y, FIELD.cellW, FIELD.cellH);
        ctx.strokeStyle = 'rgba(255,214,120,.45)'; ctx.lineWidth = 3;
        for (let i = -FIELD.cellH; i < FIELD.cellW; i += 14) {
          ctx.beginPath(); ctx.moveTo(X + i, Y + FIELD.cellH); ctx.lineTo(X + i + FIELD.cellH, Y); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(X + i, Y); ctx.lineTo(X + i + FIELD.cellH, Y + FIELD.cellH); ctx.stroke();
        }
        ctx.restore();
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = 'rgba(255,220,130,.9)'; ctx.lineWidth = 2;
        ctx.strokeRect(X + 2, Y + 2, FIELD.cellW - 4, FIELD.cellH - 4);
        ctx.setLineDash([]);
        /* 铲子图标跟手：固定静态资产。 */
        if (!GardenGame.drawDesignTool || !GardenGame.drawDesignTool(ctx, 'shovel', m.x - 10, m.y - 62, 48, 54)) {
          ctx.save();
          ctx.translate(m.x, m.y);
          ctx.globalAlpha = 0.92;
          ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 4; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(-4, -66); ctx.lineTo(-10, -40); ctx.stroke();
          ctx.fillStyle = GardenGame.C.steel;
          ctx.beginPath();
          ctx.moveTo(-10, -40); ctx.lineTo(-16, -12); ctx.lineTo(0, -12); ctx.lineTo(-6, -40);
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = GardenGame.C.steelDark; ctx.lineWidth = 1.6; ctx.stroke();
          ctx.restore();
        }
      } else if (valid) {
        /* 可种植: 白雾 + 虚线框 + 半透明预览 */
        ctx.fillStyle = 'rgba(255,255,255,.16)';
        ctx.fillRect(X, Y, FIELD.cellW, FIELD.cellH);
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2;
        ctx.strokeRect(X + 2, Y + 2, FIELD.cellW - 4, FIELD.cellH - 4);
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.55;
        GardenGame.drawPlant(ctx, this.selected, cx, cy, this.time, { seed: 1, hpRatio: 1, static: true });
        ctx.globalAlpha = 1;
      } else {
        /* 不可种植: 红色斜纹 + ✕(不依赖颜色单独表意) */
        ctx.save();
        ctx.beginPath(); ctx.rect(X, Y, FIELD.cellW, FIELD.cellH); ctx.clip();
        ctx.fillStyle = 'rgba(120,20,16,.20)';
        ctx.fillRect(X, Y, FIELD.cellW, FIELD.cellH);
        ctx.strokeStyle = 'rgba(200,40,30,.38)'; ctx.lineWidth = 3;
        for (let i = -FIELD.cellH; i < FIELD.cellW; i += 12) {
          ctx.beginPath(); ctx.moveTo(X + i, Y + FIELD.cellH); ctx.lineTo(X + i + FIELD.cellH, Y); ctx.stroke();
        }
        ctx.restore();
        ctx.strokeStyle = 'rgba(255,90,70,.92)'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - 13, cy - 32); ctx.lineTo(cx + 13, cy - 6);
        ctx.moveTo(cx + 13, cy - 32); ctx.lineTo(cx - 13, cy - 6);
        ctx.stroke();
        if (this.selected) {
          ctx.globalAlpha = 0.4;
          GardenGame.drawPlant(ctx, this.selected, cx, cy, this.time, { seed: 1, hpRatio: 1, static: true });
          ctx.globalAlpha = 1;
        }
      }
      /* 悬停原因小木牌 */
      if (this.selected && !this.shovelMode) {
        let hint = null;
        if (occupied) hint = '已有植物';
        else if (!afford) hint = '阳光不足';
        if (hint) {
          ctx.font = 'bold 13px ' + FONT;
          const tw = ctx.measureText(hint).width + 18;
          const hx = Math.max(X + 4, Math.min(cx - tw / 2, FIELD.right - tw - 4));
          const hy = Math.max(GardenGame.BAR.h + 8, Y - 26);
          GardenGame.rr(ctx, hx, hy, tw, 20, 6);
          ctx.fillStyle = 'rgba(40,24,10,.92)'; ctx.fill();
          ctx.strokeStyle = 'rgba(255,220,150,.55)'; ctx.lineWidth = 1.2; ctx.stroke();
          ctx.fillStyle = '#ffd9a0';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(hint, hx + tw / 2, hy + 11);
        }
      }
      ctx.restore();
    }

    /* ---------- 顶部操作台(园艺种子操作台) ---------- */
    drawBar(ctx) {
      /* 木台面 */
      GardenGame.woodPlank(ctx, 0, 0, VIEW.W, GardenGame.BAR.h, 0, '#a9743f', '#7c5230', '#573718');
      /* 台面下沿凹槽 */
      ctx.fillStyle = 'rgba(0,0,0,.30)';
      ctx.fillRect(0, GardenGame.BAR.h - 3, VIEW.W, 3);
      ctx.fillStyle = 'rgba(255,220,160,.14)';
      ctx.fillRect(0, GardenGame.BAR.h - 1, VIEW.W, 1);
      this.drawSunJar(ctx);
      this.drawPackets(ctx);
      this.drawShovelBtn(ctx);
      this.drawProgress(ctx);
      this.drawIconBtn(ctx, 'pause');
      this.drawIconBtn(ctx, 'mute');
    }

    /* 阳光罐(玻璃罐 + 阳光液) */
    drawSunJar(ctx) {
      const s = UI.sunPanel;
      ctx.save();
      if (this.sunBounce > 0) ctx.translate(0, -Math.sin(this.sunBounce * 20) * this.sunBounce * 8);
      /* 罐体 */
      GardenGame.rr(ctx, s.x, s.y, s.w, s.h, 10);
      const g = ctx.createLinearGradient(0, s.y, 0, s.y + s.h);
      g.addColorStop(0, 'rgba(255,251,232,.97)'); g.addColorStop(1, '#eed9a6');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = GardenGame.C.woodDark; ctx.lineWidth = 2.5; ctx.stroke();
      /* 阳光液 */
      ctx.save();
      GardenGame.rr(ctx, s.x, s.y, s.w, s.h, 10); ctx.clip();
      const lg = ctx.createLinearGradient(0, s.y + s.h * 0.5, 0, s.y + s.h);
      lg.addColorStop(0, 'rgba(255,210,63,.5)'); lg.addColorStop(1, 'rgba(245,161,30,.72)');
      ctx.fillStyle = lg;
      ctx.fillRect(s.x, s.y + s.h * 0.54, s.w, s.h * 0.46);
      ctx.restore();
      /* 罐口太阳 */
      GardenGame.drawSunIcon(ctx, s.x + s.w / 2, s.y + 26, 14, this.time * 0.8);
      /* 计数 */
      ctx.font = 'bold 20px ' + FONT;
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      const flash = this.sunFlash > 0 && Math.sin(this.sunFlash * 30) > 0;
      GardenGame.outlinedText(ctx, String(this.sunCount), s.x + s.w / 2, s.y + s.h - 8,
        flash ? '#ff9a8a' : '#fff6d8', 'rgba(62,38,12,.9)', 3.5);
      /* 玻璃高光 */
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      GardenGame.rr(ctx, s.x + 7, s.y + 8, 6, s.h - 26, 3); ctx.fill();
      ctx.restore();
    }

    /* 种子袋 × 7 */
    drawPackets(ctx) {
      GardenGame.PLANT_ORDER.forEach((key, i) => {
        const r = GardenGame.packetRect(i);
        const def = GardenGame.PLANTS[key];
        const cd = this.cds[key];
        const afford = this.sunCount >= def.cost;
        const selected = this.selected === key;
        const hover = this.hoverUI === 'plant:' + key;
        const err = (this.cardErr && this.cardErr.key === key) ? Math.sin(this.cardErr.t * 60) * 2.5 : 0;
        const lift = selected ? -4 : (hover ? -2 : 0);
        ctx.save();
        ctx.translate(err, lift);
        /* 袋身(呢绒) */
        GardenGame.rr(ctx, r.x, r.y, r.w, r.h, 7);
        const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
        g.addColorStop(0, '#f4e6c0'); g.addColorStop(1, GardenGame.C.feltDark);
        ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = selected ? GardenGame.C.sunDeep : '#8a6a3e';
        ctx.lineWidth = selected ? 2.5 : 2; ctx.stroke();
        GardenGame.stitch(ctx, r.x + 4, r.y + 4, r.w - 8, r.h - 8, 5, 'rgba(247,234,208,.9)', 1.2);
        /* 束口带 */
        ctx.fillStyle = selected ? '#f2cd68' : '#c9a05a';
        ctx.fillRect(r.x + 4, r.y + 4, r.w - 8, 8);
        ctx.fillStyle = 'rgba(0,0,0,.16)';
        ctx.fillRect(r.x + 4, r.y + 11, r.w - 8, 1.5);
        /* 植物头像 */
        ctx.save();
        ctx.translate(r.x + r.w / 2, r.y + 44);
        ctx.scale(0.40, 0.40);
        GardenGame.drawPlant(ctx, key, 0, 0, 0, { seed: 1 + i * 0.7, static: true });
        ctx.restore();
        /* 名称 */
        ctx.font = 'bold 12px ' + FONT;
        ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = GardenGame.C.soil;
        ctx.fillText(def.name, r.x + r.w / 2, r.y + r.h - 17);
        /* 价格吊牌 */
        const pw = 34, ph = 15, px = r.x + (r.w - pw) / 2, py = r.y + r.h - 15;
        GardenGame.rr(ctx, px, py, pw, ph, 4);
        ctx.fillStyle = afford ? 'rgba(255,247,218,.96)' : 'rgba(52,34,20,.9)';
        ctx.fill();
        ctx.strokeStyle = afford ? '#8a6a3e' : GardenGame.C.danger;
        ctx.lineWidth = 1.4; ctx.stroke();
        GardenGame.drawSunIcon(ctx, px + 8, py + ph / 2, 4, 0);
        ctx.font = 'bold 11px ' + FONT; ctx.textAlign = 'left';
        ctx.fillStyle = afford ? '#8a5a1a' : '#ffb4a4';
        ctx.fillText(String(def.cost), px + 14, py + ph / 2 + 4);
        /* ---- 状态层 ---- */
        if (cd > 0) {
          /* 冷却只保留遮罩进度与钟表，不显示倒计时数字。 */
          const ratio = Math.min(1, cd / def.cd);
          ctx.save();
          GardenGame.rr(ctx, r.x, r.y, r.w, r.h, 7); ctx.clip();
          ctx.fillStyle = 'rgba(12,20,34,.68)';
          ctx.fillRect(r.x, r.y, r.w, r.h * ratio);
          ctx.restore();
          const mx = r.x + r.w / 2, my = r.y + 32;
          ctx.fillStyle = 'rgba(240,246,255,.94)';
          ctx.beginPath(); ctx.arc(mx, my, 9, 0, 6.29); ctx.fill();
          ctx.strokeStyle = '#33414f'; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.arc(mx, my, 9, 0, 6.29); ctx.stroke();
          ctx.lineWidth = 1.8; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx, my - 5.5); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + 4, my + 2); ctx.stroke();
        } else if (!afford) {
          /* 阳光不足: 灰幕 + 小锁(与冷却区分) */
          ctx.fillStyle = 'rgba(52,50,46,.42)';
          GardenGame.rr(ctx, r.x, r.y, r.w, r.h, 7); ctx.fill();
          const mx = r.x + r.w / 2, my = r.y + 32;
          ctx.strokeStyle = '#f2e2ba'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.arc(mx, my - 3, 4.5, Math.PI, 0); ctx.stroke();
          ctx.fillStyle = '#f2e2ba';
          GardenGame.rr(ctx, mx - 6, my - 3, 12, 9, 2); ctx.fill();
        }
        /* 选中: 袋顶三角 + 呼吸金光 */
        if (selected) {
          ctx.fillStyle = GardenGame.C.sun;
          ctx.beginPath();
          ctx.moveTo(r.x + r.w / 2 - 7, r.y - 9);
          ctx.lineTo(r.x + r.w / 2 + 7, r.y - 9);
          ctx.lineTo(r.x + r.w / 2, r.y - 2);
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(255,220,90,' + (0.55 + Math.sin(this.time * 8) * 0.35).toFixed(2) + ')';
          ctx.lineWidth = 2;
          GardenGame.rr(ctx, r.x - 3, r.y - 3, r.w + 6, r.h + 6, 9); ctx.stroke();
        }
        ctx.restore();
      });
    }

    /* 铲子钉 */
    drawShovelBtn(ctx) {
      const b = UI.shovel;
      GardenGame.woodButton(ctx, b.x, b.y, b.w, b.h, this.shovelMode, this.hoverUI === 'shovel');
      if (!GardenGame.drawDesignTool || !GardenGame.drawDesignTool(ctx, 'shovel', b.x + 8, b.y + 11, b.w - 16, 43)) {
        ctx.save();
        ctx.translate(b.x + b.w / 2, b.y + b.h / 2 - 3);
        ctx.strokeStyle = '#7a4a22'; ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-2, -22); ctx.lineTo(-9, 2); ctx.stroke();
        ctx.fillStyle = GardenGame.C.steel;
        ctx.beginPath();
        ctx.moveTo(-9, 2); ctx.lineTo(-16, 18); ctx.lineTo(1, 18); ctx.lineTo(-5, 2);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = GardenGame.C.steelDark; ctx.lineWidth = 2; ctx.stroke();
        ctx.restore();
      }
      ctx.font = 'bold 12px ' + FONT;
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = GardenGame.C.soil;
      ctx.fillText('铲子', b.x + b.w / 2, b.y + b.h - 5);
    }

    /* 波次进度牌(木桩) */
    drawProgress(ctx) {
      const p = UI.prog;
      const total = GardenGame.WAVES.total;
      GardenGame.woodPlank(ctx, p.x - 5, p.y - 9, p.w + 10, p.h + 18, 6, '#a9743f', '#7c5230');
      GardenGame.rr(ctx, p.x, p.y, p.w, p.h, p.h / 2);
      ctx.fillStyle = 'rgba(30,20,8,.55)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,235,190,.35)'; ctx.lineWidth = 1.2; ctx.stroke();
      const isHuge = GardenGame.WAVES.huge.indexOf(this.wave) >= 0;
      const interval = isHuge ? GardenGame.WAVES.hugeBreak : this.diff.waveInt;
      const frac = (this.wave >= total) ? 1 : (this.waveTimer > 0 ? Math.max(0, 1 - this.waveTimer / interval) : 1);
      const progress = Math.min(1, (Math.max(0, this.wave - 1) + frac) / total);
      if (progress > 0) {
        GardenGame.rr(ctx, p.x + 2, p.y + 2, Math.max(6, (p.w - 4) * progress), p.h - 4, (p.h - 4) / 2);
        const fg = ctx.createLinearGradient(p.x, 0, p.x + p.w, 0);
        fg.addColorStop(0, '#9fdc6e'); fg.addColorStop(1, '#f5c542');
        ctx.fillStyle = fg; ctx.fill();
      }
      /* 旗帜标记 */
      [0.25, 0.5, 0.75, 1].forEach(f => {
        const fx = p.x + 4 + (p.w - 8) * f;
        const big = (f === 0.5 || f === 1);
        ctx.strokeStyle = '#4a3319'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(fx, p.y + p.h + 4); ctx.lineTo(fx, p.y + p.h - 4); ctx.stroke();
        ctx.fillStyle = big ? '#d23b3b' : '#e8a0a0';
        ctx.beginPath();
        ctx.moveTo(fx, p.y + p.h - 4);
        ctx.lineTo(fx + (big ? 10 : 7), p.y + p.h - 1);
        ctx.lineTo(fx, p.y + p.h + 2);
        ctx.closePath(); ctx.fill();
      });
      ctx.font = 'bold 13px ' + FONT;
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      GardenGame.outlinedText(ctx, '第 ' + Math.max(1, this.wave) + ' / ' + total + ' 波 · ' + this.diff.name,
        p.x + p.w / 2, p.y + p.h + 22, '#f7ead0', 'rgba(40,26,12,.8)', 3);
    }

    /* 暂停 / 静音钉 */
    drawIconBtn(ctx, kind) {
      const b = UI[kind];
      GardenGame.woodButton(ctx, b.x, b.y, b.w, b.h, false, this.hoverUI === kind);
      ctx.save();
      ctx.translate(b.x + b.w / 2, b.y + b.h / 2 - 3);
      if (kind === 'pause') {
        ctx.fillStyle = GardenGame.C.soil;
        if (this.state === 'playing') {
          GardenGame.rr(ctx, -9, -11, 6.5, 22, 2); ctx.fill();
          GardenGame.rr(ctx, 2.5, -11, 6.5, 22, 2); ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(-7, -12); ctx.lineTo(10, 0); ctx.lineTo(-7, 12);
          ctx.closePath(); ctx.fill();
        }
      } else {
        ctx.fillStyle = GardenGame.C.soil;
        ctx.beginPath();
        ctx.moveTo(-9, -3); ctx.lineTo(-4, -3); ctx.lineTo(3, -10);
        ctx.lineTo(3, 10); ctx.lineTo(-4, 3); ctx.lineTo(-9, 3);
        ctx.closePath(); ctx.fill();
        if (this.audio.muted) {
          ctx.strokeStyle = GardenGame.C.danger; ctx.lineWidth = 3; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(-11, -10); ctx.lineTo(9, 10); ctx.stroke();
        } else {
          ctx.strokeStyle = GardenGame.C.soil; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(3, 0, 8, -0.9, 0.9); ctx.stroke();
          ctx.beginPath(); ctx.arc(3, 0, 12, -0.8, 0.8); ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  GardenGame.Game = Game;

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const boot = () => { if (!window.gardenGame) window.gardenGame = new GardenGame.Game(document.getElementById('game')); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = GardenGame;
})(typeof window !== 'undefined' ? window : globalThis);
