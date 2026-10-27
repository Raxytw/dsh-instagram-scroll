# DSH Instagram 滾動瀏覽與探索插件 (`@luoyi-dsh/instagram-scroll`)

![Banner](assets/banner.png)

> **DeepSeek Harness (DSH)** 專屬的 Instagram 動態探索、智慧推坑與日報生成外掛。  
> 具備核心能力：**定時或手動替主人刷一輪 Instagram 首頁動態與主題標籤、逐條閱讀內文評估主人興趣、自動點讚與留言推坑，並自動彙整生成每日 Markdown 探索日報**。

---

## 🌟 核心特性

1. **自動動態探索巡查 (Scroll Duty)**：
   - 定期輪詢首頁動態牆 (Timeline Feed) 與指定主題標籤 (Hashtags)。
   - 逐則貼文抓取標題、作者、標籤與完整內文。
2. **LLM 價值評估與推坑 (AI Recommendation)**：
   - 由大語言模型依據主人的興趣 Prompt 深度分析貼文內容與價值評分。
   - 若達標（預設 > 75 分），自動在貼文下點讚並留言 `@目標用戶` 附上真誠自然的推薦語。
3. **每日探索日報 (Daily Markdown Report)**：
   - 自動將今日瀏覽之所有精選貼文、摘要與推薦紀錄整理為 Markdown 日報。
   - 儲存於 `data/reports/YYYY-MM-DD.md`，可隨時在 Web 面板查看與回溯。
4. **狀態帳本與嚴格去重控制**：
   - `data/scroll_ledger.json` 記錄已看貼文 PK 與今日推坑次數，避免重複推坑或重複閱讀，並防止觸發風控。
5. **DSH Web 瀏覽器端介面 (`client.js`)**：
   - 提供直觀動態牆瀑布流預覽、即時手動觸發刷動態按鈕、日報閱讀器與自訂設定面板。

---

## 📦 安裝方式

使用 DSH CLI 安裝插件：

```bash
dsh plugin --profile web add @luoyi-dsh/instagram-scroll
```

或透過 npm 安裝：

```bash
npm install @luoyi-dsh/instagram-scroll
```

---

## 🛠️ 提供之 DSH Tools

| 工具名稱 | 說明 | 參數 |
| :--- | :--- | :--- |
| **`ig_run_scroll_duty_now`** | 立即手動替主人刷一輪 Instagram 動態與探索，讀取貼文進行評估、點讚與留言推坑 | 無 |
| **`ig_scroll_feed`** | 滾動讀取 Instagram 時間軸最新動態貼文（含作者、讚數、內文摘要） | `limit` (number，預設 15，最大 50) |
| **`ig_explore_topics`** | 依照指定主題或探索標籤滾動閱讀熱門貼文 | `tag` (string，必填), `limit` (number，預設 15) |
| **`ig_like_feed_post`** | 在滾動瀏覽過程中對感興趣的 Instagram 貼文按讚 | `media_pk` (string，必填) |

---

## 💻 使用範例

### 1. DSH AI 自然語言直接調用

在 DSH 對話中，主模型可直接以自然語言執行滾動探索或瀏覽：

```text
💬 範例 1：執行一輪完整的動態探索與推坑
「請立刻替我刷一輪 Instagram 動態牆，看看有沒有適合我的技術新貼文並推薦給我」
-> AI 將調用：ig_run_scroll_duty_now()

💬 範例 2：滾動瀏覽首頁動態貼文
「幫我刷最新 10 則 Instagram 動態」
-> AI 將調用：ig_scroll_feed(limit=10)

💬 範例 3：探索特定主題標籤
「探索 Instagram 上 #deepseek 標籤的熱門貼文」
-> AI 將調用：ig_explore_topics(tag="deepseek", limit=15)
```

---

### 2. 透過 HTTP REST API 調用 (DSH Web 路由)

> 💡 **提示**：DSH Web 預設埠號為 **3080**。插件已註冊官方 REST API（前綴 `/api/instagram/scroll`）：

#### 1. 手動觸發滾動一輪 (`POST /api/instagram/scroll/run`)
```bash
curl -X POST http://127.0.0.1:3080/api/instagram/scroll/run
```

#### 2. 獲取當前滾動狀態與今日統計 (`GET /api/instagram/scroll/status`)
```bash
curl http://127.0.0.1:3080/api/instagram/scroll/status
```

#### 3. 讀取今日探索日報內容 (`GET /api/instagram/scroll/report`)
```bash
curl http://127.0.0.1:3080/api/instagram/scroll/report
```

#### 4. 讀取與更新設定 (`GET / POST /api/instagram/scroll/config`)
```bash
# 取得設定
curl http://127.0.0.1:3080/api/instagram/scroll/config

# 更新設定
curl -X POST http://127.0.0.1:3080/api/instagram/scroll/config \
  -H "Content-Type: application/json" \
  -d '{"masterUsername":"your_username","minScore":80}'
```

---

## ⚙️ 設定參數說明 (Settings)

可於 DSH 設定面板或插件目錄下的 `data/config.json` 中配置：

| 欄位名稱 | 型別 | 預設值 | 說明 |
| :--- | :--- | :--- | :--- |
| **`masterUsername`** | string | `""` | 主人的 Instagram 使用者名稱（達標時在留言區 @主人 推薦） |
| **`interestTags`** | array | `["ai", "deepseek", "coding", "tech"]` | 主人感興趣的主題標籤或領域關鍵字清單 |
| **`personaPrompt`** | string | *預設人設提示詞* | 評估貼文趣味度與撰寫 @主人 推薦語的人設 Prompt |
| **`minScore`** | number | `75` | 推坑門檻分數（0-100，達標才在貼文下留言推薦） |
| **`dailyRecommendCap`** | number | `5` | 每日向主人推坑留言的上限則數（防止過度打擾與風控） |
| **`scrollIntervalMinutes`**| number | `60` | 自動巡查刷動態牆的時間週期（分鐘） |
| **`autoScrollEnabled`** | boolean| `true` | 是否啟用背景定時自動刷動態牆任務 |
| **`likeOnRecommend`** | boolean| `true` | 決定推薦給主人時是否順便對該貼文點讚 |
| **`batchSize`** | number | `15` | 每輪滾動瀏覽抓取的貼文筆數 (10-30) |

---

## 📁 目錄結構

```text
dsh-instagram-scroll/
├── cordis.patch.yml               # DSH bundle patch 宣告
├── package.json                   # 模組定義與依賴
├── tsconfig.json                  # TypeScript 編譯設定
├── assets/
│   └── banner.png                 # 宣傳橫幅
├── client.js                      # DSH Web 前端面板 (動態瀏覽、手動觸發、日報查看)
├── data/
│   ├── config.json                # 本地設定檔
│   ├── scroll_ledger.json         # 瀏覽去重與統計帳本
│   └── reports/                   # 每日日報儲存目錄 (YYYY-MM-DD.md)
└── src/
    ├── index.ts                   # Cordis 外掛入口、排程定時器與 Web API
    ├── config.ts                  # Schemastery 設定模型
    ├── types.d.ts                 # 型別宣告
    ├── core/
    │   └── scrollDuty.ts          # 滾動瀏覽、大模型評估、點讚與推坑核心邏輯
    ├── lib/
    │   ├── hostdeps.ts            # DSH 宿主相容層
    │   └── ledger.ts              # 日報生成與歷史去重帳本管理器
    └── tools/
        └── scrollTools.ts         # 向 DSH Tools 註冊之專用滾動瀏覽工具
```

---

## 📄 授權條款

本專案採用 [MIT License](LICENSE) 開源授權。
