/**
 * BWIKI (B站 MediaWiki) 数据源
 * 爬取 https://wiki.biligame.com/yh/ 异环数据
 */

import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { config } from '../config.js';
import { getCached, setCache } from './cache.js';
import type { Character, BaseStats, Skill, BannerInfo, MaterialItem, Enemy, Arc, Material, Rarity, ElementType, RoleType, BreakthroughMaterial } from '../types/index.js';

const { bwiki } = config;

/** 带缓存的 API 请求 */
async function apiRequest(params: Record<string, string>): Promise<any> {
  const url = new URL(bwiki.apiUrl);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const urlStr = url.toString();

  const cached = await getCached(urlStr);
  if (cached) return cached;

  const resp = await fetch(urlStr, {
    headers: { 'User-Agent': bwiki.userAgent },
    signal: AbortSignal.timeout(config.requestTimeout),
  });

  if (!resp.ok) {
    throw new Error(`BWIKI API error: ${resp.status} ${resp.statusText}`);
  }

  const data = await resp.json();
  await setCache(urlStr, data);
  return data;
}

/** 获取页面 HTML */
async function getPageHtml(title: string): Promise<cheerio.CheerioAPI> {
  const data = await apiRequest({
    action: 'parse',
    page: title,
    format: 'json',
    prop: 'text',
  });
  const html = data?.parse?.text?.['*'] ?? '';
  return cheerio.load(html);
}

/** 通用搜索 */
export async function searchWiki(query: string, limit = 10) {
  const data = await apiRequest({
    action: 'query',
    list: 'search',
    srsearch: query,
    srlimit: String(limit),
    format: 'json',
  });

  return (data?.query?.search ?? []).map((item: any) => ({
    title: item.title,
    pageId: item.pageid,
    snippet: item.snippet?.replace(/<[^>]+>/g, '') ?? '',
  }));
}

/** 获取分类下所有页面 */
export async function getCategoryMembers(category: string, limit = 100) {
  const data = await apiRequest({
    action: 'query',
    list: 'categorymembers',
    cmtitle: `Category:${category}`,
    cmlimit: String(limit),
    format: 'json',
  });
  return (data?.query?.categorymembers ?? [])
    .filter((m: any) => m.ns === 0) // 只取主命名空间
    .map((m: any) => ({ title: m.title, pageId: m.pageid }));
}

/** 解析角色页面，提取结构化数据 */
export async function getCharacter(name: string): Promise<Character | null> {
  try {
    const $ = await getPageHtml(name);

    // 基础信息
    const table = $('table.LB').first();
    const rows = table.find('tr');
    
    const getRowVal = (label: string): string => {
      const row = rows.filter((_, r) => $(r).find('td').first().text().trim() === label);
      return row.length ? $(row).find('td').eq(1).text().trim() : '';
    };

    // 解析稀有度 (SSR/SR/R)
    const rarityImg = $('img[alt*="标识"], img[alt*="S标识"]').first().attr('alt') ?? '';
    const rarity: Rarity = rarityImg.includes('S') ? 'SSR' : rarityImg.includes('A') ? 'SR' : 'R';
    
    // 角色名：以传入的名称为准（来自 Category:角色），
    // 页面上可能先出现"施工中"占位符导致抓错
    const characterName = name;

    // 属性/元素
    const element = getRowVal('属性') as ElementType || '物理';

    // 定位
    const role = getRowVal('类型') as RoleType || '输出';

    // 所属
    const faction = getRowVal('所属') || '';

    // 弧盘适配
    const arcType = getRowVal('弧盘适配') || '';

    // CV
    const cv = getRowVal('CV') || '';

    // 生日
    const birthday = getRowVal('生日') || '';

    // 角色故事
    const storyDiv = $('div:contains("人物故事")').last();
    const description = storyDiv.next('div').text().trim() || $(storyDiv).closest('div').find('div[style*="overflow"]').text().trim() || '';

    // 基础属性 (从属性详情表)
    let baseStats: BaseStats = {};
    let maxStats: BaseStats = {};

    // 解析属性表
    const statsTables = $('table.LB');
    statsTables.each((_, tbl) => {
      const $tbl = $(tbl);
      const rows = $tbl.find('tr');
      const stats: Record<string, string> = {};
      rows.each((_, r) => {
        const cells = $(r).find('td');
        if (cells.length >= 2) {
          const key = $(cells[0]).text().trim();
          const val = $(cells[1]).text().trim();
          stats[key] = val;
        }
      });
      
      // 判断是基础属性还是满级属性
      if (Object.keys(stats).length > 0 && !baseStats.hp) {
        baseStats = {
          hp: stats['生命'] ? parseInt(stats['生命']) || undefined : undefined,
          attack: stats['攻击'] ? parseInt(stats['攻击']) || undefined : undefined,
          physicalDef: stats['物理防御'] ? parseInt(stats['物理防御']) || undefined : undefined,
          magicDef: stats['法术防御'] ? parseInt(stats['法术防御']) || undefined : undefined,
          critRate: stats['暴击率'],
          critDmg: stats['暴击增伤'] || stats['暴击伤害'],
          chargeEfficiency: stats['充能效率'] || stats['充能'],
          atkSpeed: stats['攻速'],
        };
      } else if (Object.keys(stats).length > 0) {
        maxStats = {
          hp: stats['生命'] ? parseInt(stats['生命']) || undefined : undefined,
          attack: stats['攻击'] ? parseInt(stats['攻击']) || undefined : undefined,
          physicalDef: stats['物理防御'] ? parseInt(stats['物理防御']) || undefined : undefined,
          magicDef: stats['法术防御'] ? parseInt(stats['法术防御']) || undefined : undefined,
          critRate: stats['暴击率'],
          critDmg: stats['暴击增伤'] || stats['暴击伤害'],
          chargeEfficiency: stats['充能效率'] || stats['充能'],
          atkSpeed: stats['攻速'],
        };
      }
    });

    // 解析技能
    const skills: Skill[] = [];
    $('.skill-container').each((_, el) => {
      const $el = $(el);
      const name = $el.find('.title-line').first().text().trim();
      if (!name) return;

      // 判断技能类型
      let type: '奥义' | '战技' | '普攻' | '特性' = '特性';
      const imgAlt = $el.find('.skill-img img').first().attr('alt') ?? '';
      if (imgAlt.includes('奥义')) type = '奥义';
      else if (imgAlt.includes('战技')) type = '战技';
      else if (imgAlt.includes('基本') || imgAlt.includes('普攻')) type = '普攻';
      else if (imgAlt.includes('特性')) type = '特性';

      // 技能描述（取第一段非空文本）
      let description = '';
      const descDiv = $el.find('.skill-box > div').eq(1);
      if (descDiv.length) {
        // 移除 LV 效果内容
        const clone = descDiv.clone();
        clone.find('b').remove();
        description = clone.text().trim().replace(/\s+/g, ' ');
      }

      // LV 效果
      const levels: string[] = [];
      $el.find('.skill-box > div > b').each((_, lv) => {
        const text = $(lv).text().trim();
        if (text) levels.push(text);
      });

      skills.push({ name, type, description, levels });
    });

    // 解析突破材料
    const breakthrough: BreakthroughMaterial[] = [];
    const btTable = $('table.wikitable').first();
    if (btTable.length) {
      btTable.find('tr').each((_, row) => {
        const cells = $(row).find('th, td');
        if (cells.length >= 2) {
          const levelText = $(cells[0]).text().trim();
          const level = parseInt(levelText) || 0;
          if (level > 0) {
            const matText = $(cells[1]).text().trim();
            const materials: MaterialItem[] = matText ? [{ name: matText, count: 1 }] : [];
            const talent = $(cells[2]).text().trim() || undefined;
            breakthrough.push({ level, materials, talent });
          }
        }
      });
    }

    // 解析卡池历史
    const bannerHistory: BannerInfo[] = [];
    $('.panel.panel-primary').each((_, panel) => {
      const title = $(panel).find('.panel-title').text().trim();
      if (title) {
        const body = $(panel).find('.panel-collapse').text().trim().replace(/\s+/g, ' ');
        bannerHistory.push({ name: title, description: body });
      }
    });

    // 立绘图片
    const img = $('img[alt*="立绘"]').first();
    const imageUrl = img.attr('src') || undefined;

    return {
      name: characterName,
      rarity,
      element,
      role,
      faction,
      arcType,
      cv,
      birthday,
      description,
      baseStats,
      maxStats,
      skills,
      breakthrough,
      bannerHistory,
      wikiUrl: `${bwiki.baseUrl}/${encodeURIComponent(name)}`,
      imageUrl,
    };
  } catch (err) {
    console.error(`[BWIKI] 获取角色 "${name}" 失败:`, err);
    return null;
  }
}

/** 搜索角色 */
export async function searchCharacters(query: string) {
  const members = await getCategoryMembers('角色');
  
  // 先精确匹配
  const exact = members.find((m: { title: string }) => m.title === query);
  if (exact) return [exact];

  // 模糊匹配
  const lower = query.toLowerCase();
  return members.filter((m: { title: string }) => m.title.toLowerCase().includes(lower));
}

/** 获取所有角色列表 */
export async function listCharacters() {
  return getCategoryMembers('角色');
}

/** 获取当前卡池信息（从首页抓取） */
export async function getCurrentBanners(): Promise<BannerInfo[]> {
  try {
    const $ = await getPageHtml('首页');
    const banners: BannerInfo[] = [];

    // 策略1: 旧版 Bootstrap panel（backward compat）
    $('.panel.panel-primary').each((_, panel) => {
      const title = $(panel).find('.panel-title').text().trim();
      if (title && title.includes('UP')) {
        const body = $(panel).find('.panel-collapse').text().trim().replace(/\s+/g, ' ');
        banners.push({ name: title, description: body });
      }
    });

    // 策略2: 新版 "公测实时动态" 公告区块
    if (banners.length === 0) {
      $('.announcement-box').each((_, box) => {
        const heading = $(box).find('h3').first().text().trim();
        // 提取公告条目
        $(box).find('a').each((_, link) => {
          const text = $(link).text().trim();
          const href = $(link).attr('href') || '';
          if (text && text.length > 5 && !href.startsWith('#')) {
            // 合并前面的日期（如果有）
            const parentText = $(link).parent().text().trim();
            const dateMatch = parentText.match(/(\d{4}-\d{2}-\d{2})/);
            const desc = (dateMatch ? `[${dateMatch[1]}] ` : '') + text;
            banners.push({ name: `📢 ${heading}`, description: desc });
          }
        });
      });
    }

    // 策略3: 搜索 "卡池" 相关的 wiki 页面
    if (banners.length === 0) {
      try {
        const searchData = await apiRequest({
          action: 'query',
          list: 'search',
          srsearch: '卡池 UP',
          srlimit: '5',
          format: 'json',
        });
        const items = (searchData?.query?.search ?? []) as Array<{ title: string; snippet?: string }>;
        for (const item of items) {
          const snippet = (item.snippet ?? '').replace(/<[^>]+>/g, '').slice(0, 200);
          banners.push({
            name: item.title,
            description: snippet || '详见页面内容',
          });
        }
      } catch {
        // 搜索失败就跳过
      }
    }

    return banners;
  } catch {
    return [];
  }
}

// (类型已从 types/index.js 导入)