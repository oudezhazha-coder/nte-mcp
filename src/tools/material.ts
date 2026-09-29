/** 材料查询 MCP 工具 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { searchWiki } from '../sources/bwiki.js';

/** 注册材料相关工具 */
export function registerMaterialTools(server: McpServer) {
  server.registerTool(
    'query_material',
    {
      description: '查询异环材料/物品的获取方式和用途',
      inputSchema: {
        name: z.string().describe('材料名称，如"突破石"'),
      },
    },
    async ({ name }) => {
      const results = await searchWiki(name, 5);
      
      if (results.length === 0) {
        return {
          content: [{ type: 'text', text: `未找到材料"${name}"的相关信息` }],
        };
      }

      const lines: string[] = [
        `# 材料"${name}" 搜索结果`,
        '',
      ];

      for (const r of results) {
        lines.push(`**${r.title}**`);
        if (r.snippet) {
          lines.push(`> ${r.snippet.replace(/\n/g, ' ')}`);
        }
        lines.push(`🔗 https://wiki.biligame.com/yh/${encodeURIComponent(r.title)}`);
        lines.push('');
      }

      lines.push('💡 异环常见材料类型：');
      lines.push('- **突破材料**：角色等级突破所需');
      lines.push('- **技能材料**：技能升级所需');
      lines.push('- **突破石**：弧盘突破素材');
      lines.push('- **通用材料**：可在大世界采集或敌人掉落');

      return {
        content: [{ type: 'text', text: lines.join('\n') }],
      };
    },
  );
}