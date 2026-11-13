export const BOOT_MS = 20_000;
export const REVEAL_MS = 650;

const merry = [
  ["syrup", "西罗布村", "登船迎着晨光启航"],
  ["baratie", "海上餐厅", "巴拉蒂的鱼形餐厅"],
  ["cocoyasi", "可可亚西村", "橘子园与阿龙公园"],
  ["loguetown", "罗格镇", "伟大航路前的最后一站"],
  ["cape", "双子岬", "越过颠倒山，遇见拉布"],
  ["whiskey", "威士忌山", "月下的仙人掌山峰"],
  ["garden", "小花园", "史前丛林与火山"],
  ["drum", "磁鼓岛", "雪山上的城堡"],
  ["alabasta", "阿拉巴斯坦", "沙漠之国与告别"],
  ["jaya", "加亚", "魔谷镇与冲天海流"],
  ["sky", "空岛", "云海尽头的黄金钟"],
  ["longring", "长环长岛", "长岛草原上的比赛"],
  ["water", "水之都", "沿着水道驶入造船城"],
  ["enies", "司法岛", "越过瀑布，救回同伴"],
  ["farewell", "海上告别", "海雾中送别第一艘船"],
];

const sunny = [
  ["sunny", "水之都 · 新船启航", "从造船城驶向下一段旅程"],
  ["thriller", "恐怖三桅帆船", "雾中的岛船与尖塔"],
  ["sabaody", "香波地群岛", "泡泡树海，伙伴暂时分散"],
  ["amazon", "九蛇岛", "路飞支线 · 船员分散期间", true],
  ["impel", "推进城", "路飞支线 · 前往深海监狱", true],
  ["marine", "马林梵多", "路飞支线 · 顶上战争", true],
  ["reunion", "香波地群岛 · 重聚", "两年后再次出发，驶向新世界"],
  ["fishman", "鱼人岛", "穿过泡泡，潜入海底"],
  ["punk", "庞克哈萨德", "一侧是烈焰，一侧是冰雪"],
  ["dressrosa", "德雷斯罗萨", "红瓦城与斗牛竞技场"],
  ["zou", "佐乌", "象主背上的岛屿"],
  ["cake", "蛋糕岛", "万国的糖果海岸"],
  ["wano", "和之国", "瀑布、山城与月下觉醒"],
  ["egghead", "蛋头岛", "云端的未来都市"],
  ["elbaf", "艾尔巴夫", "巨人之国与世界树"],
];

export const VOYAGE = [
  ...merry.map(([id, title, detail], index) => ({ id, title, detail, at: index * 0.5 / merry.length, ship: "merry" })),
  ...sunny.map(([id, title, detail, detour], index) => ({ id, title, detail, detour, at: 0.5 + index * 0.46 / sunny.length, ship: "sunny" })),
];

export const clamp = (value) => Math.min(1, Math.max(0, value));
export function voyageFrame(elapsed) {
  const progress = clamp(elapsed / BOOT_MS);
  const index = VOYAGE.findLastIndex(chapter => chapter.at <= progress);
  const transition = clamp((progress - 0.482) / 0.036);
  return {
    index,
    progress,
    shipX: 9 + progress * 82,
    sunnyMix: transition * transition * (3 - 2 * transition),
  };
}
