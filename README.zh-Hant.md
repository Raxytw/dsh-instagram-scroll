# DSH Instagram 滾動瀏覽與探索插件 (`@luoyi-dsh/instagram-scroll`)

<div align="center">

![DSH Instagram Scroll Banner](assets/banner.png)

**[English](README.md) | [繁體中文](README.zh-Hant.md) | [操作方法與 Agent 指南](AGENTS.md)**

</div>

> **DeepSeek Harness (DSH)** 專屬的 Instagram 動態探索、智慧推坑與日報生成外掛。  
> 自動沿用 `@luoyi-dsh/instagram-mcp` 設定之機器人帳號與主人帳號，定時或手動替主人刷 Instagram 首頁動態與模糊搜尋主題、嚴格過濾 AI 生成的影片/動畫/文章 (AIGC)、逐條深度審查正文評估主人興趣、自動點讚與留言 `@主人` 推坑，並自動彙整生成每日 Markdown 探索日報。

> [!CAUTION]
> ### ⚠️ 重要風險警告與免責聲明 (CRITICAL DISCLAIMER)
> 1. **違反 Instagram 社群守則與使用條款**：本插件採用非官方 API 進行自動化操作，明確違反 Instagram / Meta 的服務條款與社群守則。
> 2. **切勿使用本人主要帳號運行**：嚴禁使用個人主要帳號或重要商業帳號！請務必使用測試小號並搭配純淨住宅代理。
> 3. **免責宣告**：本專案純屬技術研究用途，任何帳號停權或損失由使用者自負風險。

---

## 🌟 核心特色

1. **自動沿用 MCP 帳號設定**：
   - 機器人登入帳號與推坑目標主人帳號 (`masterUsername`) 直接從 `@luoyi-dsh/instagram-mcp` 自動讀取與同步，無須重複設定。
2. **自動動態牆與模糊關鍵字探索 (Scroll Duty)**：
   - 結合首頁動態牆與多階段模糊搜尋 (`igFuzzySearchPosts`)，徹底解決單純標籤搜尋返回 0 則貼文的問題。
3. **嚴格排除 AI 生成內容 (AIGC) 與正文深度審查**：
   - 自動攔截 AI 生成影片、AI 動畫、AI 繪圖與 AI 農場文章，並分離正文與 `#標籤`，結合外部訂閱插件 (`dsh-plugin-subscriptions`) AI 額度進行深度語義審查，絕不隨便推坑。
4. **每日探索日報 (`data/reports/YYYY-MM-DD.md`)**：
   - 自動將今日瀏覽之精選貼文、摘要與推薦紀錄整理為 Markdown 日報，可隨時於 Web 面板閱讀。

---

## 📦 安裝方式

```bash
# 使用 DSH CLI 安裝插件
dsh plugin --profile web add @luoyi-dsh/instagram-scroll

# 或透過 npm 安裝
npm install @luoyi-dsh/instagram-scroll
```

---

## 📖 插件操作方法與工具調用說明

完整的 DSH 工具清單、自然語言調用範例、HTTP REST API 端點與設定參數表，請參閱 **[AGENTS.md](AGENTS.md)**。

---

## 📁 目錄結構

```text
dsh-instagram-scroll/
├── cordis.patch.yml               # DSH bundle patch 宣告
├── package.json                   # 模組定義與依賴
├── tsconfig.json                  # TypeScript 編譯設定
├── AGENTS.md                      # 插件操作方法與 Agent 調用指南
├── CHANGELOG.md                   # 版本更新紀錄
├── README.md                      # 英文介紹文件
├── README.zh-Hant.md              # 繁體中文介紹文件 (本檔案)
├── client.js                      # DSH Web 前端面板
└── src/                           # 滾動探索核心、日報帳本管理與工具註冊
```

---

## 📜 版本紀錄與授權條款

- 詳細版本演進與更新紀錄，請參閱 [CHANGELOG.md](CHANGELOG.md)。
- 本專案採用 [MIT License](LICENSE) 開源授權。
