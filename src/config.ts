/**
 * src/config.ts —— Instagram 滾動探索與主人推坑插件設定
 */

export interface InstagramScrollConfig {
  masterUsername?: string
  fuzzySearchEnabled?: boolean
  fuzzyKeywords?: string[]
  tagSearchEnabled?: boolean
  interestTags?: string[]
  // === 用戶喜歡內容與偏好 ===
  userInterests?: string
  positiveKeywords?: string[]
  negativeKeywords?: string[]
  minCaptionLength?: number
  requireBodyMatch?: boolean
  strictContentCheck?: boolean
  // ============================
  personaPrompt?: string
  minScore?: number
  dailyRecommendCap?: number
  scrollIntervalMinutes?: number
  autoScrollEnabled?: boolean
  likeOnRecommend?: boolean
  batchSize?: number
  // === 安全防風控 ===
  maxRecommendsPerRun?: number
  minPostReadDelaySeconds?: number
  maxPostReadDelaySeconds?: number
  cooldownOnBlockMinutes?: number
}

export const defaultScrollConfig: InstagramScrollConfig = {
  masterUsername: '',
  fuzzySearchEnabled: true,
  fuzzyKeywords: ['art', 'deepseek', 'coding', 'kemono', 'tech'],
  tagSearchEnabled: false,
  interestTags: ['art', 'deepseek', 'coding', 'kemono', 'tech'],
  userInterests:
    '專注於真實人類原創手繪藝術 (插畫、Kemono、角色設計)、前沿軟體技術 (LLM 架構、Agent、開源專案)、全端與前端開發、高效率工具或深度技術解析。偏好真實人類原創作品與實踐乾貨，嚴格排除任何 AI 生成的影片、AI 動畫、AI 繪圖/算圖或 AI 生成的農場文章！',
  positiveKeywords: [
    'art',
    'kemono',
    'deepseek',
    'agent',
    'coding',
    '技術',
    '前端',
    '後端',
    '架構',
    '開源',
    '教學',
    '程式',
    '開發',
    '模型',
    'github',
    'prompt',
    '演算法',
    '工具',
    '實戰',
    '乾貨',
  ],
  negativeKeywords: [
    '互粉',
    '代購',
    '博彩',
    '運彩',
    '兼職',
    '抽獎',
    '免費領',
    '私訊',
    '點擊連結',
    '主頁連結',
    '減肥',
    '微商',
    '外匯',
    '虛擬幣',
    '心靈雞湯',
    '穿搭',
    '搞笑',
    '自拍',
    '八卦',
    '暴富',
    '躺平',
    '加盟',
    'AI生成',
    'AI影片',
    'AI動畫',
    'AI繪圖',
    'AI文章',
    'AIGC',
    'Midjourney',
    'Stable Diffusion',
    'Sora',
    'Runway',
    'Kling',
    '可靈',
    '即夢',
    'AI配音',
    'AI美女',
  ],
  minCaptionLength: 30,
  requireBodyMatch: true,
  strictContentCheck: true,
  personaPrompt:
    '你是一位洞察力敏銳、品味高雅的社群特助。請以極高標準評估這篇 Instagram 貼文是否深度符合主人的興趣偏好。若是具備前沿乾貨、創意見解或高實用價值的精選內容，請給出高分評價並撰寫簡短自然、熱情切題的推坑一句話。',
  minScore: 80,
  dailyRecommendCap: 5,
  scrollIntervalMinutes: 60,
  autoScrollEnabled: true,
  likeOnRecommend: true,
  batchSize: 15,
  maxRecommendsPerRun: 1,
  minPostReadDelaySeconds: 3,
  maxPostReadDelaySeconds: 7,
  cooldownOnBlockMinutes: 30,
}

export function unwrapScrollValue<T>(val: any, fallback: T): T {
  if (val === null || val === undefined) return fallback
  if (val === '[object Object]') return fallback
  if (typeof val === 'object' && typeof val.get === 'function') {
    const v = val.get()
    return (v !== undefined && v !== null && typeof v !== 'object') ? v : fallback
  }
  if (typeof val === 'object' && !Array.isArray(val)) {
    return fallback
  }
  return val as T
}

function parseListValue(val: any, fallback: string[] = []): string[] {
  if (Array.isArray(val)) {
    return val.map((s) => String(s || '').trim()).filter(Boolean)
  }
  if (typeof val === 'string') {
    return val.split(/[,，\n]+/).map((s) => s.trim().replace(/^#/, '')).filter(Boolean)
  }
  return fallback
}

export function sanitizeScrollConfig(raw: any): InstagramScrollConfig {
  const c = raw || {}
  const parsedTags = parseListValue(c.interestTags, defaultScrollConfig.interestTags || [])
  return {
    masterUsername: unwrapScrollValue(c.masterUsername, defaultScrollConfig.masterUsername || ''),
    fuzzySearchEnabled: unwrapScrollValue(c.fuzzySearchEnabled, defaultScrollConfig.fuzzySearchEnabled ?? true),
    fuzzyKeywords: parseListValue(c.fuzzyKeywords, parsedTags.length > 0 ? parsedTags : (defaultScrollConfig.fuzzyKeywords || [])),
    tagSearchEnabled: unwrapScrollValue(c.tagSearchEnabled, defaultScrollConfig.tagSearchEnabled ?? false),
    interestTags: parsedTags,
    userInterests: unwrapScrollValue(c.userInterests, defaultScrollConfig.userInterests || ''),
    positiveKeywords: parseListValue(c.positiveKeywords, defaultScrollConfig.positiveKeywords || []),
    negativeKeywords: parseListValue(c.negativeKeywords, defaultScrollConfig.negativeKeywords || []),
    minCaptionLength: unwrapScrollValue(c.minCaptionLength, defaultScrollConfig.minCaptionLength || 30),
    requireBodyMatch: unwrapScrollValue(c.requireBodyMatch, defaultScrollConfig.requireBodyMatch ?? true),
    strictContentCheck: unwrapScrollValue(c.strictContentCheck, defaultScrollConfig.strictContentCheck ?? true),
    personaPrompt: unwrapScrollValue(c.personaPrompt, defaultScrollConfig.personaPrompt || ''),
    minScore: unwrapScrollValue(c.minScore, defaultScrollConfig.minScore || 80),
    dailyRecommendCap: unwrapScrollValue(c.dailyRecommendCap, defaultScrollConfig.dailyRecommendCap || 5),
    scrollIntervalMinutes: unwrapScrollValue(c.scrollIntervalMinutes, defaultScrollConfig.scrollIntervalMinutes || 60),
    autoScrollEnabled: unwrapScrollValue(c.autoScrollEnabled, defaultScrollConfig.autoScrollEnabled ?? true),
    likeOnRecommend: unwrapScrollValue(c.likeOnRecommend, defaultScrollConfig.likeOnRecommend ?? true),
    batchSize: unwrapScrollValue(c.batchSize, defaultScrollConfig.batchSize || 15),
    maxRecommendsPerRun: unwrapScrollValue(c.maxRecommendsPerRun, defaultScrollConfig.maxRecommendsPerRun || 1),
    minPostReadDelaySeconds: unwrapScrollValue(c.minPostReadDelaySeconds, defaultScrollConfig.minPostReadDelaySeconds || 3),
    maxPostReadDelaySeconds: unwrapScrollValue(c.maxPostReadDelaySeconds, defaultScrollConfig.maxPostReadDelaySeconds || 7),
    cooldownOnBlockMinutes: unwrapScrollValue(c.cooldownOnBlockMinutes, defaultScrollConfig.cooldownOnBlockMinutes || 30),
  }
}

export function buildScrollConfigSchema(z: any) {
  return z.object({
    masterUsername: z
      .string()
      .default('')
      .description('主人的 Instagram 使用者名稱 (發現好文時將在留言區 @主人推薦)'),
    fuzzySearchEnabled: z
      .boolean()
      .default(true)
      .description('是否啟用模糊搜尋探索貼文 (預設開啟，解決單純 Tags 搜尋抓到 0 則貼文的問題)'),
    fuzzyKeywords: z
      .array(z.string())
      .default(['ai', 'deepseek', 'coding', 'tech', 'gadgets'])
      .description('模糊搜尋關鍵字清單 (結合綜合 SERP、Reels 搜尋與相關創作者貼文)'),
    tagSearchEnabled: z
      .boolean()
      .default(false)
      .description('是否啟用主題標籤 #Tag 搜尋 (預設關閉，保留並可用按鈕隨時開關)'),
    interestTags: z
      .array(z.string())
      .default(['ai', 'deepseek', 'coding', 'tech', 'gadgets'])
      .description('探索的主題標籤清單 (保留設定，當開啟 Tags 搜尋按鈕時使用)'),
    userInterests: z
      .string()
      .default(defaultScrollConfig.userInterests!)
      .description('主人喜歡的內容風格與領域詳細描述 (AI 將依此深度審查貼文實質內容)'),
    positiveKeywords: z
      .array(z.string())
      .default(defaultScrollConfig.positiveKeywords!)
      .description('正文必須討論或偏好的正面核心關鍵字清單'),
    negativeKeywords: z
      .array(z.string())
      .default(defaultScrollConfig.negativeKeywords!)
      .description('負向排除關鍵字 (命中時直接拒絕推薦，避免廣告、抽獎或廢文)'),
    minCaptionLength: z
      .number()
      .default(30)
      .description('正文有效文字最小字數要求 (扣除 #標籤 後，過短或無實質內容者直接過濾)'),
    requireBodyMatch: z
      .boolean()
      .default(true)
      .description('正文實質內容必須命中主人偏好主題 (拒絕僅在文末蹭 tag 的貼文)'),
    strictContentCheck: z
      .boolean()
      .default(true)
      .description('啟用嚴格內容審查機制 (結合 LLM / 正文語義深度質檢)'),
    personaPrompt: z
      .string()
      .default(defaultScrollConfig.personaPrompt!)
      .description('評估貼文趣味度與撰寫 @主人推薦語的人設提示詞'),
    minScore: z
      .number()
      .default(80)
      .description('推坑門檻分數 (0-100，達標才在貼文下留言 @主人，避免隨便推薦)'),
    dailyRecommendCap: z
      .number()
      .default(5)
      .description('每日向主人推坑留言的上限則數 (防止過度頻繁打擾與風控)'),
    scrollIntervalMinutes: z
      .number()
      .default(60)
      .description('自動刷動態牆並尋找好內容的時間週期 (分鐘)'),
    autoScrollEnabled: z
      .boolean()
      .default(true)
      .description('是否啟用背景定時自動刷動態牆任務'),
    likeOnRecommend: z
      .boolean()
      .default(true)
      .description('決定推薦給主人時是否順便對該貼文點讚'),
    batchSize: z
      .number()
      .default(15)
      .description('每輪滾動瀏覽抓取的貼文筆數 (10-30)'),
    maxRecommendsPerRun: z
      .number()
      .default(1)
      .description('單次滾動瀏覽最多推坑留言則數 (避免短時間連發觸發官方風控)'),
    minPostReadDelaySeconds: z
      .number()
      .default(3)
      .description('每掃描一則貼文前人造擬真閱讀微延遲最小秒數'),
    maxPostReadDelaySeconds: z
      .number()
      .default(7)
      .description('每掃描一則貼文前人造擬真閱讀微延遲最大秒數'),
    cooldownOnBlockMinutes: z
      .number()
      .default(30)
      .description('遇到 Action Block / 頻率限制時自動熔斷暫停分鐘數'),
  })
}
