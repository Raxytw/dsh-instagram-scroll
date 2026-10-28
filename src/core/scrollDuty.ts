/**
 * src/core/scrollDuty.ts —— Instagram 滾動探索、趣味評估與 @主人推坑任務
 * ============================================================================
 * 概念參照 dsh-bili-scroll：
 * 每天替主人刷一輪 Instagram（時間軸動態 + 興趣主題探索）。
 * 逐條讀內文判斷是否值得，遇到真心覺得主人會喜歡的貼文或影片，
 * 就在該貼文底下留一條評論「@主人 + 推薦原因」，並記錄至今日日報。
 * ============================================================================
 */

import type { InstagramMcpClient, InstagramPost } from '@luoyi-dsh/instagram-mcp'
import { InstagramScrollConfig } from '../config.js'
import { ScrollLedgerManager } from '../lib/ledger.js'

export interface ScrollRoundResult {
  ok: boolean
  totalScanned: number
  worthyCount: number
  recommendedCount: number
  recommendations: Array<{
    postPk: string
    code: string
    author: string
    url: string
    score: number
    comment: string
  }>
  message: string
}

/**
 * 簡易而實用的評估與推薦語產生器
 * 結合貼文內文關鍵字權重、互動熱度與語意提示進行評分
 */
function evaluatePost(
  post: InstagramPost,
  config: InstagramScrollConfig
): { isWorthy: boolean; score: number; reason: string; commentText: string } {
  const caption = (post.caption || '').toLowerCase()
  const tags = config.interestTags || []
  let score = 50

  // 1. 關鍵字與標籤匹配加分
  let hitTags: string[] = []
  for (const tag of tags) {
    const clean = tag.replace(/^#/, '').toLowerCase().trim()
    if (clean && caption.includes(clean)) {
      hitTags.push(clean)
      score += 12
    }
  }

  // 2. 互動熱度與品質加分
  const likes = post.like_count || 0
  const comments = post.comment_count || 0
  if (likes > 500) score += 10
  else if (likes > 100) score += 5

  if (comments > 20) score += 8
  else if (comments > 5) score += 4

  // 3. 內文長度加分（有原創詳細說明通常更具乾貨）
  if (caption.length > 100) score += 8

  // 4. 廣告或過濾詞扣分
  const spamKeywords = ['互粉', '代購', '博彩', '運彩', '兼職', '抽獎', '免費領']
  for (const kw of spamKeywords) {
    if (caption.includes(kw)) {
      score -= 35
    }
  }

  score = Math.min(98, Math.max(20, score))
  const isWorthy = score >= (config.minScore || 75)

  let reason = ''
  let commentText = ''
  const master = (config.masterUsername || '').replace(/^@/, '').trim()

  if (isWorthy) {
    if (hitTags.length > 0) {
      reason = `精準命中主人關注領域 [#${hitTags.join(', #')}]，內容高質且社群互動熱絡 (${likes} 讚, ${comments} 則留言)。`
      const hookPhrases = [
        '這篇思路與案例很不錯，特別推薦你看一下！',
        '發現這個很對你的胃口，覺得對你手邊專案很有幫助！',
        '這篇乾貨滿滿，看到覺得不能錯過，推推！',
        '這篇分析非常到位，特地 @ 你存起來參考！',
      ]
      const chosenHook = hookPhrases[Math.floor(Math.random() * hookPhrases.length)]
      commentText = master ? `@${master} ${chosenHook}` : `這篇乾貨非常精彩，推薦關注！`
    } else {
      reason = `熱門高讚貼文 (${likes} 讚)，討論熱烈，具備高參考價值。`
      commentText = master ? `@${master} 看到這篇討論很熱絡，分享給你看看！` : '推薦這篇精彩內容！'
    }
  }

  return { isWorthy, score, reason, commentText }
}

export async function executeScrollRound(
  ctx: any,
  config: InstagramScrollConfig,
  mcp: InstagramMcpClient,
  ledger: ScrollLedgerManager,
  log: (msg: string) => void = console.log
): Promise<ScrollRoundResult> {
  // 防風控冷卻保護檢查
  if (ledger.isInCooldown()) {
    const rem = ledger.getCooldownRemainingSeconds()
    const reason = ledger.getCooldownReason()
    const msg = `防風控冷卻保護中（剩餘 ${rem} 秒，原因: ${reason}），暫停本輪滾動瀏覽`
    log(`[ScrollDuty] 🚨 ${msg}`)
    return {
      ok: true,
      totalScanned: 0,
      worthyCount: 0,
      recommendedCount: 0,
      recommendations: [],
      message: msg,
    }
  }

  log('[ScrollDuty] 🚀 開始替主人刷一輪 Instagram...')

  const master = (config.masterUsername || '').replace(/^@/, '').trim()
  if (!master) {
    log('[ScrollDuty] ⚠️ 尚未配置主人帳號 (masterUsername)，將僅進行瀏覽紀錄而不留言 @主人。')
  }

  const batchSize = Math.max(5, config.batchSize || 15)
  const maxPerRun = config.maxRecommendsPerRun || 1
  const candidatePosts: InstagramPost[] = []

  // 1. 抓取時間軸首頁動態 (Feed)
  try {
    log(`[ScrollDuty] 正在滾動時間軸動態牆 (抓取上限: ${batchSize})...`)
    const feedRes = await mcp.igGetTimelineFeed(batchSize)
    if (feedRes?.ok && Array.isArray(feedRes.posts)) {
      candidatePosts.push(...feedRes.posts)
      log(`[ScrollDuty] 從首頁時間軸獲取到 ${feedRes.posts.length} 則動態。`)
    }
  } catch (e: any) {
    log(`[ScrollDuty] 獲取時間軸動態異常: ${e.message}`)
    if (/feedback|action block|checkpoint|rate limit/i.test(e.message)) {
      ledger.triggerCooldown(config.cooldownOnBlockMinutes || 30, e.message)
      return {
        ok: false,
        totalScanned: 0,
        worthyCount: 0,
        recommendedCount: 0,
        recommendations: [],
        message: `時間軸獲取異常並觸發風控冷卻: ${e.message}`,
      }
    }
  }

  // 2. 隨機選取一個主人感興趣的標籤進行主題探索 (Explore Tag)
  const tags = config.interestTags || []
  if (tags.length > 0) {
    const randomTag = tags[Math.floor(Math.random() * tags.length)].replace(/^#/, '').trim()
    try {
      log(`[ScrollDuty] 正在探索主題標籤 #${randomTag}...`)
      const tagRes = await mcp.igSearchHashtag(randomTag, 10)
      if (tagRes?.ok && Array.isArray(tagRes.posts)) {
        candidatePosts.push(...tagRes.posts)
        log(`[ScrollDuty] 從 #${randomTag} 獲取到 ${tagRes.posts.length} 則主題貼文。`)
      }
    } catch (e: any) {
      log(`[ScrollDuty] 探索標籤異常: ${e.message}`)
      if (/feedback|action block|checkpoint|rate limit/i.test(e.message)) {
        ledger.triggerCooldown(config.cooldownOnBlockMinutes || 30, e.message)
      }
    }
  }

  let totalScanned = 0
  let worthyCount = 0
  let recommendedCount = 0
  const recommendations: any[] = []

  // 3. 逐條讀內文進行評估與推薦 (模擬人類瀏覽微延遲)
  for (const post of candidatePosts) {
    if (recommendedCount >= maxPerRun) {
      log(`[ScrollDuty] 達到本輪推坑上限 (${maxPerRun} 則)，結束本輪滾動。`)
      break
    }

    const postPk = String(post.pk || post.id || '')
    if (!postPk) continue

    // 跳過已看過的貼文
    if (ledger.hasSeen(postPk)) {
      continue
    }

    // 模擬人類瀏覽閱讀貼文微延遲
    const minDelay = config.minPostReadDelaySeconds || 3
    const maxDelay = Math.max(minDelay, config.maxPostReadDelaySeconds || 7)
    const readWaitMs = Math.floor((minDelay + Math.random() * (maxDelay - minDelay)) * 1000)
    await new Promise((r) => setTimeout(r, readWaitMs))

    totalScanned++
    const evalRes = evaluatePost(post, config)

    if (evalRes.isWorthy) {
      worthyCount++
      log(
        `[ScrollDuty] ⭐ 發現值得內容！作者: @${post.user?.username || 'unknown'}, 評分: ${evalRes.score}/100. 短碼: ${post.code}`
      )

      // 檢查是否還能推坑 (每日上限控制)
      const cap = config.dailyRecommendCap || 5
      if (ledger.canRecommend(cap) && master) {
        log(`[ScrollDuty] 正在貼文下留言 @${master} 進行推薦...`)
        try {
          const commentRes = await mcp.igPostComment({
            media_pk: postPk,
            text: evalRes.commentText,
            jitter_min: 6.0,
            jitter_max: 15.0,
          })

          if (commentRes?.in_cooldown || (commentRes?.error && /action block|feedback|checkpoint|please wait|rate limit/i.test(commentRes.error))) {
            ledger.triggerCooldown(config.cooldownOnBlockMinutes || 30, commentRes.error || 'Instagram 頻率風控阻擋')
            log(`[ScrollDuty] 🚨 偵測到風控或熔斷保護，停止後續推坑！`)
            ledger.markSeen(postPk, true)
            break
          }

          if (commentRes?.ok) {
            log(`[ScrollDuty] ✅ 成功留言 @${master}！`)
            recommendedCount++

            // 若開啟，順便點讚
            if (config.likeOnRecommend) {
              const likeRes = await mcp.igLikeMedia(postPk).catch(() => ({} as any))
              if (likeRes?.in_cooldown || (likeRes?.error && /action block|feedback|checkpoint|please wait|rate limit/i.test(likeRes.error))) {
                ledger.triggerCooldown(config.cooldownOnBlockMinutes || 30, likeRes.error || 'Instagram 點讚風控阻擋')
                break
              }
            }

            const recItem = {
              postPk,
              code: post.code,
              author: post.user?.username || 'unknown',
              url: post.url || `https://www.instagram.com/p/${post.code}/`,
              score: evalRes.score,
              reason: evalRes.reason,
              commentText: evalRes.commentText,
              timestamp: new Date().toISOString(),
            }

            ledger.recordRecommendation(recItem)
            recommendations.push(recItem)
          } else {
            log(`[ScrollDuty] 留言發布失敗: ${commentRes?.error || '未知原因'}`)
            ledger.markSeen(postPk, true)
          }
        } catch (e: any) {
          log(`[ScrollDuty] 留言異常: ${e.message}`)
          ledger.markSeen(postPk, true)
          if (/feedback|action block|checkpoint|rate limit/i.test(e.message)) {
            ledger.triggerCooldown(config.cooldownOnBlockMinutes || 30, e.message)
            break
          }
        }
      } else {
        log(`[ScrollDuty] 今日推薦已達上限 (${cap}則) 或未配置主人帳號，僅標記值得並記錄日報。`)
        ledger.markSeen(postPk, true)
      }
    } else {
      ledger.markSeen(postPk, false)
    }
  }

  const msg = `本輪滾動瀏覽完畢！共掃描 ${totalScanned} 則新內容，發現 ${worthyCount} 則值得貼文，成功替主人留評推薦 ${recommendedCount} 則。`
  log(`[ScrollDuty] 🎉 ${msg}`)

  return {
    ok: true,
    totalScanned,
    worthyCount,
    recommendedCount,
    recommendations,
    message: msg,
  }
}
