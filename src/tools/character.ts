/** 角色查询 MCP 工具 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getCharacter, searchCharacters, listCharacters } from '../sources/bwiki.js';

/** 注册角色相关工具 */
export function registerCharacterTools(server: McpServer) {
  // 1. 查询角色详情
  server.registerTool(
    'query_character',
    {
      description: '查询异环角色详情，包括属性、技能、突破材料等',
      inputSchema: { name: z.string().describe('角色名称（支持模糊匹配，如"娜娜莉"）') },
    },
    async ({ name }) => {
      const characters = await searchCharacters(name);
      
      if (characters.length === 0) {
        return {
          content: [{ type: 'text', text: `未找到角色"${name}"，试试其他关键词` }],
        };
      }

      // 取第一个精确匹配的角色
      const chara = await getCharacter(characters[0].title);
      if (!chara) {
        return {
          content: [{ type: 'text', text: `获取角色"${characters[0].title}"数据失败` }],
        };
      }

      const lines: string[] = [
        `# ${chara.name}`,
        `**稀有度**: ${chara.rarity}  |  **属性**: ${chara.element}  |  **定位**: ${chara.role}`,
        `**所属**: ${chara.faction || '未知'}  |  **弧盘**: ${chara.arcType || '未知'}`,
        `**CV**: ${chara.cv || '未知'}  |  **生日**: ${chara.birthday || '未知'}`,
        '',
        '## 基础属性',
      ];

      if (chara.baseStats) {
        const bs = chara.baseStats;
        lines.push([
          bs.hp ? `生命: ${bs.hp}` : '',
          bs.attack ? `攻击: ${bs.attack}` : '',
          bs.physicalDef ? `物防: ${bs.physicalDef}` : '',
          bs.magicDef ? `法防: ${bs.magicDef}` : '',
        ].filter(Boolean).join('  |  '));
        lines.push([
          bs.critRate ? `暴击率: ${bs.critRate}` : '',
          bs.critDmg ? `暴击伤害: ${bs.critDmg}` : '',
          bs.chargeEfficiency ? `充能: ${bs.chargeEfficiency}` : '',
        ].filter(Boolean).join('  |  '));
      }

      if (chara.skills.length > 0) {
        lines.push('', '## 技能');
        for (const skill of chara.skills) {
          lines.push(`**${skill.type} · ${skill.name}**`);
          lines.push(`> ${skill.description || '暂无描述'}`);
          lines.push('');
        }
      }

      if (chara.bannerHistory.length > 0) {
        lines.push('## 卡池历史');
        for (const banner of chara.bannerHistory) {
          lines.push(`- **${banner.name}**: ${banner.description || '无详情'}`);
        }
      }

      if (chara.description) {
        lines.push('', '## 角色故事');
        lines.push(chara.description.slice(0, 300) + (chara.description.length > 300 ? '...' : ''));
      }

      lines.push('', `📖 [查看完整页面](${chara.wikiUrl})`);

      return {
        content: [{ type: 'text', text: lines.join('\n') }],
      };
    },
  );

  // 2. 角色列表
  server.registerTool(
    'list_characters',
    {
      description: '获取异环所有角色列表',
      inputSchema: {},
    },
    async () => {
      const members = await listCharacters();
      const names: string[] = members
        .map((m: { title: string }) => m.title)
        .filter((t: string) => t && !t.startsWith('模板') && !t.startsWith('预设'));
      
      return {
        content: [{
          type: 'text',
          text: `# 异环角色列表（共 ${names.length} 名）\n\n${names.map((n, i) => `${i + 1}. ${n}`).join('\n')}\n\n💡 使用 query_character 查询角色详情`,
        }],
      };
    },
  );
}