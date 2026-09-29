/** 异环游戏数据类型定义 */

/** 角色稀有度 */
export type Rarity = 'SSR' | 'SR' | 'R';

/** 属性类型 */
export type ElementType = '灵' | '暗' | '火' | '冰' | '风' | '雷' | '物理' | '光';

/** 角色定位 */
export type RoleType = '输出' | '辅助' | '生存' | '混合';

/** 角色基本信息 */
export interface Character {
  name: string;
  rarity: Rarity;
  element: ElementType;
  role: RoleType;
  faction: string;
  /** 弧盘适配 */
  arcType: string;
  cv: string;
  birthday: string;
  description: string;
  baseStats: BaseStats;
  maxStats: BaseStats;
  skills: Skill[];
  breakthrough: BreakthroughMaterial[];
  bannerHistory: BannerInfo[];
  wikiUrl: string;
  imageUrl?: string;
}

/** 基础属性 */
export interface BaseStats {
  hp?: number;
  attack?: number;
  physicalDef?: number;
  magicDef?: number;
  critRate?: string;
  critDmg?: string;
  chargeEfficiency?: string;
  atkSpeed?: string;
}

/** 技能 */
export interface Skill {
  name: string;
  type: '奥义' | '战技' | '普攻' | '特性';
  description: string;
  levels: string[];
}

/** 突破材料 */
export interface BreakthroughMaterial {
  level: number;
  materials: MaterialItem[];
  talent?: string;
}

/** 材料项 */
export interface MaterialItem {
  name: string;
  count: number;
}

/** 武器/弧盘 */
export interface Arc {
  name: string;
  rarity: Rarity;
  type: string;
  baseAttack: number;
  subStat: string;
  effect: string;
  wikiUrl: string;
}

/** 怪物 */
export interface Enemy {
  name: string;
  type: string;
  element: ElementType;
  drops: MaterialItem[];
  location: string;
  wikiUrl: string;
}

/** 卡池 */
export interface Banner {
  name: string;
  type: '限定' | '常驻' | '武器';
  startDate: string;
  endDate: string;
  rateUp5Star: string[];
  rateUp4Star: string[];
}

/** 卡池信息（简化版，来自 HTML 解析） */
export interface BannerInfo {
  name: string;
  description: string;
}

/** 材料/物品 */
export interface Material {
  name: string;
  type: string;
  rarity: Rarity;
  description: string;
  source: string[];
  wikiUrl: string;
}

/** BWIKI 页面解析结果 */
export interface WikiPageData {
  title: string;
  pageId: number;
  html: string;
  categories: string[];
  links: string[];
  imageUrl?: string;
}