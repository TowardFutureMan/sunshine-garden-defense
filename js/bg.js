/* ============================================================
 * 静态场景背景 - 预渲染到离屏 canvas
 * 内容: 日光氛围 / 花坛床沿 / 双色棋盘草坪 / 左侧砖台 / 右侧土路
 * 每帧仅 drawImage; 动态草叶与光尘由 drawAmbient 追加
 * ============================================================ */
(function (root) {
  'use strict';
  const GardenGame = root.GardenGame || (root.GardenGame = {});
  const VIEW = GardenGame.V, FIELD = GardenGame.FIELD;

  function make(w, h) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    return cv;
  }

  /* 一次性把整张美术背景的草块投影到规则逻辑网格；外围庭院连续衔接。
   * 使用局部三角形仿射贴图，原图片文件保持不变，每帧只绘制缓存。 */
  GardenGame.calibrateBackground = function (img) {
    const profile = GardenGame.BACKGROUND;
    const scale = 2;
    const cv = make(VIEW.W * scale, VIEW.H * scale);
    const ctx = cv.getContext('2d');
    ctx.scale(scale, scale);
    const targetX = [0];
    for (let c = 0; c <= FIELD.cols; c++) targetX.push(FIELD.x + c * FIELD.cellW);
    targetX.push(VIEW.W);
    const sourceY = [0, ...profile.rows, VIEW.H];
    const targetY = [0];
    for (let r = 0; r <= FIELD.rows; r++) targetY.push(FIELD.y + r * FIELD.cellH);
    targetY.push(VIEW.H);
    const sourceX = [profile.columns[0], ...profile.columns, profile.columns[FIELD.rows]]
      .map(row => [0, ...row, VIEW.W]);

    function triangle(s, t) {
      const ux = s[1].x-s[0].x, uy = s[1].y-s[0].y;
      const vx = s[2].x-s[0].x, vy = s[2].y-s[0].y;
      const ax = t[1].x-t[0].x, ay = t[1].y-t[0].y;
      const bx = t[2].x-t[0].x, by = t[2].y-t[0].y;
      const det = ux*vy-uy*vx;
      const a = (ax*vy-bx*uy)/det, c = (bx*ux-ax*vx)/det;
      const b = (ay*vy-by*uy)/det, d = (by*ux-ay*vx)/det;
      const e = t[0].x-a*s[0].x-c*s[0].y, f = t[0].y-b*s[0].x-d*s[0].y;
      ctx.save();
      // 亚像素重叠消除独立 clip 的抗锯齿细缝。
      const mx = (t[0].x+t[1].x+t[2].x)/3, my = (t[0].y+t[1].y+t[2].y)/3;
      ctx.beginPath();
      t.forEach((p,i) => {
        const dx=p.x-mx,dy=p.y-my,k=0.45/Math.hypot(dx,dy);
        const x=p.x+dx*k,y=p.y+dy*k;
        if (i) ctx.lineTo(x,y); else ctx.moveTo(x,y);
      });
      ctx.closePath();ctx.clip();
      ctx.transform(a,b,c,d,e,f);
      ctx.drawImage(img,0,0,VIEW.W,VIEW.H);
      ctx.restore();
    }
    for (let r=0;r<sourceY.length-1;r++) {
      for (let c=0;c<targetX.length-1;c++) {
        const s = [
          {x:sourceX[r][c],y:sourceY[r]}, {x:sourceX[r][c+1],y:sourceY[r]},
          {x:sourceX[r+1][c+1],y:sourceY[r+1]}, {x:sourceX[r+1][c],y:sourceY[r+1]}
        ];
        const t = [
          {x:targetX[c],y:targetY[r]}, {x:targetX[c+1],y:targetY[r]},
          {x:targetX[c+1],y:targetY[r+1]}, {x:targetX[c],y:targetY[r+1]}
        ];
        triangle([s[0],s[1],s[2]],[t[0],t[1],t[2]]);
        triangle([s[0],s[2],s[3]],[t[0],t[2],t[3]]);
      }
    }
    return cv;
  };

  /* 伪随机(固定种子 -> 每次重开纹理一致) */
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---- 各区域 ---- */
  function paintSkyAmbient(ctx) {
    /* 日光: 左上来光 */
    const g = ctx.createRadialGradient(VIEW.W * 0.22, -40, 40, VIEW.W * 0.5, VIEW.H * 0.55, VIEW.H * 1.05);
    g.addColorStop(0, 'rgba(255,244,200,.20)');
    g.addColorStop(0.5, 'rgba(255,240,190,.06)');
    g.addColorStop(1, 'rgba(30,40,20,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW.W, VIEW.H);
    /* 四角轻压暗 */
    const v = ctx.createRadialGradient(VIEW.W / 2, VIEW.H / 2, VIEW.H * 0.42, VIEW.W / 2, VIEW.H / 2, VIEW.H * 0.95);
    v.addColorStop(0, 'rgba(20,30,12,0)');
    v.addColorStop(1, 'rgba(20,30,12,.16)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, VIEW.W, VIEW.H);
  }

  function paintLawnBed(ctx, rnd) {
    const X = FIELD.x, Y = FIELD.y, W = FIELD.right - FIELD.x, H = FIELD.bottom - FIELD.y;
    const BED = 12;   // 床沿宽

    /* 床沿(花坛抬高的一圈土埂) */
    const bg = ctx.createLinearGradient(0, Y - BED, 0, FIELD.bottom + BED);
    bg.addColorStop(0, '#6b4e30'); bg.addColorStop(1, '#4a3520');
    ctx.fillStyle = bg;
    ctx.fillRect(X - BED, Y - BED, W + BED * 2, H + BED * 2);
    /* 土埂颗粒 */
    for (let i = 0; i < 700; i++) {
      const ex = X - BED + rnd() * (W + BED * 2), ey = Y - BED + rnd() * (H + BED * 2);
      const inX = ex > X && ex < FIELD.right, inY = ey > Y && ey < FIELD.bottom;
      if (inX && inY) continue;
      ctx.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,.14)' : 'rgba(255,220,170,.08)';
      ctx.fillRect(ex, ey, 1 + rnd() * 2, 1 + rnd() * 2);
    }
    /* 床沿内口阴影(草坪像凹进去) */
    ctx.save();
    ctx.beginPath();
    ctx.rect(X, Y, W, H);
    ctx.clip();
    const sg = ctx.createLinearGradient(0, Y, 0, Y + 16);
    sg.addColorStop(0, 'rgba(20,32,10,.30)'); sg.addColorStop(1, 'rgba(20,32,10,0)');
    ctx.fillStyle = sg; ctx.fillRect(X, Y, W, 16);
    const sg2 = ctx.createLinearGradient(X, 0, X + 14, 0);
    sg2.addColorStop(0, 'rgba(20,32,10,.26)'); sg2.addColorStop(1, 'rgba(20,32,10,0)');
    ctx.fillStyle = sg2; ctx.fillRect(X, Y, 14, H);
    const sg3 = ctx.createLinearGradient(FIELD.right, 0, FIELD.right - 16, 0);
    sg3.addColorStop(0, 'rgba(20,32,10,.22)'); sg3.addColorStop(1, 'rgba(20,32,10,0)');
    ctx.fillStyle = sg3; ctx.fillRect(FIELD.right - 16, Y, 16, H);
    ctx.restore();
  }

  function paintLawn(ctx, rnd) {
    const X = FIELD.x, Y = FIELD.y, W = FIELD.right - FIELD.x, H = FIELD.bottom - FIELD.y;
    const cw = FIELD.cellW, ch = FIELD.cellH;

    /* 棋盘格双色 + 每格微扰动 */
    for (let r = 0; r < FIELD.rows; r++) {
      for (let c = 0; c < FIELD.cols; c++) {
        const light = (r + c) % 2 === 0;
        ctx.fillStyle = light ? GardenGame.C.lawnLight : GardenGame.C.lawnDark;
        ctx.fillRect(X + c * cw, Y + r * ch, cw, ch);
        /* 单格明度扰动 */
        const tint = (rnd() - 0.5) * 0.05;
        ctx.fillStyle = tint > 0 ? 'rgba(255,255,220,' + tint.toFixed(3) + ')' : 'rgba(20,40,10,' + (-tint).toFixed(3) + ')';
        ctx.fillRect(X + c * cw, Y + r * ch, cw, ch);
        /* 每格上缘一线高光(草皮厚度感) */
        ctx.fillStyle = 'rgba(255,255,230,.05)';
        ctx.fillRect(X + c * cw, Y + r * ch, cw, 2);
      }
    }
    /* 割草宽条纹(同色相微差, 增加织体) */
    for (let r = 0; r < FIELD.rows; r++) {
      if (r % 2) continue;
      ctx.fillStyle = 'rgba(255,255,255,.028)';
      ctx.fillRect(X, Y + r * ch, W, ch);
    }
    /* 细密颗粒 */
    for (let i = 0; i < 2600; i++) {
      const px = X + rnd() * W, py = Y + rnd() * H;
      ctx.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,.055)' : 'rgba(24,52,14,.075)';
      ctx.fillRect(px, py, 1, 1 + rnd());
    }
    /* 零星小三叶草(小而淡, 不抢中心注意力) */
    for (let i = 0; i < 26; i++) {
      const px = X + 14 + rnd() * (W - 28), py = Y + 12 + rnd() * (H - 24);
      ctx.fillStyle = rnd() < 0.6 ? 'rgba(46,94,28,.16)' : 'rgba(255,255,255,.10)';
      ctx.beginPath();
      ctx.arc(px, py, 1.6, 0, 6.29); ctx.arc(px + 3.4, py + 1.6, 1.3, 0, 6.29); ctx.arc(px - 3.2, py + 1.8, 1.2, 0, 6.29);
      ctx.fill();
    }
  }

  function paintTerrace(ctx, rnd) {
    /* 左侧砖台(房子一侧): 暖色石材铺装 */
    const X0 = 0, X1 = FIELD.x, Y0 = GardenGame.BAR.h, Y1 = VIEW.H;
    const g = ctx.createLinearGradient(0, Y0, 0, Y1);
    g.addColorStop(0, '#c79a68'); g.addColorStop(1, '#a87f52');
    ctx.fillStyle = g;
    ctx.fillRect(X0, Y0, X1, Y1 - Y0);
    /* 砖缝 */
    ctx.strokeStyle = 'rgba(90,60,32,.35)'; ctx.lineWidth = 1.2;
    for (let y = Y0 + 26; y < Y1; y += 31) {
      ctx.beginPath(); ctx.moveTo(X0 + 4, y); ctx.lineTo(X1 - 4, y); ctx.stroke();
    }
    let row = 0;
    for (let y = Y0; y < Y1; y += 31, row++) {
      const off = (row % 2) ? 22 : 0;
      for (let x = X0 + 10 + off; x < X1 - 6; x += 44) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, Math.min(y + 31, Y1)); ctx.stroke();
      }
    }
    /* 石材颗粒与暗角 */
    for (let i = 0; i < 420; i++) {
      const px = rnd() * X1, py = Y0 + rnd() * (Y1 - Y0);
      ctx.fillStyle = rnd() < 0.5 ? 'rgba(80,50,24,.10)' : 'rgba(255,230,190,.12)';
      ctx.fillRect(px, py, 1.5, 1.5);
    }
    const sh = ctx.createLinearGradient(X1, 0, X1 - 26, 0);
    sh.addColorStop(0, 'rgba(28,36,14,.30)'); sh.addColorStop(1, 'rgba(28,36,14,0)');
    ctx.fillStyle = sh;
    ctx.fillRect(X1 - 26, Y0, 26, Y1 - Y0);
    /* 草坪侧石唇(压住草坪边缘) */
    const lip = ctx.createLinearGradient(FIELD.x - 7, 0, FIELD.x, 0);
    lip.addColorStop(0, '#8f6a42'); lip.addColorStop(1, '#b08c5e');
    ctx.fillStyle = lip;
    ctx.fillRect(FIELD.x - 7, Y0, 7, Y1 - Y0);
    ctx.fillStyle = 'rgba(255,235,200,.25)';
    ctx.fillRect(FIELD.x - 7, Y0, 1.5, Y1 - Y0);
  }

  function paintPath(ctx, rnd) {
    /* 右侧土路(僵尸来路) */
    const X0 = FIELD.right, X1 = VIEW.W, Y0 = GardenGame.BAR.h, Y1 = VIEW.H;
    const g = ctx.createLinearGradient(X0, 0, X1, 0);
    g.addColorStop(0, '#8a6a42'); g.addColorStop(1, '#5f4526');
    ctx.fillStyle = g;
    ctx.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
    /* 车辙与颗粒 */
    for (let i = 0; i < 240; i++) {
      const px = X0 + rnd() * (X1 - X0), py = Y0 + rnd() * (Y1 - Y0);
      ctx.fillStyle = rnd() < 0.5 ? 'rgba(40,26,12,.16)' : 'rgba(255,220,160,.07)';
      ctx.beginPath(); ctx.ellipse(px, py, 1.6 + rnd() * 2.4, 1.2 + rnd() * 1.6, rnd() * 3, 0, 6.29); ctx.fill();
    }
    /* 几颗小石子 */
    for (let i = 0; i < 9; i++) {
      const px = X0 + 8 + rnd() * (X1 - X0 - 16), py = Y0 + 20 + rnd() * (Y1 - Y0 - 40);
      const r = 2.4 + rnd() * 2.6;
      ctx.fillStyle = '#9a8f7c';
      ctx.beginPath(); ctx.ellipse(px, py, r, r * 0.72, rnd() * 3, 0, 6.29); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.28)';
      ctx.beginPath(); ctx.ellipse(px - r * 0.3, py - r * 0.3, r * 0.4, r * 0.26, 0, 0, 6.29); ctx.fill();
    }
    /* 路左缘草皮探入 */
    ctx.fillStyle = GardenGame.C.lawnEdge;
    for (let i = 0; i < 16; i++) {
      const py = Y0 + rnd() * (Y1 - Y0);
      const h = 3 + rnd() * 4;
      ctx.beginPath();
      ctx.moveTo(X0 + 1, py);
      ctx.quadraticCurveTo(X0 + 4, py - h, X0 + 9, py - h * 0.4);
      ctx.quadraticCurveTo(X0 + 4, py + 1, X0 + 1, py);
      ctx.fill();
    }
    /* 路右缘暗(景深) */
    const dk = ctx.createLinearGradient(X1 - 40, 0, X1, 0);
    dk.addColorStop(0, 'rgba(20,14,6,0)'); dk.addColorStop(1, 'rgba(20,14,6,.34)');
    ctx.fillStyle = dk;
    ctx.fillRect(X1 - 40, Y0, 40, Y1 - Y0);
  }

  /* ---- 构建 ---- */
  GardenGame.buildBackground = function () {
    const rnd = rng(20261017);
    const bg = make(VIEW.W, VIEW.H);
    const ctx = bg.getContext('2d');
    /* 底色(草坪外的绿) */
    ctx.fillStyle = '#6da342';
    ctx.fillRect(0, 0, VIEW.W, VIEW.H);
    paintTerrace(ctx, rnd);
    paintPath(ctx, rnd);
    paintLawnBed(ctx, rnd);
    paintLawn(ctx, rnd);
    paintSkyAmbient(ctx);
    return bg;
  };

  /* ---- 动态环境层(每帧, 轻量) ---- */
  GardenGame.buildAmbient = function () {
    /* 草簇: 集中在床沿与外围; 光尘: 缓慢漂浮 */
    const rnd = rng(9917);
    const tufts = [];
    for (let i = 0; i < 46; i++) {
      const side = rnd();
      let x, y;
      if (side < 0.4) { x = FIELD.x - 10 + rnd() * 20; y = FIELD.y + rnd() * (FIELD.bottom - FIELD.y); }
      else if (side < 0.7) { x = FIELD.right - 8 + rnd() * 16; y = FIELD.y + rnd() * (FIELD.bottom - FIELD.y); }
      else { x = FIELD.x + rnd() * (FIELD.right - FIELD.x); y = FIELD.y - 10 + rnd() * 14; }
      tufts.push({ x: x, y: y, h: 4 + rnd() * 6, p: rnd() * 6.28 });
    }
    const motes = [];
    for (let i = 0; i < 14; i++) {
      motes.push({
        x: FIELD.x + rnd() * (FIELD.right - FIELD.x),
        y: FIELD.y + rnd() * (FIELD.bottom - FIELD.y),
        r: 0.8 + rnd() * 1.6,
        vy: -4 - rnd() * 7,
        vx: 3 + rnd() * 6,
        p: rnd() * 6.28
      });
    }
    return { tufts: tufts, motes: motes };
  };

  /* 每帧绘制: 静态底 + 摇摆草簇 + 光尘 */
  GardenGame.drawAmbient = function (ctx, bg, amb, t, reduced) {
    ctx.drawImage(bg, 0, 0);
    if (reduced) return;
    const sway = (p) => Math.sin(t * 1.6 + p) * 2.2;
    ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    for (const g of amb.tufts) {
      const s = sway(g.p);
      ctx.strokeStyle = 'rgba(30,70,20,.30)';
      ctx.beginPath();
      ctx.moveTo(g.x, g.y);
      ctx.quadraticCurveTo(g.x + s * 0.5, g.y - g.h * 0.6, g.x + s, g.y - g.h);
      ctx.stroke();
    }
    for (const m of amb.motes) {
      const a = 0.06 + 0.06 * (0.5 + 0.5 * Math.sin(t * 1.3 + m.p));
      ctx.fillStyle = 'rgba(255,246,200,' + a.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(m.x + Math.sin(t * 0.5 + m.p) * 14, m.y + Math.cos(t * 0.4 + m.p * 2) * 10, m.r, 0, 6.29);
      ctx.fill();
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = GardenGame;
})(typeof window !== 'undefined' ? window : globalThis);
