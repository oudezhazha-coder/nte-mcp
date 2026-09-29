/** 武器/弧盘查询 MCP 工具 - 预留 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/** 注册武器相关工具 */
export function registerWeaponTools(server: McpServer) {
  server.registerTool(
    'list_weapon_categories',
    {
      description: '查看异环武器和弧盘分类说明',
      inputSchema: {},
    },
    async () => {
      return {
        content: [{
          type: 'text',
          text: `# 异环武器 & 弧盘系统

异环的装备系统分为 **弧盘** 和 **磁盘** 两部分：

## 弧盘 (角色专武)
- 每个角色可装备一个弧盘
- 弧盘提供基础属性和特殊效果
- 适配类型：等离子、凝聚态、气态、固态、混沌等

## 磁盘 (套装)
- 磁盘提供套装效果和词条属性
- 主输出优先：伤害词条
- 辅助优先：循环和团队增益
- 生存位优先：护盾、回复、减伤

💡 使用 \`search_wiki\` 搜索具体弧盘信息`,
        }],
      };
    },
  );
}