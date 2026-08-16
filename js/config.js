/* =========================================================
 * 末世孤城 · 半感染者 —— 游戏配置数据
 * 所有数值集中在这里，方便调平衡。
 * ========================================================= */
(function () {
  'use strict';
  const LG = window.LG = window.LG || {};

  /* ---------------- 玩家基础属性 ---------------- */
  const BAL = {
    maxHp: 100,
    maxEnergy: 100,
    startHunger: 80,
    startThirst: 80,
    hungerDecayPerDay: 18,
    thirstDecayPerDay: 22,
    startInfection: 35,        // 半感染者：天生带感染
    baseMoveSpeed: 150,        // px/s
    dashSpeed: 340,
    dashTime: 0.16,
    dashCooldown: 2.2,
    attackCost: 6,             // 每次攻击消耗体力
    clawCost: 12,
    clawInfection: 4,          // 使用尸化之爪增加的感染
    baseAttackDmg: 6,
    restHours: 8,
    maxCarry: 24,              // 背包负重（种数不限，总数限制）
    loseLootOnDeath: 0.6,      // 死亡损失 60% 携带物品
    infectionGainPerBite: 8,
    tamedFeedCost: 2,          // 驯化需要喂 2 块生肉
    tamedBaseChance: 0.55,
    penSlots: 6,               // 畜栏容量
    bigZombieLimit: 3,
    farmPlots: 6,
    maxStorage: 40,            // 储物箱容量
    pouchBonus: 6,             // 每个布袋 +6 背包容量
    pouchSlots: 2,             // 最多背 2 个布袋
    furnitureNodeChance: 0.15, // 箱柜里开出家具的概率
    plantPetChance: 0.12,      // 种植时种出变异植物宠物的概率
    winDay: 30,                // 守望结局：存活天数
  };

  /* ---------------- 物品 ---------------- */
  const ITEMS = {
    // —— 武器 ——
    pipe:    { name: '铁管', icon: '🔧', cat: 'weapon', dmg: 12, range: 72, atkSpeed: 0.55, desc: '生锈的铁管。砸开过很多脑袋，也砸开过很多罐头。' },
    crowbar: { name: '撬棍', icon: '🪛', cat: 'weapon', dmg: 16, range: 80, atkSpeed: 0.62, desc: '修车工留下的撬棍。撬锁、撬箱、撬脑壳。' },
    knife:   { name: '军匕', icon: '🔪', cat: 'weapon', dmg: 10, range: 58, atkSpeed: 0.34, desc: '轻而快。适合在丧尸反应过来之前划开它的喉咙。' },
    machete: { name: '砍刀', icon: '🪓', cat: 'weapon', dmg: 22, range: 92, atkSpeed: 0.85, desc: '沉。一刀下去，会听见骨头裂开的声音。' },
    chainsaw:{ name: '电锯', icon: '⛓️', cat: 'weapon', dmg: 30, range: 96, atkSpeed: 1.1,  desc: '燃油驱动的电锯。噪音会引来很远的东西。' },
    // —— 材料 ——
    scrap:   { name: '废铁', icon: '🧱', cat: 'mat', desc: '锈迹斑斑的金属碎片。搭栅栏、修门窗、做合成。' },
    gasoline:{ name: '汽油', icon: '⛽', cat: 'mat', desc: '还有半罐。易燃，也金贵。' },
    battery: { name: '电池', icon: '🔋', cat: 'mat', desc: '还有余电的电池。灯光在末世是奢侈品。' },
    cement:  { name: '水泥', icon: '🧱', cat: 'mat', desc: '干硬的水泥块。能砌墙，也能喂给石头一样的怪物。' },
    core:    { name: '尸核', icon: '💠', cat: 'mat', desc: '丧尸体内的结晶体。异能丧尸合成的核心材料。' },
    gene:    { name: '基因样本', icon: '🧪', cat: 'mat', desc: '科研所的试管。半感染者的身体似乎与它有共鸣。' },
    cloth:   { name: '破布', icon: '🧻', cat: 'mat', desc: '褪色的布料。有人曾用它们裹住伤口，有人曾用它们裹住自己。' },
    venom:   { name: '腐蚀粘液', icon: '🫧', cat: 'mat', desc: '从腐蚀者身上剥离的粘液，带着酸味。也许有人愿意用它做点什么。' },
    // —— 食物 ——
    water:    { name: '清水', icon: '💧', cat: 'food', hunger: 0, thirst: 40, desc: '过滤过的水。有点铁锈味，但能喝。' },
    can:      { name: '罐头', icon: '🥫', cat: 'food', hunger: 35, thirst: 5, desc: '过期的罐头。味道可疑，但活着比讲究重要。' },
    rawMeat:  { name: '生肉', icon: '🥩', cat: 'food', hunger: 18, thirst: -4, infection: 3, desc: '从丧尸身上割下的肉。能填肚子，也喂丧尸。' },
    cookedMeat:{ name: '烤肉', icon: '🍖', cat: 'food', hunger: 42, thirst: -2, desc: '篝火烤过的肉。是废墟里少有的慰藉。' },
    potato:   { name: '土豆', icon: '🥔', cat: 'food', hunger: 22, desc: '自己种出来的土豆。带着泥土的踏实。' },
    corn:     { name: '玉米', icon: '🌽', cat: 'food', hunger: 26, desc: '自己种的玉米。甜，能让人想起夏天。' },
    mtomato:  { name: '变异番茄', icon: '🍅', cat: 'food', hunger: 15, infection: 12, desc: '裂开的番茄，紫红色，散发着甜腻的腐味。吃下它会加重感染。' },
    mushroom: { name: '夜光菇', icon: '🍄', cat: 'food', hunger: 12, desc: '夜里会发出幽蓝的光。煮汤很好喝。' },
    // —— 医疗 ——
    bandage:   { name: '绷带', icon: '🩹', cat: 'med', heal: 18, desc: '干净的绷带。止血，也止不住孤独。' },
    medkit:    { name: '药箱', icon: '💊', cat: 'med', heal: 45, infection: -8, desc: '完整的急救箱。碘伏的味道让人安心。' },
    antibiotic:{ name: '抗生素', icon: '💉', cat: 'med', heal: 10, infection: -28, desc: '稀缺的抗生素。能短暂压制体内的尸化。' },
    // —— 种子 ——
    seedPotato:  { name: '土豆种子', icon: '🌱', cat: 'seed', crop: 'potato', desc: '干瘪的土豆切块。埋进土里，等一场雨。' },
    seedCorn:    { name: '玉米种子', icon: '🌱', cat: 'seed', crop: 'corn', desc: '几粒玉米。种下它，像种下一个夏天。' },
    seedTomato:  { name: '变异番茄种子', icon: '🌱', cat: 'seed', crop: 'mtomato', desc: '紫红色的种子。种下去会结出危险又诱人的果实。' },
    seedMush:    { name: '夜光菇孢子', icon: '🍄', cat: 'seed', crop: 'mushroom', desc: '装在塑料袋里的孢子。阴暗潮湿的地方长得最好。' },
    // —— 特殊 ——
    diary:  { name: '日记碎片', icon: '📜', cat: 'special', desc: '阿岚留下的纸条。' },
    key:    { name: '生锈钥匙', icon: '🗝️', cat: 'special', desc: '锈蚀的钥匙。也许能打开某扇门。' },
    cure:   { name: '病毒解药', icon: '🫙', cat: 'special', desc: '玻璃罐里装着淡绿色的气体。科研所的最终产物——或者说，最后的答案。' },
    // —— 工具（工作台制造）——
    lantern: { name: '灯笼', icon: '🏮', cat: 'tool', desc: '自制的灯笼。把它带在身边，黑夜会退远一些（搜索时视野扩大）。' },
    pouch:   { name: '布袋', icon: '👜', cat: 'tool', desc: '粗布缝的口袋。塞进背包里，能多装不少东西（背包容量 +6，最多 2 个）。' },
    torch:   { name: '火把', icon: '🔥', cat: 'tool', desc: '浸了汽油的火把。火光摇曳，能照亮一段路（视野小幅扩大）。' },
    // —— 弹药/远程武器 ——
    ammo:    { name: '弹药', icon: '🔫', cat: 'mat', desc: '黄澄澄的子弹。人类用它们说话。' },
    gun:     { name: '土枪', icon: '💥', cat: 'weapon', dmg: 14, range: 240, atkSpeed: 1.0, ranged: true, ammoCost: 1, desc: '自制的土枪。打不远，但够用。每发消耗 1 弹药。' },
    pistol:  { name: '手枪', icon: '🔫', cat: 'weapon', dmg: 18, range: 260, atkSpeed: 0.7, ranged: true, ammoCost: 1, desc: '拾荒者留下的手枪。保养得很好。每发消耗 1 弹药。' },
    // —— 特殊丧尸战利品 ——
    bossBone:     { name: '尸王颅骨', icon: '💀', cat: 'special', desc: '尸王的头骨，重得像一块铁。' },
    bruteHide:    { name: '硬化厚皮', icon: '🛡️', cat: 'special', desc: '蛮力者的皮，刀都划不开。' },
    runnerTendon: { name: '迅捷肌腱', icon: '🦵', cat: 'special', desc: '迅捷者的肌腱，绷紧时像弓弦。' },
    mistVeil:     { name: '雾纱', icon: '🌫️', cat: 'special', desc: '雾行者身上落下的纱。抓不住，但能织。' },
    galeFeather:  { name: '风之羽', icon: '🪶', cat: 'special', desc: '暴风者留下的羽毛，轻得像一阵风。' },
    deepOrb:      { name: '深水珠', icon: '🔵', cat: 'special', desc: '溺尸体内的珠子，冰凉，握久了会发麻。' },
    // —— 装备（工作台用特殊战利品制造）——
    catToy:      { name: '逗猫棒', icon: '🪄', cat: 'equip', slot: 'toy', desc: '自制逗猫棒。在营地里装备它，所有动物都会跟着你跑（无法带出营地使用）。' },
    crown:       { name: '尸王之冠', icon: '👑', cat: 'equip', slot: 'head', desc: '尸王的颅骨打磨成的冠。戴上它，你就是所有丧尸的王。（最大生命 +15）' },
    hideArmor:   { name: '硬化皮甲', icon: '🦺', cat: 'equip', slot: 'body', desc: '蛮力者的厚皮缝成的甲。（受到的伤害 -15%）' },
    swiftBoots:  { name: '迅捷之靴', icon: '🥾', cat: 'equip', slot: 'foot', desc: '迅捷者的肌腱鞣成的靴子。（移动速度 +15%）' },
    mistCloak:   { name: '雾纱披风', icon: '🧣', cat: 'equip', slot: 'acc', desc: '雾行者的纱织成的披风。（视野扩大）' },
    windFeather: { name: '风之羽饰', icon: '🪶', cat: 'equip', slot: 'acc', desc: '暴风者的羽。冲刺冷却 -0.8 秒。' },
    deepPendant: { name: '深水坠饰', icon: '📿', cat: 'equip', slot: 'acc', desc: '溺尸的珠。能压住你体内的尸化。（感染漂移减缓）' },
  };

  /* ---------------- 特殊装备（装备栏） ---------------- */
  const EQUIP = {
    crown:       { name: '尸王之冠', icon: '👑', slot: 'head', bonus: { maxHp: 15 }, craft: { bossBone: 1, core: 3 }, energy: 10, desc: '尸王的颅骨打磨成的冠。' },
    hideArmor:   { name: '硬化皮甲', icon: '🦺', slot: 'body', bonus: { dmgRed: 0.15 }, craft: { bruteHide: 2, cloth: 2 }, energy: 10, desc: '蛮力者的厚皮缝成的甲。' },
    swiftBoots:  { name: '迅捷之靴', icon: '🥾', slot: 'foot', bonus: { speed: 0.15 }, craft: { runnerTendon: 2, cloth: 2 }, energy: 10, desc: '迅捷者的肌腱鞣成的靴子。' },
    mistCloak:   { name: '雾纱披风', icon: '🧣', slot: 'acc', bonus: { vision: 60 }, craft: { mistVeil: 1, cloth: 2 }, energy: 10, desc: '雾行者的纱织成的披风。' },
    windFeather: { name: '风之羽饰', icon: '🪶', slot: 'acc', bonus: { dashCd: 0.8 }, craft: { galeFeather: 1, cloth: 1 }, energy: 10, desc: '暴风者的羽。' },
    deepPendant: { name: '深水坠饰', icon: '📿', slot: 'acc', bonus: { infDrift: 0.3 }, craft: { deepOrb: 1, cloth: 1 }, energy: 10, desc: '溺尸的珠。' },
  };
  /* 装备栏槽位 */
  const EQUIP_SLOTS = [
    ['head', '头部'], ['body', '身体'], ['foot', '腿部'], ['acc', '饰品'], ['toy', '手持'],
  ];

  /* ---------------- 家具（收集后直接摆在家里） ---------------- */
  const FURNITURE = {
    sofa:       { name: '旧沙发', icon: '🛋️', desc: '塌陷的沙发，弹簧硌人。但它是这里唯一的沙发。' },
    table:      { name: '木桌', icon: '🪵', desc: '结实的木桌。桌腿有点晃，垫一垫就能用。' },
    lamp:       { name: '落地灯', icon: '💡', desc: '落地灯。虽然没有电，但摆在那里就让人觉得温暖。' },
    shelf:      { name: '书架', icon: '📚', desc: '书架。书页都发黄了，风一吹就哗哗响。' },
    plant:      { name: '盆栽', icon: '🪴', desc: '一盆活着的绿植。它是这片废墟里少数还在生长的东西。' },
    rug:        { name: '地毯', icon: '🧶', desc: '褪色的地毯。踩上去很软，像踩着一小块过去。' },
    clock:      { name: '挂钟', icon: '🕰️', desc: '停摆的挂钟。指针停在某个下午三点。' },
    gramophone: { name: '留声机', icon: '📻', desc: '留声机。转盘坏了，但喇叭还是黄铜色的。' },
  };

  /* 每个区域可收集的家具池 */
  const ZONE_FURNITURE = {
    wild:    ['plant'],
    mall:    ['sofa', 'rug'],
    oldtown: ['table', 'clock'],
    metro:   ['lamp', 'gramophone'],
    lab:     ['shelf'],
  };

  /* ---------------- 宠物（每张地图一只，不同品种） ---------------- */
  const PETS = {
    wild:    { type: 'dog',     name: '土狗',   icon: '🐕', buff: '每天有 40% 概率在院子里捡到 1 件物资' },
    mall:    { type: 'cat',     name: '暹罗猫', icon: '🐈', buff: '休息一晚时体力额外恢复 +10' },
    oldtown: { type: 'crow',    name: '乌鸦',   icon: '🐦', buff: '搜索时更容易找到日记碎片' },
    metro:   { type: 'hamster', name: '仓鼠',   icon: '🐹', buff: '作物每天额外生长 +0.25' },
    lab:     { type: 'rabbit',  name: '变异兔', icon: '🐇', buff: '感染漂移减缓（每天最多 +0.5）' },
  };

  /* ---------------- 敌对人类（随机刷新，使用远程武器） ---------------- */
  const HUMAN = {
    raider: {
      name: '拾荒者', icon: '🚶',
      hp: 45, dmg: 8, speed: 58,
      range: 250, projSpeed: 240, shootCd: 1.6, aggro: 300,
      desc: '活下来的人不一定都善良。他端着枪，用看猎物的眼神看着你。',
      /* 人类掉落物 */
      drop: { pistol: 0.12, ammo: 1, can: 0.5, water: 0.4, scrap: 0.5, bandage: 0.3, rawMeat: 0.3 },
    },
  };

  /* ---------------- 特殊人类：艾巳（可招募，每日生产医疗用品） ---------------- */
  const AI_SHI = {
    name: '艾巳', icon: '👩',
    cost: { water: 2, can: 2 },
    desc: '背着医药箱的女人。她说自己是从旧城区一路走来的医生，身上有消毒水的味道。',
    lines: [
      '艾巳在整理药箱。她抬头看了你一眼："伤口要记得换药。"',
      '艾巳说，废墟里最缺的不是食物，是绷带和碘伏。',
      '艾巳把一颗药放进你手心："含着，别咽。苦是苦了点。"',
      '艾巳望着远处的废墟："那边……还有活着的人吗？"',
    ],
  };

  /* ---------------- 变异植物宠物（种田概率种出，每种植物限一只） ---------------- */
  const PLANT_PETS = {
    potato:   { name: '土豆精', icon: '🥔', buff: '每日饥饿衰减 -3' },
    corn:     { name: '玉米精', icon: '🌽', buff: '作物每天额外生长 +0.2' },
    mtomato:  { name: '番茄精', icon: '🍅', buff: '每日感染漂移 -0.5' },
    mushroom: { name: '菇精',   icon: '🍄', buff: '每日体力恢复 +5' },
  };

  /* ---------------- 作物 ---------------- */
  const CROPS = {
    potato:  { name: '土豆', icon: '🥔', days: 2, yield: 'potato', yieldMin: 2, yieldMax: 3, seed: 'seedPotato', desc: '2 天成熟。可靠的口粮。' },
    corn:    { name: '玉米', icon: '🌽', days: 3, yield: 'corn', yieldMin: 2, yieldMax: 3, seed: 'seedCorn', desc: '3 天成熟。甜甜的。' },
    mtomato: { name: '变异番茄', icon: '🍅', days: 4, yield: 'mtomato', yieldMin: 2, yieldMax: 3, seed: 'seedTomato', desc: '4 天成熟。吃多了会加重感染，但它是驯化与合成的关键。' },
    mushroom:{ name: '夜光菇', icon: '🍄', days: 2, yield: 'mushroom', yieldMin: 2, yieldMax: 3, seed: 'seedMush', desc: '2 天成熟。喜阴。' },
  };

  /* ---------------- 搜索区域（每 5 天开放一个新地区） ---------------- */
  const ZONES = {
    wild:  { name: '荒野公路', icon: '🛣️', unlockDay: 1, rooms: 9,  difficulty: 1,
             zombies: [['walker', 3], ['walker', 2], ['runner', 1]],
             loot: { water: 6, can: 5, scrap: 7, cloth: 6, rawMeat: 4, seedPotato: 3, seedCorn: 2, bandage: 2, potato: 3, corn: 2 },
             lootCount: 9, desc: '曾经通往市区的公路。废弃的汽车像一具具铁皮尸体。', color: '#5a6a5a' },
    mall:  { name: '废弃商场', icon: '🏬', unlockDay: 5, rooms: 12, difficulty: 2,
             zombies: [['walker', 4], ['runner', 2], ['spitter', 1]],
             loot: { can: 8, water: 7, bandage: 4, cloth: 5, knife: 1, scrap: 4, rawMeat: 3, seedMush: 2, medkit: 1, potato: 3 },
             lootCount: 12, desc: '玻璃穹顶碎了大半。商场广播还在循环播放着停电前的促销信息。', color: '#6a5a6a' },
    oldtown:{ name: '旧城区', icon: '🏚️', unlockDay: 10, rooms: 14, difficulty: 3,
             zombies: [['walker', 4], ['runner', 3], ['brute', 2], ['spitter', 1]],
             loot: { crowbar: 1, scrap: 9, gasoline: 5, cloth: 6, can: 5, rawMeat: 4, battery: 2, bandage: 3, seedTomato: 2, core: 2 },
             lootCount: 13, desc: '晾衣绳上还挂着褪色的衣服。风一吹，像在跟谁招手。', color: '#6a5f4a' },
    metro: { name: '地铁隧道', icon: '🚇', unlockDay: 15, rooms: 13, difficulty: 4,
             zombies: [['runner', 5], ['walker', 4], ['brute', 2], ['spitter', 2]],
             loot: { battery: 8, gasoline: 5, scrap: 6, medkit: 2, core: 4, cloth: 5, can: 4, water: 4, antibiotic: 1, machete: 1 },
             lootCount: 12, desc: '黑暗里只有滴水声。车厢里有人用血写了很长很长的字。', color: '#4a556a' },
    lab:   { name: '科研所', icon: '🔬', unlockDay: 20, rooms: 15, difficulty: 5,
             zombies: [['brute', 4], ['spitter', 3], ['runner', 4], ['boss', 1]],
             loot: { gene: 5, core: 6, antibiotic: 3, medkit: 3, battery: 5, chainsaw: 1, gasoline: 4, scrap: 5, cloth: 4, key: 1 },
             lootCount: 14, desc: '门禁系统还在工作，红灯一闪一闪。这里曾经研究过"它们"。', color: '#5a4a6a' },
  };

  /* ---------------- 丧尸类型 ---------------- */
  const ZOMBIES = {
    walker: { name: '游荡者', icon: '🧟', hp: 30, dmg: 6,  speed: 42,  core: 1, exp: 1,
              desc: '最普通的丧尸。漫无目的地走着，像在找什么，又像什么都不记得了。' },
    runner: { name: '迅捷者', icon: '🏃', hp: 20, dmg: 5,  speed: 95,  core: 1, exp: 2,
              desc: '生前大概是运动员。动作快得吓人，但依旧不会主动伤害你。' },
    brute:  { name: '蛮力者', icon: '💪', hp: 72, dmg: 12, speed: 34,  core: 2, exp: 3,
              desc: '浑身肌肉鼓胀的大家伙。安静的时候像一尊石像。' },
    spitter:{ name: '腐蚀者', icon: '☣️', hp: 40, dmg: 9,  speed: 46,  core: 2, exp: 3,
              desc: '皮肤溃烂，滴着粘液。靠近它时能闻到酸味。' },
    boss:   { name: '尸王', icon: '👑', hp: 160, dmg: 16, speed: 40,  core: 6, exp: 8,
              desc: '实验的产物。比其他丧尸更"清醒"，眼神里甚至有一丝哀伤。它不攻击，只是看着你。' },
    /* —— 特殊天气才会出现的丧尸 —— */
    drowner:    { name: '溺尸', icon: '💧', hp: 46, dmg: 8, speed: 36, core: 2, exp: 3,
                  desc: '雨夜才会从积水里爬出来。水顺着它的身体滴答滴答，像一首走调的歌。它同样不会主动攻击你。' },
    mistwalker: { name: '雾行者', icon: '🌫️', hp: 38, dmg: 7, speed: 62, core: 2, exp: 3,
                  desc: '雾是它的皮肤。它走得很慢，但你看不清它——而它总能看见你。温顺，像雾本身。' },
    gale:       { name: '暴风者', icon: '💨', hp: 26, dmg: 5, speed: 118, core: 1, exp: 2,
                  desc: '被风带走了所有重量。快得只剩一道影子，掠过时带起一片尘土。它追着风跑，不追你。' },
  };

  /* ---------------- 异能大丧尸合成配方 ---------------- */
  const SYNTH = {
    fire:   { name: '焰尸', icon: '🔥', color: '#d96a3a',
              need: { gasoline: 2, core: 3 }, abilityName: '焚烬',
              abilityDesc: '周期性喷出火焰，灼烧附近所有敌对丧尸。',
              desc: '往驯养丧尸体内浇灌汽油与尸核，点燃它胸腔里那团死火。',
              hp: 90, dmg: 14, speed: 60 },
    thunder:{ name: '雷尸', icon: '⚡', color: '#8a5ad9',
              need: { battery: 2, core: 3 }, abilityName: '雷击',
              abilityDesc: '释放电弧，麻痹并伤害附近的敌对丧尸。',
              desc: '把电池塞进它的胸腔。电流穿过尸核时，它抽搐着站了起来。',
              hp: 80, dmg: 12, speed: 68 },
    rock:   { name: '岩尸', icon: '🪨', color: '#8a8f92',
              need: { cement: 2, core: 2 }, abilityName: '铁壁',
              abilityDesc: '化身石墙，吸引并扛下所有伤害。',
              desc: '水泥与尸核混合，浇筑出一堵会走路的墙。',
              hp: 150, dmg: 10, speed: 40 },
    vine:   { name: '藤尸', icon: '🌿', color: '#4a9a6a',
              need: { mtomato: 3, core: 2 }, abilityName: '治愈',
              abilityDesc: '持续释放孢子，缓慢治疗你。',
              desc: '变异番茄的藤蔓从它体内长出。它不再伤人，只想让你活着。',
              hp: 70, dmg: 8, speed: 64 },
  };

  /* ---------------- 日记碎片（阿岚的笔记） ---------------- */
  const DIARY = [
    { id: 'd1', day: 1, text: '第 1 天。风把广告牌吹得哗哗响。城市没有电，也就没有声音，除了风。我找到了这栋带院子的房子，栅栏还立着。就叫它"孤城"吧。' },
    { id: 'd2', day: 2, text: '第 2 天。它们不会攻击人。它们只是走，走累了就站着，站成一片枯树林。我把手伸到一只面前，它歪着头看我，像一条迷路的狗。' },
    { id: 'd3', day: 4, text: '第 4 天。我种下了一排土豆。泥土是温的。末日之后，土地反而变得肥沃，大概是因为没有人在乎它了。' },
    { id: 'd4', day: 6, text: '第 6 天。我在商场里捡到一本相册。里面全是陌生人的笑脸。我把相册带回来了，摆在窗台上，假装家里有人。' },
    { id: 'd5', day: 8, text: '第 8 天。我被咬了一口。伤口不疼，反而发热，像有东西在血管里游。我试着不去想它。' },
    { id: 'd6', day: 10, text: '第 10 天。我养了一只丧尸。它很安静，我叫它"小灰"。它听我说话，虽然它听不懂。夜里我数它的呼吸声入睡。' },
    { id: 'd7', day: 12, text: '第 12 天。老橘回来了，叼着一条鱼。猫不在乎世界变成什么样，只要有鱼。我有点羡慕它。' },
    { id: 'd8', day: 15, text: '第 15 天。我发现了研究所的地图。他们在那里面研究"共生"。也许，他们早就知道有人会走到这一步。' },
    { id: 'd9', day: 18, text: '第 18 天。我开始能"听"见它们。不是声音，是念头，像水底的暗流。它们没有恶意，它们只是……饿？不是饿。是空。' },
    { id: 'd10', day: 21, text: '第 21 天。我把小灰和尸核放在一起，加了汽油。它站起来的时候，胸腔里亮着橙色的光。我叫它"守夜人"。它有名字了。' },
    { id: 'd11', day: 25, text: '第 25 天。镜子里的我，眼睛开始泛灰。我把镜子扣在桌上。没关系。我还有这片田，还有它们，还有老橘。' },
    { id: 'd12', day: 28, text: '第 28 天。如果我撑不住了，请替我照顾好这片院子。土豆要记得浇水，小灰喜欢听人说话。风很大的时候，把收音机打开——' },
  ];

  /* ---------------- 收音机片段 ---------------- */
  const RADIO = [
    '滋滋……这里是……中央广播……请幸存者前往……滋滋……',
    '……无人应答。无人应答。愿你们安好。',
    '……爸爸，妈妈，如果你们听到这段录音，我还在，我在城东……',
    '滋滋……提示：明日多云转阴，气温 12℃。末日前的天气预报，还在播。',
    '……本台消息，变异个体已确认不会主动攻击人类，请市民保持冷静，不要开枪。',
    '……我不知道还有没有人听。如果有人听，请替我转告那个住在院子里的人：今天有雨，记得收衣服。',
    '……我已经三天没有见到活人了。刚才有个丧尸在我门口站了一下午。我没关门。它也没进来。',
  ];

  /* ---------------- 结局 ---------------- */
  const ENDINGS = {
    fall: {
      title: '堕落',
      text: '第 {day} 天，凌晨。\n你最后看见的，是老橘蹲在窗台上，尾巴轻轻扫着。\n然后，你听见自己的喉咙里，发出了一声不属于人类的低吼。\n\n院子里的它们都抬起头，看着你，像迎接一个迟到的家人。\n\n半感染者，终于走完了另一半。',
      purple: true,
    },
    watch: {
      title: '守望者',
      text: '第 30 天，黄昏。\n收音机里传来断断续续的旋律，是有人用琴键弹一支老歌。\n老橘跳上你的膝盖。小灰站在栅栏边，安静地看落日。\n守夜人胸腔里的火光，把影子拉得很长很长。\n\n你没有等到救援。但你等到了自己。\n\n末世没有结束。\n可这座孤城，从此有了守夜的人。',
      purple: true,
    },
    clean: {
      title: '净化',
      text: '你走上科研所的屋顶，拧开了玻璃罐。\n淡绿色的气体在晨风里散开，像一场安静的大雪。\n\n丧尸一个接一个停下脚步。它们仰起头，灰白的眼睛望着天空，\n然后缓缓倒下——不是死亡，是沉睡。\n\n病毒被净化了。\n人类活下来了，十不存一。\n\n你站在屋顶上，风把你的头发吹乱。\n你体内的另一半，也在慢慢安静下来。\n\n黎明来了。',
      purple: true,
    },
    emperor: {
      title: '末日帝王',
      text: '你没有拧开盖子。\n玻璃罐躺在你怀里，凉凉的，像一颗不会跳动的心脏。\n\n你走出科研所。丧尸们让开一条路——不是害怕，是臣服。\n你成了这片废墟唯一的王。\n\n王座是塌了一半的天台，臣民是百万具行走的空壳。\n岁月如沙，你和它们一起缓慢腐烂，骨头长出青苔。\n\n千万年后，又一个直立猿路过你的王座，\n指着你的骸骨，对同伴说：看，神。\n\n孤城。孤独的王。',
      purple: true,
    },
    pets: {
      title: '宠物王朝',
      text: '院子里站满了它们——土狗、暹罗猫、乌鸦、仓鼠、变异兔，还有老橘，还有田边那些会走路的植物。\n你坐在台阶上，它们围拢过来，像一支小小的军队。\n\n人类已经不多了。但这片废墟，从此有了王——\n不是统治人类的王，是统治所有毛茸茸的、湿漉漉的、会摇尾巴的生命的王。\n\n它们不懂"王朝"，但它们都跟着你。\n你数了数：六双眼睛，一颗心。\n\n这大概就是末世的答案。',
      purple: true,
    },
  };

  /* ---------------- 天气 ---------------- */
  const WEATHER = [
    { id: 'clear', name: '晴', rain: 0, wind: 1 },
    { id: 'overcast', name: '阴', rain: 0, wind: 2 },
    { id: 'wind', name: '大风', rain: 0, wind: 3 },
    { id: 'rain', name: '雨', rain: 1, wind: 2 },
    { id: 'fog', name: '雾', rain: 0, wind: 0.5 },
  ];

  /* 每日天气对应的氛围台词（用于"度过一天"转场） */
  const DAY_LINES = {
    clear:    ['阳光照进院子，风是暖的。', '今天没有云。天蓝得不像末世。', '干燥的一天。连丧尸都晒得懒洋洋的。'],
    overcast: ['云压得很低，像谁把世界调暗了一格。', '灰蒙蒙的一天。', '阴天。远处偶尔传来一两声闷响。'],
    wind:     ['风把栅栏吹得吱呀响。', '大风吹过废墟，扬起尘土和旧报纸。', '风很大，声音像有人在很远的地方喊你。'],
    rain:     ['雨点打在铁皮屋顶上，噼里啪啦。', '雨把一切都洗得发亮，包括伤口。', '雨夜。水洼里有什么东西在动。'],
    fog:      ['雾很浓，院子外的丧尸只剩下影子。', '雾里传来滴水声。', '浓雾锁住了孤城，也锁住了外面的世界。'],
  };

  /* ---------------- 基础设施 ---------------- */
  const BASE_LAYOUT = {
    mapW: 34, mapH: 22, tile: 34,
    playerSpawn: { x: 15, y: 15 },
    catSpawn: { x: 12, y: 17 },
    buildings: {
      farm:   { name: '农田', icon: '🌾', x: 3, y: 3, w: 6, h: 5, color: '#4a5a3a', desc: '种下种子，等一场雨。' },
      pen:    { name: '畜栏', icon: '🐾', x: 25, y: 3, w: 6, h: 5, color: '#4a4a5a', desc: '驯养的丧尸住在这里。' },
      synth:  { name: '合成台', icon: '🔮', x: 3, y: 13, w: 5, h: 4, color: '#5a3a4a', desc: '把驯养丧尸与材料熔炼成异能大丧尸。' },
      med:    { name: '医疗站', icon: '⛑️', x: 26, y: 13, w: 5, h: 4, color: '#3a4a5a', desc: '包扎伤口，压制感染。' },
      storage:{ name: '储物箱', icon: '📦', x: 14, y: 2, w: 4, h: 3, color: '#4a4a3a', desc: '查看背包，更换武器。' },
      fire:   { name: '篝火', icon: '🔥', x: 14, y: 11, w: 4, h: 4, color: '#5a4a3a', desc: '休息，度过一天。也可以把生肉烤熟。' },
      bench:  { name: '工作台', icon: '🛠️', x: 19, y: 10, w: 4, h: 3, color: '#4a4636', desc: '篝火旁的工作台。可以做灯笼、缝布袋。' },
      shelter:{ name: '遮雨棚', icon: '☔', x: 9, y: 10, w: 4, h: 3, color: '#3a4a42', desc: '雨天的庇护所。下雨时躲进去，能恢复体力。' },
      gate:   { name: '大门', icon: '🚪', x: 15, y: 19, w: 4, h: 3, color: '#5a3a3a', desc: '走出孤城，去废墟里搜索物资。' },
      radio:  { name: '收音机', icon: '📻', x: 21, y: 16, w: 3, h: 2, color: '#3a3a4a', desc: '吱吱呀呀的收音机。' },
    },
  };

  LG.CFG = {
    BAL, ITEMS, CROPS, ZONES, ZOMBIES, SYNTH, DIARY, RADIO, ENDINGS, WEATHER, DAY_LINES,
    FURNITURE, ZONE_FURNITURE, PETS, HUMAN, AI_SHI, PLANT_PETS, EQUIP, EQUIP_SLOTS, BASE_LAYOUT,
    /* TapTap 配置：上架前填写真实值。
     * 注意：TapTap H5 渠道禁止内购，本游戏不含任何支付功能；
     * 仅保留 登录 / 激励视频 / 分享 / 埋点。 */
    TAP: {
      enabled: true,
      clientId: '请填写你的TapTap客户端ID',
      useRealSdk: false,       // 置为 true 并引入官方 SDK 后生效（见 docs/taptap-sdk.md）
      privacyUrl: 'https://2391089148-a11y.github.io/moshi/',  // 隐私政策网页（发布后生效）
    },
  };
})();
