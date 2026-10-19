(function () {
  'use strict';
  const cv=document.getElementById('portrait'),c=cv.getContext('2d');
  const button=document.getElementById('start');
  let test=null,recorder=null,chunks=[],sink=null;
  function text(s,x,y,size,color){c.fillStyle=color||'#243e2e';c.font='600 '+size+'px system-ui';c.fillText(s,x,y);}
  function round(x,y,w,h,r,fill){c.fillStyle=fill;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();}
  function frame(){
    const g=window.gardenGame;
    c.fillStyle='#edf0df';c.fillRect(0,0,1080,1920);
    text('正常角色 / 游戏实测',48,92,28,'#63765d');
    text('土豆雷触发测试',48,184,64);
    if(g){
      round(40,265,1000,620,20,'#294a30');
      c.save();c.beginPath();c.roundRect(40,265,1000,620,20);c.clip();c.drawImage(g.canvas,0,0,g.canvas.width,g.canvas.height,40,265,1000,620);c.restore();
      text('触发区域放大',48,1000,32);
      const x=test?test.mine.x:GardenGame.cellCX(3),y=GardenGame.rowFeet(2);
      c.save();c.beginPath();c.roundRect(40,1040,1000,500,20);c.clip();
      c.drawImage(g.canvas,(x-100)*g.dpr,(y-165)*g.dpr,500*g.dpr,250*g.dpr,40,1040,1000,500);c.restore();
    }
    const elapsed=test?test.elapsed:0;
    const status=!test?'准备实测':test.exploded?'03 / 接触爆炸，僵尸被消灭':test.mine.armed?'02 / 已成熟，等待僵尸接触':'01 / 种下土豆雷，等待成熟';
    round(40,1580,1000,202,24,'#dce6ca');text(status,74,1650,38);
    const progress=test?Math.min(1,(14-test.mine.armT)/14):0;
    round(74,1680,932,12,6,'#b7c8a4');if(progress>0)round(74,1680,932*progress,12,6,'#4d763c');
    text(test&&test.exploded?'爆炸触发：1 次  /  击杀：'+g.stats.kills:('实测 '+elapsed.toFixed(1)+' 秒  /  成熟时间 14 秒'),74,1748,28,'#4c6545');
    text('真实游戏录屏 · 预设单僵尸测试 · 原速',48,1853,26,'#63765d');
    if(test&&!test.finished){
      test.elapsed=g.et-test.started;
      if(test.mine.armed&&test.readyAt==null)test.readyAt=test.elapsed;
      if(test.elapsed>=23){
        test.finished=true;g.state='paused';window.mineTestResult={armedAt:test.readyAt,explodedAt:test.explodedAt,explosions:test.explosions,kills:g.stats.kills,mineHp:test.mine.hp,pass:test.explosions===1&&g.stats.kills===1};
        recorder.stop();button.disabled=false;button.textContent='重新实测并录制';
      }
    }
    requestAnimationFrame(frame);
  }
  button.addEventListener('click',async()=>{
    const g=window.gardenGame;
    if(!g.bgReady||!Object.values(GardenGame.designArt).every(a=>a.ready||a.failed)||!Object.values(GardenGame.zombieArt.static).every(a=>a.ready||a.failed)){button.textContent='素材加载中，请稍后再点';return;}
    button.disabled=true;document.getElementById('download').hidden=true;
    g.audio.ensure();await g.audio.ctx.resume();
    if(!sink){sink=g.audio.ctx.createMediaStreamDestination();g.audio.master.connect(sink);}
    const stream=cv.captureStream(30);for(const track of sink.stream.getAudioTracks())stream.addTrack(track);
    const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));
    chunks=[];recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:8000000});
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
    recorder.onstop=()=>{const blob=new Blob(chunks,{type:mime});window.mineRecordingBlob=blob;const a=document.getElementById('download');a.href=URL.createObjectURL(blob);a.download='potato-mine-portrait.webm';a.hidden=false;window.mineRecordingReady=true;};
    window.mineRecordingReady=false;recorder.start(1000);
    g.newGame('normal');g.rnd=()=>.5;g.wave=1;g.waveTimer=9999;g.spawnQueue=[];g.sunTimer=9999;g.banner=null;
    g.tryPlant('potatomine',3,2);const mine=g.plants.find(p=>p.key==='potatomine');
    const zombie=new GardenGame.Zombie('normal',2,g);zombie.x=mine.x+356;g.zombies=[zombie];
    if(!g._recordOriginalExplode)g._recordOriginalExplode=g.explode.bind(g);
    test={mine,zombie,started:g.et,elapsed:0,readyAt:null,exploded:false,explosions:0,finished:false};
    g.explode=(...args)=>{test.exploded=true;test.explosions++;test.explodedAt=g.et-test.started;return g._recordOriginalExplode(...args);};
  });
  requestAnimationFrame(frame);
})();
