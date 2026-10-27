/**
 * src/tools/scrollTools.ts —— 註冊給 DSH 主模型的 Instagram 滾動瀏覽專用工具
 */

import type { InstagramMcpClient } from '@luoyi-dsh/instagram-mcp'
import { InstagramScrollConfig } from '../config.js'

export function registerScrollTools(
  ctx: any,
  config: InstagramScrollConfig,
  getMcpClient: () => InstagramMcpClient | null,
  log: (msg: string) => void
) {
  const tools = (typeof ctx.get === 'function' ? ctx.get('tools') : undefined) || ctx.tools

  const register = (toolDef: any) => {
    try {
      if (typeof tools?.register === 'function') {
        tools.register(toolDef)
      } else if (typeof ctx?.tool === 'function') {
        ctx.tool(toolDef)
      }
    } catch (e: any) {
      log(`註冊滾動工具 ${toolDef.name} 失敗: ${e.message}`)
    }
  }

  // 1. 滾動獲取動態牆 (Timeline Feed)
  register({
    name: 'ig_scroll_feed',
    description: '滾動讀取 Instagram 時間軸最新動態貼文，包含作者、讚數、短碼、內文摘要等。',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: '抓取貼文數量上限 (預設 15，最大 50)',
        },
      },
    },
    execute: async (args: any) => {
      const client = getMcpClient()
      if (!client || !client.ready) {
        return { ok: false, error: 'Instagram FastMCP 尚未就緒，請檢查連線狀態。' }
      }
      const count = Math.min(50, Math.max(1, args.limit || config.batchSize || 15))
      return await client.igGetTimelineFeed(count)
    },
  })

  // 2. 滾動特定主題或探索貼文
  register({
    name: 'ig_explore_topics',
    description: '依照指定主題或探索標籤滾動閱讀熱門貼文，探索新主題。',
    parameters: {
      type: 'object',
      properties: {
        tag: { type: 'string', description: '主題標籤名稱 (如 ai, tech, art)' },
        limit: { type: 'number', description: '獲取數量上限 (預設 15)' },
      },
      required: ['tag'],
    },
    execute: async (args: any) => {
      const client = getMcpClient()
      if (!client || !client.ready) {
        return { ok: false, error: 'Instagram FastMCP 尚未就緒' }
      }
      return await client.igSearchHashtag(args.tag, args.limit || 15)
    },
  })

  // 3. 滾動時即時點讚
  register({
    name: 'ig_like_feed_post',
    description: '在滾動瀏覽過程中對感興趣的 Instagram 貼文按讚。',
    parameters: {
      type: 'object',
      properties: {
        media_pk: { type: 'string', description: '貼文唯一識別碼 (Media PK)' },
      },
      required: ['media_pk'],
    },
    execute: async (args: any) => {
      const client = getMcpClient()
      if (!client || !client.ready) {
        return { ok: false, error: 'Instagram FastMCP 尚未就緒' }
      }
      return await client.igLikeMedia(args.media_pk)
    },
  })

  log('✅ 已註冊 Instagram 滾動瀏覽 (Scroll) 工具套件至 DSH Tools！')
}
