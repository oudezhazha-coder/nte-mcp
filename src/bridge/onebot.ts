/**
 * OneBot v11 协议处理
 *
 * 实现 OneBot v11 Reverse WebSocket 服务端协议。
 * NapCat 作为 WS Client 连接上来后，推送事件至此，
 * 本模块负责事件解析和 API 调用（回复消息）。
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';

// ─── OneBot v11 事件类型 ───────────────────────────────────────

export interface OneBotGroupMsg {
  post_type: 'message';
  message_type: 'group';
  group_id: number;
  user_id: number;
  sender: {
    nickname: string;
    card: string;
    user_id: number;
    role: 'owner' | 'admin' | 'member';
  };
  /** array 格式消息段 */
  message: OneBotMsgSegment[];
  raw_message: string;
  self_id: number;
  time: number;
  message_id: number;
}

export interface OneBotPrivateMsg {
  post_type: 'message';
  message_type: 'private';
  user_id: number;
  sender: { nickname: string; user_id: number };
  message: OneBotMsgSegment[];
  raw_message: string;
  self_id: number;
  time: number;
  message_id: number;
}

export type OneBotEvent = OneBotGroupMsg | OneBotPrivateMsg;

export interface OneBotMsgSegment {
  type: 'text' | 'at' | 'image' | 'face' | 'reply';
  data: Record<string, string>;
}

// ─── OneBot v11 API 请求/响应 ──────────────────────────────────

export interface OneBotApiRequest {
  action: string;
  params: Record<string, unknown>;
  echo?: string;
}

export interface OneBotApiResponse {
  status: 'ok' | 'failed';
  retcode: number;
  data: unknown;
  echo?: string;
}

// ─── 回调类型 ───────────────────────────────────────────────────

type EventHandler = (event: OneBotEvent, sendApi: SendApiFn) => void;
type SendApiFn = (action: string, params: Record<string, unknown>) => Promise<OneBotApiResponse>;

// ─── WS Server ──────────────────────────────────────────────────

export interface BridgeServerOptions {
  port: number;
  token?: string;
  onEvent: EventHandler;
  onConnect?: (conn: { userId?: number; nickname?: string }) => void;
  onDisconnect?: () => void;
}

export function createBridgeServer(options: BridgeServerOptions) {
  const { port, token, onEvent, onConnect, onDisconnect } = options;
  const wss = new WebSocketServer({ port, host: '127.0.0.1' });

  wss.on('listening', () => {
    console.log(`[Bridge] WebSocket 服务已启动 ws://127.0.0.1:${port}/OneBotv11`);
  });

  wss.on('error', (err) => {
    console.error('[Bridge] WebSocket 服务错误:', err);
  });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    // Token 验证
    if (token) {
      const auth = req.headers['authorization'] ?? '';
      // Bearer token 或直接在 URL 参数中
      const bearerToken = auth.replace(/^Bearer\s+/i, '').trim();
      // URL token 参数
      const url = new URL(req.url ?? '/', 'http://localhost');
      const urlToken = url.searchParams.get('token') ?? '';

      const validToken = token.trim();
      if (bearerToken !== validToken && urlToken !== validToken) {
        console.error('[Bridge] Token 验证失败，关闭连接');
        ws.close(4001, 'Unauthorized');
        return;
      }
    }

    console.log('[Bridge] NapCat 已连接');

    // API 调用：向 NapCat 发送请求并等待响应
    let echoCounter = 0;
    const pendingRequests = new Map<string, { resolve: (v: OneBotApiResponse) => void; reject: (e: Error) => void }>();

    const sendApi: SendApiFn = (action, params) => {
      return new Promise((resolve, reject) => {
        const echo = `bridge_${++echoCounter}`;
        pendingRequests.set(echo, { resolve, reject });
        const req: OneBotApiRequest = { action, params, echo };
        ws.send(JSON.stringify(req));
        // 30 秒超时
        setTimeout(() => {
          if (pendingRequests.has(echo)) {
            pendingRequests.delete(echo);
            reject(new Error(`API ${action} 响应超时`));
          }
        }, 30000);
      });
    };

    // 接收消息
    ws.on('message', (data: Buffer) => {
      try {
        const json = JSON.parse(data.toString());

        // 判断是事件推送还是 API 响应
        if (json.post_type) {
          // 只处理消息事件，忽略心跳(meta_event)和通知(notice)
          if (json.post_type === 'message') {
            onEvent(json as OneBotEvent, sendApi);
          }
        } else if (json.echo && pendingRequests.has(json.echo)) {
          // API 响应
          const { resolve } = pendingRequests.get(json.echo)!;
          pendingRequests.delete(json.echo);
          resolve(json as OneBotApiResponse);
        }
      } catch (err) {
        console.error('[Bridge] 消息解析错误:', err);
      }
    });

    ws.on('close', () => {
      console.log('[Bridge] NapCat 已断开');
      // 拒绝所有挂起的请求
      for (const [echo, { reject }] of pendingRequests) {
        reject(new Error('NapCat 已断开连接'));
      }
      pendingRequests.clear();
      onDisconnect?.();
    });

    ws.on('error', (err) => {
      console.error('[Bridge] WebSocket 连接错误:', err);
    });

    onConnect?.({});
  });

  return {
    close: () => wss.close(),
    wss,
  };
}