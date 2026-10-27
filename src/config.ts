/**
 * src/config.ts —— Instagram 滾動探索與主人推坑插件設定
 */

export interface InstagramScrollConfig {
  masterUsername?: string
  interestTags?: string[]
  personaPrompt?: string
  minScore?: number
  dailyRecommendCap?: number
  scrollIntervalMinutes?: number
  autoScrollEnabled?: boolean
  likeOnRecommend?: boolean
  batchSize?: number
}

export const defaultScrollConfig: InstagramScrollConfig = {
  masterUsername: '',
  interestTags: ['ai', 'deepseek', 'coding', 'tech', 'gadgets'],
  personaPrompt:
    '你是一位洞察力敏銳、品味高雅的社群特助。請評估這篇 Instagram 貼文/影片是否具有前沿乾貨、創意見解、實用價值或視覺驚艷。若是主人會感興趣的好內容，請給出大於80分的評價，並撰寫簡短自然、熱情真誠的推坑一句話。',
  minScore: 75,
  dailyRecommendCap: 5,
  scrollIntervalMinutes: 60,
  autoScrollEnabled: true,
  likeOnRecommend: true,
  batchSize: 15,
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

export function sanitizeScrollConfig(raw: any): InstagramScrollConfig {
  const c = raw || {}
  return {
    masterUsername: unwrapScrollValue(c.masterUsername, defaultScrollConfig.masterUsername || ''),
    interestTags: Array.isArray(c.interestTags) ? c.interestTags : (defaultScrollConfig.interestTags || []),
    personaPrompt: unwrapScrollValue(c.personaPrompt, defaultScrollConfig.personaPrompt || ''),
    minScore: unwrapScrollValue(c.minScore, defaultScrollConfig.minScore || 75),
    dailyRecommendCap: unwrapScrollValue(c.dailyRecommendCap, defaultScrollConfig.dailyRecommendCap || 5),
    scrollIntervalMinutes: unwrapScrollValue(c.scrollIntervalMinutes, defaultScrollConfig.scrollIntervalMinutes || 60),
    autoScrollEnabled: unwrapScrollValue(c.autoScrollEnabled, defaultScrollConfig.autoScrollEnabled ?? true),
    likeOnRecommend: unwrapScrollValue(c.likeOnRecommend, defaultScrollConfig.likeOnRecommend ?? true),
    batchSize: unwrapScrollValue(c.batchSize, defaultScrollConfig.batchSize || 15),
  }
}

export function buildScrollConfigSchema(z: any) {
  return z.object({
    masterUsername: z
      .string()
      .default('')
      .description('主人的 Instagram 使用者名稱 (發現好文時將在留言區 @主人推薦)'),
    interestTags: z
      .array(z.string())
      .default(['ai', 'deepseek', 'coding', 'tech'])
      .description('主人感興趣的主題標籤或領域關鍵字清單'),
    personaPrompt: z
      .string()
      .default(defaultScrollConfig.personaPrompt!)
      .description('評估貼文趣味度與撰寫 @主人推薦語的人設提示詞'),
    minScore: z
      .number()
      .default(75)
      .description('推坑門檻分數 (0-100，達標才在貼文下留言 @主人)'),
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
  })
}
