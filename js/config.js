/* ============================================================
 * 阳光庭院塔防 Web 版 - 配置与数值表
 * 全局命名空间: GardenGame
 * ============================================================ */
(function (root) {
  'use strict';
  const GardenGame = root.GardenGame || (root.GardenGame = {});

  /* 画布尺寸 */
  GardenGame.V = { W: 1000, H: 620 };
  GardenGame.SUN = { iconRadius: 15, hitRadius: 64, idlePeriod: 3.2, floatX: 1.6, floatY: 3.5, breath: .055 }; // 视觉尺寸与点击热区分开，方便收集
  GardenGame.BAR = { y: 0, h: 80 };            // 顶部卡片栏高度

  /* 唯一逻辑网格。背景加载时按下方美术标定数据投影到此网格。 */
  GardenGame.FIELD = { x: 120, y: 84, cols: 9, rows: 5, cellW: 84.4, cellH: 95 };
  const F = GardenGame.FIELD;
  F.right = F.x + F.cols * F.cellW;
  F.bottom = F.y + F.rows * F.cellH;    // 草坪下缘 559

  GardenGame.colX = c => F.x + c * F.cellW;
  GardenGame.rowTop = r => F.y + r * F.cellH;
  GardenGame.rowBottom = r => F.y + (r + 1) * F.cellH;
  GardenGame.cellCX = c => GardenGame.colX(c) + F.cellW / 2;
  GardenGame.rowCY = r => GardenGame.rowTop(r) + F.cellH / 2;
  /* 根部/脚底统一放在行中心稍下方，而非紧贴下一行边界。 */
  GardenGame.rowFeet = r => GardenGame.rowCY(r) + 32;
  GardenGame.mowerParkX = () => F.x - 36;

  /* lawn.jpg 的美术标定：坐标归一到 1000x620，与原图分辨率无关。
   * 六条横线及各横线上十个纵线交点，描述原图略有透视且不等高的草块。
   * 只影响背景贴图；种植/预览/碰撞始终使用上面的规则网格。
   * 更换背景图时重新标定此配置，不调整角色与输入的坐标体系。 */
  GardenGame.BACKGROUND = {
    src: 'assets/backgrounds/lawn.jpg',
    rows: [76, 159, 249, 339, 436, 558],
    columns: [
      [140.9,230.9,308.9,387.1,466.5,543.6,622.4,701.9,779.3,866.0],
      [132.3,224.5,304.7,384.6,464.9,544.0,623.6,704.7,784.3,873.3],
      [123.0,217.7,300.0,381.9,463.2,544.5,624.9,707.7,789.7,881.2],
      [113.7,210.8,295.4,379.2,461.4,545.0,626.2,710.7,795.2,889.0],
      [103.7,203.4,290.4,376.3,459.6,545.5,627.5,714.0,801.0,897.5],
      [91.1,194.1,284.1,372.6,457.2,546.2,629.3,718.0,808.4,908.2]
    ]
  };

  GardenGame.ZOMBIE_SPAWN_X = 962;             // 僵尸出生 x

  /* 植物表 */
  GardenGame.PLANTS = {
    sunflower:  { name: '向日葵',   cost: 50,  hp: 300,  cd: 7.5, sun:{ interval: 8, jitter: 2, amount: 25 } },
    peashooter: { name: '豌豆射手', cost: 100, hp: 300,  cd: 7.5, fire:{ interval: 1.4, dmg: 20, speed: 300 } },
    wallnut:    { name: '坚果墙',   cost: 50,  hp: 4000, cd: 25 },
    snowpea:    { name: '寒冰射手', cost: 175, hp: 300,  cd: 7.5, fire:{ interval: 1.4, dmg: 20, speed: 300, ice: true } },
    cherrybomb: { name: '樱桃炸弹', cost: 150, hp: 9999, cd: 45, fuse: 1.2 },
    repeater:   { name: '双发射手', cost: 200, hp: 300,  cd: 7.5, fire:{ interval: 1.5, dmg: 20, speed: 300, double: true } },
    potatomine: { name: '土豆雷',   cost: 25,  hp: 300,  cd: 25, arm: 14 }
  };
  GardenGame.PLANT_ORDER = ['sunflower', 'peashooter', 'wallnut', 'snowpea', 'cherrybomb', 'repeater', 'potatomine'];

  /* 僵尸表 (hp/speed 为基础值, 实际受难度与波次缩放) */
  GardenGame.ZOMBIES = {
    normal:     { name: '普通僵尸',   hp: 200, speed: 16 },
    conehead:   { name: '路障僵尸',   hp: 200, speed: 16, armor: { type: 'cone',   hp: 370 } },
    buckethead: { name: '铁桶僵尸',   hp: 200, speed: 15, armor: { type: 'bucket', hp: 1100 } },
    polevault:  { name: '撑杆僵尸',   hp: 260, speed: 22 },
    newspaper:  { name: '读报僵尸',   hp: 200, speed: 13, armor: { type: 'paper',  hp: 260 } },
    football:   { name: '橄榄球僵尸', hp: 200, speed: 28, armor: { type: 'helmet', hp: 900 } },
    flag:       { name: '旗帜僵尸',   hp: 200, speed: 17 }
  };

  /* 难度 */
  GardenGame.DIFFICULTIES = {
    easy:   { name: '轻松', startSun: 150, hpMul: 0.75, spdMul: 0.85, waveInt: 24, sunFall: [7, 10], countMul: 0.8 },
    normal: { name: '普通', startSun: 75,  hpMul: 1.0,  spdMul: 1.0,  waveInt: 19, sunFall: [8, 12], countMul: 1.0 },
    hard:   { name: '困难', startSun: 50,  hpMul: 1.35, spdMul: 1.15, waveInt: 15, sunFall: [9, 13], countMul: 1.15 }
  };

  /* 波次 */
  GardenGame.WAVES = {
    total: 20,               // 总波数
    huge: [10, 20],          // 旗帜大波
    prepFirst: 18,           // 第一波准备时间
    hugeMul: 2.0,            // 大波数量倍率
    hugeBreak: 26,           // 大波后的休整
    hpPerWave: 0.05          // 每波血量成长
  };

  /* 兼容 CommonJS 便于 node 测试 */
  if (typeof module !== 'undefined' && module.exports) module.exports = GardenGame;
})(typeof window !== 'undefined' ? window : globalThis);
