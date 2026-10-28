# DSH Instagram Scroll Feed & Exploration Plugin (`@luoyi-dsh/instagram-scroll`)

<div align="center">

![DSH Instagram Scroll Banner](assets/banner.png)

**[English](README.md) | [繁體中文](README.zh-Hant.md) | [Agent & Operational Guide](AGENTS.md)**

</div>

> Dedicated Instagram feed exploration, AI content review, and daily digest plugin for **DeepSeek Harness (DSH)**.  
> Automatically inherits Bot and Master accounts from `@luoyi-dsh/instagram-mcp`, browses Instagram timeline feeds and fuzzy-searched topics, strictly filters out AI-generated videos/animations/articles (AIGC), evaluates post substance against the owner's interests via LLM, leaves authentic `@master` recommendation comments, and compiles daily Markdown reports.

> [!CAUTION]
> ### ⚠️ CRITICAL WARNING & DISCLAIMER
> 1. **Violation of Instagram Terms of Service & Community Guidelines**:
>    This plugin operates via unofficial APIs, which **expressly violates Instagram / Meta's Terms of Use and Community Guidelines**.
> 2. **DO NOT USE YOUR PERSONAL / PRIMARY ACCOUNT**:
>    **Never run this plugin using your personal, primary, or business Instagram account!** Use disposable test accounts paired with clean residential proxies.
> 3. **Disclaimer**:
>    This project is provided strictly for educational and technical research purposes. Use entirely at your own risk!

---

## 🌟 Key Features

1. **Zero-Config Account Inheritance**:
   - Automatically inherits both the Bot session (`username`) and Master account (`masterUsername`) from `@luoyi-dsh/instagram-mcp`.
2. **Automated Feed & Fuzzy Topic Exploration (Scroll Duty)**:
   - Periodically polls timeline feeds and fuzzy-searches configured topics (`igFuzzySearchPosts` + hashtag fallback).
3. **Strict Anti-AIGC & Deep Content Inspection**:
   - Automatically rejects AI-generated videos, animations, images, and content-farm articles, as well as hashtag spam, giveaways, and superficial posts.
   - Evaluates genuine body text via LLM (supporting external `dsh-plugin-subscriptions` quota) before recommending to the master.
4. **Daily Markdown Digest (`data/reports/YYYY-MM-DD.md`)**:
   - Organizes reviewed posts, summaries, and recommendation trails into daily Markdown reports viewable in the Web UI.

---

## 📦 Installation

```bash
# Via DSH Plugin CLI
dsh plugin --profile web add @luoyi-dsh/instagram-scroll

# Or via npm
npm install @luoyi-dsh/instagram-scroll
```

---

## 📖 Operational Guide & Tool Reference

For complete DSH tool definitions, natural language prompts, HTTP REST API routes, and configuration parameters, please refer to **[AGENTS.md](AGENTS.md)**.

---

## 📁 Directory Structure

```text
dsh-instagram-scroll/
├── cordis.patch.yml               # DSH bundle patch manifest
├── package.json                   # Module definitions and dependencies
├── tsconfig.json                  # TypeScript compiler configuration
├── AGENTS.md                      # Operational & Agent Tool Guide
├── CHANGELOG.md                   # Version release notes
├── README.md                      # English overview (This file)
├── README.zh-Hant.md              # Traditional Chinese overview
├── client.js                      # DSH Web UI panel
└── src/                           # Core scroll duty, ledger/report manager, and DSH tools
```

---

## 📜 Releases & License

- See [CHANGELOG.md](CHANGELOG.md) for release history.
- Licensed under the [MIT License](LICENSE).
