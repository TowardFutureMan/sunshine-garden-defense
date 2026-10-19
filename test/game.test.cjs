'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..');
function load(){
 const images=[];class Image {set src(value){images.push(value);}}
 const env=vm.createContext({console,Math,Date,Image,performance:{now:()=>0}});
 const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
 for(const[,src]of html.matchAll(/<script src="([^"]+)"/g)){
  const file=src.split('?')[0];vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),env,{filename:file});
 }
 const P=env.GardenGame,g=new P.Game(null);g.newGame('normal');g.rnd=()=>.5;g.wave=1;g.waveTimer=9999;g.spawnQueue=[];g.sunTimer=9999;
 return{P,g,images};
}
function advance(g,seconds){for(let i=0;i<Math.ceil(seconds*60);i++)g.update(1/60);}
function mineScenario(type,{armed=true,row=2,vaulted=false}={}){
 const{P,g}=load();const mine=new P.Plant('potatomine',3,2,g);g.plants=[mine];
 if(armed)advance(g,14.1);
 const z=new P.Zombie(type,row,g);z.x=mine.x+140;z.vaulted=vaulted;g.zombies=[z];
 let count=0;const original=g.explode.bind(g);g.explode=(...args)=>{count++;return original(...args)};
 return{P,g,mine,z,explosions:()=>count};
}
for(const type of ['normal','conehead','buckethead','newspaper','football','flag']){
 test('成熟土豆雷接触 '+type+' 后爆炸并击杀',()=>{
  const s=mineScenario(type);advance(s.g,16);
  assert.equal(s.explosions(),1);assert.equal(s.z.dying,true);assert.equal(s.mine.hp,300);
 });
}
test('未成熟土豆雷可以被吃掉',()=>{const s=mineScenario('normal',{armed:false});s.z.x=s.mine.x+60;advance(s.g,3.6);assert.equal(s.mine.dead,true);assert.equal(s.explosions(),0);});
test('邻行僵尸不触发爆炸',()=>{const s=mineScenario('normal',{row:1});advance(s.g,16);assert.equal(s.explosions(),0);assert.equal(s.mine.dead,false);});
test('撑杆僵尸可以跳过土豆雷',()=>{const s=mineScenario('polevault');advance(s.g,12);assert.equal(s.z.vaulted,true);assert.equal(s.z.dying,false);assert.equal(s.mine.dead,false);});
test('无杆状态接触土豆雷会触发',()=>{const s=mineScenario('polevault',{vaulted:true});advance(s.g,12);assert.equal(s.explosions(),1);assert.equal(s.z.dying,true);});
test('爆炸伤害不跨行',()=>{const s=mineScenario('normal');const adjacent=new s.P.Zombie('normal',1,s.g);adjacent.x=s.mine.x+60;s.g.zombies.push(adjacent);advance(s.g,10);assert.equal(s.z.dying,true);assert.equal(adjacent.dying,false);});
test('种植、阳光消耗与卡片冷却',()=>{const{g,P}=load();g.sunCount=300;const before=g.sunCount;g.tryPlant('peashooter',1,1);assert.equal(g.plants.length,1);assert.equal(g.sunCount,before-P.PLANTS.peashooter.cost);g.tryPlant('peashooter',2,1);assert.equal(g.plants.length,1);});
test('暂停冻结战斗时间',()=>{const{g}=load();g.setPaused(true);const before=g.et;advance(g,2);assert.equal(g.et,before);g.setPaused(false);advance(g,.2);assert.ok(g.et>before);});
test('仅保留音效',()=>{const{P}=load();const audio=new P.Audio();assert.equal('bgm' in audio,false);audio.ctx={};let tones=0;audio.tone=()=>tones++;audio.play('shoot');assert.equal(tones,1);audio.toggleMute();audio.play('shoot');assert.equal(tones,1);});
test('所有运行时图像和图集文件完整',()=>{const{images,P}=load();assert.ok(images.length>=20);for(const src of images){assert.ok(fs.existsSync(path.join(ROOT,src)),src);}assert.equal(Object.keys(P.PLANTS).length,7);assert.equal(Object.keys(P.ZOMBIES).length,7);});
