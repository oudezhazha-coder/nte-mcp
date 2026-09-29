#!/usr/bin/env node

/**
 * nte-mcp NapCat 桥接层服务
 *
 * 启动一个 OneBot v11 Reverse WebSocket 服务端，
 * NapCat 连接后即可通过 QQ 群聊/私聊调用异环数据查询工具。
 *
 * 启动方式：
 *   npx tsx src/bridge/server.ts        # 开发
 *   node dist/bridge/server.js           # 构建后
 */

import { createBridgeServer } from './onebot.js';
import { routeMessage } from './router.js';

// ─── 配置 ───────────────────────────────────────────────────────

const PORT = 9331;
const WS_PATH = '/OneBotv11';

// NapCat onebot11_2449325739.json 中的 token（含前导空格）
const TOKEN = '  JANQnvCinzLP3d6pNOD2SEutWljndC3RQKnyI855LrhVww9oQK2vMZfaGQXK9JQJ';

// ─── 启动服务 ───────────────────────────────────────────────────

function main() {
  const server = createBridgeServer({
    port: PORT,
    token: TOKEN,

    onEvent: async (event, sendApi) => {
      // 只处理文本消息
      if (!event.message) return;
      const text = extractPlainText(event.message);
      if (!text) return;

      const from = {
        userId: event.user_id,
        groupId: event.message_type === 'group' ? event.group_id : undefined,
      };

      console.log(`[Bridge] ${event.message_type === 'group' ? `群${event.group_id}` : '私聊'}` +
        ` | ${event.sender.nickname}(${event.user_id}): ${text}`);

      const result = await routeMessage(text, from);

      if (result.matched && result.reply) {
        const params: Record<string, unknown> = {
          message: result.reply,
        };

        if (event.message_type === 'group') {
          params.group_id = event.group_id;
          await sendApi('send_group_msg', params).catch((err) => {
            console.error('[Bridge] 发送群消息失败:', err);
          });
        } else {
          params.user_id = event.user_id;
          await sendApi('send_private_msg', params).catch((err) => {
            console.error('[Bridge] 发送私聊消息失败:', err);
          });
        }
      }
    },

    onConnect: () => {
      console.log(`[Bridge] ===============================`);
      console.log(`[Bridge] NapCat 桥接就绪，等待指令`);
      console.log(`[Bridge] 发送"帮助"查看可用指令`);
      console.log(`[Bridge] ===============================`);
    },

    onDisconnect: () => {
      console.log('[Bridge] 等待 NapCat 重连…');
    },
  });

  // 优雅关闭
  const shutdown = () => {
    console.log('\n[Bridge] 正在关闭…');
    server.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

/**
 * 从 OneBot array 格式消息中提取纯文本
 */
function extractPlainText(segments: Array<{ type: string; data: Record<string, string> }>): string {
  return segments
    .filter((s) => s.type === 'text')
    .map((s) => s.data.text ?? '')
    .join('')
    .trim();
}

main();