/* 战斗视觉状态：固定根部的待机、眨眼、受咬缺口、受击反馈与被吃掉过渡。 */
(function (root) {
  'use strict';
  const P = root.GardenGame;
  const rawPlant = P.drawPlant, rawParticle = P.drawParticle, rawMuzzle = P.plantMuzzleAt;
  const shooters = new Set(['peashooter', 'snowpea', 'repeater']);

  function blinkAmount(t) {
    const phase = ((t % 3.7) + 3.7) % 3.7;
    if (phase < 3.35 || phase > 3.57) return 0;
    return Math.sin((phase - 3.35) / 0.22 * Math.PI);
  }
  function walnutEyes(ctx, t) {
    const closed = blinkAmount(t);
    if (closed <= 0) return;
    const eyes = [[5.5,-42.5,6.5,7.0],[19.6,-44.5,4.0,6.2]];
    for (const [x,y,rx,ry] of eyes) {
      ctx.save(); ctx.beginPath(); ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2); ctx.clip();
      const lid = ctx.createLinearGradient(x-rx,y-ry,x+rx,y+ry);
      lid.addColorStop(0,'#f5bd62'); lid.addColorStop(1,'#d99a48'); ctx.fillStyle=lid;
      ctx.fillRect(x-rx-1,y-ry-1,rx*2+2,ry*closed+1);
      ctx.fillRect(x-rx-1,y+ry-ry*closed,rx*2+2,ry*closed+1);
      if (closed > 0.8) { ctx.strokeStyle='#8e5a29';ctx.lineWidth=0.8;ctx.beginPath();ctx.moveTo(x-rx,y);ctx.quadraticCurveTo(x,y+1,x+rx,y);ctx.stroke(); }
      ctx.restore();
    }
  }
  function rootedPose(key, t, o) {
    const reduced = P.reducedMotion && P.reducedMotion();
    const phase = (t + (o.seed || 0) * .3) * Math.PI * 2 / 3.6;
    const recoil = !reduced && shooters.has(key) ? (o.recoil || 0) : 0;
    const hp=o.hpRatio==null?1:o.hpRatio;
    const wilt=hp<.34?2:hp<.67?1:0;
    return {
      neckY: -22,
      angle: reduced ? 0 : Math.sin(phase) * .045 - recoil * .035 + wilt * .045,
      sx: 1 - recoil * .025,
      sy: reduced ? 1 : 1 + Math.cos(phase) * .014 + recoil * .02 - wilt * .035
    };
  }
  function rootedPlant(ctx, key, t, o) {
    const item = P.designArt && P.designArt[key];
    if (!item || !item.ready) return false;
    if (key === 'wallnut') {
      const hp=o.hpRatio==null?1:o.hpRatio;
      const variant=hp<.34?'wallnut-critical':hp<.67?'wallnut-cracked':'wallnut';
      const selected=P.designArt[variant]&&P.designArt[variant].ready?variant:key;
      P.drawDesignPlant(ctx,selected,0,0,0,{static:true});
      if (selected==='wallnut' && !(P.reducedMotion && P.reducedMotion())) walnutEyes(ctx,t);
      return true;
    }
    if (key !== 'sunflower' && !shooters.has(key)) return false;
    if (key === 'sunflower' && o.pop > 0) {
      ctx.save();ctx.globalAlpha*=o.pop*.16;ctx.fillStyle='#ffe470';ctx.beginPath();ctx.ellipse(0,-50,29,28,0,0,Math.PI*2);ctx.fill();ctx.restore();
    }
    // 同一张母图分层摆动，避免生成帧之间的形状、大小变化造成跳帧感。
    // 叶片底座固定，上半部围绕茎的连接点缓慢摆动；接缝留 1px 重叠。
    const pose = rootedPose(key,t,o), neckY = pose.neckY;
    ctx.save();ctx.beginPath();ctx.rect(-80,neckY-.5,160,45);ctx.clip();
    P.drawDesignPlant(ctx,key,0,0,0,{static:true});ctx.restore();
    ctx.save();ctx.translate(0,neckY);ctx.rotate(pose.angle);ctx.scale(pose.sx,pose.sy);ctx.translate(0,-neckY);
    ctx.beginPath();ctx.rect(-80,-120,160,120+neckY+.5);ctx.clip();
    P.drawDesignPlant(ctx,key,0,0,0,{static:true});ctx.restore();
    return true;
  }
  function skillPlant(ctx,key,t,o) {
    if(!P.designArt||!P.designArt[key]||!P.designArt[key].ready)return false;
    if(key==='cherrybomb'){
      const charge=Math.max(0,Math.min(1,1-(o.fuse==null?1.2:o.fuse)/1.2));
      const pulse=charge*charge*Math.sin(t*(8+charge*18))*.035;
      P.drawShadow(ctx,0,-1,24,8,.22);
      ctx.save();ctx.globalAlpha*=charge*.4;const glow=ctx.createRadialGradient(0,-27,3,0,-27,40);
      glow.addColorStop(0,'#ff7e42');glow.addColorStop(1,'rgba(255,87,43,0)');ctx.fillStyle=glow;ctx.fillRect(-42,-70,84,84);ctx.restore();
      ctx.save();ctx.scale(1+charge*.24+pulse,1+charge*.22-pulse*.3);
      P.drawDesignPlant(ctx,key,0,0,0,{static:true});
      ctx.fillStyle='#fff2a2';ctx.strokeStyle='#ffa035';ctx.lineWidth=1.4;
      const r=2+charge*2;ctx.beginPath();ctx.arc(-5,-56,r,0,Math.PI*2);ctx.fill();
      for(let i=0;i<5;i++){const a=t*8+i*Math.PI*2/5;ctx.beginPath();ctx.moveTo(-5+Math.cos(a)*5,-56+Math.sin(a)*5);ctx.lineTo(-5+Math.cos(a)*9,-56+Math.sin(a)*9);ctx.stroke();}
      ctx.restore();return true;
    }
    if(key==='potatomine'&&o.armed!==false){
      P.drawShadow(ctx,0,-1,20,6,.22);P.drawDesignPlant(ctx,key,0,0,0,{static:true});
      ctx.save();ctx.globalAlpha*=.28+.22*Math.sin(t*5);ctx.fillStyle='#fff29a';ctx.beginPath();ctx.arc(0,-44,6,0,Math.PI*2);ctx.fill();ctx.restore();
      return true;
    }
    return false;
  }
  function particle(game,x,y,vx,vy,life,color,size,gravity,type){
    if(game&&game.particles)game.particles.push(new P.Particle(x,y,vx,vy,life,color,size,gravity,type));
  }
  P.emitBlast=function(game,x,y,kind){
    const potato=kind==='potato';
    for(let i=0;i<7;i++){
      const a=i*Math.PI*2/7,spread=potato?18:28;
      particle(game,x+Math.cos(a)*spread*.3,y+Math.sin(a)*8,Math.cos(a)*spread,-18-game.rnd()*20,.7+game.rnd()*.4,potato?'#ac9069':'#aaa18b',12+game.rnd()*10,-8,'blast-smoke');
    }
    particle(game,x,y,0,0,.2,'#fff6c4',potato?38:64,0,'blast-flash');
    if(potato)for(let i=0;i<14;i++)particle(game,x,y+16,-110+game.rnd()*220,-85-game.rnd()*130,.55+game.rnd()*.35,'#8e643b',3+game.rnd()*4,380,'earth');
  };
  P.emitIce=function(game,x,y){
    for(let i=0;i<9;i++){const a=i*Math.PI*2/9,v=40+game.rnd()*75;particle(game,x,y,Math.cos(a)*v,Math.sin(a)*v-20,.3+game.rnd()*.22,'#bef2ff',3+game.rnd()*3,90,'ice-shard');}
    particle(game,x,y,0,0,.23,'#d9fbff',14,0,'ice-ring');
  };
  P.emitLeafLoss=function(game,p,tier){
    for(let i=0;i<3+tier;i++)particle(game,p.x-14+game.rnd()*28,p.y-20-game.rnd()*30,-25+game.rnd()*55,-30-game.rnd()*30,.55+game.rnd()*.3,tier===2?'#9a9c4b':'#8aba53',3+game.rnd()*2,150,'leaf');
  };
  const bitePositions={wallnut:[24,-39],sunflower:[25,-50],cherrybomb:[28,-27],potatomine:[21,-21]};
  P.drawPlant = function (ctx,key,x,y,t,o) {
    o=o||{};
    if (o.static) return rawPlant(ctx,key,x,y,t,o);
    const hp=o.hpRatio==null?1:o.hpRatio;
    const tier=hp<.34?2:hp<.67?1:0;
    const dying=o.deathT>0,progress=dying?1-o.deathT/.35:0;
    ctx.save();ctx.translate(x,y);
    if(dying){ctx.globalAlpha*=Math.max(0,1-progress);ctx.rotate(progress*.18);ctx.scale(1-progress*.12,1-progress*.72);}
    if(o.hitT>0){try{ctx.filter='brightness(1.28)';}catch(_){}}
    else if(tier===2){try{ctx.filter='saturate(.7)';}catch(_){}}
    if(tier&&key!=='wallnut'){
      const [bx,by]=bitePositions[key]||[26,-48];
      ctx.beginPath();ctx.rect(-120,-150,240,180);
      for(let i=0;i<tier+1;i++){ctx.moveTo(bx+5-i*2+4,by+i*7);ctx.arc(bx+5-i*2,by+i*7,4,0,Math.PI*2);}
      if(tier===2){ctx.moveTo(-19+5,-21);ctx.arc(-19,-21,5,0,Math.PI*2);}
      ctx.clip('evenodd');
    }
    if((key==='sunflower'||key==='wallnut'||shooters.has(key))&&rootedPlant(ctx,key,t,o)){
      P.drawShadow(ctx,0,-1,key==='wallnut'?33:25,key==='wallnut'?11:8.5,.22);
    }else if(!skillPlant(ctx,key,t,o)) rawPlant(ctx,key,0,0,t,o);
    ctx.restore();

  };
  // 发射位置和上半部绘制共用同一套变换，避免摆动时豌豆从嘴外出现。
  P.plantMuzzleAt = function (key,t,o,index) {
    o=o||{};
    const item=P.designArt&&P.designArt[key];
    if(!shooters.has(key)||!item||!item.ready)return rawMuzzle?rawMuzzle(key,t,o,index):null;
    if(o.static)return P.designMuzzleAt(key,0,{static:true},index);
    const m=item.mouths[(index||0)%item.mouths.length],pose=rootedPose(key,t,o);
    const x=(m[0]-item.pivot[0])*item.scale*pose.sx;
    const y=((m[1]-item.pivot[1])*item.scale-pose.neckY)*pose.sy;
    return {x:x*Math.cos(pose.angle)-y*Math.sin(pose.angle),
      y:pose.neckY+x*Math.sin(pose.angle)+y*Math.cos(pose.angle)};
  };
  P.drawParticle=function(ctx,p,t){
    const a=Math.max(0,Math.min(1,p.life/p.maxLife)),progress=1-a;
    if(p.type==='blast-flash'){
      ctx.save();ctx.globalAlpha*=Math.pow(a,.7);const r=p.size*(.6+progress*1.4),g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r);
      g.addColorStop(0,'#fffce6');g.addColorStop(.28,'#fff0a2');g.addColorStop(.6,'rgba(255,168,65,.9)');g.addColorStop(1,'rgba(255,113,48,0)');
      ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(p.x,p.y,r,r*.85,0,0,Math.PI*2);ctx.fill();ctx.restore();return;
    }
    if(p.type==='blast-smoke'){
      ctx.save();ctx.globalAlpha*=a*.62;const r=p.size*(.6+progress*1.65),g=ctx.createRadialGradient(p.x-r*.2,p.y-r*.2,0,p.x,p.y,r);
      g.addColorStop(0,'#e5ddc8');g.addColorStop(.5,p.color);g.addColorStop(1,'rgba(126,117,99,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();ctx.restore();return;
    }
    if(p.type==='ice-ring'||p.type==='ready'){
      ctx.save();ctx.globalAlpha*=a;ctx.strokeStyle=p.color;ctx.lineWidth=p.type==='ready'?2:1.8;ctx.beginPath();ctx.ellipse(p.x,p.y,p.size*(.5+progress*1.5),p.size*(p.type==='ready'?.35:1)*(.5+progress*1.5),0,0,Math.PI*2);ctx.stroke();ctx.restore();return;
    }
    if(!['leaf','shard','earth','ice-shard','paper'].includes(p.type))return rawParticle(ctx,p,t);
    ctx.save();ctx.globalAlpha*=a;ctx.translate(p.x,p.y);ctx.rotate(progress*5+p.vx*.03);ctx.fillStyle=p.color;
    if(p.type==='paper'){
      ctx.fillRect(-p.size,-p.size*.65,p.size*2,p.size*1.3);ctx.strokeStyle='#b7ac8f';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(-p.size*.6,-p.size*.2);ctx.lineTo(p.size*.65,-p.size*.2);ctx.moveTo(-p.size*.6,p.size*.25);ctx.lineTo(p.size*.3,p.size*.25);ctx.stroke();
    }else if(p.type==='ice-shard'){
      ctx.beginPath();ctx.moveTo(0,-p.size*1.6);ctx.lineTo(p.size*.75,0);ctx.lineTo(0,p.size);ctx.lineTo(-p.size*.6,0);ctx.closePath();ctx.fill();ctx.strokeStyle='#f5feff';ctx.lineWidth=.8;ctx.stroke();
    }else{
      ctx.beginPath();ctx.moveTo(-p.size,0);ctx.lineTo(0,-p.size*.6);ctx.lineTo(p.size,0);ctx.lineTo(0,p.size*.8);ctx.closePath();ctx.fill();
    }
    ctx.restore();
  };
  P.combatFX={blinkAmount:blinkAmount};
})(typeof window!=='undefined'?window:globalThis);
