/** 搜索与资讯类 MCP 工具 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { searchWiki, getCurrentBanners } from '../sources/bwiki.js';

/** 注册搜索与资讯工具 */
export function registerSearchTools(server: McpServer) {
  // 1. 通用搜索
  server.registerTool(
    'search_wiki',
    {
      description: '搜索异环 BWIKI 百科，查找角色、武器、材料等信息',
      inputSchema: {
        query: z.string().describe('搜索关键词'),
        limit: z.number().min(1).max(20).default(10).describe('返回结果数量'),
      },
    },
    async ({ query, limit }) => {
      const results = await searchWiki(query, limit);
      
      if (results.length === 0) {
        return {
          content: [{ type: 'text', text: `未找到与"${query}"相关的内容` }],
        };
      }

      const lines: string[] = [
        `# 搜索"${query}" 共 ${results.length} 条结果`,
        '',
      ];

      for (const r of results) {
        lines.push(`### ${r.title}`);
        if (r.snippet) {
          lines.push(`> ${r.snippet.replace(/\n/g, ' ').slice(0, 200)}`);
        }
        lines.push(`🔗 https://wiki.biligame.com/yh/${encodeURIComponent(r.title)}`);
        lines.push('');
      }

      return {
        content: [{ type: 'text', text: lines.join('\n') }],
      };
    },
  );

  // 2. 当前卡池
  server.registerTool(
    'get_banners',
    {
      description: '获取异环当前版本卡池信息',
      inputSchema: {},
    },
    async () => {
      const banners = await getCurrentBanners();
      
      if (banners.length === 0) {
        return {
          content: [{ type: 'text', text: '当前暂无卡池信息或获取失败，请查看游戏内公告' }],
        };
      }

      const lines: string[] = ['# 异环当前卡池', ''];
      for (const b of banners) {
        lines.push(`## ${b.name}`);
        lines.push(b.description || '暂无详情');
        lines.push('');
      }

      return {
        content: [{ type: 'text', text: lines.join('\n') }],
      };
    },
  );
}