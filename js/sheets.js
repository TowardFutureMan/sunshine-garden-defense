/* ============================================================
 * 序列帧播放模块 - 8帧图集加载 / 接地锚点对齐 / 硬切播放
 * 数据源: js/sheet-data.js (GardenGame.SHEET_DATA)
 * 接入方: sprites.js 的 GardenGame.drawPlant / GardenGame.drawMower,
 *          game.js 的选卡缩略图 / 铲子图标 / 铲子光标
 * ============================================================ */
(function (root) {
  'use strict';
  const GardenGame = root.GardenGame;
  const DATA = GardenGame.SHEET_DATA || {};
  const CACHE_H = 200;                       // 每帧离屏缓存高度(px), 兼顾清晰度与显存
  const sheets = GardenGame.sheets = {};            // key -> {src,frames,fps,scale,image,ready,failed,cache}

  function init(key, d) {
    const s = sheets[key] = {
      src: d.src, frames: d.frames, fps: d.fps || 7,
      scale: d.scale || 0.2, image: null, ready: false, failed: false, cache: []
    };
    if (typeof root.Image !== 'function') return;   // 无头环境(node 测试)保持未就绪, 走程序化降级
    const img = s.image = new root.Image();
    img.onload = function () {
      if (!img.naturalWidth) { s.failed = true; return; }
      s.ready = true;
      buildCache(s);
    };
    img.onerror = function () { s.failed = true; };
    img.src = s.src;
  }

  /* 逐帧预渲染到离屏画布: 每帧只做一次高质量缩放, 之后每帧一次 drawImage */
  function buildCache(s) {
    if (!root.document) return;
    s.cache = s.frames.map(function (f) {
      const k = CACHE_H / f.rect[3];
      const cv = root.document.createElement('canvas');
      cv.width = Math.max(1, Math.ceil(f.rect[2] * k));
      cv.height = CACHE_H;
      const c = cv.getContext('2d');
      c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
      c.drawImage(s.image, f.rect[0], f.rect[1], f.rect[2], f.rect[3], 0, 0, cv.width, cv.height);
      return cv;
    });
  }

  for (const key of Object.keys(DATA)) init(key, DATA[key]);

  GardenGame.sheetReady = function (key) { return !!(sheets[key] && sheets[key].ready); };
  GardenGame.sheetAllReady = function () {
    for (const k in sheets) if (!sheets[k].ready) return false;
    return true;
  };
  /* 帧序号: t 秒 -> floor(t*fps) 取模; reduced-motion 时恒为第 0 帧 */
  GardenGame.sheetFrameIndex = function (key, t) {
    const s = sheets[key];
    if (!s || !s.frames.length) return 0;
    if (GardenGame.reducedMotion && GardenGame.reducedMotion()) return 0;
    const n = s.frames.length;
    let i = Math.floor((t || 0) * s.fps) % n;
    return i < 0 ? i + n : i;
  };
  /* 炮口(游戏px, 相对接地锚点; 已含各图集缩放) */
  GardenGame.sheetMouths = function (key) {
    const s = sheets[key];
    return (s && s.ready && s.frames && DATA[key] && DATA[key].mouths) ? DATA[key].mouths : null;
  };

  /* o: { scaleMul=1, frame=null(按t), alpha=null, timeScale=1 } */
  GardenGame.drawSheet = function (ctx, key, x, y, t, o) {
    o = o || {};
    const s = sheets[key];
    if (!s || !s.ready) return false;
    const n = s.frames.length;
    const tt = (t || 0) * (o.timeScale || 1);
    const i = (o.frame != null) ? ((o.frame % n) + n) % n : GardenGame.sheetFrameIndex(key, tt);
    const f = s.frames[i];
    if (!f) return false;
    const disp = s.scale * (o.scaleMul == null ? 1 : o.scaleMul);
    const prevAlpha = ctx.globalAlpha;
    if (o.alpha != null) ctx.globalAlpha = prevAlpha * o.alpha;
    const cv = s.cache[i];
    if (cv) {
      const k = cv.height / f.rect[3];                    // 缓存倍率
      const dsk = disp / k;                               // 缓存 -> 屏幕
      ctx.drawImage(cv,
        x - (f.pivot[0] - f.rect[0]) * k * dsk,
        y - (f.pivot[1] - f.rect[1]) * k * dsk,
        cv.width * dsk, cv.height * dsk);
    } else {
      ctx.drawImage(s.image, f.rect[0], f.rect[1], f.rect[2], f.rect[3],
        x - (f.pivot[0] - f.rect[0]) * disp, y - (f.pivot[1] - f.rect[1]) * disp,
        f.rect[2] * disp, f.rect[3] * disp);
    }
    ctx.globalAlpha = prevAlpha;
    return true;
  };

  /* 在矩形框内居中适配(选卡栏图标 / 铲子光标) */
  GardenGame.drawSheetFit = function (ctx, key, x, y, w, h, t, o) {
    o = o || {};
    const s = sheets[key];
    if (!s || !s.ready) return false;
    const n = s.frames.length;
    const tt = (t || 0) * (o.timeScale || 1);
    const i = (o.frame != null) ? ((o.frame % n) + n) % n : GardenGame.sheetFrameIndex(key, tt);
    const f = s.frames[i];
    const disp = s.scale * (o.scaleMul == null ? 1 : o.scaleMul);
    const dw = f.rect[2] * disp, dh = f.rect[3] * disp;
    const k = Math.min(w / dw, h / dh);
    ctx.save();
    ctx.translate(x + (w - dw * k) / 2, y + (h - dh * k) / 2);
    ctx.scale(k, k);
    const ok = GardenGame.drawSheet(ctx, key, 0, 0, t, o);
    ctx.restore();
    return ok;
  };
})(typeof window !== 'undefined' ? window : globalThis);
