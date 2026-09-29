/**
 * 环世全鉴 (mysqil.com) 数据源
 *
 * 社区维护的异环攻略站，数据随游戏版本持续更新。
 * 作为 BWIKI 的辅助/后备数据源，覆盖新角色和当前卡池。
 *
 * @see https://wiki.mysqil.com/
 */

import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const BASE = 'https://wiki.mysqil.com';
const UA = 'nte-mcp/0.2.0';

// ─── 类型 ───────────────────────────────────────────────────────

export interface MysqilCharacter {
  /** 角色名（中文） */
  name: string;
  /** URL slug */
  slug: string;
  /** S / A */
  rarity: string;
  /** 属性：灵/暗/光/咒/魂/相/神 */
  element: string;
  /** 弧盘类型 */
  arcType: string;
  /** 定位 */
  role: string;
  /** 站位 */
  position: string;
  /** 描述 */
  description?: string;
  /** 基础属性（80级） */
  stats?: {
    hp?: string;
    attack?: string;
    defence?: string;
    critRate?: string;
    critDmg?: string;
  };
  /** 推荐弧盘 */
  recommendedArc?: string;
}

export interface MysqilBanner {
  name: string;
  type: '限定卡池' | '专武卡池' | '复刻卡池' | string;
  characters: string[];
  startDate: string;
  endDate: string;
  version: string;
}

// ─── HTTP 请求 ──────────────────────────────────────────────────

async function fetchPage(path: string): Promise<string> {
  const resp = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`mysqil fetch ${path}: ${resp.status}`);
  return resp.text();
}

// ─── 角色列表 ──────────────────────────────────────────────────

const NAME_MAP: Record<string, string> = {
  'nanali': '娜娜莉',
  'lingke': '灵可',
  'heiyu': '黑羽',
  'bohe': '薄荷',
  'anhunqu': '安魂曲',
  'baizang': '白藏',
  'fadiya': '法帝娅',
  'xun': '浔',
  'jiuyuan': '九原',
  'hasuoer': '哈索尔',
  'zaowu': '早雾',
  'zhenhong': '真红',
  'dafutier': '达芙蒂尔',
  'ling': '零',
  'yiluoyi': '伊洛伊',
  'canhong': '残虹',
  'mingyin': '明音凛',
  'kaesi': '卡厄斯',
  'tajiduo': '塔吉多',
  'xiaozhi': '小吱',
  'haniya': '哈尼娅',
  'edjia': '埃德嘉',
  'haiyue': '海月',
  'yi': '翳',
  'adeler': '阿德勒',
};

/** 获取 mysqil.com 全角色列表 */
export async function getCharacterList(): Promise<MysqilCharacter[]> {
  const html = await fetchPage('/characters');
  const $ = cheerio.load(html);
  const characters: MysqilCharacter[] = [];

  $('a[href*="/characters/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (!href.startsWith('/characters/') || href === '/characters') return;
    const slug = href.replace('/characters/', '').replace(/\/$/, '');
    if (!slug || slug.includes('#')) return;

    const text = $(el).text().trim();
    // 格式: S灵娜娜莉等离子·主C·前排
    // 第1位: 稀有度 S/A, 第2位: 属性(1个中文字)
    const rarityMatch = text.match(/^([SA])([灵暗光咒魂相神])(.+)/);
    if (!rarityMatch) return;

    const element = rarityMatch[2];
    const rest = rarityMatch[3];
    const parts = rest.split(/[·\s]+/).filter(Boolean);

    // 从 NAME_MAP 取中文名
    const displayName = NAME_MAP[slug] || parts[0] || slug;

    // parts 格式: [名字, 弧盘类型?, 定位, 站位?]
    let arcType = '';
    let role = '';
    let position = '';

    if (parts.length >= 3) {
      arcType = ['固态', '液态', '气态', '等离子', '聚合'].includes(parts[1]) ? parts[1] : '';
      role = parts[arcType ? 2 : 1] || '';
      position = parts.slice(arcType ? 3 : 2).join('·') || '';
    }

    characters.push({
      name: displayName,
      slug,
      rarity: rarityMatch?.[1] || 'S',
      element,
      arcType,
      role,
      position,
    });
  });

  return characters;
}

// ─── 角色详情 ──────────────────────────────────────────────────

/** 从角色页面提取基础数据 */
export async function getCharacterDetail(slug: string): Promise<MysqilCharacter | null> {
  try {
    const html = await fetchPage(`/characters/${slug}`);
    const $ = cheerio.load(html);
    const bodyText = $('body').text();

    // dt/dd 信息块
    const info: Record<string, string> = {};
    $('dt').each((_, el) => {
      const key = $(el).text().trim();
      const dd = $(el).next('dd');
      const val = dd.text().trim();
      if (key && val) info[key] = val;
    });

    // 基础属性
    const findStat = (label: string): string | undefined => {
      const idx = bodyText.indexOf(label);
      if (idx < 0) return undefined;
      // 取后面的数字（可能含逗号）
      const after = bodyText.slice(idx + label.length, idx + label.length + 30);
      const numMatch = after.match(/([0-9,]+%?)/);
      return numMatch?.[1] || undefined;
    };

    // 推荐武器/弧盘
    const arcMatch = bodyText.match(/推荐武器\s*\n?\s*(.+?)\s*S/i);

    // 描述
    const descMatch = bodyText.match(/概述\s*\n?\s*(.+?)(?:\n|$)/);
    // 如果描述太短或匹配了多余内容
    let description = descMatch?.[1]?.trim() || undefined;

    const stats = {
      hp: findStat('基础生命值'),
      attack: findStat('基础攻击力'),
      defence: findStat('基础防御力'),
      critRate: findStat('暴击率'),
      critDmg: findStat('暴击伤害'),
    };

    // 只在有数据时才返回 stats
    const hasStats = Object.values(stats).some(Boolean);

    return {
      name: info['稀有度'] ? (Object.values(NAME_MAP).find(n => bodyText.includes(n)) || slug) : slug,
      slug,
      rarity: info['稀有度'] || 'S',
      element: info['属性'] || '',
      arcType: info['弧盘类型'] || '',
      role: info['定位'] || '',
      position: info['站位'] || '',
      description,
      stats: hasStats ? stats : undefined,
      recommendedArc: arcMatch?.[1]?.trim() || undefined,
    };
  } catch (err) {
    console.error(`[mysqil] 获取角色 ${slug} 失败:`, err);
    return null;
  }
}

// ─── 卡池信息 ──────────────────────────────────────────────────

/** 解析日期格式 `249月→1510月` → `2026-09-24 → 2026-10-15` */
function parseBannerDates(
  refYear: number,
  startMatch: string,
  endMatch: string,
): [start: string, end: string] {
  const s = startMatch.match(/^(\d{1,2})(\d{1,2})月?$/);
  const e = endMatch.match(/^(\d{1,2})(\d{1,2})月?$/);
  if (!s || !e) return ['', ''];
  const sm = Number(s[2]), sd = Number(s[1]);
  const em = Number(e[2]), ed = Number(e[1]);
  const sy = sm >= 7 ? refYear : refYear; // 跨年处理
  const ey = em >= sm ? refYear : refYear + 1;
  return [
    `${sy}-${String(sm).padStart(2, '0')}-${String(sd).padStart(2, '0')}`,
    `${ey}-${String(em).padStart(2, '0')}-${String(ed).padStart(2, '0')}`,
  ];
}

/** 从时间线页面提取当前卡池 */
export async function getBanners(): Promise<MysqilBanner[]> {
  try {
    const html = await fetchPage('/timeline');
    const $ = cheerio.load(html);
    const bodyText = $('body').text();
    const banners: MysqilBanner[] = [];

    // 查找版本区间，取当前时间所在的版本
    const versionRegex = /(\d{4}-\d{2}-\d{2})\s*—\s*(\d{4}-\d{2}-\d{2})\s*\n?\s*「([^」]+)」/g;
    let currentVersion = '';
    let versionYear = 2026;
    const now = Date.now();
    let verMatch;

    while ((verMatch = versionRegex.exec(bodyText)) !== null) {
      const start = new Date(verMatch[1]).getTime();
      const end = new Date(verMatch[2]).getTime();
      if (start <= now && end >= now) {
        currentVersion = verMatch[3];
        versionYear = new Date(verMatch[1]).getFullYear();
        break;
      }
    }

    // 提取限定卡池（带日期格式：249月→1510月「预言终幕曲」限定棋盘限定卡池S级角色：黑羽）
    const bannerRegex = /(\d{1,2})(\d{1,2})月→(\d{1,2})(\d{1,2})月「([^」]+)」[^。]*?限定(?:棋盘|卡池)\s*限定卡池\s*S级角色[：:]\s*([^\s（<0-9]+)/g;
    let match;

    while ((match = bannerRegex.exec(bodyText)) !== null) {
      const startDay = match[1], startMonth = match[2];
      const endDay = match[3], endMonth = match[4];
      const name = match[5].trim();
      const charName = match[6].trim();

      const [startDate, endDate] = parseBannerDates(
        versionYear,
        `${startDay}${startMonth}月`,
        `${endDay}${endMonth}月`,
      );

      if (!banners.some(b => b.name === name)) {
        banners.push({
          name,
          type: '限定卡池',
          characters: [charName],
          startDate,
          endDate,
          version: currentVersion,
        });
      }
    }

    return banners;
  } catch (err) {
    console.error('[mysqil] 获取卡池信息失败:', err);
    return [];
  }
}