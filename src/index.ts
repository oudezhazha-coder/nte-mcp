#!/usr/bin/env node

/**
 * nte-mcp - 异环 (Neverness to Everness) 游戏数据查询 MCP Server
 *
 * 通过 MCP 协议向 AI 助手 / QQ 机器人提供异环游戏数据查询能力。
 *
 * 启动方式：
 *   npx nte-mcp            # stdio 模式
 *   node dist/index.js      # stdio 模式
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { config } from './config.js';
import { registerCharacterTools } from './tools/character.js';
import { registerSearchTools } from './tools/search.js';
import { registerWeaponTools } from './tools/weapon.js';
import { registerMaterialTools } from './tools/material.js';

async function main() {
  const server = new McpServer({
    name: config.serverName,
    version: config.serverVersion,
  });

  // 注册所有工具
  registerCharacterTools(server);
  registerSearchTools(server);
  registerWeaponTools(server);
  registerMaterialTools(server);

  // 使用 stdio 传输
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`[nte-mcp] 异环MCP服务已启动 v${config.serverVersion}`);
  console.error(`[nte-mcp] 数据源: ${config.bwiki.baseUrl}`);
}

main().catch((err) => {
  console.error('[nte-mcp] 启动失败:', err);
  process.exit(1);
});