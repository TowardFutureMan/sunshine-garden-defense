/* 僵尸美术接入：走路播放源帧；啃食停步；坐标、碰撞与伤害继续由实体模块管理。 */
(function (root) {
  'use strict';
  const GardenGame = root.GardenGame;
  const META = GardenGame.ZOMBIE_ART_META || {};
  const legacyDraw = GardenGame.drawZombie;
  const staticArt = {};
  const GROUND_OFFSET = 4;
  const MOUTHS = { normal: [-18,-53], conehead: [-18,-43], buckethead: [-18,-41], polevault: [-16,-55], newspaper: [-18,-48], football: [-17,-50], flag: [-20,-50] };

  const ALL_ART=Object.assign({},META);
  for(const key of ['newspaper-angry','polevault-landed']){
    const m=GardenGame.STATE_ART&&GardenGame.STATE_ART[key];
    if(m)ALL_ART[key]={staticSrc:m.src,staticBounds:m.bounds,staticPivot:m.pivot,height:m.height};
  }
  for (const key of Object.keys(ALL_ART)) {
    const m = ALL_ART[key], b = m.staticBounds;
    const item = staticArt[key] = { ready: false, failed: false, meta: m, cache: null };
    item.scale = m.height / (b[3] - b[1]);
    item.rect = [Math.max(0, b[0] - 3), Math.max(0, b[1] - 3), b[2] - b[0] + 6, b[3] - b[1] + 6];
    if (typeof root.Image !== 'function') continue;
    const image = item.image = new root.Image();
    image.onload = function () {
      if (!image.naturalWidth) { item.failed = true; return; }
      // 按真实边界裁切并缓存；不改写原 PNG。
      item.rect[2] = Math.min(item.rect[2], image.naturalWidth - item.rect[0]);
      item.rect[3] = Math.min(item.rect[3], image.naturalHeight - item.rect[1]);
      if (root.document) {
        const canvas = root.document.createElement('canvas');
        const k = 240 / item.rect[3];
        canvas.width = Math.ceil(item.rect[2] * k); canvas.height = 240;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(image, ...item.rect, 0, 0, canvas.width, canvas.height);
        item.cache = canvas;
      }
      item.ready = true;
    };
    image.onerror = function () { item.failed = true; };
    image.src = m.staticSrc;
  }

  function stateArtType(z){
    if(z.type==='newspaper'&&z.armor&&z.armor.hp<=0)return 'newspaper-angry';
    if(z.type==='polevault'&&z.vaulted)return 'polevault-landed';
    return null;
  }
  function artType(z) {
    if (!META[z.type]) return null;
    const state=stateArtType(z);
    if(state&&staticArt[state]&&staticArt[state].ready)return z.type;
    if ((z.armor && z.armor.hp <= 0) || (z.type === 'polevault' && z.vaulted)) return 'normal';
    return z.type;
  }
  function frame(z, key) {
    if ((GardenGame.reducedMotion && GardenGame.reducedMotion()) || z.assetStatic) return 0;
    if (z.eating || z.moving === false) return 1;
    if (z.vaultT > 0) return 2;
    // walkPhase 由实际移动量推进；冰冻减速、停步和暂停自然同步，不使用墙钟时间。
    return GardenGame.sheetFrameIndex('zombie-' + key, (z.walkPhase || 0) / 1.92);
  }
  function paintStatic(ctx, key) {
    const a = staticArt[key];
    if (!a || !a.ready) return false;
    const p = a.meta.staticPivot, r = a.rect, s = a.scale;
    const dx = (r[0] - p[0]) * s, dy = (r[1] - p[1]) * s;
    if (a.cache) ctx.drawImage(a.cache, dx, dy, r[2] * s, r[3] * s);
    else ctx.drawImage(a.image, ...r, dx, dy, r[2] * s, r[3] * s);
    return true;
  }

  function paintState(ctx,state,z){
    if(!z.moving||z.eating||z.rageT>0||z.dying||(GardenGame.reducedMotion&&GardenGame.reducedMotion()))return paintStatic(ctx,state);
    // 无道具形象用自身腿部做轻微交替摆动，不再借用含报纸/撑杆的整身帧。
    ctx.save();ctx.beginPath();ctx.rect(-100,-150,200,126);ctx.clip();paintStatic(ctx,state);ctx.restore();
    for(let side=0;side<2;side++){
      const hip=side?8:-8,angle=Math.sin(z.walkPhase||0)*.075*(side?1:-1);
      ctx.save();ctx.translate(hip,-25);ctx.rotate(angle);ctx.translate(-hip,25);
      ctx.beginPath();ctx.rect(side?0:-100,-25,100,50);ctx.clip();paintStatic(ctx,state);ctx.restore();
    }
    return true;
  }
  GardenGame.zombieArt = { meta: META, static: staticArt, type: artType, state: stateArtType, frame: frame };
  GardenGame.drawZombie = function (ctx, z, t) {
    const key = artType(z), sheet = 'zombie-' + key;
    const hasSheet = key && GardenGame.sheetReady && GardenGame.sheetReady(sheet);
    const state=stateArtType(z);
    const hasState=state&&staticArt[state]&&staticArt[state].ready;
    const hasStatic = hasState || (key && staticArt[key] && staticArt[key].ready);
    if (!hasSheet && !hasStatic) return legacyDraw(ctx, z, t);

    ctx.save(); ctx.translate(z.x, z.feetY + GROUND_OFFSET);
    const dying = z.dyingT > 0 ? 1 - z.dyingT / 0.9 : 0;
    if (dying > 0) {
      ctx.globalAlpha *= z.dyingT < 0.25 ? Math.max(z.dyingT / 0.25, 0) : 1;
      ctx.rotate(Math.min(dying, 1) * 1.35); ctx.translate(0, dying * 8);
    }
    const vaultH = z.vaultT > 0 && z.vaultDur > 0 ? Math.sin(Math.PI * (z.vaultDur - z.vaultT) / z.vaultDur) * 58 : 0;
    // 接地阴影不随跳跃上升。
    GardenGame.drawShadow(ctx, 0, 2, 20, vaultH ? 4 : 6, vaultH ? 0.13 : 0.25);
    ctx.translate(0, -vaultH);
    const reduced = GardenGame.reducedMotion && GardenGame.reducedMotion();
    if(z.rageT>0&&!reduced)ctx.translate(Math.sin((.55-z.rageT)*40)*1.3,0);
    if(z.landedT>0)ctx.scale(1+z.landedT*.12,1-z.landedT*.35);
    const biting = !!z.eating && !z.dying && !(z.rageT>0) && !reduced;
    const chew = biting ? (1 - Math.cos((z.eatT || 0) * Math.PI * 2 / .55)) * .5 : 0;
    if (biting) { ctx.rotate(-.025 - chew*.04); ctx.translate(-chew*1.4,0); }
    if (z.flash > 0 && !reduced) ctx.translate(z.flash / .12 * 3.2,0);
    const filters = [];
    if (z.flash > 0) filters.push('brightness(1.85)', 'saturate(0.4)');
    else if (z.freezeT > 0) filters.push('sepia(0.3)', 'hue-rotate(145deg)', 'saturate(0.8)');
    else if (z.angry) filters.push('saturate(1.3)');
    else if (z.maxHp && z.hp / z.maxHp < .34) filters.push('saturate(.65)');
    if (filters.length) { try { ctx.filter = filters.join(' '); } catch (_) { /* 旧浏览器继续正常绘制 */ } }
    const staticOnly = z.assetStatic || (GardenGame.reducedMotion && GardenGame.reducedMotion());
    if(hasState)paintState(ctx,state,z);
    else if (hasSheet && !staticOnly) GardenGame.drawSheet(ctx, sheet, 0, 0, 0, { frame: frame(z, key) });
    else if (!paintStatic(ctx, key) && hasSheet) GardenGame.drawSheet(ctx, sheet, 0, 0, 0, { frame: 0 });
    // 以原画为底，局部开合嘴和前倾形成啃食；腿部保持停步姿态。
    if (biting) {
      const m=MOUTHS[key]||MOUTHS.normal;
      ctx.save();ctx.filter='none';ctx.fillStyle='#483025';ctx.beginPath();ctx.ellipse(m[0],m[1],3.3,1.2+chew*1.8,-.12,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#eee3bd';ctx.fillRect(m[0]-2,m[1]-1.8,1.5,1.5);ctx.fillRect(m[0]+.5,m[1]-1.7,1.4,1.3);ctx.restore();
    }
    const ratio=z.maxHp?z.hp/z.maxHp:1;
    if (ratio<.67 && !staticOnly) {
      ctx.save();ctx.filter='none';ctx.strokeStyle='#514a35';ctx.lineWidth=1.1;ctx.beginPath();
      ctx.moveTo(0,-29);ctx.lineTo(5,-24);ctx.moveTo(4,-31);ctx.lineTo(9,-26);
      if(ratio<.34){ctx.moveTo(-6,-48);ctx.lineTo(-3,-44);ctx.moveTo(7,-18);ctx.lineTo(11,-14);}ctx.stroke();ctx.restore();
    }
    if(z.armorBreakT>0){
      ctx.save();ctx.filter='none';ctx.globalAlpha*=z.armorBreakT/.38;ctx.strokeStyle='#ffdd8c';ctx.lineWidth=1.8;
      const radius=8+(1-z.armorBreakT/.38)*14;ctx.beginPath();ctx.arc(-7,-58,radius,0,Math.PI*2);ctx.stroke();ctx.restore();
    }
    ctx.restore();
  };
})(typeof window !== 'undefined' ? window : globalThis);
