# DSH Instagram Scroll Feed & Exploration Plugin (`@luoyi-dsh/instagram-scroll`)

<div align="center">

![DSH Instagram Scroll Banner](assets/banner.png)

**[English](README.md) | [繁體中文](README.zh-Hant.md)**

</div>

> Dedicated Instagram feed exploration, AI recommendation, and daily digest plugin for **DeepSeek Harness (DSH)**.  
> Core capabilities: **Automatically or manually browse Instagram timeline feeds and topic hashtags on behalf of the user, evaluate post relevance against the owner's interests using LLMs, like and leave authentic recommendation comments, and aggregate highlights into daily Markdown reports**.

> [!CAUTION]
> ### ⚠️ CRITICAL WARNING & DISCLAIMER
> 1. **Violation of Instagram Terms of Service & Community Guidelines**:
>    This plugin and its automated feed browsing, liking, and commenting routines operate via unofficial APIs, which **expressly violates Instagram / Meta's Terms of Use and Community Guidelines**.
> 2. **DO NOT USE YOUR PERSONAL / PRIMARY ACCOUNT**:
>    **Never run this plugin using your personal, primary, or business Instagram account!** Automated browsing and repeated comment posting are quickly flagged by Instagram's anti-scraping and bot-detection heuristics, resulting in: **Action Blocks, Challenge Checkpoints, temporary locks, and PERMANENT ACCOUNT SUSPENSION / BANNING**.
> 3. **Use Dedicated Burner / Alt Accounts & Clean Proxies**:
>    Only run this plugin on disposable secondary accounts (burner/alt accounts) with dedicated residential proxies. Avoid sudden geographic IP changes.
> 4. **Built-in Anti-Risk Safeguards**:
>    - **Per-Run Action Cap**: Strictly limits recommendations to at most 1 per scroll run (`maxRecommendsPerRun: 1`) to avoid burst posting.
>    - **Humanized Reading Delays**: Injects randomized 3–7s reading delays between scanning candidate posts (`minPostReadDelaySeconds: 3, maxPostReadDelaySeconds: 7`).
>    - **Action Jitter**: Enforces 6–15s randomized delays before executing comments or likes.
>    - **Circuit Breaker Cooldown**: Automatically pauses all exploration for 30 minutes if an Action Block or rate limit is encountered.
> 5. **Disclaimer**:
>    This project is provided strictly for educational and technical research purposes. The developers and contributors accept **no responsibility or liability** for any account bans, suspensions, or losses resulting from its use. Use entirely at your own risk!

---

## 🌟 Key Features

1. **Automated Feed Browsing (Scroll Duty)**:
   - Periodically polls timeline feeds and configured topic hashtags.
   - Extracts post caption, author, tags, and media metadata.
2. **Deep Content Inspection & User Preference Alignment**:
   - **No Superficial Recommendations**: Abandons simple hashtag-only / high-like criteria; threshold raised to score 80.
   - **Caption & Tag Separation**: Dissects raw captions to separate genuine body text from trailing hashtags and mentions. Posts with substantive body text shorter than `minCaptionLength` (30 chars) are discarded.
   - **Hashtag Spam / Farm Detection**: Flags and drops posts where tags dominate over meaningful content.
   - **Body Topic Verification**: Mandates that master's interest keywords/topics genuinely appear within the post body (`requireBodyMatch`).
   - **Negative / Spam Filtering**: Instantly filters out giveaways, mutual-follows, dropshipping, gambling, emotional clickbait, and superficial selfie/meme posts.
   - **LLM Semantic Review & Tailored Hook**: Evaluates true content substance via LLM or robust heuristic review, synthesizing custom authentic recommendation comments.
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
| **`userInterests`** | string | *Default persona description* | Detailed description of owner's topics, taste, and technical expectations |
| **`positiveKeywords`** | array | `["ai", "deepseek", ...]` | High-priority positive topic keywords required in post body |
| **`negativeKeywords`** | array | `["互粉", "代購", "抽獎", ...]` | Negative / spam blacklist words to immediately reject |
| **`minCaptionLength`** | number | `30` | Minimum character length of genuine post body (excluding hashtags) |
| **`requireBodyMatch`** | boolean| `true` | Body text must substantiate owner's preferences (rejects tag-only matches) |
| **`strictContentCheck`**| boolean| `true` | Enables deep content inspection pipeline before commenting |
| **`interestTags`** | array | `["ai", "deepseek", "coding", "tech", "gadgets"]` | Exploration starting tags (not sole recommendation criteria) |
| **`personaPrompt`** | string | *Default persona prompt* | Persona prompt guiding post analysis and recommendation copywriting |
| **`minScore`** | number | `80` | Recommendation score threshold (0-100; elevated to avoid spam) |
| **`dailyRecommendCap`** | number | `5` | Maximum recommendation comments allowed per day |
| **`maxRecommendsPerRun`**| number | `1` | Max recommendations per duty run to prevent bursting |
| **`minPostReadDelaySeconds`** | number | `3` | Minimum human reading pacing delay between posts |
| **`maxPostReadDelaySeconds`** | number | `7` | Maximum human reading pacing delay between posts |
| **`cooldownOnBlockMinutes`** | number | `30` | Automatic circuit breaker cooldown minutes upon action blocks |
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
