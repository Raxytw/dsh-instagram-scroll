/**
 * src/lib/ledger.ts —— 滾動紀錄、推坑去重與日報帳本
 * ============================================================================
 * 職責：
 * 1. 記錄已滾動瀏覽過的貼文 (seenPosts)，避免重複審閱與重複推坑。
 * 2. 記錄今日替主人推薦的次數，嚴格遵循每日上限，防止 IG 頻率過高。
 * 3. 輸出 Markdown 日報至 data/reports/YYYY-MM-DD.md。
 * ============================================================================
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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

export interface ScrollLedgerState {
  version: number
  date: string
  seenPosts: Record<string, { timestamp: string; worthy?: boolean }>
  recommendedToday: RecommendedItem[]
  dailyStats: {
    scrolledCount: number
    recommendedCount: number
  }
  cooldownUntil?: number
  cooldownReason?: string
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
    if (!existsSync(this.filePath)) {
      this.save()
    }
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
        if (data.date !== today) {
          // 隔日重設每日統計
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
      recommendedToday: [],
      dailyStats: { scrolledCount: 0, recommendedCount: 0 },
    }
  }

  public save(): void {
    try {
      writeFileSync(this.filePath, JSON.stringify(this.state, null, 2), 'utf-8')
    } catch (e: any) {
      console.error(`[ScrollLedger] 保存失敗: ${e.message}`)
    }
  }

  private checkRollover(): void {
    const today = this.getTodayStr()
    if (this.state.date !== today) {
      this.state.date = today
      this.state.recommendedToday = []
      this.state.dailyStats = { scrolledCount: 0, recommendedCount: 0 }
      this.save()
    }
  }

  public hasSeen(postPk: string): boolean {
    return Boolean(this.state.seenPosts[postPk])
  }

  public markSeen(postPk: string, worthy: boolean = false): void {
    this.checkRollover()
    this.state.seenPosts[postPk] = {
      timestamp: new Date().toISOString(),
      worthy,
    }
    this.state.dailyStats.scrolledCount = (this.state.dailyStats.scrolledCount || 0) + 1
    this.save()
  }

  public canRecommend(cap: number): boolean {
    this.checkRollover()
    if (cap <= 0) return true
    return (this.state.dailyStats.recommendedCount || 0) < cap
  }

  public recordRecommendation(item: RecommendedItem): void {
    this.checkRollover()
    this.state.recommendedToday.unshift(item)
    this.state.dailyStats.recommendedCount = (this.state.dailyStats.recommendedCount || 0) + 1
    this.markSeen(item.postPk, true)
    this.save()
    this.appendReport(item)
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

