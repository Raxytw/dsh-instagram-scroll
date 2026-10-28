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
    reason: string
  }>
  message: string
}

export interface ParsedPostContent {
  rawCaption: string
  cleanBody: string
  hashtags: string[]
  mentions: string[]
  tagCount: number
  tagCharLength: number
  cleanLength: number
  isTagSpam: boolean
}

export interface EvaluationResult {
  isWorthy: boolean
  score: number
  reason: string
  commentText: string
  rejectionReason?: string
  reviewMethod: 'llm' | 'heuristic'
}

/**
 * 正文解析與標籤分離器
 * 徹底區分貼文真正的正文內容與文末堆砌的標籤 (防止標籤農場誤導)
 */
export function parsePostContent(caption: string = ''): ParsedPostContent {
  const rawCaption = String(caption || '').trim()

  // 提取所有 hashtag 與 mention
  const hashtags = (rawCaption.match(/#[\p{L}\p{N}_]+/gu) || []).map((t) => t.slice(1).toLowerCase())
  const mentions = (rawCaption.match(/@[\p{L}\p{N}._]+/gu) || []).map((m) => m.slice(1))

  // 移除所有 #tag 與 @mention，整理出真正的正文文字
  let cleanBody = rawCaption
    .replace(/#[\p{L}\p{N}_]+/gu, ' ')
    .replace(/@[\p{L}\p{N}._]+/gu, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim()

  const cleanLength = cleanBody.length
  const tagCount = hashtags.length
  const tagCharLength = hashtags.reduce((acc, tag) => acc + tag.length, 0)

  // 判定是否為標籤農場 (Hashtag Spam):
  // 1. 標籤數量超過 12 個
  // 2. 標籤總長度超越正文長度且正文字數小於 40 字
  const isTagSpam = tagCount > 12 || (tagCount >= 6 && tagCharLength > cleanLength && cleanLength < 40)

  return {
    rawCaption,
    cleanBody,
    hashtags,
    mentions,
    tagCount,
    tagCharLength,
    cleanLength,
    isTagSpam,
  }
}

/**
 * 調用宿主 LLM 或環境變數中的 DeepSeek / OpenAI 服務進行深度語義內容審查
 */
async function callLlmInference(
  ctx: any,
  systemPrompt: string,
  userPrompt: string
): Promise<string | null> {
  // 1. 優先嘗試 DSH 宿主注入的 LLM 服務
  const llm = (typeof ctx?.get === 'function' ? ctx.get('llm') : null) || ctx?.llm
  if (llm) {
    try {
      if (typeof llm.chat === 'function') {
        const res = await llm.chat({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
        })
        const reply = res?.content || res?.text || (typeof res === 'string' ? res : '')
        if (reply) return reply
      }
      if (typeof llm.complete === 'function') {
        const reply = await llm.complete(`${systemPrompt}\n\n${userPrompt}`)
        if (reply) return reply
      }
    } catch (e: any) {
      console.warn(`[ScrollDuty LLM] 宿主 ctx.llm 調用異常: ${e.message}`)
    }
  }

  // 2. 檢查備援環境變數 (DeepSeek / OpenAI)
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY
  const baseUrl =
    process.env.DEEPSEEK_API_BASE || process.env.OPENAI_BASE_URL || 'https://api.deepseek.com'

  if (apiKey) {
    try {
      const resp = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
      })
      if (resp.ok) {
        const data = (await resp.json()) as any
        return data.choices?.[0]?.message?.content || null
      }
    } catch (err: any) {
      console.warn(`[ScrollDuty LLM] 外部 API 調用異常: ${err.message}`)
    }
  }

  return null
}

/**
 * 嚴密的高精度內容檢驗引擎 (Content Inspection Pipeline)
 * 解決痛點：「不要隨便推薦、要依據用戶喜歡內容、@ 前要檢查貼文內容、不要只看 tag」
 */
export async function inspectAndEvaluatePost(
  ctx: any,
  post: InstagramPost,
  config: InstagramScrollConfig
): Promise<EvaluationResult> {
  const master = (config.masterUsername || '').replace(/^@/, '').trim()
  const parsed = parsePostContent(post.caption || '')
  const minScore = config.minScore || 80
  const minLength = config.minCaptionLength || 30
  const userInterests =
    config.userInterests ||
    '專注於前沿 AI 技術、開源軟體、全端與前端架構、實用開發工具、優質 UI/UX 設計技巧或實用技術深度解析；喜愛實踐乾貨與原創見解。'

  // === 第 1 關：正文實質內容字數檢驗 (拒絕無內文或純圖廢文) ===
  if (parsed.cleanLength < minLength) {
    return {
      isWorthy: false,
      score: 15,
      reason: '',
      rejectionReason: `正文有效字數不足 (${parsed.cleanLength} 字 < 門檻 ${minLength} 字)，資訊量過少無實質乾貨內容。`,
      commentText: '',
      reviewMethod: 'heuristic',
    }
  }

  // === 第 2 關：標籤農場檢查 (拒絕標籤堆砌蹭熱度) ===
  if (parsed.isTagSpam) {
    return {
      isWorthy: false,
      score: 20,
      reason: '',
      rejectionReason: `判定為標籤農場 (包含 ${parsed.tagCount} 個標籤，標籤佔比過高且正文空洞)。`,
      commentText: '',
      reviewMethod: 'heuristic',
    }
  }

  // === 第 3 關：負面詞與廣告過濾 (Negative Keywords / Spam Filter) ===
  const negativeWords = config.negativeKeywords || []
  const rawLower = parsed.rawCaption.toLowerCase()
  for (const badKw of negativeWords) {
    const cleanKw = badKw.toLowerCase().trim()
    if (cleanKw && rawLower.includes(cleanKw)) {
      return {
        isWorthy: false,
        score: 10,
        reason: '',
        rejectionReason: `命中排除關鍵字/廣告宣傳詞彙 [${cleanKw}]。`,
        commentText: '',
        reviewMethod: 'heuristic',
      }
    }
  }

  // === 第 4 關：正文實質主題核驗 (不能只看文末 tag) ===
  const positiveWords = config.positiveKeywords || []
  const cleanLower = parsed.cleanBody.toLowerCase()
  const hitBodyKeywords: string[] = []

  for (const kw of positiveWords) {
    const cleanKw = kw.toLowerCase().trim()
    if (cleanKw && cleanLower.includes(cleanKw)) {
      hitBodyKeywords.push(cleanKw)
    }
  }

  // 若設定要求「正文必須命中用戶偏好」，且正文未命中任何關鍵字，直接退回
  if (config.requireBodyMatch && hitBodyKeywords.length === 0) {
    return {
      isWorthy: false,
      score: 30,
      reason: '',
      rejectionReason: `正文實質內容未提及主人偏好領域關鍵字 (僅文末標籤包含相關字詞，判定為蹭熱度)。`,
      commentText: '',
      reviewMethod: 'heuristic',
    }
  }

  // === 第 5 關：LLM 深度語義質檢 (如果環境具備 LLM 能力) ===
  const systemPrompt = `你是一位高品味、眼光極為嚴格的私人內容審查特助。
主人的核心原則是：「絕對不要隨便推薦、必須切合主人喜歡的內容，在留言 @ 主人之前必須深入檢查正文實質內容，嚴禁只看文末的 tag 就隨意推薦」。
主人的內容偏好定義如下：
"""
${userInterests}
"""

任務要求：
1. 請審查貼文正文是否深度探討主人喜歡的主題，還是只是空泛的標籤農場或蹭流量。
2. 評估內容是否具備前沿實踐、技術見解、架構乾貨或優質教學價值。
3. 若內容確實極為優秀且深度符合主人喜好，請給出大於等於 ${minScore} 的高分，並撰寫簡短真誠、針對此篇貼文具體乾貨的一句話推坑留言 (不要千篇一律套話)。
4. 若品質普通、偏題或僅表面蹭熱度，給予低於 ${minScore} 的分數並給出 rejectionReason。

請嚴格輸出 JSON 格式：
{
  "isWorthy": boolean,
  "score": number, // 0-100
  "summary": "貼文真正主旨簡介 (30字內)",
  "rejectionReason": "未通過的原因 (若不合格)",
  "reason": "推薦給主人的實質價值說明 (若合格)",
  "hookPhrase": "針對本篇內容亮點量身打造的推坑一句話 (若合格，25字內，真誠具體，嚴禁空洞廢話)"
}`

  const userPrompt = `請審查以下 Instagram 貼文：
- 作者：@${post.user?.username || 'unknown'}
- 互動數據：${post.like_count || 0} 讚, ${post.comment_count || 0} 則留言
- 貼文真正正文內容 (已剔除標籤)：
"""
${parsed.cleanBody.slice(0, 800)}
"""
- 文末標籤清單：#${parsed.hashtags.join(', #')}
- 正文命中之領域詞：${hitBodyKeywords.join(', ') || '無'}

請依據審查原則進行嚴格評估並以 JSON 返回。`

  const llmResponse = await callLlmInference(ctx, systemPrompt, userPrompt)
  if (llmResponse) {
    try {
      const cleanedJson = llmResponse.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
      const parsedLlm = JSON.parse(cleanedJson)
      const score = Number(parsedLlm.score || 0)
      const isWorthy = Boolean(parsedLlm.isWorthy) && score >= minScore

      if (isWorthy) {
        const hook = String(parsedLlm.hookPhrase || parsedLlm.reason || '這篇分析非常到位，強烈推薦！').trim()
        const commentText = master ? `@${master} ${hook}` : hook
        return {
          isWorthy: true,
          score,
          reason: String(parsedLlm.reason || parsedLlm.summary || '內容深度契合主人關注領域且具備乾貨價值。'),
          commentText,
          reviewMethod: 'llm',
        }
      } else {
        return {
          isWorthy: false,
          score,
          reason: '',
          rejectionReason: String(parsedLlm.rejectionReason || '內容深度未達主人品味標準或主題不符。'),
          commentText: '',
          reviewMethod: 'llm',
        }
      }
    } catch (e: any) {
      console.warn(`[ScrollDuty] LLM 結果 JSON 解析異常: ${e.message}`)
    }
  }

  // === 備援：啟發式嚴密內容質檢 (Heuristic Rule Engine) ===
  // 當宿主無 LLM 或 LLM 調用異常時，依然嚴守品質底線，絕不隨便推薦！
  let heuristicScore = 40 // 底分

  // 正文字數深度加分 (有較長詳細說明通常具備更高乾貨密度)
  if (parsed.cleanLength > 300) heuristicScore += 18
  else if (parsed.cleanLength > 150) heuristicScore += 12
  else if (parsed.cleanLength > 60) heuristicScore += 6

  // 正文實質命中關鍵詞加分
  heuristicScore += Math.min(25, hitBodyKeywords.length * 8)

  // 乾貨排版特徵檢查 (具備條列、步驟或結構化排版)
  if (/[0-9][.、]|👉|✅|🔹|💡|📌|\n- |\n\* /.test(parsed.cleanBody)) {
    heuristicScore += 10
  }

  // 社群互動數據適度輔助加分 (最多 12 分，避免高讚垃圾貼文)
  const likes = post.like_count || 0
  const comments = post.comment_count || 0
  if (likes > 300) heuristicScore += 6
  if (comments > 15) heuristicScore += 6

  heuristicScore = Math.min(96, Math.max(10, heuristicScore))
  const isHeuristicWorthy = heuristicScore >= minScore

  if (isHeuristicWorthy) {
    const reason = `正文實質深度探討 [${hitBodyKeywords.slice(0, 3).join(', ')}]，文字詳實完整 (${parsed.cleanLength} 字)，結構條理分明。`
    const hookPhrases = [
      `這篇關於 ${hitBodyKeywords[0] || '該主題'} 的內容分享非常扎實，特別推薦你看！`,
      `發現這篇乾貨對你的方向很有啟發，特地 @ 你存起來！`,
      `這篇思路與案例分析得很透徹，內容很硬核，推推！`,
    ]
    const chosenHook = hookPhrases[Math.floor(Math.random() * hookPhrases.length)]
    const commentText = master ? `@${master} ${chosenHook}` : `這篇乾貨非常精彩，推薦關注！`

    return {
      isWorthy: true,
      score: heuristicScore,
      reason,
      commentText,
      reviewMethod: 'heuristic',
    }
  } else {
    return {
      isWorthy: false,
      score: heuristicScore,
      reason: '',
      rejectionReason: `內容乾貨密度評分 (${heuristicScore}) 未達嚴選門檻 (${minScore})。`,
      commentText: '',
      reviewMethod: 'heuristic',
    }
  }
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

  log('[ScrollDuty] 🚀 開始替主人刷一輪 Instagram (啟動正文內容嚴格審查模式)...')

  const master = (config.masterUsername || '').replace(/^@/, '').trim()
  if (!master) {
    log('[ScrollDuty] ⚠️ 尚未配置主人帳號 (masterUsername)，將僅進行瀏覽審核而不留言 @主人。')
  }

  const batchSize = Math.max(5, config.batchSize || 15)
  const maxPerRun = config.maxRecommendsPerRun || 1
  const candidatePosts: InstagramPost[] = []

  // 1. 抓取首頁時間軸動態牆 (Feed)
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

  // 2. 隨機選取一個主人感興趣的標籤進行探索抓取 (Explore Tag)
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

  // 3. 逐條讀內文進行深度內容審查與推薦
  for (const post of candidatePosts) {
    if (recommendedCount >= maxPerRun) {
      log(`[ScrollDuty] 達到本輪推坑上限 (${maxPerRun} 則)，結束本輪推薦。`)
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
    const evalRes = await inspectAndEvaluatePost(ctx, post, config)

    if (evalRes.isWorthy) {
      worthyCount++
      log(
        `[ScrollDuty] ⭐ 發現極高價值內容！審查機制: [${evalRes.reviewMethod.toUpperCase()}], 評分: ${evalRes.score}/100, 作者: @${post.user?.username || 'unknown'}`
      )
      log(`[ScrollDuty] 推薦原因: ${evalRes.reason}`)

      // 檢查是否還能推坑 (每日上限控制)
      const cap = config.dailyRecommendCap || 5
      if (ledger.canRecommend(cap) && master) {
        // @ 前進行最後確認檢查 (Pre-mention Verification)
        if (!evalRes.commentText || !evalRes.commentText.includes(master)) {
          log(`[ScrollDuty] ⚠️ 推坑語句缺少 @${master}，自動補上主人名稱`)
          evalRes.commentText = `@${master} ${evalRes.commentText || '這篇分析非常到位，特地推薦你看看！'}`
        }

        log(`[ScrollDuty] 正在貼文下留言推坑: "${evalRes.commentText}"...`)
        try {
          const commentRes = await mcp.igPostComment({
            media_pk: postPk,
            text: evalRes.commentText,
            jitter_min: 6.0,
            jitter_max: 15.0,
          })

          if (
            commentRes?.in_cooldown ||
            (commentRes?.error &&
              /action block|feedback|checkpoint|please wait|rate limit/i.test(commentRes.error))
          ) {
            ledger.triggerCooldown(
              config.cooldownOnBlockMinutes || 30,
              commentRes.error || 'Instagram 頻率風控阻擋'
            )
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
              if (
                likeRes?.in_cooldown ||
                (likeRes?.error &&
                  /action block|feedback|checkpoint|please wait|rate limit/i.test(likeRes.error))
              ) {
                ledger.triggerCooldown(
                  config.cooldownOnBlockMinutes || 30,
                  likeRes.error || 'Instagram 點讚風控阻擋'
                )
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
      log(`[ScrollDuty] ⏭️ 未通過內容審核: ${evalRes.rejectionReason || '評分未達標準'}`)
      ledger.markSeen(postPk, false)
    }
  }

  const msg = `本輪滾動完畢！共掃描 ${totalScanned} 則內容，經正文與語義嚴格審查，精選 ${worthyCount} 則符合主人偏好，成功留評推薦 ${recommendedCount} 則。`
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

