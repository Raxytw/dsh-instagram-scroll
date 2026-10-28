/**
 * src/index.ts —— DSH Instagram 滾動瀏覽與推坑插件 (Cordis Plugin)
 * ============================================================================
 * 職責：
 * 1. 導出標準 DSH 插件結構 (name, inject, Config, apply)。
 * 2. 依賴 dsh-instagram-mcp 核心服務 (ctx.instagramMcp)，共享 FastMCP 與登入 Session。
 * 3. 具備如同 dsh-bili-scroll 的核心能力：
 *    - 定時或手動替主人刷一輪 Instagram (首頁動態 + 主題標籤探索)
 *    - 逐條讀內文評估主人是否感興趣
 *    - 若值得，自動在該貼文底下留言 @主人 + 推薦詞，並給予點讚
 *    - 生成本日探索日報 data/reports/YYYY-MM-DD.md
 * 4. 透過 webServer.register 官方路由標準提供 API 供 client.js 前端面板操作。
 * ============================================================================
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildScrollConfigSchema, defaultScrollConfig, InstagramScrollConfig, sanitizeScrollConfig } from './config.js'
import { loadSchemastery } from './lib/hostdeps.js'
import { ScrollLedgerManager } from './lib/ledger.js'
import { executeScrollRound } from './core/scrollDuty.js'
import { type InstagramMcpClient, getSharedMcpClient, getSharedMcpService } from '@luoyi-dsh/instagram-mcp'

export const name = 'instagram-scroll'
export const inject = ['webServer', 'tools']

const zInstance = await loadSchemastery()
export const Config = buildScrollConfigSchema(zInstance)

function sendJson(res: any, status: number, data: any) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(data))
}

function readBody(req: any): Promise<any> {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (chunk: any) => { body += chunk })
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}) }
      catch { resolve({}) }
    })
    req.on('error', () => resolve({}))
  })
}

export function apply(ctx: any, userConfig: Partial<InstagramScrollConfig> = {}) {
  const pluginRoot = dirname(dirname(fileURLToPath(import.meta.url)))
  const dataDir = join(pluginRoot, 'data')
  const reportsDir = join(dataDir, 'reports')
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })
  if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true })

  const configFile = join(dataDir, 'config.json')
  const localSavedConfig = (() => {
    try {
      if (existsSync(configFile)) {
        return JSON.parse(readFileSync(configFile, 'utf-8'))
      }
    } catch {}
    return {}
  })()

  const activeConfig: InstagramScrollConfig = sanitizeScrollConfig({
    ...defaultScrollConfig,
    ...userConfig,
    ...localSavedConfig,
  })

  // 若 config.json 尚不存在，動態創建初始配置檔
  if (!existsSync(configFile)) {
    try {
      writeFileSync(configFile, JSON.stringify(activeConfig, null, 2), 'utf-8')
    } catch {}
  }

  const saveConfig = (patch: Partial<InstagramScrollConfig>) => {
    Object.assign(activeConfig, patch)
    try {
      writeFileSync(configFile, JSON.stringify(activeConfig, null, 2), 'utf-8')
    } catch (e: any) {
      log(`保存 config.json 失敗: ${e.message}`)
    }
  }

  const log = (msg: string) => {
    console.log(`[IG-Scroll] ${msg}`)
  }

  log(`Instagram 滾動探索推坑插件啟動中... (路徑: ${pluginRoot})`)

  // 初始化去重與日報帳本
  const ledger = new ScrollLedgerManager(join(dataDir, 'scroll_ledger.json'), reportsDir)

  let scrollTimer: NodeJS.Timeout | null = null
  let isDisposed = false

  const getMcpClient = (): InstagramMcpClient | null => {
    return getSharedMcpClient()
  }

  // 註冊給主模型的 DSH Tools
  const tools = (typeof ctx.get === 'function' ? ctx.get('tools') : undefined) || ctx.tools
  const registerTool = (toolDef: any) => {
    try {
      if (typeof tools?.register === 'function') {
        tools.register(toolDef)
      } else if (typeof ctx?.tool === 'function') {
        ctx.tool(toolDef)
      }
    } catch {}
  }

  registerTool({
    name: 'ig_run_scroll_duty_now',
    description:
      '替主人在 Instagram 刷一輪動態與感興趣的熱門貼文/影片，讀取內文評估是否值得，若符合主人興趣則自動在該貼文下留言 @主人 進行推薦。',
    parameters: { type: 'object', properties: {} },
    execute: async () => {
      const client = getMcpClient()
      if (!client || !client.ready) {
        return { ok: false, error: 'Instagram FastMCP 尚未就緒，請檢查帳號登入狀態。' }
      }
      return await executeScrollRound(ctx, activeConfig, client, ledger, log)
    },
  })

  // 排程管理器
  const setupScheduler = () => {
    if (isDisposed) return
    if (scrollTimer) {
      clearInterval(scrollTimer)
      scrollTimer = null
    }

    if (activeConfig.autoScrollEnabled) {
      const intervalMs = Math.max(10, activeConfig.scrollIntervalMinutes || 60) * 60 * 1000
      log(`啟動 Instagram 自動滾動巡邏排程，週期: ${activeConfig.scrollIntervalMinutes} 分鐘`)
      scrollTimer = setInterval(async () => {
        const client = getMcpClient()
        if (isDisposed || !client || !client.ready) return
        try {
          await executeScrollRound(ctx, activeConfig, client, ledger, log)
        } catch (e: any) {
          log(`自動滾動巡查執行異常: ${e.message}`)
        }
      }, intervalMs)
    }
  }

  setupScheduler()

  // Web API 路由處理函數
  const handleRequest = async (req: any, res: any) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1')
      const pathname = url.pathname

      // 讀取設定
      if (req.method === 'GET' && pathname === '/api/instagram/scroll/config') {
        const svc = getSharedMcpService() || (globalThis as any).__DSH_INSTAGRAM_MCP__
        const inheritedMaster = svc?.config?.masterUsername || activeConfig.masterUsername || ''
        return sendJson(res, 200, {
          ok: true,
          config: sanitizeScrollConfig({
            ...activeConfig,
            masterUsername: inheritedMaster,
          }),
        })
      }

      // 儲存設定
      if (req.method === 'POST' && pathname === '/api/instagram/scroll/config') {
        const newCfg = await readBody(req)
        saveConfig(newCfg)
        setupScheduler()
        const svc = getSharedMcpService() || (globalThis as any).__DSH_INSTAGRAM_MCP__
        const inheritedMaster = svc?.config?.masterUsername || activeConfig.masterUsername || ''
        return sendJson(res, 200, {
          ok: true,
          config: sanitizeScrollConfig({
            ...activeConfig,
            masterUsername: inheritedMaster,
          }),
        })
      }

      // 讀取今日狀態與推坑數據
      if (req.method === 'GET' && pathname === '/api/instagram/scroll/status') {
        const svc = getSharedMcpService() || (globalThis as any).__DSH_INSTAGRAM_MCP__
        const client = getMcpClient() || svc?.client
        const mcpLogin = svc?.loginStatus || null
        const isReady = Boolean(client && client.ready)
        const account =
          mcpLogin?.username ||
          svc?.config?.username ||
          (mcpLogin?.message?.match(/@([^\s)]+)/)?.[1]) ||
          (isReady ? '已連線' : '')
        const masterUsername = svc?.config?.masterUsername || activeConfig.masterUsername || ''

        return sendJson(res, 200, {
          ok: true,
          mcpReady: isReady,
          inheritedSession: true,
          loginStatus: mcpLogin || (isReady ? { ok: true, message: 'FastMCP 運行中', username: account } : null),
          mcpAccount: account,
          masterUsername,
          dailyStats: ledger.getDailyStats(),
        })
      }

      // 讀取今日日報內容
      if (req.method === 'GET' && pathname === '/api/instagram/scroll/report') {
        return sendJson(res, 200, {
          ok: true,
          report: ledger.getTodayReport(),
        })
      }

      // 手動立即跑一輪
      if (req.method === 'POST' && pathname === '/api/instagram/scroll/run') {
        const client = getMcpClient()
        if (!client || !client.ready) {
          return sendJson(res, 503, { ok: false, error: 'Instagram FastMCP 尚未就緒，請先確認登入。' })
        }

        const result = await executeScrollRound(ctx, activeConfig, client, ledger, log)
        return sendJson(res, 200, result)
      }

      sendJson(res, 404, { ok: false, error: `Not found: ${pathname}` })
    } catch (err: any) {
      sendJson(res, 500, { ok: false, error: err.message })
    }
  }

  // 設置全域請求處理器委託，保證即使路由已註冊也能執行最新版本程式碼
  ;(globalThis as any).__DSH_IG_SCROLL_HANDLER__ = handleRequest

  const webServer = (typeof ctx.get === 'function' ? ctx.get('webServer') : undefined) || ctx.webServer
  if (!(globalThis as any).__DSH_IG_SCROLL_ROUTES_REGISTERED__ && webServer) {
    const routeDispatcher = (req: any, res: any) => {
      const activeHandler = (globalThis as any).__DSH_IG_SCROLL_HANDLER__
      if (typeof activeHandler === 'function') {
        return activeHandler(req, res)
      }
      return handleRequest(req, res)
    }

    try {
      if (typeof webServer.register === 'function') {
        webServer.register({
          kind: 'prefix',
          path: '/api/instagram/scroll',
          handler: routeDispatcher,
        })
        ;(globalThis as any).__DSH_IG_SCROLL_ROUTES_REGISTERED__ = true
        log('✅ 已註冊 DSH 官方路由: /api/instagram/scroll')
      } else if (webServer.router) {
        webServer.router.all('/api/instagram/scroll/*', routeDispatcher)
        ;(globalThis as any).__DSH_IG_SCROLL_ROUTES_REGISTERED__ = true
      }
    } catch (e: any) {
      log(`註冊 Scroll Web 路由異常: ${e.message}`)
    }
  }

  // 優雅關閉
  const dispose = async () => {
    isDisposed = true
    if (scrollTimer) clearInterval(scrollTimer)
    log('Instagram 滾動探索插件已卸載。')
  }

  if (typeof ctx?.on === 'function') {
    ctx.on('dispose', dispose)
  }
}

export default {
  name,
  inject,
  Config,
  apply,
}
