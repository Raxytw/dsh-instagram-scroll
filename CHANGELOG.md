# Changelog

All notable changes to `@luoyi-dsh/instagram-scroll` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.1] - 2026-10-28

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
