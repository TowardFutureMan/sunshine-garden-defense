/* ============================================================
 * 设计令牌 - "阳光庭院玩具塔防"
 * 色彩/字体/布局/材质 的唯一来源, 其他模块只引用不硬编码
 * 布局常量同时服务于绘制与点击判定(同源不同拷贝)
 * ============================================================ */
(function (root) {
  'use strict';
  const GardenGame = root.GardenGame || (root.GardenGame = {});

  /* ---- 核心色板(庭院材料) ---- */
  GardenGame.C = {
    lawnLight: '#93cf5a',   // 草坪亮格
    lawnDark: '#79b545',    // 草坪暗格
    lawnEdge: '#4e7d2e',    // 草坪边缘深绿
    bedSoil: '#5a4128',     // 花坛床土
    woodLight: '#b07c45',   // 蜂蜜木亮
    wood: '#8a5f33',        // 木
    woodDark: '#6b4223',    // 深木(描边)
    terra: '#c96f4a',       // 陶土
    terraDark: '#a04f30',
    sun: '#ffd23f',         // 阳光
    sunDeep: '#f5a11e',
    cream: '#f7ead0',       // 奶油(缝线/高光)
    soil: '#4a3626',        // 园土褐(文字/描边)
    soilSoft: '#6b5238',
    felt: '#e8d5a8',        // 种子袋呢绒
    feltDark: '#d3ba80',
    steel: '#b8c4cc',
    steelDark: '#6f7a84',
    danger: '#c0392b',
    good: '#5da83f'
  };

  GardenGame.FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Source Han Sans SC", sans-serif';

  /* ---- 操作台布局(逻辑坐标 1000x620) ---- */
  GardenGame.UI = {
    sunPanel: { x: 8, y: 5, w: 80, h: 70 },
    packet: { x: 96, y: 5, w: 74, h: 70, pitch: 78 },
    shovel: { x: 646, y: 5, w: 56, h: 70 },
    prog: { x: 712, y: 22, w: 176, h: 16 },
    pause: { x: 898, y: 5, w: 46, h: 70 },
    mute: { x: 950, y: 5, w: 42, h: 70 }
  };
  /* 第 i 个种子袋的矩形 */
  GardenGame.packetRect = function (i) {
    const p = GardenGame.UI.packet;
    return { x: p.x + i * p.pitch, y: p.y, w: p.w, h: p.h };
  };
  /* 阳光罐中心(阳光飞入目标) */
  GardenGame.sunTarget = function () {
    const s = GardenGame.UI.sunPanel;
    return { x: s.x + s.w / 2, y: s.y + s.h * 0.42 };
  };

  /* ---- 材质绘制助手 ---- */
  /* 软阴影(统一光源: 左上来光, 影子落向右下) */
  GardenGame.drawShadow = function (ctx, x, y, rx, ry, alpha) {
    ry = ry || rx * 0.36;
    ctx.save();
    ctx.globalAlpha = alpha == null ? 0.24 : alpha;
    ctx.fillStyle = '#2f4a1e';
    ctx.beginPath();
    ctx.ellipse(x + rx * 0.16, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  /* 呢绒缝线(虚线) */
  GardenGame.stitch = function (ctx, x, y, w, h, r, col, lw) {
    ctx.save();
    ctx.strokeStyle = col || GardenGame.C.cream;
    ctx.lineWidth = lw || 1.4;
    ctx.setLineDash([4, 3]);
    GardenGame.rr(ctx, x, y, w, h, r);
    ctx.stroke();
    ctx.restore();
  };

  /* 木质横条(台面/木牌): 带年轮细纹与顶面高光 */
  GardenGame.woodPlank = function (ctx, x, y, w, h, r, c1, c2, edge) {
    c1 = c1 || GardenGame.C.woodLight; c2 = c2 || GardenGame.C.wood; edge = edge || GardenGame.C.woodDark;
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    GardenGame.rr(ctx, x, y, w, h, r);
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = edge; ctx.lineWidth = 2; ctx.stroke();
    /* 顶面高光 */
    ctx.save();
    GardenGame.rr(ctx, x, y, w, h, r); ctx.clip();
    ctx.fillStyle = 'rgba(255,235,190,.22)';
    ctx.fillRect(x, y, w, Math.max(1.5, h * 0.18));
    /* 木纹细线 */
    ctx.strokeStyle = 'rgba(60,36,16,.10)'; ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const ly = y + h * (i / 4);
      ctx.beginPath(); ctx.moveTo(x + 3, ly);
      ctx.bezierCurveTo(x + w * 0.3, ly + 1.2, x + w * 0.6, ly - 1.2, x + w - 3, ly);
      ctx.stroke();
    }
    ctx.restore();
  };

  /* 圆角木质钉帽(工具按钮) */
  GardenGame.woodButton = function (ctx, x, y, w, h, active, hover) {
    const r = 8;
    GardenGame.rr(ctx, x, y, w, h, r);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    if (active) { g.addColorStop(0, '#ffe9a8'); g.addColorStop(1, '#f0c95e'); }
    else if (hover) { g.addColorStop(0, '#f2e2ba'); g.addColorStop(1, '#dcc491'); }
    else { g.addColorStop(0, GardenGame.C.felt); g.addColorStop(1, GardenGame.C.feltDark); }
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = active ? GardenGame.C.sunDeep : GardenGame.C.woodDark;
    ctx.lineWidth = active ? 2.5 : 2; ctx.stroke();
    GardenGame.stitch(ctx, x + 4, y + 4, w - 8, h - 8, 5, active ? 'rgba(160,110,20,.5)' : 'rgba(247,234,208,.75)', 1.2);
  };

  /* 文字描边(游戏内一切文字的 Unified 处理) */
  GardenGame.outlinedText = function (ctx, text, x, y, fill, stroke, lw) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = lw || 3;
    ctx.strokeStyle = stroke || 'rgba(40,26,12,.85)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
  };

  /* 触屏/桌面反馈提示(短暂浮出, 靠近操作点) */
  GardenGame.reducedMotion = function () {
    if (typeof root.matchMedia !== 'function') return false;
    return root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = GardenGame;
})(typeof window !== 'undefined' ? window : globalThis);
