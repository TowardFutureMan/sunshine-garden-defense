/* ============================================================
 * 精灵模块 - 序列帧美术与 Canvas 路径绘制共用根部锚点
 * 面向约定: 植物向右(+x)发射，僵尸向左(-x)移动
 * ============================================================ */
(function (root) {
  'use strict';
  const GardenGame = root.GardenGame || (root.GardenGame = {});

  /* ---------- 基础工具(导出供其他模块复用) ---------- */
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function ell(ctx, x, y, rx, ry, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2);
  }
  function dot(ctx, x, y, r, fill) {
    ell(ctx, x, y, r, r); if (fill) ctx.fillStyle = fill; ctx.fill();
  }
  function leaf(ctx, x, y, dir, col) {
    ctx.save();
    ctx.translate(x, y); ctx.scale(dir, 1); ctx.rotate(-0.42);
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(12, -9, 24, -2);
    ctx.quadraticCurveTo(12, 7, 0, 0);
    ctx.fill();
    ctx.restore();
  }
  function stalk(ctx, t, seed, col, leafCol) {
    col = col || '#4e9a3d'; leafCol = leafCol || '#57a946';
    ctx.save();
    ctx.rotate(Math.sin(t * 1.6 + (seed || 0)) * 0.028);
    ctx.strokeStyle = col; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(0, -40); ctx.stroke();
    leaf(ctx, -3, -18, -1, leafCol);
    leaf(ctx, 3, -30, 1, leafCol);
    ctx.restore();
  }
  function eyes(ctx, x, y, rx, ry, look, pupilCol) {
    ctx.fillStyle = '#fff';
    ell(ctx, x - rx * 1.6, y, rx, ry); ctx.fill();
    ell(ctx, x + rx * 1.6, y, rx, ry); ctx.fill();
    ctx.fillStyle = pupilCol || '#33240f';
    ell(ctx, x - rx * 1.6 + look, y, rx * 0.55, ry * 0.62); ctx.fill();
    ell(ctx, x + rx * 1.6 + look, y, rx * 0.55, ry * 0.62); ctx.fill();
  }
  function smile(ctx, x, y, r, from, to, col, lw) {
    ctx.strokeStyle = col; ctx.lineWidth = lw || 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x, y, r, from, to); ctx.stroke();
  }

  /* ---------- 阳光图标 ---------- */
  GardenGame.rr = rr;
  GardenGame.ell = ell;
  GardenGame.dot = dot;
  GardenGame.drawSunIcon = function (ctx, cx, cy, r, t) {
    // 关卡阳光、阳光罐与价格图标使用同一张设计资产；加载失败保留原绘制。
    const size = r * 3.5;
    if (GardenGame.drawDesignTool && GardenGame.drawDesignTool(ctx, 'sun', cx-size/2, cy-size/2, size, size)) return;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((t || 0) * 0.6);
    ctx.fillStyle = 'rgba(255, 220, 90, 0.35)';
    for (let i = 0; i < 8; i++) {
      ctx.save(); ctx.rotate(i * Math.PI / 4);
      ctx.beginPath();
      ctx.moveTo(-r * 0.28, -r * 1.1);
      ctx.lineTo(0, -r * 1.75);
      ctx.lineTo(r * 0.28, -r * 1.1);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.15, 0, 0, r);
    g.addColorStop(0, '#fff3b0');
    g.addColorStop(0.55, '#ffd23f');
    g.addColorStop(1, '#f5a11e');
    ctx.fillStyle = g;
    ell(ctx, 0, 0, r, r); ctx.fill();
    ctx.strokeStyle = '#d97e10'; ctx.lineWidth = Math.max(1, r * 0.12); ctx.stroke();
    ctx.restore();
  };

  /* ============================================================
   * 植物绘制: (ctx, x, y, t, o)
   * x,y = 植物根部锚点; o = { seed, recoil, pop, hpRatio, eatShake,
   *                        fuse, armed, sunk, ice }
   * ============================================================ */
  function drawSunflower(ctx, x, y, t, o) {
    ctx.save(); ctx.translate(x, y);
    stalk(ctx, t, o.seed);
    const pop = o.pop || 0;
    ctx.save();
    ctx.translate(0, -52);
    ctx.rotate(Math.sin(t * 1.7 + (o.seed || 0)) * 0.05);
    ctx.scale(1 + pop * 0.16, 1 + pop * 0.16);
    for (let i = 0; i < 12; i++) {
      ctx.save(); ctx.rotate(i * Math.PI / 6);
      ctx.fillStyle = (i % 2) ? '#ffd23f' : '#ffc01f';
      ell(ctx, 0, -15, 6, 13, 0); ctx.fill();
      ctx.restore();
    }
    const g = ctx.createRadialGradient(-4, -4, 2, 0, 0, 14);
    g.addColorStop(0, '#ffb84d'); g.addColorStop(1, '#e8781a');
    ctx.fillStyle = g; ell(ctx, 0, 0, 13, 13); ctx.fill();
    ctx.strokeStyle = '#c26a14'; ctx.lineWidth = 2; ctx.stroke();
    eyes(ctx, 0, -2, 3.2, 4, 0.8);
    smile(ctx, 0, 3, 5.5, Math.PI * 0.15, Math.PI * 0.85, '#8a5a1a', 2);
    ctx.restore(); ctx.restore();
  }

  const PALS = {
    green: { stem: '#4e9a3d', leaf: '#57a946', head1: '#8fd66a', head2: '#5da83f', line: '#417a2b', mouth: '#245c16' },
    ice:   { stem: '#3f9fbf', leaf: '#4fb3cf', head1: '#bde9f5', head2: '#5cc6de', line: '#3a9db8', mouth: '#2a7a94' }
  };

  function drawShooter(ctx, x, y, t, o, pal, tubes) {
    ctx.save(); ctx.translate(x, y);
    stalk(ctx, t, o.seed, pal.stem, pal.leaf);
    const recoil = o.recoil || 0;
    ctx.save();
    ctx.translate(-recoil * 3.5, -52);
    ctx.fillStyle = pal.line;
    for (const ty of tubes) { rr(ctx, 6, ty - 5, 21, 10, 5); ctx.fill(); }
    ctx.fillStyle = pal.mouth;
    for (const ty of tubes) { ell(ctx, 27, ty, 3.2, 4.2); ctx.fill(); }
    const g = ctx.createRadialGradient(-4, -6, 2, 0, 0, 16);
    g.addColorStop(0, pal.head1); g.addColorStop(1, pal.head2);
    ctx.fillStyle = g; ell(ctx, 0, 0, 14, 13); ctx.fill();
    ctx.strokeStyle = pal.line; ctx.lineWidth = 2; ctx.stroke();
    eyes(ctx, 6, -4, 3, 3.5, 1);
    if (o.ice) {
      for (let i = 0; i < 3; i++) {
        const a = t * 2 + i * 2.1;
        const sx = Math.cos(a) * 15, sy = Math.sin(a) * 9 - 6;
        ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(sx - 2.4, sy); ctx.lineTo(sx + 2.4, sy);
        ctx.moveTo(sx, sy - 2.4); ctx.lineTo(sx, sy + 2.4);
        ctx.stroke();
      }
    }
    ctx.restore(); ctx.restore();
  }

  /* 豌豆射手: 序列帧(js/sheets.js, v3 图集)未就绪时的程序化降级绘制 */
  function drawPeashooter(ctx, x, y, t, o) {
    drawShooter(ctx, x, y, t, o, PALS.green, [-1]);
  }
  function drawSnowPea(ctx, x, y, t, o) {
    drawShooter(ctx, x, y, t, o, PALS.ice, [-1]);
  }
  function drawRepeater(ctx, x, y, t, o) {
    drawShooter(ctx, x, y, t, o, PALS.green, [-9, 8]);
  }

  function drawWallnut(ctx, x, y, t, o) {
    ctx.save(); ctx.translate(x, y);
    const shake = o.eatShake ? Math.sin(o.eatShake * 34) * 2.2 : 0;
    ctx.translate(shake, 0);
    const hp = (o.hpRatio == null) ? 1 : o.hpRatio;
    const g = ctx.createLinearGradient(0, -60, 0, 0);
    g.addColorStop(0, '#eab873'); g.addColorStop(1, '#c98a4b');
    ctx.fillStyle = g;
    ell(ctx, 0, -30, 25, 30, 0); ctx.fill();
    ell(ctx, 0, -56, 11, 9, 0); ctx.fill();
    ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#fff';
    ell(ctx, -8, -32, 4, 4.5); ctx.fill();
    ell(ctx, 7, -32, 4, 4.5); ctx.fill();
    if (hp < 0.45) {           // 受伤后变成 >" 怒眉
      ctx.strokeStyle = '#5d3a17'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(-12, -40); ctx.lineTo(-3, -35); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(11, -40); ctx.lineTo(2, -35); ctx.stroke();
      ctx.fillStyle = '#3a2410';
      ell(ctx, -8, -31, 2, 2.4); ctx.fill();
      ell(ctx, 7, -31, 2, 2.4); ctx.fill();
    } else {
      eyes(ctx, -0.5, -32, 4, 4.5, 0.6);
    }
    if (o.eatShake) {
      ctx.fillStyle = '#5d3a17';
      ell(ctx, 0, -20, 4.5, 3.4); ctx.fill();
    } else {
      smile(ctx, 0, -24, 5, Math.PI * 0.15, Math.PI * 0.85, '#7a4a22', 2.2);
    }
    if (hp < 0.66) {           // 裂纹
      ctx.strokeStyle = '#7a4a22'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-14, -52); ctx.lineTo(-8, -44); ctx.lineTo(-13, -36); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(15, -50); ctx.lineTo(9, -40); ctx.stroke();
    }
    if (hp < 0.33) {
      ctx.beginPath(); ctx.moveTo(12, -60); ctx.lineTo(6, -52); ctx.lineTo(13, -46); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-4, -12); ctx.lineTo(-10, -8); ctx.stroke();
    }
    ctx.restore();
  }

  function drawCherry(ctx, x, y, t, o) {
    ctx.save(); ctx.translate(x, y);
    const f = (o.fuse == null) ? 9 : o.fuse;
    const pulse = (f < 0.8) ? 1 + Math.sin(t * 30) * 0.11 : 1;
    ctx.save(); ctx.scale(pulse, pulse);
    ctx.strokeStyle = '#3f8f3a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-9, -26); ctx.quadraticCurveTo(-5, -42, 0, -45); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(9, -26); ctx.quadraticCurveTo(5, -42, 0, -45); ctx.stroke();
    leaf(ctx, 1, -44, 1, '#57a946');
    cherryBall(ctx, -10, -22);
    cherryBall(ctx, 10, -22);
    ctx.restore(); ctx.restore();
  }
  function cherryBall(ctx, cx, cy) {
    const g = ctx.createRadialGradient(cx - 4, cy - 5, 2, cx, cy, 14);
    g.addColorStop(0, '#ff8a76'); g.addColorStop(1, '#d22f2f');
    ctx.fillStyle = g; ell(ctx, cx, cy, 12, 12); ctx.fill();
    ctx.strokeStyle = '#8f1d1d'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff';
    ell(ctx, cx - 4, cy - 2, 2.6, 3); ctx.fill();
    ell(ctx, cx + 4, cy - 2, 2.6, 3); ctx.fill();
    ctx.fillStyle = '#2a0f0f';
    ell(ctx, cx - 3.4, cy - 1.6, 1.3, 1.8); ctx.fill();
    ell(ctx, cx + 4.6, cy - 1.6, 1.3, 1.8); ctx.fill();
    ctx.strokeStyle = '#2a0f0f'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - 7, cy - 8); ctx.lineTo(cx - 2, cy - 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 7, cy - 8); ctx.lineTo(cx + 2, cy - 5); ctx.stroke();
    smile(ctx, cx, cy + 3, 3.6, Math.PI * 1.15, Math.PI * 1.85, '#2a0f0f', 2);
  }

  function drawPotato(ctx, x, y, t, o) {
    ctx.save(); ctx.translate(x, y);
    ctx.save();
    ctx.translate(0, o.sunk || 0);
    if (!o.armed) {
      ctx.fillStyle = '#7a5a36';
      ell(ctx, 0, 2, 20, 9, 0); ctx.fill();
      ctx.fillStyle = '#5f4527';
      ell(ctx, -8, 4, 4, 2.5); ctx.fill();
      ell(ctx, 7, 4, 5, 3); ctx.fill();
      ctx.save(); ctx.translate(0, -4); ctx.rotate(Math.sin(t * 2) * 0.12);
      ctx.strokeStyle = '#4e9a3d'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -10); ctx.stroke();
      leaf(ctx, 0, -10, 1, '#57a946');
      leaf(ctx, 0, -10, -1, '#57a946');
      ctx.restore();
    } else {
      const g = ctx.createRadialGradient(-5, -25, 3, 0, -18, 24);
      g.addColorStop(0, '#caa06a'); g.addColorStop(1, '#96683c');
      ctx.fillStyle = g;
      ell(ctx, 0, -18, 19, 15, 0); ctx.fill();
      ctx.fillStyle = 'rgba(122, 86, 48, 0.55)';
      ell(ctx, -12, -13, 4, 3); ctx.fill();
      ell(ctx, 10, -22, 3.5, 3); ctx.fill();
      ell(ctx, 7, -10, 3, 2.5); ctx.fill();
      ctx.strokeStyle = '#6f4a26'; ctx.lineWidth = 2;
      ell(ctx, 0, -18, 19, 15, 0); ctx.stroke();
      eyes(ctx, 0, -20, 3, 3.4, 0.5);
      smile(ctx, 0, -14, 4.5, Math.PI * 0.15, Math.PI * 0.85, '#3a2617', 2);
      const blink = (Math.sin(t * 8) + 1) / 2;
      ctx.fillStyle = 'rgba(255, 80, 60,' + (blink * 0.25).toFixed(3) + ')';
      ell(ctx, 0, -37, 8, 8); ctx.fill();
      ctx.fillStyle = 'rgba(255, 60, 40,' + (0.4 + blink * 0.6).toFixed(3) + ')';
      ell(ctx, 0, -37, 3.2, 3.2); ctx.fill();
    }
    ctx.restore(); ctx.restore();
  }

  const PLANT_DRAWERS = {
    sunflower: drawSunflower,
    peashooter: drawPeashooter,
    snowpea: drawSnowPea,
    repeater: drawRepeater,
    wallnut: drawWallnut,
    cherrybomb: drawCherry,
    potatomine: drawPotato
  };
  /* 序列帧姿态: 落地回弹/射击后坐/啃食摇晃/樱桃引信脉冲(与静态设计图期一致) */
  function sheetPose(key, t, o) {
    if (o.static || (GardenGame.reducedMotion && GardenGame.reducedMotion())) return { angle: 0, sx: 1, sy: 1, dx: 0 };
    const pop = o.pop || 0, recoil = o.recoil || 0;
    const pulse = key === 'cherrybomb' && o.fuse > 0 && o.fuse < 0.8 ? Math.sin(t * 30) * 0.04 : 0;
    return {
      angle: -recoil * 0.045,
      sx: 1 + pop * 0.08 - recoil * 0.06 + pulse,
      sy: 1 - pop * 0.08 + recoil * 0.025 + pulse,
      dx: o.eatShake ? Math.sin(o.eatShake * 34) * 1.5 : 0
    };
  }
  GardenGame.drawPlant = function (ctx, key, x, y, t, o) {
    o = o || {};
    /* 统一脚底软阴影(光源左上, 落点略偏右下) */
    const SR = { sunflower: 25, peashooter: 25, snowpea: 25, repeater: 25, wallnut: 33, cherrybomb: 24, potatomine: 20 };
    const rx = SR[key] || 24;
    GardenGame.drawShadow(ctx, x, y - 1, rx, rx * 0.34, o.armed === false ? 0.12 : 0.22);
    /* 选卡和放置预览优先使用静态母版，不经过动画图集。 */
    if (o.static && GardenGame.drawDesignPlant && GardenGame.drawDesignPlant(ctx, key, x, y, 0, o)) return;
    /* 土豆雷未武装: 埋地土丘用程序化绘制(图集只做已激活姿态) */
    if (key === 'potatomine' && o.armed === false) {
      const mound = PLANT_DRAWERS.potatomine;
      if (mound) { mound(ctx, x, y, o.static ? 0 : t, o); return; }
    }
    /* 1) 8帧序列帧(正常态) */
    if (GardenGame.sheetReady && GardenGame.sheetReady(key)) {
      const tt = o.static ? 0 : t;
      const pose = sheetPose(key, tt, o);
      ctx.save();
      ctx.translate(x + pose.dx, y);
      ctx.rotate(pose.angle); ctx.scale(pose.sx, pose.sy);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      GardenGame.drawSheet(ctx, key, 0, 0, tt, null);
      /* 墙坚果受损裂纹(程序化叠加, 不依赖来源) */
      if (key === 'wallnut' && !o.static && o.hpRatio < 0.66) {
        ctx.strokeStyle = '#785327'; ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-15, -54); ctx.lineTo(-10, -45); ctx.lineTo(-15, -35);
        if (o.hpRatio < 0.33) { ctx.moveTo(14, -54); ctx.lineTo(8, -46); ctx.lineTo(12, -37); }
        ctx.stroke();
      }
      ctx.restore();
      return;
    }
    /* 2) 静态设计图(序列帧加载失败时) */
    if (GardenGame.drawDesignPlant && GardenGame.drawDesignPlant(ctx, key, x, y, t, o)) return;
    /* 3) 程序化降级 */
    const fn = PLANT_DRAWERS[key];
    if (fn) fn(ctx, x, y, o.static ? 0 : t, o);
  };

  GardenGame.plantMuzzleAt = function (key, t, o, index) {
    const mouths = GardenGame.sheetMouths ? GardenGame.sheetMouths(key) : null;
    if (mouths && mouths.length) {
      const m = mouths[(index || 0) % mouths.length];
      return { x: m[0], y: m[1] };
    }
    return GardenGame.designMuzzleAt ? GardenGame.designMuzzleAt(key, t, o, index) : null;
  };

  /* ============================================================
   * 僵尸绘制: drawZombie(ctx, z, t)
   * z = { x, feetY, walkPhase, type, eating, eatT, flash, freezeT,
   *       dyingT, moving, armor, angry, pad, skin, vaultT, vaultDur }
   * ============================================================ */
  function zleg(ctx, x, phase, skin, dark) {
    ctx.save();
    ctx.translate(x, -24);
    ctx.rotate(Math.sin(phase) * 0.5);
    ctx.fillStyle = skin;
    rr(ctx, -4.5, 0, 9, 25, 4); ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.fillStyle = '#4a3b2f';
    rr(ctx, -6, 20, 15, 6, 2.5); ctx.fill();
    ctx.restore();
  }
  function zarm(ctx, sx, sy, eating, eatT, phase, skin, dark) {
    const chomp = eating ? -Math.abs(Math.sin(eatT * 9 + phase)) * 15 : Math.sin(phase) * 2.5;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(-0.12 + (eating ? Math.sin(eatT * 9 + phase) * 0.22 : 0));
    ctx.strokeStyle = skin; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-18, 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-18, 5); ctx.lineTo(-34, 5 + chomp); ctx.stroke();
    ctx.fillStyle = skin;
    dot(ctx, -34, 5 + chomp, 5);
    ctx.strokeStyle = dark; ctx.lineWidth = 1.4;
    ell(ctx, -34, 5 + chomp, 5, 5); ctx.stroke();
    ctx.restore();
  }

  GardenGame.drawZombie = function (ctx, z, t) {
    ctx.save();
    ctx.translate(z.x, z.feetY);
    const dying = z.dyingT > 0 ? (1 - z.dyingT / 0.9) : 0;
    if (dying > 0) {
      ctx.globalAlpha = z.dyingT < 0.25 ? Math.max(z.dyingT / 0.25, 0) : 1;
      ctx.rotate(Math.min(dying, 1) * 1.35);
      ctx.translate(0, dying * 8);
    }
    const vaultH = z.vaultT > 0 ? Math.sin(Math.PI * (z.vaultDur - z.vaultT) / z.vaultDur) * 58 : 0;
    ctx.translate(0, -vaultH);
    const flash = z.flash > 0;
    if (flash) { try { ctx.filter = 'brightness(1.9) saturate(0.4)'; } catch (e) { /* noop */ } }

    const walk = z.walkPhase;
    const bob = z.moving ? Math.abs(Math.sin(walk)) * 2.2 : Math.sin(t * 2.2) * 0.7;
    const frozen = z.freezeT > 0;

    /* 脚底接地阴影 */
    GardenGame.drawShadow(ctx, 0, 2, 20, 6.5, 0.26);

    const skin = z.skin || '#a9bd8f';
    const dark = '#57684f';
    const coat = z.pad ? '#8a4b42' : '#5f6f63';

    zleg(ctx, -8, walk + Math.PI, skin, dark);
    zleg(ctx, 7, walk, skin, dark);

    ctx.save();
    ctx.rotate(z.eating ? -0.12 : -0.055);
    const by = -46 + bob;

    /* 躯干(破外套) */
    ctx.fillStyle = coat;
    ctx.beginPath();
    ctx.moveTo(-13, by + 4);
    ctx.quadraticCurveTo(-16, by + 22, -11, by + 40);
    ctx.lineTo(-6, by + 35); ctx.lineTo(-2, by + 41); ctx.lineTo(3, by + 35);
    ctx.lineTo(9, by + 41); ctx.lineTo(13, by + 34);
    ctx.quadraticCurveTo(16, by + 22, 13, by + 4);
    ctx.quadraticCurveTo(0, by - 3, -13, by + 4);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = 2; ctx.stroke();
    /* V 领 */
    ctx.strokeStyle = '#3f4a3d'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-4, by + 4); ctx.lineTo(-2, by + 16); ctx.lineTo(2, by + 4); ctx.stroke();
    /* 纽扣 */
    ctx.fillStyle = '#39432f';
    dot(ctx, 3, by + 22, 1.4); dot(ctx, 3, by + 30, 1.4);

    /* 手臂 */
    zarm(ctx, -9, by + 8, z.eating, z.eatT, 0, skin, dark);
    zarm(ctx, -2, by + 10, z.eating, z.eatT, 1.3, skin, dark);

    /* 头 */
    ctx.save();
    ctx.translate(-4, by - 14);
    ctx.rotate(z.eating ? -0.06 : 0);
    ctx.fillStyle = skin;
    ell(ctx, 0, 0, 13, 15, 0); ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = 2; ctx.stroke();
    /* 耳朵 */
    ell(ctx, -9, 1, 4, 5, 0); ctx.fill();
    /* 眼睛 */
    ctx.fillStyle = '#fff';
    ell(ctx, -9, -4, 4.4, 4.8, 0); ctx.fill();
    ctx.fillStyle = z.angry ? '#e23b2e' : '#20261c';
    ell(ctx, -10.4, -4, 2.2, 2.4, 0); ctx.fill();
    if (z.angry) {   // 怒眉
      ctx.strokeStyle = '#20261c'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-14, -9); ctx.lineTo(-5, -6.5); ctx.stroke();
    }
    /* 嘴 */
    if (z.eating) {
      ctx.fillStyle = '#3a2f28';
      ell(ctx, -10, 7, 4, 3, 0); ctx.fill();
      ctx.fillStyle = '#e8e0d0';
      ctx.fillRect(-13, 4.6, 6.5, 2);
    } else {
      ctx.strokeStyle = '#3f4a3d'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-12, 7); ctx.lineTo(-6, 8.4); ctx.stroke();
    }
    /* 头发 */
    ctx.fillStyle = '#3a332a';
    ctx.beginPath();
    ctx.moveTo(-4, -12); ctx.lineTo(2, -19); ctx.lineTo(7, -11);
    ctx.lineTo(12, -16); ctx.lineTo(14, -6);
    ctx.closePath(); ctx.fill();

    /* ---- 头饰/装甲 ---- */
    if (z.armor && z.armor.hp > 0) {
      if (z.armor.type === 'cone') {
        ctx.save(); ctx.rotate(-0.1);
        ctx.fillStyle = '#e8850c';
        ctx.beginPath();
        ctx.moveTo(-14, -10); ctx.lineTo(10, -10); ctx.lineTo(-2, -34);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f2f2f2';
        rr(ctx, -12.5, -17, 22, 5.5, 2); ctx.fill();
        ctx.strokeStyle = '#a85f04'; ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-14, -10); ctx.lineTo(-2, -34); ctx.lineTo(10, -10);
        ctx.closePath(); ctx.stroke();
        ctx.restore();
      } else if (z.armor.type === 'bucket') {
        const g = ctx.createLinearGradient(0, -32, 0, -10);
        g.addColorStop(0, '#c9cfd6'); g.addColorStop(0.5, '#9aa3ad'); g.addColorStop(1, '#787f88');
        ctx.fillStyle = g;
        rr(ctx, -15, -31, 28, 21, 4); ctx.fill();
        ctx.strokeStyle = '#5a616a'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#c9cfd6';
        ell(ctx, -1, -31, 14, 5, 0); ctx.fill();
        ctx.strokeStyle = '#5a616a'; ctx.lineWidth = 1.6; ctx.stroke();
        ctx.fillStyle = '#5a616a';
        dot(ctx, -10, -26, 1.3); dot(ctx, 8, -26, 1.3);
      }
    }
    if (z.armor && z.armor.type === 'helmet' && z.armor.hp > 0) {
      ctx.fillStyle = '#c23a2e';
      ell(ctx, -2, -7, 15, 13, 0); ctx.fill();
      ctx.save();
      ctx.translate(-2, -7); ctx.rotate(Math.PI / 2);
      ctx.fillStyle = '#f2f2f2';
      rr(ctx, -1.6, -13, 3.2, 25, 1.5); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = '#8f2418'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(-2, -7, 15, 13, 0, Math.PI, 0); ctx.stroke();
      /* 面罩 */
      ctx.strokeStyle = '#d8d8d8'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-14, -2); ctx.lineTo(-18, 4); ctx.stroke();
    }
    ctx.restore(); /* 头 */

    /* 报纸 (挡在身前) */
    if (z.armor && z.armor.type === 'paper' && z.armor.hp > 0) {
      ctx.save();
      ctx.translate(-6, by + 16); ctx.rotate(-0.35);
      ctx.fillStyle = '#e6d9b8';
      rr(ctx, -50, -14, 36, 30, 2); ctx.fill();
      ctx.strokeStyle = '#a08c60'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#b3452f';
      rr(ctx, -46, -10, 20, 4, 1); ctx.fill();
      ctx.strokeStyle = '#8a7a52'; ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.moveTo(-46, -3 + i * 6); ctx.lineTo(-18, -3 + i * 6); ctx.stroke();
      }
      ctx.restore();
    }

    /* 橄榄球护肩 */
    if (z.pad) {
      ctx.fillStyle = '#c23a2e';
      rr(ctx, -14, by + 2, 28, 10, 5); ctx.fill();
      ctx.strokeStyle = '#8f2418'; ctx.lineWidth = 2; ctx.stroke();
    }

    /* 旗帜 */
    if (z.type === 'flag') {
      ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(16, by + 20); ctx.lineTo(16, by - 78); ctx.stroke();
      const w = Math.sin(t * 7) * 4;
      ctx.fillStyle = '#d23b3b';
      ctx.beginPath();
      ctx.moveTo(16, by - 78);
      ctx.quadraticCurveTo(34, by - 74 + w, 42, by - 68 + w);
      ctx.quadraticCurveTo(34, by - 62 + w, 16, by - 58);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff';
      dot(ctx, 30, by - 68 + w, 2.4);
      ctx.fillStyle = skin;
      dot(ctx, 16, by + 18, 5);
    }

    /* 撑杆 */
    if (z.type === 'polevault' && !z.vaulted && z.vaultT <= 0) {
      ctx.save();
      ctx.translate(10, by + 30); ctx.rotate(-0.9);
      ctx.strokeStyle = '#c99b5f'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -86); ctx.stroke();
      ctx.strokeStyle = '#a84b3a'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(0, -66); ctx.lineTo(0, -50); ctx.stroke();
      ctx.restore();
    }
    ctx.restore(); /* 身体 */

    /* 冰冻覆盖 */
    if (frozen) {
      ctx.fillStyle = 'rgba(120, 200, 255, 0.26)';
      ell(ctx, -6, -38, 22, 26, 0); ctx.fill();
      ell(ctx, -8, -62, 14, 15, 0); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.8)';
      dot(ctx, -18, -44, 1.4); dot(ctx, 6, -52, 1.2);
    }
    ctx.restore();
  };

  /* ---------- 豌豆 ---------- */
  GardenGame.drawPea = function (ctx, p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.ice) {
      ctx.fillStyle = 'rgba(140,220,255,.35)';
      ell(ctx, 0, 0, 9, 9); ctx.fill();
    }
    const g = ctx.createRadialGradient(-2, -2, 1, 0, 0, 7);
    g.addColorStop(0, p.ice ? '#eafaff' : '#c4f19a');
    g.addColorStop(1, p.ice ? '#5cc6de' : '#4f9e33');
    ctx.fillStyle = g;
    ell(ctx, 0, 0, 6.5, 6.5); ctx.fill();
    ctx.strokeStyle = p.ice ? '#3a9db8' : '#3c7a26';
    ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  };

  /* ---------- 阳光 ---------- */
  GardenGame.sunVisualPose = function (s,t) {
    const reduced = GardenGame.reducedMotion && GardenGame.reducedMotion();
    const collecting = s.collectT > 0;
    const phase = t * Math.PI * 2 / GardenGame.SUN.idlePeriod + (s.seed || 0);
    if (collecting || reduced) return {
      x:s.x,y:s.y,angle:0,scale:collecting ? .7+.3*Math.min(1,s.collectT/.55) : 1,
      phase:phase,glow:.18,sparkles:false
    };
    return {
      x:s.x+Math.cos(phase)*GardenGame.SUN.floatX,
      y:s.y+Math.sin(phase)*GardenGame.SUN.floatY,
      angle:Math.sin(phase)*.04,
      scale:1+Math.cos(phase)*GardenGame.SUN.breath,
      phase:phase,glow:.17+.07*(.5+.5*Math.sin(phase)),sparkles:true
    };
  };
  GardenGame.sunOrbitSpots=function(s,t){
    const spots=[];
    for(let i=0;i<5;i++){
      const angle=t*Math.PI*2/4.8+(s.seed||0)+i*Math.PI*2/5;
      const radius=33+(i%3)*3;
      spots.push({x:Math.cos(angle)*radius,y:Math.sin(angle)*radius,r:3.2+(i%2)*1.2,alpha:.65+.2*Math.sin(t*2+i)});
    }
    return spots;
  };
  GardenGame.drawSun = function (ctx, s, t) {
    const pose=GardenGame.sunVisualPose(s,t);
    ctx.save();ctx.translate(pose.x,pose.y);
    const blink = s.collectT<=0 && s.life<3 ? .4+.6*Math.abs(Math.sin(t*6)) : 1;
    ctx.globalAlpha*=blink;
    // 扩散光晕只画在收集物周围，顶部和价格图标保持静态。
    const radius=38*pose.scale;
    const halo=ctx.createRadialGradient(0,0,8,0,0,radius);
    halo.addColorStop(0,'rgba(255,227,106,'+pose.glow+')');
    halo.addColorStop(.55,'rgba(255,215,73,'+(pose.glow*.5)+')');
    halo.addColorStop(1,'rgba(255,210,60,0)');
    ctx.fillStyle=halo;ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.fill();
    if(pose.sparkles)for(const spot of GardenGame.sunOrbitSpots(s,t)){
      ctx.save();ctx.globalAlpha*=spot.alpha;
      const light=ctx.createRadialGradient(spot.x,spot.y,0,spot.x,spot.y,spot.r*1.8);
      light.addColorStop(0,'#fffbd4');light.addColorStop(.3,'#ffe88b');light.addColorStop(1,'rgba(255,220,88,0)');
      ctx.fillStyle=light;ctx.beginPath();ctx.arc(spot.x,spot.y,spot.r*1.8,0,Math.PI*2);ctx.fill();ctx.restore();
    }
    ctx.rotate(pose.angle);ctx.scale(pose.scale,pose.scale);
    GardenGame.drawSunIcon(ctx,0,0,GardenGame.SUN.iconRadius,t+(s.seed||0));
    ctx.restore();
  };

  /* ---------- 小推车 ---------- */
  GardenGame.drawMower = function (ctx, m, t) {
    /* 停车使用静态母版，只有触发清场后才播放轮子序列帧。 */
    if (m.state === 'run' && GardenGame.sheetReady && GardenGame.sheetReady('mower')) {
      ctx.save();
      const running = m.state === 'run';
      const jitter = running && !(GardenGame.reducedMotion && GardenGame.reducedMotion()) ? Math.sin(t * 40) * 0.7 : 0;
      ctx.translate(m.x + jitter, m.feetY);
      GardenGame.drawShadow(ctx, 0, 2, 24, 5, 0.24);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      const sheet = GardenGame.sheets.mower;
      const maxHeight = Math.max(...sheet.frames.map(f => f.rect[3])) * sheet.scale;
      const design = GardenGame.designArt && GardenGame.designArt.mower;
      const scaleMul = design && design.ready ? design.height / maxHeight : 1;
      GardenGame.drawSheet(ctx, 'mower', 0, 0, t, { timeScale: 2.6, scaleMul: scaleMul });
      ctx.restore();
      return;
    }
    if (GardenGame.drawDesignMower && GardenGame.drawDesignMower(ctx, m, t)) return;
    ctx.save();
    ctx.translate(m.x, m.feetY);
    const shake = m.state === 'run' ? Math.sin(t * 40) * 1.5 : 0;
    ctx.translate(shake, 0);
    GardenGame.drawShadow(ctx, 0, 2, 23, 6, 0.26);
    /* 车身 */
    const g = ctx.createLinearGradient(0, -26, 0, -2);
    g.addColorStop(0, '#d64545'); g.addColorStop(1, '#962c2c');
    ctx.fillStyle = g;
    rr(ctx, -22, -26, 44, 22, 7); ctx.fill();
    ctx.strokeStyle = '#6e1f1f'; ctx.lineWidth = 2.5; ctx.stroke();
    /* 引擎盖 */
    ctx.fillStyle = '#b03030';
    rr(ctx, -30, -20, 12, 14, 4); ctx.fill();
    ctx.strokeStyle = '#6e1f1f'; ctx.lineWidth = 2; ctx.stroke();
    /* 刀片 */
    ctx.fillStyle = '#cfd6dd';
    ell(ctx, 22, -14, 6, 6, t * (m.state === 'run' ? 20 : 1)); ctx.fill();
    ctx.strokeStyle = '#7d868f'; ctx.lineWidth = 1.5; ctx.stroke();
    /* 轮子 */
    ctx.fillStyle = '#2c2c2c';
    dot(ctx, -12, 0, 8); dot(ctx, 14, 0, 8);
    ctx.fillStyle = '#8f8f8f';
    dot(ctx, -12, 0, 3.2); dot(ctx, 14, 0, 3.2);
    /* 排气 */
    ctx.fillStyle = '#5a616a';
    rr(ctx, -32, -32, 5, 10, 2); ctx.fill();
    ctx.restore();
  };

  /* ---------- 粒子 ---------- */
  GardenGame.drawParticle = function (ctx, p, t) {
    const a = Math.max(0, Math.min(1, p.life / p.maxLife));
    ctx.save();
    if (p.type === 'text') {
      ctx.globalAlpha = a;
      ctx.font = p.font || 'bold 18px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.55)';
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    } else if (p.type === 'ring') {
      ctx.globalAlpha = a * 0.9;
      ctx.strokeStyle = p.color; ctx.lineWidth = 3 + 5 * a;
      ell(ctx, p.x, p.y, p.size * (1.6 - a), p.size * (1.6 - a)); ctx.stroke();
    } else if (p.type === 'snow') {
      ctx.globalAlpha = a;
      ctx.strokeStyle = p.color; ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(p.x - 3, p.y); ctx.lineTo(p.x + 3, p.y);
      ctx.moveTo(p.x, p.y - 3); ctx.lineTo(p.x, p.y + 3);
      ctx.stroke();
    } else {
      ctx.globalAlpha = p.type === 'smoke' ? a * 0.5 : a;
      ctx.fillStyle = p.color;
      ell(ctx, p.x, p.y, p.size * (p.type === 'smoke' ? (2 - a) * 0.8 : a), p.size * (p.type === 'smoke' ? (2 - a) * 0.8 : a));
      ctx.fill();
    }
    ctx.restore();
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = GardenGame;
})(typeof window !== 'undefined' ? window : globalThis);
