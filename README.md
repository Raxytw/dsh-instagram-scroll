# DSH Instagram Scroll Feed & Exploration Plugin (`@luoyi-dsh/instagram-scroll`)

<div align="center">

![DSH Instagram Scroll Banner](assets/banner.png)

**[English](README.md) | [繁體中文](README.zh-Hant.md)**

</div>

> Dedicated Instagram feed exploration, AI recommendation, and daily digest plugin for **DeepSeek Harness (DSH)**.  
> Core capabilities: **Automatically or manually browse Instagram timeline feeds and topic hashtags on behalf of the user, evaluate post relevance against the owner's interests using LLMs, like and leave authentic recommendation comments, and aggregate highlights into daily Markdown reports**.

---

## 🌟 Key Features

1. **Automated Feed Browsing (Scroll Duty)**:
   - Periodically polls timeline feeds and configured topic hashtags.
   - Extracts post caption, author, tags, and media metadata.
2. **LLM Evaluation & Smart Recommendation**:
   - Analyzes post relevance and scores content (0-100) based on master's interest prompt.
   - Automatically likes posts and writes authentic recommendation comments mentioning master (`@masterUsername`) when score meets criteria (default > 75).
3. **Daily Markdown Digest (`data/reports/YYYY-MM-DD.md`)**:
   - Automatically organizes reviewed posts, summaries, and recommendation trails into clean Markdown daily digests.
   - Viewable directly in the web console.
4. **State Ledger & Deduplication**:
   - `data/scroll_ledger.json` keeps track of inspected media PKs and daily quotas to prevent repetitive actions and avoid rate limits.
5. **DSH Web Control Panel (`client.js`)**:
   - Provides an intuitive feed waterfall preview, manual duty execution button, daily report reader, and settings inspector.

---

## 📦 Installation

Install via DSH Plugin CLI:

```bash
dsh plugin --profile web add @luoyi-dsh/instagram-scroll
```

Or via standard npm:

```bash
npm install @luoyi-dsh/instagram-scroll
```

---

## 🛠️ Provided DSH Tools

| Tool Name | Description | Parameters |
| :--- | :--- | :--- |
| **`ig_run_scroll_duty_now`** | Trigger an immediate exploration duty cycle (evaluate posts, like & recommend) | None |
| **`ig_scroll_feed`** | Read timeline feed posts (author, like count, caption excerpt) | `limit` (number, default 15, max 50) |
| **`ig_explore_topics`** | Explore popular posts under a specific topic or hashtag | `tag` (string, required), `limit` (number, default 15) |
| **`ig_like_feed_post`** | Like an Instagram post during browsing | `media_pk` (string, required) |

---

## 💻 Usage Examples

### 1. Natural Language Invocation in DSH Chat

```text
💬 Example 1: Run full exploration and recommendation duty
"Please check my Instagram feed right now and recommend any interesting technical posts."
-> AI calls: ig_run_scroll_duty_now()

💬 Example 2: Read timeline posts
"Browse the latest 10 posts on my Instagram feed."
-> AI calls: ig_scroll_feed(limit=10)

💬 Example 3: Explore a hashtag
"Explore top posts under #deepseek on Instagram."
-> AI calls: ig_explore_topics(tag="deepseek", limit=15)
```

---

### 2. Via HTTP REST API (DSH Web Routes)

> 💡 **Tip**: Default DSH Web port is **3080**.

#### 1. Manually Trigger Duty Cycle (`POST /api/instagram/scroll/run`)
```bash
curl -X POST http://127.0.0.1:3080/api/instagram/scroll/run
```

#### 2. Get Current Status & Daily Stats (`GET /api/instagram/scroll/status`)
```bash
curl http://127.0.0.1:3080/api/instagram/scroll/status
```

#### 3. Read Today's Markdown Digest (`GET /api/instagram/scroll/report`)
```bash
curl http://127.0.0.1:3080/api/instagram/scroll/report
```

#### 4. Read & Update Configuration (`GET / POST /api/instagram/scroll/config`)
```bash
# Read config
curl http://127.0.0.1:3080/api/instagram/scroll/config

# Update config
curl -X POST http://127.0.0.1:3080/api/instagram/scroll/config \
  -H "Content-Type: application/json" \
  -d '{"masterUsername":"your_username","minScore":80}'
```

---

## ⚙️ Configuration Parameters (Settings)

> 💡 **Tip**: No need to configure Instagram credentials here; it automatically inherits session state from `@luoyi-dsh/instagram-mcp`.

| Field | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| **`masterUsername`** | string | `""` | Master's Instagram username (mentioned in comments when recommended) |
| **`interestTags`** | array | `["ai", "deepseek", "coding", "tech"]` | Topic hashtags and keywords matching the owner's interest |
| **`personaPrompt`** | string | *Default persona prompt* | Persona prompt guiding post analysis and recommendation copywriting |
| **`minScore`** | number | `75` | Recommendation score threshold (0-100) |
| **`dailyRecommendCap`** | number | `5` | Maximum recommendation comments allowed per day |
| **`scrollIntervalMinutes`**| number | `60` | Background exploration duty interval in minutes |
| **`autoScrollEnabled`** | boolean| `true` | Whether background automated exploration duty is enabled |
| **`likeOnRecommend`** | boolean| `true` | Automatically like post upon recommending to master |
| **`batchSize`** | number | `15` | Number of posts inspected per scroll duty round (10-30) |

---

## 📁 Directory Structure

```text
dsh-instagram-scroll/
├── cordis.patch.yml               # DSH bundle patch manifest
├── package.json                   # Module definitions and dependencies
├── tsconfig.json                  # TypeScript compiler configuration
├── CHANGELOG.md                   # Version release notes
├── README.md                      # English documentation (This file)
├── README.zh-Hant.md              # Traditional Chinese documentation
├── assets/
│   ├── banner.png                 # Promotional banner
│   └── zh-Hant.md                 # Localized documentation
├── client.js                      # DSH Web UI panel
├── data/                          # [Runtime generated, ignored in Git]
│   ├── config.json                # Local configuration
│   ├── scroll_ledger.json         # Deduplication and quota ledger
│   └── reports/                   # Daily reports folder (YYYY-MM-DD.md)
└── src/
    ├── index.ts                   # Cordis plugin entrypoint and Web API
    ├── config.ts                  # Schemastery config schema
    ├── types.d.ts                 # Type definitions
    ├── core/
    │   └── scrollDuty.ts          # Scroll duty execution, LLM evaluation, likes & comments
    ├── lib/
    │   ├── hostdeps.ts            # DSH runtime compatibility layer
    │   └── ledger.ts              # Daily digest and history ledger manager
    └── tools/
        └── scrollTools.ts         # Dedicated DSH tools registration
```

---

## 📜 Releases & Changelog

For detailed release history and changes, please refer to [CHANGELOG.md](CHANGELOG.md).

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
