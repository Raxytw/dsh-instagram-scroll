# Changelog

All notable changes to `@luoyi-dsh/instagram-scroll` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.3] - 2026-10-28

### Added
- **Deep Content Inspection Pipeline**:
  - Implemented `parsePostContent` to strictly separate raw post captions from trailing hashtags and account mentions.
  - Added substantive body text length validation (`minCaptionLength`) to discard superficial single-emoji or textless media posts.
  - Implemented tag spamming detection (`isTagSpam`) to filter out hashtag farms.
- **User Preference Alignment**:
  - Added `userInterests` detailed persona & preference description for deep semantic comparison.
  - Added `positiveKeywords` for essential topic matching in actual post body text (`requireBodyMatch`).
  - Added `negativeKeywords` anti-spam filter for ads, giveaways, mutual follows, and irrelevant entertainment fluff.
- **Pre-mention Content Verification**:
  - Deep review via host LLM or heuristic rules before posting any `@master` comment.
  - Post-specific tailored hook generation to eliminate generic repeated comments.
  - Elevated default recommendation threshold score to `80`.

---

## [1.0.2] - 2026-10-28

### Added
- **Anti-Risk & Anti-Ban Controls**:
  - Circuit Breaker Cooldown mode (30 minutes) on Action Block / Feedback Required exceptions.
  - Humanized reading pacing (3-7s delay between posts).
  - Single-run recommendation limit (`maxRecommendsPerRun = 1`) to avoid burst commenting.
- **Community Guidelines Disclaimer**:
  - Explicit warning callout in documentation against using personal primary Instagram accounts.

---

### Added
- **Dynamic Route Dispatcher**:
  - Implemented `__DSH_IG_SCROLL_HANDLER__` delegating request handler in `index.ts` to support live code hot reloads without triggering "duplicate prefix route" crashes in DSH WebServer.
- **Synchronized MCP Session Display**:
  - Added real-time Instagram account handle resolution in `/api/instagram/scroll/status` directly from `@luoyi-dsh/instagram-mcp` shared service.
- **Immediate Client Mounting**:
  - Configured `client.immediately = true` in `package.json` for instantaneous UI tab rendering.
- **Multi-language Documentation**:
  - Comprehensive English and Traditional Chinese README files with release notes.

### Changed
- Standardized Cordis bundle patch identifier to `@luoyi-dsh/instagram-scroll`.
- Enhanced `client.js` with instant loading and improved status card badges.

---

## [1.0.0] - 2026-10-27

### Initial Release
- **Automated Scroll Duty**: Periodically browses timeline feeds and interest tags.
- **AI Recommendation Engine**: LLM post content evaluation, scoring, automatic like and @mention comments.
- **Daily Markdown Reports**: Digest generated daily in `data/reports/YYYY-MM-DD.md`.
- **Deduplication Ledger**: `data/scroll_ledger.json` to prevent duplicate reads and quota abuse.
- **Web UI & REST API**: Native dashboard with waterfall stream, manual scroll trigger, report viewer, and config editor.
