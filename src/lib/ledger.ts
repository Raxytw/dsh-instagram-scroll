/**
 * src/lib/ledger.ts —— 滾動紀錄、跨外掛永久推坑去重與日報帳本
 * ============================================================================
 * 職責：
 * 1. 記錄已滾動瀏覽過的貼文/Reel (seenPosts) 與永久已推薦清單 (sentPosts / recommendedHistory)，
 *    跨日絕不清空已發送紀錄，避免重複審閱與重複推坑。
 * 2. 與姊妹外掛 dsh-instagram-plugin 的 data/ledger.json 及全域共享去重庫
 *    ~/.dsh/instagram-sent-media.json 雙向同步，同時比對 Canonical PK、Shortcode (code)、
 *    URL 與作者+內文指紋，100% 杜絕任何貼文或 Reel 被重複發送！
 * 3. 記錄今日替主人推薦的次數，嚴格遵循每日上限，防止 IG 頻率過高。
 * 4. 輸出 Markdown 日報至 data/reports/YYYY-MM-DD.md。
 * ============================================================================
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export interface RecommendedItem {
  postPk: string
  code: string
  author: string
  url: string
  score: number
  reason: string
  commentText: string
  timestamp: string
}

export interface SeenPostRecord {
  timestamp: string
  worthy?: boolean
  code?: string
  url?: string
  author?: string
  fingerprint?: string
}

export interface ScrollLedgerState {
  version: number
  date: string
  seenPosts: Record<string, SeenPostRecord>
  sentPosts?: Record<string, SeenPostRecord>
  recommendedToday: RecommendedItem[]
  recommendedHistory?: RecommendedItem[]
  dailyStats: {
    scrolledCount: number
    recommendedCount: number
  }
  cooldownUntil?: number
  cooldownReason?: string
}

export interface SharedSentMediaFile {
  version: number
  updatedAt: string
  sentPks: Record<string, { timestamp: string; code?: string; url?: string; source?: string; fingerprint?: string }>
  sentCodes: Record<string, string>
  sentFingerprints: Record<string, string>
  seenPks: Record<string, { timestamp: string; code?: string; source?: string }>
  seenCodes: Record<string, string>
}

/** 正規化提取貼文或 Reel 的所有唯一識別碼 (Canonical PK、Shortcode、URL、內容指紋) */
export function extractCanonicalMediaIdentity(postOrPk: any): {
  canonicalPk: string
  rawPk: string
  code: string
  url: string
  author: string
  fingerprint: string
} {
  if (typeof postOrPk === 'string' || typeof postOrPk === 'number') {
    const raw = String(postOrPk).trim()
    const canonicalPk = raw.split('_')[0].trim()
    const urlCodeMatch = raw.match(/instagram\.com\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i)
    const code = urlCodeMatch ? urlCodeMatch[1] : ''
    return { canonicalPk, rawPk: raw, code, url: '', author: '', fingerprint: '' }
  }

  const obj = postOrPk || {}
  const rawPk = String(obj.pk || obj.id || obj.postPk || '').trim()
  const canonicalPk = rawPk.split('_')[0].trim()
  const url = String(obj.url || '').trim()
  const urlCodeMatch = url.match(/instagram\.com\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i)
  const code = String(obj.code || (urlCodeMatch ? urlCodeMatch[1] : '') || '').trim()
  const author = String(obj.user?.username || obj.author || '')
    .toLowerCase()
    .replace(/^@/, '')
    .trim()
  const cleanCaption = String(obj.caption || '')
    .toLowerCase()
    .replace(/#[\p{L}\p{N}_]+/gu, '')
    .replace(/\s+/g, '')
    .slice(0, 80)
  const fingerprint = author && cleanCaption.length >= 12 ? `${author}:${cleanCaption}` : ''

  return { canonicalPk, rawPk, code, url, author, fingerprint }
}

export class ScrollLedgerManager {
  private filePath: string
  private reportsDir: string
  private state: ScrollLedgerState

  constructor(filePath: string, reportsDir: string) {
    this.filePath = filePath
    this.reportsDir = reportsDir
    if (!existsSync(dirname(filePath))) {
      mkdirSync(dirname(filePath), { recursive: true })
    }
    if (!existsSync(reportsDir)) {
      mkdirSync(reportsDir, { recursive: true })
    }
    this.state = this.load()
    this.syncSharedRegistry()
    if (!existsSync(this.filePath)) {
      this.save()
    }
  }

  private getDshHomeDir(): string {
    return process.env.DSH_HOME || join(process.env.USERPROFILE || process.env.HOME || homedir(), '.dsh')
  }

  private getSharedSentMediaPath(): string {
    const dir = this.getDshHomeDir()
    if (!existsSync(dir)) {
      try {
        mkdirSync(dir, { recursive: true })
      } catch {}
    }
    return join(dir, 'instagram-sent-media.json')
  }

  private getSiblingPluginLedgerPath(): string {
    const pluginRoot = dirname(dirname(this.filePath))
    return join(dirname(pluginRoot), 'dsh-instagram-plugin', 'data', 'ledger.json')
  }

  private loadSharedRegistry(): SharedSentMediaFile {
    const sharedPath = this.getSharedSentMediaPath()
    const empty: SharedSentMediaFile = {
      version: 1,
      updatedAt: new Date().toISOString(),
      sentPks: {},
      sentCodes: {},
      sentFingerprints: {},
      seenPks: {},
      seenCodes: {},
    }
    try {
      if (existsSync(sharedPath)) {
        const parsed = JSON.parse(readFileSync(sharedPath, 'utf-8'))
        return {
          version: 1,
          updatedAt: parsed.updatedAt || empty.updatedAt,
          sentPks: parsed.sentPks || {},
          sentCodes: parsed.sentCodes || {},
          sentFingerprints: parsed.sentFingerprints || {},
          seenPks: parsed.seenPks || {},
          seenCodes: parsed.seenCodes || {},
        }
      }
    } catch {}
    return empty
  }

  private saveSharedRegistry(reg: SharedSentMediaFile): void {
    try {
      reg.updatedAt = new Date().toISOString()
      const sharedPath = this.getSharedSentMediaPath()
      const tmp = `${sharedPath}.tmp`
      writeFileSync(tmp, JSON.stringify(reg, null, 2), 'utf-8')
      renameSync(tmp, sharedPath)
      ;(globalThis as any).__DSH_IG_SENT_REGISTRY__ = reg
    } catch {}
  }

  /**
   * 雙向同步 scroll_ledger.json、dsh-instagram-plugin 的 ledger.json 與歷史日報，
   * 確保兩邊曾發送或看過的貼文/Reel 全部匯入全域永久去重庫
   */
  public syncSharedRegistry(): SharedSentMediaFile {
    const reg = this.loadSharedRegistry()
    let dirty = false

    if (!this.state.sentPosts) this.state.sentPosts = {}
    if (!Array.isArray(this.state.recommendedHistory)) this.state.recommendedHistory = []

    // 1. 同步本插件自身的 seenPosts / sentPosts / recommendedToday / recommendedHistory
    for (const [rawKey, meta] of Object.entries(this.state.seenPosts || {})) {
      const cleanPk = String(rawKey).split('_')[0].trim()
      if (!cleanPk) continue
      if (!reg.seenPks[cleanPk]) {
        reg.seenPks[cleanPk] = { timestamp: meta?.timestamp || new Date().toISOString(), code: meta?.code, source: 'scroll' }
        dirty = true
      }
      if (meta?.code && !reg.seenCodes[meta.code]) {
        reg.seenCodes[meta.code] = cleanPk
        dirty = true
      }
      if (meta?.worthy) {
        this.state.sentPosts[cleanPk] = meta
        if (!reg.sentPks[cleanPk]) {
          reg.sentPks[cleanPk] = {
            timestamp: meta.timestamp || new Date().toISOString(),
            code: meta.code,
            url: meta.url,
            fingerprint: meta.fingerprint,
            source: 'scroll',
          }
          dirty = true
        }
        if (meta.code && !reg.sentCodes[meta.code]) {
          reg.sentCodes[meta.code] = cleanPk
          dirty = true
        }
      }
    }

    for (const item of [...(this.state.recommendedToday || []), ...(this.state.recommendedHistory || [])]) {
      const idInfo = extractCanonicalMediaIdentity(item)
      if (idInfo.canonicalPk) {
        this.state.sentPosts[idInfo.canonicalPk] = {
          timestamp: item.timestamp,
          worthy: true,
          code: idInfo.code,
          url: idInfo.url,
          author: idInfo.author,
        }
        if (!reg.sentPks[idInfo.canonicalPk]) {
          reg.sentPks[idInfo.canonicalPk] = {
            timestamp: item.timestamp || new Date().toISOString(),
            code: idInfo.code,
            url: idInfo.url,
            source: 'scroll-recommend',
          }
          dirty = true
        }
      }
      if (idInfo.code && !reg.sentCodes[idInfo.code]) {
        reg.sentCodes[idInfo.code] = idInfo.canonicalPk || idInfo.code
        dirty = true
      }
    }

    // 2. 同步姊妹外掛 dsh-instagram-plugin 的 ledger.json
    const pluginLedgerPath = this.getSiblingPluginLedgerPath()
    if (existsSync(pluginLedgerPath)) {
      try {
        const pluginData = JSON.parse(readFileSync(pluginLedgerPath, 'utf-8'))
        for (const [rawKey, meta] of Object.entries<any>(pluginData?.seenPosts || {})) {
          const cleanPk = String(rawKey).split('_')[0].trim()
          if (!cleanPk) continue
          if (!reg.seenPks[cleanPk]) {
            reg.seenPks[cleanPk] = { timestamp: meta?.timestamp || new Date().toISOString(), code: meta?.code, source: 'plugin' }
            dirty = true
          }
          if (meta?.code && !reg.seenCodes[meta.code]) {
            reg.seenCodes[meta.code] = cleanPk
            dirty = true
          }
          if (meta?.recommended && !reg.sentPks[cleanPk]) {
            reg.sentPks[cleanPk] = {
              timestamp: meta?.timestamp || new Date().toISOString(),
              code: meta?.code,
              url: meta?.url,
              source: 'plugin-patrol',
            }
            dirty = true
          }
          if (meta?.recommended && meta?.code && !reg.sentCodes[meta.code]) {
            reg.sentCodes[meta.code] = cleanPk
            dirty = true
          }
        }
      } catch {}
    }

    // 3. 掃描歷史日報 data/reports/*.md 中所有已推坑過的貼文與 Reel 短碼
    if (existsSync(this.reportsDir)) {
      try {
        const files = readdirSync(this.reportsDir).filter((f) => f.endsWith('.md'))
        for (const f of files) {
          const md = readFileSync(join(this.reportsDir, f), 'utf-8')
          const matches = md.matchAll(/instagram\.com\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/gi)
          for (const m of matches) {
            const code = m[1]
            if (code && !reg.sentCodes[code]) {
              reg.sentCodes[code] = `report:${f}`
              dirty = true
            }
            if (code && !reg.seenCodes[code]) {
              reg.seenCodes[code] = `report:${f}`
              dirty = true
            }
          }
        }
      } catch {}
    }

    if (dirty || !existsSync(this.getSharedSentMediaPath())) {
      this.saveSharedRegistry(reg)
    } else {
      ;(globalThis as any).__DSH_IG_SENT_REGISTRY__ = reg
    }
    return reg
  }

  private getTodayStr(): string {
    return new Date().toISOString().slice(0, 10)
  }

  private load(): ScrollLedgerState {
    const today = this.getTodayStr()
    try {
      if (existsSync(this.filePath)) {
        const raw = readFileSync(this.filePath, 'utf-8')
        const data = JSON.parse(raw)
        if (!data.sentPosts) data.sentPosts = {}
        if (!Array.isArray(data.recommendedHistory)) {
          data.recommendedHistory = Array.isArray(data.recommendedToday) ? [...data.recommendedToday] : []
        }
        if (data.date !== today) {
          // 隔日僅重設當日計數，永久保留 seenPosts、sentPosts 與 recommendedHistory！
          if (Array.isArray(data.recommendedToday)) {
            for (const item of data.recommendedToday) {
              if (!data.recommendedHistory.some((h: any) => h.postPk === item.postPk || (h.code && h.code === item.code))) {
                data.recommendedHistory.unshift(item)
              }
            }
          }
          data.date = today
          data.recommendedToday = []
          data.dailyStats = { scrolledCount: 0, recommendedCount: 0 }
        }
        return data
      }
    } catch {}

    return {
      version: 1,
      date: today,
      seenPosts: {},
      sentPosts: {},
      recommendedToday: [],
      recommendedHistory: [],
      dailyStats: { scrolledCount: 0, recommendedCount: 0 },
    }
  }

  public save(): void {
    try {
      const tmp = `${this.filePath}.tmp`
      writeFileSync(tmp, JSON.stringify(this.state, null, 2), 'utf-8')
      renameSync(tmp, this.filePath)
    } catch (e: any) {
      console.error(`[ScrollLedger] 保存失敗: ${e.message}`)
    }
  }

  private checkRollover(): void {
    const today = this.getTodayStr()
    if (this.state.date !== today) {
      if (!Array.isArray(this.state.recommendedHistory)) {
        this.state.recommendedHistory = []
      }
      if (Array.isArray(this.state.recommendedToday)) {
        for (const item of this.state.recommendedToday) {
          if (!this.state.recommendedHistory.some((h) => h.postPk === item.postPk || (h.code && h.code === item.code))) {
            this.state.recommendedHistory.unshift(item)
          }
        }
      }
      this.state.date = today
      this.state.recommendedToday = []
      this.state.dailyStats = { scrolledCount: 0, recommendedCount: 0 }
      this.save()
    }
  }

  /**
   * 檢查該貼文或 Reel 是否已被任一外掛瀏覽或推薦過
   */
  public hasSeen(postOrPk: any): boolean {
    const { canonicalPk, rawPk, code, fingerprint } = extractCanonicalMediaIdentity(postOrPk)
    const reg = this.syncSharedRegistry()

    if (canonicalPk) {
      if (this.state.seenPosts[canonicalPk] || this.state.sentPosts?.[canonicalPk]) return true
      if (reg.sentPks[canonicalPk] || reg.seenPks[canonicalPk]) return true
    }
    if (rawPk) {
      if (this.state.seenPosts[rawPk] || this.state.sentPosts?.[rawPk]) return true
      if (reg.sentPks[rawPk] || reg.seenPks[rawPk]) return true
    }
    if (code) {
      if (reg.sentCodes[code] || reg.seenCodes[code]) return true
      if (this.state.recommendedToday?.some((r) => r.code === code)) return true
      if (this.state.recommendedHistory?.some((r) => r.code === code)) return true
    }
    if (fingerprint && reg.sentFingerprints[fingerprint]) {
      return true
    }
    return false
  }

  /**
   * 專門檢查該貼文或 Reel 是否「曾經被發送/推坑過」（跨外掛、跨日永久有效）
   */
  public hasEverSent(postOrPk: any): boolean {
    const { canonicalPk, rawPk, code, fingerprint } = extractCanonicalMediaIdentity(postOrPk)
    const reg = this.syncSharedRegistry()

    if (canonicalPk) {
      if (this.state.sentPosts?.[canonicalPk] || this.state.seenPosts[canonicalPk]?.worthy) return true
      if (reg.sentPks[canonicalPk]) return true
    }
    if (rawPk) {
      if (this.state.sentPosts?.[rawPk] || this.state.seenPosts[rawPk]?.worthy) return true
      if (reg.sentPks[rawPk]) return true
    }
    if (code) {
      if (reg.sentCodes[code]) return true
      if (this.state.recommendedToday?.some((r) => r.code === code)) return true
      if (this.state.recommendedHistory?.some((r) => r.code === code)) return true
    }
    if (fingerprint && reg.sentFingerprints[fingerprint]) {
      return true
    }
    return false
  }

  public markSeen(postOrPk: any, worthy: boolean = false): void {
    this.checkRollover()
    const idInfo = extractCanonicalMediaIdentity(postOrPk)
    const key = idInfo.canonicalPk || idInfo.rawPk
    if (!key) return

    const nowIso = new Date().toISOString()
    const entry: SeenPostRecord = {
      timestamp: nowIso,
      worthy,
      ...(idInfo.code ? { code: idInfo.code } : {}),
      ...(idInfo.url ? { url: idInfo.url } : {}),
      ...(idInfo.author ? { author: idInfo.author } : {}),
      ...(idInfo.fingerprint ? { fingerprint: idInfo.fingerprint } : {}),
    }

    const wasAlreadySeen = Boolean(this.state.seenPosts[key])
    this.state.seenPosts[key] = entry
    if (idInfo.rawPk && idInfo.rawPk !== key) {
      this.state.seenPosts[idInfo.rawPk] = entry
    }
    if (!this.state.sentPosts) this.state.sentPosts = {}
    if (worthy) {
      this.state.sentPosts[key] = entry
    }
    if (!wasAlreadySeen) {
      this.state.dailyStats.scrolledCount = (this.state.dailyStats.scrolledCount || 0) + 1
    }
    this.save()

    // 同步寫入全域共享去重檔案 ~/.dsh/instagram-sent-media.json
    const reg = this.loadSharedRegistry()
    reg.seenPks[key] = { timestamp: nowIso, code: idInfo.code || undefined, source: 'scroll' }
    if (idInfo.code) {
      reg.seenCodes[idInfo.code] = key
    }
    if (worthy) {
      reg.sentPks[key] = {
        timestamp: nowIso,
        code: idInfo.code || undefined,
        url: idInfo.url || undefined,
        fingerprint: idInfo.fingerprint || undefined,
        source: 'scroll-recommend',
      }
      if (idInfo.code) reg.sentCodes[idInfo.code] = key
      if (idInfo.fingerprint) reg.sentFingerprints[idInfo.fingerprint] = key
    }
    this.saveSharedRegistry(reg)
  }

  public canRecommend(cap: number): boolean {
    this.checkRollover()
    if (cap <= 0) return true
    return (this.state.dailyStats.recommendedCount || 0) < cap
  }

  public recordRecommendation(item: RecommendedItem): void {
    this.checkRollover()
    const cleanPk = String(item.postPk || '').split('_')[0].trim() || item.postPk
    const normalizedItem: RecommendedItem = { ...item, postPk: cleanPk }

    if (!this.state.recommendedToday.some((r) => r.postPk === cleanPk || (r.code && r.code === normalizedItem.code))) {
      this.state.recommendedToday.unshift(normalizedItem)
    }
    if (!Array.isArray(this.state.recommendedHistory)) {
      this.state.recommendedHistory = []
    }
    if (!this.state.recommendedHistory.some((r) => r.postPk === cleanPk || (r.code && r.code === normalizedItem.code))) {
      this.state.recommendedHistory.unshift(normalizedItem)
    }

    this.state.dailyStats.recommendedCount = (this.state.dailyStats.recommendedCount || 0) + 1
    this.markSeen(normalizedItem, true)
    this.save()
    this.appendReport(normalizedItem)
  }

  public getDailyStats() {
    this.checkRollover()
    return {
      date: this.state.date,
      ...this.state.dailyStats,
      recommendedItems: this.state.recommendedToday,
    }
  }

  private appendReport(item: RecommendedItem) {
    const reportPath = join(this.reportsDir, `${this.state.date}.md`)
    const line = `### [${item.author}](${item.url}) (評分: ${item.score}/100)
- **推薦原因**：${item.reason}
- **@主人留言**：\`${item.commentText}\`
- **時間**：${item.timestamp}

---
`
    try {
      let content = ''
      if (!existsSync(reportPath)) {
        content = `# Instagram 探索日報 ｜ ${this.state.date}\n> 這是今天替主人在 Instagram 挑選出的值得關注貼文與影片。\n\n`
      }
      content += line
      writeFileSync(reportPath, content, { flag: 'a', encoding: 'utf-8' })
    } catch (e: any) {
      console.error(`[ScrollLedger] 寫入日報失敗: ${e.message}`)
    }
  }

  public getTodayReport(): string {
    const reportPath = join(this.reportsDir, `${this.getTodayStr()}.md`)
    try {
      if (existsSync(reportPath)) {
        return readFileSync(reportPath, 'utf-8')
      }
    } catch {}
    return `今日 (${this.getTodayStr()}) 尚未產生推坑貼文。`
  }

  // === 防風控熔斷冷卻 (Circuit Breaker Cooldown) ===
  public isInCooldown(): boolean {
    return typeof this.state.cooldownUntil === 'number' && Date.now() < this.state.cooldownUntil
  }

  public getCooldownRemainingSeconds(): number {
    if (!this.isInCooldown()) return 0
    return Math.max(0, Math.ceil((this.state.cooldownUntil! - Date.now()) / 1000))
  }

  public getCooldownReason(): string {
    return this.state.cooldownReason || ''
  }

  public triggerCooldown(minutes = 30, reason = ''): void {
    this.state.cooldownUntil = Date.now() + minutes * 60 * 1000
    this.state.cooldownReason = reason
    this.save()
    console.warn(
      `[ScrollLedger] 🚨 觸發防風控冷卻保護！持續 ${minutes} 分鐘。原因: ${reason}`
    )
  }

  public resetCooldown(): void {
    this.state.cooldownUntil = 0
    this.state.cooldownReason = ''
    this.save()
  }
}
