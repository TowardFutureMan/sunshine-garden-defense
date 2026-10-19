/* 静态设计资产：一次加载/缩放，共用根部、炮口与 UI 适配元数据。 */
(function (root) {
  'use strict';
  const GardenGame = root.GardenGame;
  const base = 'assets/designs/garden-design-assets/';
  const definitions = {
    sun: { file: 'sun-design-v1.png', bounds: [70,70,1184,1184], pivot: [627,627], height: 52, maxWidth: 52 },
    sunflower: { file: 'sunflower-design-v1.png', bounds: [231,100,1086,1204], pivot: [664,1187], height: 76 },
    peashooter: { file: 'peashooter-design-v2.png', bounds: [106,107,1167,1157], pivot: [627,1140], height: 74, mouths: [[1110,490]] },
    wallnut: { file: 'wallnut-design-v1.png', bounds: [213,142,1058,1134], pivot: [638,1117], height: 68 },
    snowpea: { file: 'snowpea-design-v1.png', bounds: [79,64,1201,1175], pivot: [638,1158], height: 74, mouths: [[1128,502]] },
    cherrybomb: { file: 'cherrybomb-design-v1.png', bounds: [84,136,1208,1110], pivot: [632,1093], height: 58 },
    repeater: { file: 'repeater-design-v1.png', bounds: [107,98,1190,1170], pivot: [635,1153], height: 74, mouths: [[1090,342],[1120,603]] },
    potatomine: { file: 'potatomine-design-v1.png', bounds: [118,182,1162,1091], pivot: [640,1074], height: 46 },
    mower: { file: 'mower-design-v1.png', bounds: [66,125,1221,1084], pivot: [700,1082], height: 60, maxWidth: 68 },
    shovel: { file: 'shovel-design-v1.png', bounds: [218,78,1168,1171], pivot: [693,1171], height: 52 }
  };
  for (const key of ['wallnut-cracked','wallnut-critical']) {
    const state=GardenGame.STATE_ART&&GardenGame.STATE_ART[key];
    if(state)definitions[key]=Object.assign({},state);
  }
  const reduced = GardenGame.reducedMotion ? GardenGame.reducedMotion() : false;
  const art = GardenGame.designArt = {};
  for (const key of Object.keys(definitions)) {
    const item = art[key] = Object.assign({ ready: false, failed: false, cache: null }, definitions[key]);
    const b = item.bounds;
    item.scale = Math.min(item.height / (b[3] - b[1]), (item.maxWidth || 76) / (b[2] - b[0]));
    // 保留可见边缘的低 alpha 过渡，缓存只供渲染，不改写原始 PNG。
    item.crop = [b[0] - 4, b[1] - 4, b[2] - b[0] + 8, b[3] - b[1] + 8];
    item.width = item.crop[2] * item.scale;
    item.height = item.crop[3] * item.scale;
    item.offsetX = (item.crop[0] - item.pivot[0]) * item.scale;
    item.offsetY = (item.crop[1] - item.pivot[1]) * item.scale;
    if (typeof root.Image !== 'function') continue;
    const image = item.image = new root.Image();
    image.onload = function () {
      if (image.naturalWidth !== 1254 || image.naturalHeight !== 1254) { item.failed = true; return; }
      if (root.document) {
        const cv = root.document.createElement('canvas');
        cv.width = Math.ceil(item.width * 3); cv.height = Math.ceil(item.height * 3);
        const ctx = cv.getContext('2d');
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(image, ...item.crop, 0, 0, cv.width, cv.height);
        item.cache = cv;
      }
      item.ready = true;
    };
    image.onerror = function () { item.failed = true; };
    image.src = item.src || base + item.file;
  }
  function pose(key, t, o) {
    if (o.static || reduced) return { sx: 1, sy: 1, angle: 0, dx: 0, dy: 0 };
    const pop = o.pop || 0, recoil = o.recoil || 0;
    const pulse = key === 'cherrybomb' && o.fuse < 0.8 ? Math.sin(t * 30) * 0.04 : 0;
    return {
      sx: 1 + pop * 0.08 - recoil * 0.06 + pulse,
      sy: 1 - pop * 0.08 + recoil * 0.025 + pulse,
      angle: -recoil * 0.035,
      dx: o.eatShake ? Math.sin(o.eatShake * 34) * 1.5 : 0,
      dy: key === 'potatomine' && o.armed === false ? 14 : 0
    };
  }
  function paint(ctx, item) {
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    if (item.cache) ctx.drawImage(item.cache, item.offsetX, item.offsetY, item.width, item.height);
    else ctx.drawImage(item.image, ...item.crop, item.offsetX, item.offsetY, item.width, item.height);
  }
  GardenGame.drawDesignPlant = function (ctx, key, x, y, t, o) {
    const item = art[key];
    if (!item || !item.ready) return false;
    const p = pose(key, t, o);
    ctx.save(); ctx.translate(x + p.dx, y);
    if (key === 'potatomine' && o.armed === false && !o.static) {
      ctx.beginPath(); ctx.rect(-50, -100, 100, 102); ctx.clip();
    }
    ctx.translate(0, p.dy); ctx.rotate(p.angle); ctx.scale(p.sx, p.sy);
    paint(ctx, item);
    if (key === 'wallnut' && !o.static && o.hpRatio < 0.66) {
      ctx.strokeStyle = '#785327'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-15,-54); ctx.lineTo(-10,-45); ctx.lineTo(-15,-35);
      if (o.hpRatio < 0.33) { ctx.moveTo(14,-54); ctx.lineTo(8,-46); ctx.lineTo(12,-37); }
      ctx.stroke();
    }
    ctx.restore();
    return true;
  };
  GardenGame.designMuzzleAt = function (key, t, o, index) {
    const item = art[key];
    if (!item || !item.ready || !item.mouths) return null;
    const m = item.mouths[(index || 0) % item.mouths.length], p = pose(key, t, o);
    const dx = (m[0] - item.pivot[0]) * item.scale * p.sx;
    const dy = (m[1] - item.pivot[1]) * item.scale * p.sy;
    return { x: p.dx + dx * Math.cos(p.angle) - dy * Math.sin(p.angle),
      y: p.dy + dx * Math.sin(p.angle) + dy * Math.cos(p.angle) };
  };
  GardenGame.drawDesignTool = function (ctx, key, x, y, w, h) {
    const item = art[key];
    if (!item || !item.ready) return false;
    const scale = Math.min(w / item.width, h / item.height);
    ctx.save();
    ctx.translate(x + (w - item.width * scale) / 2, y + (h - item.height * scale) / 2);
    ctx.scale(scale, scale); ctx.translate(-item.offsetX, -item.offsetY); paint(ctx, item);
    ctx.restore(); return true;
  };
  GardenGame.drawDesignMower = function (ctx, m, t) {
    const item = art.mower;
    if (!item.ready) return false;
    ctx.save(); ctx.translate(m.x + (m.state === 'run' && !reduced ? Math.sin(t * 40) * 0.7 : 0), m.feetY);
    GardenGame.drawShadow(ctx, 2, 1, 24, 5, 0.24); paint(ctx, item);
    ctx.restore(); return true;
  };
})(typeof window !== 'undefined' ? window : globalThis);
