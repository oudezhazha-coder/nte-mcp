# nte-mcp 🎮

**异环 (Neverness to Everness) 游戏数据查询 MCP Server**

为 AI 助手和 QQ 机器人提供异环游戏数据查询能力的 MCP 服务端。

## 功能

| 工具 | 说明 |
|------|------|
| `query_character` | 查询角色详情（属性、技能、突破材料、卡池历史） |
| `list_characters` | 获取全角色列表 |
| `search_wiki` | 搜索 BWIKI 百科（角色、武器、材料） |
| `query_material` | 查询材料获取方式和用途 |
| `get_banners` | 查看当前版本卡池信息 |
| `list_weapon_categories` | 武器/弧盘系统说明 |

## 快速开始

```bash
# 安装依赖
npm install

# 构建
npm run build

# 启动 MCP 服务 (stdio 模式)
npm start
```

## 集成到 QQ 机器人

### 方案 1: MCP Client 直连 (推荐)

支持 MCP 协议的 AI 框架可以直接连接本服务：

```json
{
  "mcpServers": {
    "nte-mcp": {
      "command": "node",
      "args": ["path/to/nte-mcp/dist/index.js"]
    }
  }
}
```

### 方案 2: 通过 NapCat 调用（HTTP 桥接层）✅ 已实现

NapCat QQ 机器人通过 OneBot v11 WebSocket 协议连接到桥接服务，在 QQ 群/私聊中直接发送指令查询异环数据。

#### 启动桥接服务

```bash
# 构建
npm run build

# 启动桥接（生产）
npm run bridge

# 或开发模式热重载
npm run bridge:dev
```

桥接服务会在 `ws://127.0.0.1:9331/OneBotv11` 监听，NapCat 自动连接（已在配置中配好）。

#### 支持指令

| 指令 | 说明 |
|------|------|
| `查角色 <名称>` | 查询角色详情 |
| `角色列表` | 获取全角色列表 |
| `搜wiki <关键词>` | 搜索 BWIKI 百科 |
| `查材料 <名称>` | 查询材料获取方式和用途 |
| `卡池` / `当前卡池` | 查看当前版本卡池信息 |
| `武器` / `弧盘` | 武器/弧盘系统说明 |
| `帮助` / `菜单` | 显示帮助信息 |

> 无需@机器人，直接在群里发送指令即可。
> 数据来源：[异环 BWIKI](https://wiki.biligame.com/yh/)

#### 架构

```
QQ消息 → NapCat → WS Client → Bridge WS Server (:9331)
                                    ↓
                              调用 bwiki 工具函数
                                    ↓
                              回复文本 → NapCat → QQ
```

桥接层位于 `src/bridge/`，直接复用 `src/sources/bwiki.ts` 的数据爬取逻辑，不走 MCP 协议栈，延迟更低。

#### 配置说明

NapCat 的 OneBot v11 连接配置在 `napcat/config/onebot11_2449325739.json` 中，桥接服务会自动读取 token 进行握手验证。

## 数据来源

- [异环 BWIKI](https://wiki.biligame.com/yh/) - B站官方合作 Wiki

## 开源许可

MIT