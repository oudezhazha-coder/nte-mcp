/**
 * 指令路由器
 *
 * 将 QQ 群聊/私聊消息映射到 nte-mcp 工具函数调用，
 * 并将结果格式化为易读的文本回复。
 */

import { searchWiki, getCurrentBanners, searchCharacters, getCharacter, listCharacters } from '../sources/bwiki.js';
import { getCharacterList, getCharacterDetail, getBanners as getMysqilBanners } from '../sources/mysqil.js';
import { simulate, formatPullResult } from '../sources/gacha.js';

// ─── 指令定义 ───────────────────────────────────────────────────

interface CommandDef {
  /** 匹配前缀（不分大小写） */
  prefixes: string[];
  /** 描述（帮助用） */
  description: string;
  /** 处理函数：rawMessage → 回复文本 */
  handler: (args: string, from: { userId: number; groupId?: number }) => Promise<string>;
}

const commands: CommandDef[] = [
  // ── 角色查询 ──
  {
    prefixes: ['查角色', '角色查', '角色详'],
    description: '查角色 <名称> — 查询角色详情',
    handler: async (name) => {
      if (!name) return '请告诉我角色名称，例如：查角色 娜娜莉';

      // 优先从环世全鉴(mysqil.com)查找（数据最新，25个角色）
      const allMysqilChars = await getCharacterList();
      const matched = allMysqilChars.find(
        (c) => c.name.includes(name) || name.includes(c.name)
      );

      if (matched) {
        const detail = await getCharacterDetail(matched.slug);
        if (detail) {
          return formatMysqilCharDetail(detail);
        }
      }

      // fallback: BWIKI（有技能描述的老角色）
      const characters = await searchCharacters(name);
      if (characters.length > 0) {
        const chara = await getCharacter(characters[0].title);
        if (chara) {
          const lines: string[] = [
            `✨ ${chara.name}`,
            `⭐ ${chara.rarity}  |  🎯 ${chara.element}  |  🏷️ ${chara.role}`,
          ];
          if (chara.faction) lines.push(`🏛️ ${chara.faction}`);
          if (chara.arcType) lines.push(`💠 弧盘: ${chara.arcType}`);

          if (chara.baseStats) {
            const bs = chara.baseStats;
            const statParts = [
              bs.hp ? `HP: ${bs.hp}` : '',
              bs.attack ? `ATK: ${bs.attack}` : '',
              bs.physicalDef ? `物防: ${bs.physicalDef}` : '',
              bs.magicDef ? `法防: ${bs.magicDef}` : '',
            ].filter(Boolean);
            if (statParts.length) lines.push(`📊 ${statParts.join(' | ')}`);

            const critParts = [
              bs.critRate ? `暴击: ${bs.critRate}` : '',
              bs.critDmg ? `暴伤: ${bs.critDmg}` : '',
            ].filter(Boolean);
            if (critParts.length) lines.push(`⚡ ${critParts.join(' | ')}`);
          }

          if (chara.skills.length > 0) {
            for (const skill of chara.skills.slice(0, 3)) {
              lines.push(`\n🔹 ${skill.type} · ${skill.name}`);
              if (skill.description) lines.push(`  ${skill.description.slice(0, 120)}`);
            }
          }

          if (chara.description) {
            lines.push(`\n📖 ${chara.description.slice(0, 200)}`);
          }

          lines.push(`\n🔗 ${chara.wikiUrl}`);
          lines.push(`\n📡 数据源: 环世全鉴 + BWIKI（技能详情）`);
          return lines.join('\n');
        }
      }

      // 均未找到
      const wikiResults = await searchWiki(name, 3);
      if (wikiResults.length > 0) {
        const suggestions = wikiResults.map((r: { title: string }) => r.title).join('、');
        return [
          `❌ 未找到角色"${name}"。`,
          `📄 但 BWIKI 上有相关页面：${suggestions}`,
          '💡 试试其他关键词。',
        ].join('\n');
      }

      return `未找到角色"${name}"，试试其他关键词。\n💡 环世全鉴和 BWIKI 均未收录该角色，新角色可能尚未录入攻略站。`;
    },
  },

  // ── 角色列表 ──
  {
    prefixes: ['角色列表', '全角色', '所有角色'],
    description: '角色列表 — 查看所有角色',
    handler: async () => {
      const mysqilChars = await getCharacterList();
      // 按稀有度+名称排序
      const sorted = [...mysqilChars].sort((a, b) => {
        if (a.rarity !== b.rarity) return a.rarity < b.rarity ? -1 : 1;
        return a.name.localeCompare(b.name, 'zh-CN');
      });
      const lines = sorted.map((c, i) => `  ${i + 1}. [${c.rarity}] ${c.name}  🎯${c.element}  🏷️${c.role}`);
      return `📋 异环全角色（${sorted.length} 名）\n\n${lines.join('\n')}\n\n💡 发送"查角色 <名称>"查看详情\n📡 数据源: 环世全鉴`;
    },
  },

  // ── 搜索 ──
  {
    prefixes: ['搜wiki', '搜索', '找'],
    description: '搜wiki <关键词> — 搜索 BWIKI 百科',
    handler: async (query) => {
      if (!query) return '请告诉我搜索关键词，例如：搜wiki 突破石';
      const results = await searchWiki(query, 5);
      if (results.length === 0) return `未找到与"${query}"相关的内容`;

      const lines: string[] = [`🔍 搜索"${query}" 结果：\n`];
      for (const r of results) {
        lines.push(`📄 ${r.title}`);
        if (r.snippet) lines.push(`  ${r.snippet.replace(/\n/g, ' ').slice(0, 150)}`);
      }
      return lines.join('\n');
    },
  },

  // ── 材料查询 ──
  {
    prefixes: ['查材料', '材料查', '材料'],
    description: '查材料 <名称> — 查询材料获取方式和用途',
    handler: async (name) => {
      if (!name) return '请告诉我材料名称，例如：查材料 突破石';
      const results = await searchWiki(name, 5);
      if (results.length === 0) return `未找到材料"${name}"的相关信息`;

      const lines: string[] = [`📦 材料"${name}" 搜索结果：\n`];
      for (const r of results) {
        lines.push(`📄 ${r.title}`);
        if (r.snippet) lines.push(`  ${r.snippet.replace(/\n/g, ' ').slice(0, 150)}`);
        lines.push(`  🔗 https://wiki.biligame.com/yh/${encodeURIComponent(r.title)}`);
      }
      lines.push('\n💡 常见材料：突破材料 | 技能材料 | 突破石 | 通用材料');
      return lines.join('\n');
    },
  },

  
  {
    prefixes: ['武器', '弧盘', '装备'],
    description: '武器 / 弧盘 — 查看武器和弧盘系统说明',
    handler: async () => {
      return `💠 异环武器 & 弧盘系统

▫️ 弧盘（角色专武）
  每个角色装备一个弧盘，提供基础属性和特殊效果
  适配类型：等离子、凝聚态、气态、固态、混沌

▫️ 磁盘（套装）
  磁盘提供套装效果和词条属性
  - 输出：伤害词条
  - 辅助：循环和团队增益
  - 生存：护盾、回复、减伤

💡 发送"搜wiki 弧盘"或"搜wiki 磁盘"查找具体装备信息`;
    },
  },

  // ── 抽卡模拟 ──
  {
    prefixes: ['异环抽卡', '抽卡模拟', '抽卡', '十连', '单抽'],
    description: '异环抽卡 [角色名/常驻] — 模拟十连抽。如：异环抽卡黑羽 / 异环抽卡常驻',
    handler: async (args, from) => {
      const input = args.trim();
      const isSingle = /^1|单抽|一次$/.test(input);
      const isStandard = /^常驻|标准|普通$/.test(input);
      const count: 1 | 10 = isSingle ? 1 : 10;

      // 常驻池
      if (isStandard) {
        const summary = simulate(from.userId, count, '', 'standard');
        return formatPullResult(summary, '', 'standard');
      }

      // 检查是否指定了角色名（如 异环抽卡黑羽 → UP 黑羽）
      let featured = '';
      if (input) {
        const allChars = await getCharacterList();
        const matched = allChars.find(c => input.includes(c.name));
        if (matched) featured = matched.name;
      }

      // 没指定角色，取当前卡池最新 UP
      if (!featured) {
        const mysqilBanners = await getMysqilBanners();
        const featuredBanner = mysqilBanners.find(b => b.type.includes('限定'));
        featured = featuredBanner?.characters?.[0] || '黑羽';
      }

      const summary = simulate(from.userId, count, featured, 'limited');
      return formatPullResult(summary, featured, 'limited');
    },
  },
];

// ─── 环世全鉴格式化 ───────────────────────────────────────────

function formatMysqilCharDetail(c: import('../sources/mysqil.js').MysqilCharacter): string {
  const lines: string[] = [`✨ ${c.name}`];
  lines.push(`⭐ ${c.rarity}  |  🎯 ${c.element}  |  🏷️ ${c.role}`);
  if (c.arcType) lines.push(`💠 弧盘: ${c.arcType}`);
  if (c.position) lines.push(`📍 站位: ${c.position}`);

  if (c.stats) {
    const statParts = [
      c.stats.hp ? `HP: ${c.stats.hp}` : '',
      c.stats.attack ? `ATK: ${c.stats.attack}` : '',
      c.stats.defence ? `DEF: ${c.stats.defence}` : '',
    ].filter(Boolean);
    if (statParts.length) lines.push(`📊 ${statParts.join(' | ')}`);

    const critParts = [
      c.stats.critRate ? `暴击: ${c.stats.critRate}` : '',
      c.stats.critDmg ? `暴伤: ${c.stats.critDmg}` : '',
    ].filter(Boolean);
    if (critParts.length) lines.push(`⚡ ${critParts.join(' | ')}`);
  }

  if (c.recommendedArc) lines.push(`🏅 推荐: ${c.recommendedArc}`);
  if (c.description) lines.push(`\n📖 ${c.description.slice(0, 200)}`);

  lines.push(`\n📡 数据源: 环世全鉴 · wiki.mysqil.com`);
  return lines.join('\n');
}

// ─── 帮助 ───────────────────────────────────────────────────────

function helpText(): string {
  const parts = ['🤖 异环Bot 使用帮助\n', '支持以下指令：\n'];
  for (const cmd of commands) {
    parts.push(`  • ${cmd.description}`);
  }
  parts.push('\n💡 无需@机器人，直接发送指令即可');
  
  return parts.join('\n');
}

// ─── 路由 ───────────────────────────────────────────────────────

export interface RouteResult {
  /** 是否匹配到指令 */
  matched: boolean;
  /** 回复文本（匹配到指令时） */
  reply?: string;
  /** 原始消息文本 */
  rawMessage: string;
}

/**
 * 解析并路由一条群聊/私聊消息
 */
export async function routeMessage(
  text: string,
  from: { userId: number; groupId?: number },
): Promise<RouteResult> {
  const trimmed = text.trim();

  // 帮助
  if (/^(帮助|help|功能|菜单|指令)$/i.test(trimmed)) {
    return { matched: true, reply: helpText(), rawMessage: trimmed };
  }

  // 遍历指令列表
  for (const cmd of commands) {
    for (const prefix of cmd.prefixes) {
      if (trimmed.startsWith(prefix) || trimmed.toLowerCase().startsWith(prefix.toLowerCase())) {
        const args = trimmed.slice(prefix.length).trim();
        try {
          const reply = await cmd.handler(args, from);
          return { matched: true, reply, rawMessage: trimmed };
        } catch (err) {
          console.error(`[Router] 指令执行失败:`, err);
          return {
            matched: true,
            reply: `❌ 执行出错：${err instanceof Error ? err.message : '未知错误'}`,
            rawMessage: trimmed,
          };
        }
      }
    }
  }

  return { matched: false, rawMessage: trimmed };
}