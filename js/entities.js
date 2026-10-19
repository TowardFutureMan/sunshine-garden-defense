/* ============================================================
 * 实体模块 - 植物 / 僵尸 / 豌豆 / 阳光 / 粒子 / 小推车
 * ============================================================ */
(function (root) {
  'use strict';
  const GardenGame = root.GardenGame;

  /* ---------------- 植物 ---------------- */
  class Plant {
    constructor(key, col, row, game) {
      const def = GardenGame.PLANTS[key];
      this.key = key;
      this.game = game; this.readyT = 0;
      this.def = def;
      this.col = col; this.row = row;
      this.x = GardenGame.cellCX(col);
      this.y = GardenGame.rowFeet(row);
      this.hp = def.hp; this.maxHp = def.hp;
      this.seed = game.rnd() * 6.28;
      this.t = 0;
      this.dead = false;
      this.fireT = 0.6;
      this.recoil = 0;
      this.pop = 1;
      this.eatShake = 0;
      this.hitT = 0;
      this.bittenT = 0;
      this.deathT = 0;
      this.fuse = def.fuse || 0;
      this.armed = key !== 'potatomine';
      this.armT = def.arm || 0;
      this.pending = 0;
      this.pendingT = 0;
      this.produceT = key === 'sunflower' ? 5 + game.rnd() * 2 : 0;
    }
    damage(n, quiet) {
      if (this.dead) return;
      const previousTier=this.hp/this.maxHp<.34?2:this.hp/this.maxHp<.67?1:0;
      this.hp -= n;
      const tier=this.hp/this.maxHp<.34?2:this.hp/this.maxHp<.67?1:0;
      if(this.hp>0&&tier>previousTier&&this.key!=='wallnut'&&GardenGame.emitLeafLoss)GardenGame.emitLeafLoss(this.game,this,tier);
      if (!quiet) this.reactToBite();
      if (this.hp <= 0) { this.hp = 0; this.dead = true; this.deathT = 0.35; }
    }
    reactToBite() {
      this.hitT = 0.14;
      this.bittenT = 0.55;
      this.eatShake = 1;
    }
    update(dt, game) {
      if (this.dead) { this.deathT = Math.max(0, this.deathT - dt); return; }
      this.t += dt;
      this.readyT = Math.max(0,this.readyT-dt);
      this.hitT = Math.max(0, this.hitT - dt);
      this.bittenT = Math.max(0, this.bittenT - dt);
      this.pop = Math.max(0, this.pop - dt * 2.2);
      this.recoil = Math.max(0, this.recoil - dt * 5);
      this.eatShake = Math.max(0, this.eatShake - dt * 2);

      if (this.key === 'sunflower') {
        this.produceT -= dt;
        if (this.produceT <= 0) {
          this.produceT = 8 + game.rnd() * 2;
          this.pop = 1;
          game.spawnPlantSun(this);
          game.audio.play('sunpop');
        }
        return;
      }

      if (this.def.fire) {
        const f = this.def.fire;
        const target = game.zombieAhead(this.row, this.x + 10);
        if (target) {
          this.fireT -= dt;
          if (this.fireT <= 0) {
            this.fireT = f.interval;
            this.shoot(game, f);
            if (f.double) { this.pending = 1; this.pendingT = 0.18; }
          }
        } else if (this.fireT < f.interval * 0.7) {
          this.fireT = Math.min(f.interval * 0.7, this.fireT + dt);
        }
        if (this.pending > 0) {
          this.pendingT -= dt;
          if (this.pendingT <= 0) { this.pending = 0; this.shoot(game, f); }
        }
        return;
      }

      if (this.key === 'cherrybomb') {
        this.fuse -= dt;
        if (this.fuse <= 0) {
          game.explode(this.x, this.row, this.col, 1800, 1);
          this.dead = true;
        }
        return;
      }

      if (this.key === 'potatomine') {
        if (!this.armed) {
          this.armT -= dt;
          if (this.armT <= 0) {
            this.armed = true; this.readyT = .8;
            game.particles.push(new GardenGame.Particle(this.x,this.y,0,0,.8,'#ffe89c',20,0,'ready'));
            game.audio.play('arm');
            game.puff(this.x, this.y, '#8a6b46', 6);
          }
        } else if (game.zombieOnCell(this.col, this.row)) {
          game.explode(this.x, this.row, this.col, 1800, 0);
          this.dead = true;
        }
      }
    }
    shoot(game, f) {
      this.recoil = 1;
      const muzzleIndex = this.shotCount || 0;
      const mouth = GardenGame.plantMuzzleAt
        ? GardenGame.plantMuzzleAt(this.key, (game.et == null ? game.time : game.et) + this.seed, this.opts(), muzzleIndex) : null;
      this.shotCount = muzzleIndex + 1;
      game.spawnPea(this.row, this.x + (mouth ? mouth.x : 26),
        this.y + (mouth ? mouth.y : -46), f.dmg, f.speed, !!f.ice);
      game.audio.play('shoot');
    }
    opts() {
      return {
        seed: this.seed,
        recoil: this.recoil,
        pop: this.pop,
        hpRatio: this.hp / this.maxHp,
        eatShake: this.eatShake,
        hitT: this.hitT,
        bittenT: this.bittenT,
        deathT: this.deathT,
        fuse: this.fuse,
        armed: this.armed,
        readyT: this.readyT,
        sunk: this.armed ? 0 : 9,
        ice: this.key === 'snowpea'
      };
    }
  }

  /* ---------------- 僵尸 ---------------- */
  class Zombie {
    constructor(type, row, game) {
      const def = GardenGame.ZOMBIES[type];
      const mul = game.diff.hpMul * (1 + (game.wave - 1) * GardenGame.WAVES.hpPerWave);
      this.type = type;
      this.def = def;
      this.row = row;
      this.x = GardenGame.ZOMBIE_SPAWN_X + game.rnd() * 46;
      this.feetY = GardenGame.rowFeet(row) + 4;
      this.maxHp = Math.round(def.hp * mul);
      this.hp = this.maxHp;
      this.armor = def.armor ? { type: def.armor.type, hp: Math.round(def.armor.hp * mul), maxHp: Math.round(def.armor.hp * mul) } : null;
      this.baseSpeed = def.speed * game.diff.spdMul;
      this.speed = this.baseSpeed;
      this.eating = null;
      this.eatT = 0;
      this.chompT = 0.5;
      this.walkPhase = game.rnd() * 6.28;
      this.flash = 0;
      this.freezeT = 0;
      this.dying = false;
      this.dyingT = 0;
      this.moving = true;
      this.vaultT = 0;
      this.vaultDur = 0;
      this.vaultFrom = 0;
      this.vaulted = false;
      this.angry = false;
      this.rageT = 0; this.landedT = 0;
      this.armorBreakT = 0;
      this.pad = type === 'football';
      this.skin = '#a9bd8f';
      this.groaned = false;
    }
    get front() { return this.x - 26; }
    takeDamage(n, game, ice) {
      if (this.dyingT > 0) return;
      if (ice) { this.freezeT = Math.max(this.freezeT, 5); }
      this.flash = 0.12;
      let rest = n;
      if (this.armor && this.armor.hp > 0) {
        const absorbed = Math.min(this.armor.hp, rest);
        this.armor.hp -= absorbed;
        rest -= absorbed;
        if (this.armor.hp <= 0) {
          this.armor.hp = 0;
          this.armorBreakT = 0.38;
          for (let i = 0; i < 4; i++) game.particles && game.particles.push(new GardenGame.Particle(this.x - 8, this.feetY - 58, -35 + game.rnd() * 75, -60 - game.rnd() * 45, 0.45, this.armor.type === 'cone' ? '#ed9134' : this.armor.type === 'paper' ? '#e9dfc4' : '#aeb9ba', 3, 240, 'shard'));
          if (this.armor.type === 'paper') {     // 报纸碎了 -> 暴走
            this.angry = true; this.rageT = .55;
            game.audio.play('paper-rip');
            for(let i=0;i<12;i++)game.particles.push(new GardenGame.Particle(this.x-16,this.feetY-36,-90+game.rnd()*150,-55-game.rnd()*90,.6+game.rnd()*.4,'#e9dfc4',3+game.rnd()*4,180,'paper'));
            this.speed = this.baseSpeed * 2.4;
            game.puff(this.x - 20, this.feetY - 30, '#e6d9b8', 8);
            game.floatText('暴走!', this.x, this.feetY - 90, '#ff7a5c');
            game.audio.play('groan');
          } else {
            game.puff(this.x - 6, this.feetY - 60, this.armor.type === 'cone' ? '#e8850c' : '#9aa3ad', 8);
          }
        }
      }
      if (rest > 0) this.hp -= rest;
      if (this.hp <= 0 && !this.dying) {
        this.dying = true;
        this.dyingT = 0.9;
        game.stats.kills++;
        game.audio.play('gulp');
        game.puff(this.x, this.feetY - 6, '#8a7a5c', 6);
      }
    }
    update(dt, game) {
      if (this.dying) { this.dyingT -= dt; return; }
      this.flash = Math.max(0, this.flash - dt);
      this.armorBreakT = Math.max(0, this.armorBreakT - dt);
      this.landedT = Math.max(0,this.landedT-dt);
      if(this.rageT>0){this.rageT=Math.max(0,this.rageT-dt);this.moving=false;return;}
      if (this.freezeT > 0) this.freezeT -= dt;
      const slow = this.freezeT > 0 ? 0.5 : 1;

      /* 撑杆跳跃中 */
      if (this.vaultT > 0) {
        this.vaultT -= dt;
        const p = Math.min(1, (this.vaultDur - this.vaultT) / this.vaultDur);
        this.x = this.vaultFrom - 140 * (1 - (1 - p) * (1 - p));
        if (this.vaultT <= 0) { this.vaulted = true; this.landedT=.2; this.speed = this.baseSpeed * 0.9; game.audio.play('land'); game.puff(this.x,this.feetY,'#b6a17d',6); }
        return;
      }

      /* 前方有植物则啃食 */
      if (!this.eating) {
        const p = game.plantAtFront(this);
        if (p) this.eating = p;
      }
      if (this.eating) {
        if (this.eating.dead) { this.eating = null; return; }
        this.eating.damage(100 * dt * slow, true);
        this.eatT += dt * slow;
        this.moving = false;
        this.chompT -= dt * slow;
        if (this.chompT <= 0) {
          this.chompT = 0.55; game.audio.play('chomp');
          if (this.eating.reactToBite) this.eating.reactToBite();
          const plant = this.eating;
          for (let i = 0; i < 4; i++) game.particles && game.particles.push(new GardenGame.Particle(plant.x + 22, plant.y - 34, -20 + game.rnd() * 65, -45 - game.rnd() * 50, 0.4, plant.key === 'wallnut' ? '#bd8b4a' : '#83b54b', 2.8, 160, 'leaf'));
        }
        return;
      }

      /* 触发撑杆跳 */
      if (this.type === 'polevault' && !this.vaulted) {
        const p = game.plantAhead(this);
        if (p) {
          this.vaultT = 0.62;
          this.vaultDur = 0.62;
          this.vaultFrom = this.x;
          return;
        }
      }

      this.moving = true;
      this.x -= this.speed * slow * dt;
      this.walkPhase += dt * this.speed * slow * 0.12;
    }
  }

  /* ---------------- 豌豆 ---------------- */
  class Pea {
    constructor(row, x, y, dmg, speed, ice) {
      this.row = row; this.x = x; this.y = y;
      this.dmg = dmg; this.vx = speed;
      this.ice = !!ice;
      this.dead = false;
      this.t = 0;
    }
    update(dt, game) {
      this.x += this.vx * dt;
      this.t += dt;
      if (this.x > 1005) { this.dead = true; return; }
      const z = game.zombieHit(this.row, this.x);
      if (z) {
        z.takeDamage(this.dmg, game, this.ice);
        this.dead = true;
        if (this.ice) {
          game.audio.play('freeze');
          if(GardenGame.emitIce)GardenGame.emitIce(game,this.x,this.y);
          for (let i = 0; i < 3; i++) game.particles.push(new Particle(z.x, this.y, -40 + game.rnd() * 80, -50 + game.rnd() * 60, 0.4, '#bfeaff', 2.4, 0, 'snow'));
        } else {
          game.audio.play('hit');
          for (let i = 0; i < 3; i++) game.particles.push(new Particle(this.x + 4, this.y, 30 + game.rnd() * 60, -40 + game.rnd() * 80, 0.3, '#a4d977', 2.5, 300, 'dot'));
        }
      }
    }
  }

  /* ---------------- 阳光 ---------------- */
  class Sun {
    constructor(x, y, value, kind, game, targetY) {
      this.x = x; this.y = y;
      this.targetY = (targetY == null) ? y : targetY;
      this.value = value;
      this.kind = kind;         // 'sky' | 'plant'
      this.t = 0;
      this.seed = game.rnd() * 6.28;
      this.life = 14;
      this.dead = false;
      this.vy = 0;
      this.collectT = 0;
      if (kind === 'sky') { this.vy = 40; }
      if (kind === 'plant') { this.vy = -150; }
    }
    update(dt, game) {
      this.t += dt;
      if (this.collectT > 0) {
        this.collectT -= dt;
        const k = 1 - this.collectT / 0.55;
        const T = (GardenGame.sunTarget ? GardenGame.sunTarget() : { x: 45, y: 34 });
        this.x += (T.x - this.x) * dt * 9 * k;
        this.y += (T.y - this.y) * dt * 9 * k;
        if (this.collectT <= 0) {
          this.dead = true;
          if (game) game.sunBounce = 0.32;   // 阳光罐回弹
        }
        return;
      }
      if (this.vy !== 0) {
        this.vy += 320 * dt;
        this.y += this.vy * dt;
        if (this.y >= this.targetY) {
          this.y = this.targetY;
          if (this.vy > 60 && this.kind === 'plant') {
            this.vy = -this.vy * 0.32;   // 落地小弹跳
          } else { this.vy = 0; }
        }
      } else {
        this.life -= dt;
        if (this.life <= 0) this.dead = true;
      }
    }
  }

  /* ---------------- 粒子 ---------------- */
  class Particle {
    constructor(x, y, vx, vy, life, color, size, grav, type, font, text) {
      this.x = x; this.y = y;
      this.vx = vx; this.vy = vy;
      this.life = life; this.maxLife = life;
      this.color = color;
      this.size = size;
      this.grav = grav || 0;
      this.type = type || 'dot';
      this.font = font;
      this.text = text;
      this.dead = false;
    }
    update(dt) {
      this.vy += this.grav * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.life -= dt;
      if (this.life <= 0) this.dead = true;
    }
  }

  /* ---------------- 小推车 ---------------- */
  class Mower {
    constructor(row) {
      this.row = row;
      this.x = GardenGame.mowerParkX();
      this.feetY = GardenGame.rowFeet(row) + 4;
      this.state = 'idle';   // idle | run | done
      this.smokeT = 0;
    }
    update(dt, game) {
      if (this.state !== 'run') return;
      this.x += 430 * dt;
      this.smokeT -= dt;
      if (this.smokeT <= 0) {
        this.smokeT = 0.05;
        game.particles.push(new Particle(this.x - 24, this.feetY - 22, -30 - game.rnd() * 20, -30 - game.rnd() * 20, 0.5, '#cfcfcf', 4, 0, 'smoke'));
      }
      for (const z of game.zombies) {
        if (z.row === this.row && z.dyingT <= 0 && Math.abs(z.x - this.x) < 52) {
          z.takeDamage(999999, game, false);
        }
      }
      if (this.x > 1040) this.state = 'done';
    }
  }

  GardenGame.Plant = Plant;
  GardenGame.Zombie = Zombie;
  GardenGame.Pea = Pea;
  GardenGame.Sun = Sun;
  GardenGame.Particle = Particle;
  GardenGame.Mower = Mower;

  if (typeof module !== 'undefined' && module.exports) module.exports = GardenGame;
})(typeof window !== 'undefined' ? window : globalThis);
