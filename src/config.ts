/** nte-mcp 配置 */

export const config = {
  /** MCP Server 名称 */
  serverName: 'nte-mcp',

  /** MCP Server 版本 */
  serverVersion: '0.1.0',

  /** BWIKI 基础 URL */
  bwiki: {
    baseUrl: 'https://wiki.biligame.com/yh',
    apiUrl: 'https://wiki.biligame.com/yh/api.php',
    userAgent: 'nte-mcp/0.1.0',
  },

  /** 缓存配置 */
  cache: {
    /** 缓存目录 */
    dir: 'data/cache',
    /** 默认缓存 TTL（秒） */
    ttlSec: 3600,
  },

  /** 请求超时（毫秒） */
  requestTimeout: 15000,
} as const;