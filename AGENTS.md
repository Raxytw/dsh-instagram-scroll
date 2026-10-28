# AGENTS.md — `@luoyi-dsh/instagram-scroll` 操作指南與工具調用規範

本文件為 AI Agent、DeepSeek Harness (DSH) 主模型與開發者提供 `@luoyi-dsh/instagram-scroll` 的完整操作方法、DSH 工具清單、REST API 路由、AIGC 過濾規則與設定參數說明。

---

## 🧠 1. 核心運作規範

1. **自動沿用 MCP 帳號設定**：
   - 機器人登入會話 (`username`) 與推坑目標主人帳號 (`masterUsername`) 直接從 `@luoyi-dsh/instagram-mcp` 自動讀取與同步，無須在本插件額外輸入。
2. **嚴格排除 AI 生成內容 (AIGC Filter)**：
   - 滾動探索與主題搜尋時，自動過濾 AI 生成的影片、AI 動畫、AI 繪圖或 AI 生成農場文章（包含 `#aiart`, `#aivideo`, `#aianimation`, `#sora`, `#midjourney`, `#runwayml`, `#klingai`, `AI生成`, `AI影片`, `AI動畫` 等）。
3. **共享外部插件 LLM 訂閱額度**：
   - 深度語義審核優先調用 `@luoyi-dsh/instagram-plugin` 掛載之統一推理引擎 (`__DSH_INSTAGRAM_LLM__`) 與 DSH 宿主 `ctx.llm`，支援 `dsh-plugin-subscriptions` 外部訂閱額度。

---

## 🛠️ 2. 提供之 DSH Tools 清單

| 工具名稱 | 說明 | 參數 |
| :--- | :--- | :--- |
| **`ig_run_scroll_duty_now`** | 立即手動替主人刷一輪 Instagram 動態與模糊搜尋主題，進行正文審查、過濾 AIGC、點讚與留言 `@主人` 推坑 | 無 |
| **`ig_scroll_feed`** | 滾動讀取 Instagram 時間軸最新動態貼文（含作者、讚數、內文摘要，已過濾 AIGC） | `limit` (number，預設 15，最大 50) |
| **`ig_explore_topics`** | 依照指定主題關鍵字進行模糊搜尋 (`igFuzzySearchPosts`) 與標籤探索熱門貼文（已過濾 AIGC） | `tag` (string，必填), `limit` (number，預設 15) |
| **`ig_like_feed_post`** | 在滾動瀏覽過程中對感興趣的 Instagram 貼文按讚 | `media_pk` (string，必填) |

---

## 💻 3. 工具與 API 調用方式

### 1. DSH AI 自然語言直接調用

```text
💬 範例 1：執行一輪完整的動態探索與推坑
「請立刻替我刷一輪 Instagram 動態牆，看看有沒有適合我的技術新貼文並推薦給我」
-> 調用：ig_run_scroll_duty_now()

💬 範例 2：滾動瀏覽首頁動態貼文
「幫我刷最新 10 則 Instagram 動態」
-> 調用：ig_scroll_feed(limit=10)

💬 範例 3：探索特定主題關鍵字
「探索 Instagram 上關於 deepseek 的熱門貼文」
-> 調用：ig_explore_topics(tag="deepseek", limit=15)
```

### 2. 透過 HTTP REST API 調用 (DSH Web 路由，預設埠 3080)

```bash
# 1. 手動觸發滾動一輪 (POST /api/instagram/scroll/run)
curl -X POST http://127.0.0.1:3080/api/instagram/scroll/run

# 2. 獲取當前滾動狀態與今日統計 (GET /api/instagram/scroll/status)
curl http://127.0.0.1:3080/api/instagram/scroll/status

# 3. 讀取今日 Markdown 探索日報內容 (GET /api/instagram/scroll/report)
curl http://127.0.0.1:3080/api/instagram/scroll/report

# 4. 讀取與更新設定 (GET / POST /api/instagram/scroll/config)
curl http://127.0.0.1:3080/api/instagram/scroll/config

curl -X POST http://127.0.0.1:3080/api/instagram/scroll/config \
  -H "Content-Type: application/json" \
  -d '{"minScore":80,"dailyRecommendCap":5}'
```

---

## ⚙️ 4. 設定參數說明 (`data/config.json`)

| 欄位名稱 | 型別 | 預設值 | 說明 |
| :--- | :--- | :--- | :--- |
| **`userInterests`** | string | *預設偏好詳述* | 主人喜歡的內容風格與領域詳細描述（供 AI 深度比對正文語義） |
| **`positiveKeywords`** | array | `["ai", "deepseek", ...]` | 正文必須提及或重點加分的領域關鍵字清單 |
| **`negativeKeywords`** | array | `["互粉", "代購", "ai生成", ...]` | 負向排除關鍵字（含 AIGC 關鍵詞，命中時直接過濾） |
| **`minCaptionLength`** | number | `30` | 正文有效文字最小字數門檻（扣除 `#標籤` 後過短者直接過濾） |
| **`requireBodyMatch`** | boolean| `true` | 正文實質內容必須命中主人偏好主題（拒絕僅在文末蹭 tag） |
| **`strictContentCheck`**| boolean| `true` | 啟用 `@` 前深度正文審查機制 |
| **`interestTags`** | array | `["ai", "deepseek", "coding", "tech", "gadgets"]` | 模糊搜尋與探索抓取的主題關鍵字清單 |
| **`personaPrompt`** | string | *預設人設提示詞* | 評估貼文趣味度與撰寫 `@主人` 推薦語的人設 Prompt |
| **`minScore`** | number | `80` | 推坑門檻分數（0-100，達標才在貼文下留言推薦） |
| **`dailyRecommendCap`** | number | `5` | 每日向主人推坑留言的上限則數 |
| **`maxRecommendsPerRun`**| number | `1` | 單次滾動瀏覽最多推坑留言則數 |
| **`minPostReadDelaySeconds`** | number | `3` | 每讀取一則貼文前人造擬真閱讀微延遲最小秒數 |
| **`maxPostReadDelaySeconds`** | number | `7` | 每讀取一則貼文前人造擬真閱讀微延遲最大秒數 |
| **`cooldownOnBlockMinutes`** | number | `30` | 遇到 Action Block / 頻率限制時自動熔斷暫停分鐘數 |
| **`scrollIntervalMinutes`**| number | `60` | 自動巡查刷動態牆的時間週期（分鐘） |
| **`autoScrollEnabled`** | boolean| `true` | 是否啟用背景定時自動刷動態牆任務 |
| **`likeOnRecommend`** | boolean| `true` | 決定推薦給主人時是否順便對該貼文點讚 |
| **`batchSize`** | number | `15` | 每輪滾動瀏覽抓取的貼文筆數 (10-30) |
