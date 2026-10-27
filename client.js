/**
 * client.js —— DSH Web 瀏覽器端設定與動態日報面板 (dsh-instagram-scroll)
 * ============================================================================
 * 設計規範遵循:
 *  - .agents/skills/design-taste-frontend
 *  - references/app-screens.md (KPIs, Forms & Settings, Quiet Surfaces)
 * 核心功能 (比照 dsh-bili-scroll):
 *  - 每天替主人刷一輪 Instagram 貼文與影片
 *  - 逐條讀內文判斷主人是否感興趣
 *  - 值得的就在該貼文留言 @主人 + 推薦詞，並產生 Markdown 日報
 *  - 提供「現在跑一輪」按鈕與完整參數配置
 * ============================================================================
 */

window.__ModuleLoader__.load({
  id: 'dsh-instagram-scroll',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect } = React

    const API = '/api/instagram/scroll'

    const asJson = async (res) => {
      if (res.ok) return res.json()
      const text = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status}: ${text || res.statusText}`)
    }

    const jget = async (path) => asJson(await fetch(API + path, { credentials: 'same-origin' }))
    const jpost = async (path, body) =>
      asJson(
        await fetch(API + path, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body || {}),
        })
      )

    // 精緻向量 SVG 圖標集合
    const Icon = {
      Scroll: ({ size = 18 }) =>
        h(
          'svg',
          {
            width: size,
            height: size,
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 2,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          },
          h('path', { d: 'M19 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1' }),
          h('path', { d: 'M19 4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-1' }),
          h('path', { d: 'M7 8h8' }),
          h('path', { d: 'M7 12h6' })
        ),
      Play: ({ size = 13 }) =>
        h(
          'svg',
          {
            width: size,
            height: size,
            viewBox: '0 0 24 24',
            fill: 'currentColor',
            stroke: 'currentColor',
            strokeWidth: 1,
          },
          h('polygon', { points: '5 3 19 12 5 21 5 3' })
        ),
      Sparkles: ({ size = 15 }) =>
        h(
          'svg',
          {
            width: size,
            height: size,
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 2,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          },
          h('path', {
            d: 'M12 3l1.912 5.885L19.798 10.8 13.912 12.715 12 18.6l-1.912-5.885L4.202 10.8l5.886-1.915L12 3z',
          })
        ),
      User: ({ size = 15 }) =>
        h(
          'svg',
          {
            width: size,
            height: size,
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 2,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          },
          h('path', { d: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' }),
          h('circle', { cx: 12, cy: 7, r: 4 })
        ),
      Clock: ({ size = 15 }) =>
        h(
          'svg',
          {
            width: size,
            height: size,
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 2,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          },
          h('circle', { cx: 12, cy: 12, r: 10 }),
          h('polyline', { points: '12 6 12 12 16 14' })
        ),
      Refresh: ({ size = 14 }) =>
        h(
          'svg',
          {
            width: size,
            height: size,
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 2,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          },
          h('polyline', { points: '23 4 23 10 17 10' }),
          h('polyline', { points: '1 20 1 14 7 14' }),
          h('path', {
            d: 'M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
          })
        ),
      ExternalLink: ({ size = 12 }) =>
        h(
          'svg',
          {
            width: size,
            height: size,
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 2,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          },
          h('path', { d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' }),
          h('polyline', { points: '15 3 21 3 21 9' }),
          h('line', { x1: 10, y1: 14, x2: 21, y2: 3 })
        ),
      Save: ({ size = 14 }) =>
        h(
          'svg',
          {
            width: size,
            height: size,
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 2,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          },
          h('path', {
            d: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z',
          }),
          h('polyline', { points: '17 21 17 13 7 13 7 21' }),
          h('polyline', { points: '7 3 7 8 15 8' })
        ),
    }

    const CSS = `
/* ==========================================================================
   Instagram Scroll & Recommend — Design-Taste-Frontend Architecture
   ========================================================================== */
.ig-scr-root {
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 760px;
  padding: 6px 4px 40px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: var(--dsw-alias-label-primary, #f1f5f9);
  line-height: 1.5;
  box-sizing: border-box;
}

/* 頂部標頭列 (Header Shell) */
.ig-scr-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.08));
}
.ig-scr-brand-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.ig-scr-brand-mark {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: #181b22;
  border: 1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.1));
  display: flex;
  align-items: center;
  justify-content: center;
  color: #3b82f6;
}
.ig-scr-brand-title {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: #ffffff;
}
.ig-scr-brand-sub {
  font-size: 12px;
  color: var(--dsw-alias-label-secondary, #94a3b8);
  margin-top: 1px;
}

/* 分頁導航列 (Tab Navigation Rail) */
.ig-scr-tabs {
  display: flex;
  gap: 2px;
  background: var(--dsw-alias-bg-layer-2, rgba(255, 255, 255, 0.025));
  border: 1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.07));
  border-radius: 8px;
  padding: 3px;
}
.ig-scr-tab-btn {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 14px;
  font-size: 12px;
  font-weight: 500;
  color: var(--dsw-alias-label-secondary, #94a3b8);
  background: transparent;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease-in-out;
}
.ig-scr-tab-btn:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.04);
}
.ig-scr-tab-btn.active {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.08);
  font-weight: 600;
}

/* 設定卡片容器 (Flat Panel, 1px Quiet Border) */
.ig-scr-panel {
  background: var(--dsw-alias-bg-layer-2, rgba(255, 255, 255, 0.02));
  border: 1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.08));
  border-radius: 10px;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.ig-scr-section-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.05));
  padding-bottom: 10px;
}
.ig-scr-section-title {
  font-size: 13.5px;
  font-weight: 600;
  color: #ffffff;
}
.ig-scr-section-desc {
  font-size: 11.5px;
  color: var(--dsw-alias-label-secondary, #94a3b8);
}

/* 雙欄網格與輸入項 */
.ig-scr-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.ig-scr-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ig-scr-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--dsw-alias-label-secondary, #cbd5e1);
}
.ig-scr-hint {
  font-size: 11px;
  color: var(--dsw-alias-label-tertiary, #64748b);
  line-height: 1.4;
}
.ig-scr-input {
  width: 100%;
  height: 36px;
  box-sizing: border-box;
  padding: 0 12px;
  border-radius: 6px;
  font-size: 12px;
  border: 1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.1));
  background: var(--dsw-alias-bg-layer-4, rgba(0, 0, 0, 0.25));
  color: #f1f5f9;
  font-family: inherit;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.ig-scr-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 1px #3b82f6;
}
.ig-scr-textarea {
  width: 100%;
  min-height: 64px;
  box-sizing: border-box;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  border: 1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.1));
  background: var(--dsw-alias-bg-layer-4, rgba(0, 0, 0, 0.25));
  color: #f1f5f9;
  font-family: inherit;
  resize: vertical;
}

/* 開關列 (Switch Cell) */
.ig-scr-switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.05));
  border-radius: 8px;
}
.ig-scr-switch-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ig-scr-switch-name {
  font-size: 12.5px;
  font-weight: 500;
  color: #f1f5f9;
}
.ig-scr-toggle {
  position: relative;
  width: 36px;
  height: 20px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.15);
  cursor: pointer;
  border: 0;
  padding: 0;
  transition: background 0.2s ease;
  flex-shrink: 0;
}
.ig-scr-toggle.on {
  background: #10b981;
}
.ig-scr-toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #ffffff;
  transition: left 0.2s ease;
}
.ig-scr-toggle.on .ig-scr-toggle-thumb {
  left: 18px;
}

/* KPI 指標卡片 */
.ig-scr-kpi-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.ig-scr-kpi-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.06));
  border-radius: 8px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ig-scr-kpi-title {
  font-size: 11px;
  font-weight: 500;
  color: var(--dsw-alias-label-secondary, #94a3b8);
}
.ig-scr-kpi-val {
  font-size: 22px;
  font-weight: 600;
  color: #ffffff;
  font-variant-numeric: tabular-nums;
  display: flex;
  align-items: baseline;
  gap: 4px;
}
.ig-scr-kpi-denom {
  font-size: 12px;
  font-weight: 400;
  color: var(--dsw-alias-label-tertiary, #64748b);
}

/* 推薦貼文條目列表 */
.ig-scr-rec-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ig-scr-rec-item {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.06));
  border-radius: 8px;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ig-scr-rec-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.ig-scr-rec-author {
  font-size: 12.5px;
  font-weight: 600;
  color: #60a5fa;
}
.ig-scr-rec-score {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(16, 185, 129, 0.12);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.25);
  font-variant-numeric: tabular-nums;
}
.ig-scr-rec-reason {
  font-size: 11.5px;
  color: var(--dsw-alias-label-secondary, #cbd5e1);
  line-height: 1.4;
}
.ig-scr-rec-comment {
  font-size: 11.5px;
  font-family: monospace;
  padding: 6px 10px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.3);
  border-left: 2px solid #3b82f6;
  color: #93c5fd;
}

/* 按鈕樣式 */
.ig-scr-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 34px;
  padding: 0 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.1));
  background: rgba(255, 255, 255, 0.05);
  color: #f1f5f9;
  transition: all 0.15s ease;
}
.ig-scr-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}
.ig-scr-btn.primary {
  background: #2563eb;
  border-color: #1d4ed8;
  color: #ffffff;
  font-weight: 600;
}
.ig-scr-btn.primary:hover {
  background: #1d4ed8;
}
.ig-scr-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ig-scr-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 14px;
  border-top: 1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.08));
}
`

    const cleanStr = (v, fallback = '') => {
      if (typeof v === 'string') {
        return v === '[object Object]' ? fallback : v
      }
      return fallback
    }
    const cleanNum = (v, fallback = 0) => {
      if (typeof v === 'number' && !isNaN(v)) return v
      if (typeof v === 'string') {
        const n = Number(v)
        if (!isNaN(n)) return n
      }
      return fallback
    }
    const cleanArr = (v, fallback = []) => (Array.isArray(v) ? v : fallback)
    const cleanBool = (v, fallback = false) => (typeof v === 'boolean' ? v : fallback)

    const normalizeScrollConfig = (raw) => {
      const c = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {}
      return {
        masterUsername: cleanStr(c.masterUsername, ''),
        interestTags: cleanArr(c.interestTags, ['ai', 'deepseek', 'coding', 'tech', 'gadgets']),
        personaPrompt: cleanStr(c.personaPrompt, '你是一位洞察力敏銳、品味高雅的社群特助。請評估這篇 Instagram 貼文/影片是否具有前沿乾貨、創意見解、實用價值或視覺驚艷。若是主人會感興趣的好內容，請給出大於80分的評價，並撰寫簡短自然、熱情真誠的推坑一句話。'),
        minScore: cleanNum(c.minScore, 75),
        dailyRecommendCap: cleanNum(c.dailyRecommendCap, 5),
        scrollIntervalMinutes: cleanNum(c.scrollIntervalMinutes, 60),
        autoScrollEnabled: cleanBool(c.autoScrollEnabled, true),
        likeOnRecommend: cleanBool(c.likeOnRecommend, true),
        batchSize: cleanNum(c.batchSize, 15),
      }
    }

    function ScrollPanel() {
      const [tab, setTab] = useState('feed')
      const [cfg, setCfg] = useState(normalizeScrollConfig({}))
      const [status, setStatus] = useState(null)
      const [report, setReport] = useState('')
      const [loading, setLoading] = useState(true)
      const [saving, setSaving] = useState(false)
      const [runningRound, setRunningRound] = useState(false)
      const [msg, setMsg] = useState(null)

      const refresh = async () => {
        try {
          const [cfgRes, statusRes, reportRes] = await Promise.all([
            jget('/config'),
            jget('/status'),
            jget('/report'),
          ])
          if (cfgRes?.ok) setCfg(normalizeScrollConfig(cfgRes.config))
          if (statusRes?.ok) setStatus(statusRes)
          if (reportRes?.ok) setReport(reportRes.report || '')
        } catch (e) {
          setMsg(`讀取狀態失敗: ${e.message}`)
        } finally {
          setLoading(false)
        }
      }

      useEffect(() => {
        refresh()
      }, [])

      const updateField = (k, v) => setCfg((prev) => ({ ...prev, [k]: v }))

      const save = async () => {
        setSaving(true)
        setMsg(null)
        try {
          const cleanPayload = normalizeScrollConfig(cfg)
          const res = await jpost('/config', cleanPayload)
          if (res?.ok) {
            setCfg(normalizeScrollConfig(res.config))
            setMsg('✅ 滾動推坑設定已成功保存！')
          }
        } catch (e) {
          setMsg(`保存失敗: ${e.message}`)
        } finally {
          setSaving(false)
        }
      }

      const runNow = async () => {
        setRunningRound(true)
        setMsg(null)
        try {
          const res = await jpost('/run', {})
          if (res?.ok) {
            setMsg(res.message || '本輪滾動推坑完成！')
          }
          await refresh()
        } catch (e) {
          setMsg(`執行失敗: ${e.message}`)
        } finally {
          setRunningRound(false)
        }
      }

      if (loading) {
        return h('div', { className: 'ig-scr-root' }, '正在載入 Instagram 滾動推坑設定...')
      }

      const daily = status?.dailyStats || {}
      const recommendedItems = daily.recommendedItems || []

      return h(
        'div',
        { className: 'ig-scr-root' },

        // 頂部標頭列
        h(
          'div',
          { className: 'ig-scr-header' },
          h(
            'div',
            { className: 'ig-scr-brand-row' },
            h('div', { className: 'ig-scr-brand-mark' }, h(Icon.Scroll, { size: 20 })),
            h(
              'div',
              null,
              h('div', { className: 'ig-scr-brand-title' }, 'Instagram 滾動探索與主人推坑'),
              h(
                'div',
                { className: 'ig-scr-brand-sub' },
                cfg.masterUsername ? `當前主人目標: @${cfg.masterUsername.replace(/^@/, '')}` : '尚未綁定主人帳號'
              )
            )
          ),
          h(
            'button',
            {
              className: 'ig-scr-btn primary',
              disabled: runningRound,
              onClick: runNow,
            },
            h(Icon.Play, { size: 12 }),
            runningRound ? '正在替主人刷一輪...' : '🚀 現在替我刷一輪'
          )
        ),

        // 分頁切換
        h(
          'div',
          { className: 'ig-scr-tabs' },
          [
            ['feed', Icon.Sparkles, '推薦與日報'],
            ['master', Icon.User, '主人與偏好'],
            ['schedule', Icon.Clock, '排程與配額'],
          ].map(([id, IconCmp, label]) =>
            h(
              'button',
              {
                key: id,
                className: `ig-scr-tab-btn ${tab === id ? 'active' : ''}`,
                onClick: () => setTab(id),
              },
              h(IconCmp, { size: 14 }),
              label
            )
          )
        ),

        // 訊息通知
        msg
          ? h(
              'div',
              {
                style: {
                  padding: '9px 14px',
                  borderRadius: '6px',
                  background: 'rgba(59, 130, 246, 0.1)',
                  color: '#93c5fd',
                  borderLeft: '3px solid #3b82f6',
                  fontSize: '12px',
                },
              },
              msg
            )
          : null,

        // ====================================================================
        // TAB 1: 推薦與日報 (Today's Feed & Report)
        // ====================================================================
        tab === 'feed'
          ? h(
              'div',
              { className: 'ig-scr-panel' },
              h(
                'div',
                { className: 'ig-scr-section-head' },
                h('div', { className: 'ig-scr-section-title' }, '今日替主人刷貼文成果與日報'),
                h('div', { className: 'ig-scr-section-desc' }, '統計今日自動審閱量、精選出的高質內容、以及在貼文留言 @主人的推坑紀錄。')
              ),

              h(
                'div',
                { className: 'ig-scr-kpi-grid' },
                h(
                  'div',
                  { className: 'ig-scr-kpi-card' },
                  h('div', { className: 'ig-scr-kpi-title' }, '今日掃描審閱貼文'),
                  h('div', { className: 'ig-scr-kpi-val' }, daily.scrolledCount || 0)
                ),
                h(
                  'div',
                  { className: 'ig-scr-kpi-card' },
                  h('div', { className: 'ig-scr-kpi-title' }, '今日留言 @主人 推薦'),
                  h(
                    'div',
                    { className: 'ig-scr-kpi-val' },
                    daily.recommendedCount || 0,
                    h('span', { className: 'ig-scr-kpi-denom' }, `/ ${cfg.dailyRecommendCap || 5} 上限`)
                  )
                ),
                h(
                  'div',
                  { className: 'ig-scr-kpi-card' },
                  h('div', { className: 'ig-scr-kpi-title' }, '推坑門檻標準'),
                  h('div', { className: 'ig-scr-kpi-val' }, `${cfg.minScore || 75}`, h('span', { className: 'ig-scr-kpi-denom' }, '/ 100 分'))
                )
              ),

              // 今日推薦條目
              recommendedItems.length > 0
                ? h(
                    'div',
                    { style: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' } },
                    h('div', { style: { fontSize: '12px', fontWeight: 600, color: '#f1f5f9' } }, '今日已推坑貼文清單：'),
                    h(
                      'div',
                      { className: 'ig-scr-rec-list' },
                      recommendedItems.map((item, idx) =>
                        h(
                          'div',
                          { key: item.postPk || idx, className: 'ig-scr-rec-item' },
                          h(
                            'div',
                            { className: 'ig-scr-rec-head' },
                            h('div', { className: 'ig-scr-rec-author' }, `@${item.author}`),
                            h('div', { className: 'ig-scr-rec-score' }, `評分: ${item.score}`)
                          ),
                          h('div', { className: 'ig-scr-rec-reason' }, item.reason),
                          h('div', { className: 'ig-scr-rec-comment' }, item.commentText),
                          item.url
                            ? h(
                                'a',
                                {
                                  href: item.url,
                                  target: '_blank',
                                  rel: 'noopener noreferrer',
                                  style: {
                                    fontSize: '11px',
                                    color: '#60a5fa',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    textDecoration: 'none',
                                    alignSelf: 'flex-start',
                                  },
                                },
                                h(Icon.ExternalLink, { size: 12 }),
                                '開啟 Instagram 貼文'
                              )
                            : null
                        )
                      )
                    )
                  )
                : h(
                    'div',
                    {
                      style: {
                        padding: '24px 16px',
                        textAlign: 'center',
                        color: '#64748b',
                        fontSize: '12.5px',
                        background: 'rgba(255,255,255,0.015)',
                        borderRadius: '8px',
                        border: '1px dashed rgba(255,255,255,0.08)',
                      },
                    },
                    '今日尚未發現足夠高分的推坑貼文，點擊右上角「現在替我刷一輪」即刻開始探索！'
                  )
            )
          : null,

        // ====================================================================
        // TAB 2: 主人與偏好 (Master & Interests)
        // ====================================================================
        tab === 'master'
          ? h(
              'div',
              { className: 'ig-scr-panel' },
              h(
                'div',
                { className: 'ig-scr-section-head' },
                h('div', { className: 'ig-scr-section-title' }, '主人身分與興趣偏好配置'),
                h('div', { className: 'ig-scr-section-desc' }, '設定主人的 Instagram 帳號名與感興趣的標籤領域，AI 將依此進行嚴格內容篩選。')
              ),

              h(
                'div',
                { className: 'ig-scr-field' },
                h('label', { className: 'ig-scr-label' }, '🎯 主人 Instagram 帳號 (Master Username)'),
                h('input', {
                  className: 'ig-scr-input',
                  value: cleanStr(cfg.masterUsername),
                  placeholder: '例如 your_main_account (可不帶 @)',
                  onChange: (e) => updateField('masterUsername', e.target.value.replace(/^@/, '').trim()),
                }),
                h('div', { className: 'ig-scr-hint' }, '發現值得推薦的貼文/影片時，會在留言區 @ 此帳號進行推薦')
              ),

              h(
                'div',
                { className: 'ig-scr-field' },
                h('label', { className: 'ig-scr-label' }, '🏷️ 主人感興趣的主題標籤 (Interest Tags)'),
                h('input', {
                  className: 'ig-scr-input',
                  value: Array.isArray(cfg.interestTags) ? cfg.interestTags.join(', ') : '',
                  placeholder: 'ai, deepseek, coding, photography, gadgets, travel',
                  onChange: (e) =>
                    updateField(
                      'interestTags',
                      e.target.value.split(',').map((s) => s.trim().replace(/^#/, '')).filter(Boolean)
                    ),
                }),
                h('div', { className: 'ig-scr-hint' }, '多個標籤請用逗號分隔，除時間軸外亦會輪流針對這些主題進行深度探索')
              ),

              h(
                'div',
                { className: 'ig-scr-field' },
                h('label', { className: 'ig-scr-label' }, '💡 貼文評估人設與推薦 Prompt'),
                h('textarea', {
                  className: 'ig-scr-textarea',
                  value: cleanStr(cfg.personaPrompt),
                  onChange: (e) => updateField('personaPrompt', e.target.value),
                }),
                h('div', { className: 'ig-scr-hint' }, '定義如何研判貼文是否具備足夠乾貨、原創性與吸引力')
              )
            )
          : null,

        // ====================================================================
        // TAB 3: 排程與配額 (Schedule & Limits)
        // ====================================================================
        tab === 'schedule'
          ? h(
              'div',
              { className: 'ig-scr-panel' },
              h(
                'div',
                { className: 'ig-scr-section-head' },
                h('div', { className: 'ig-scr-section-title' }, '背景排程與安全風控配額'),
                h('div', { className: 'ig-scr-section-desc' }, '限制推坑頻率與留言次數，保護 IG 帳號安全並避免對主人造成疲勞轟炸。')
              ),

              h(
                'div',
                { className: 'ig-scr-switch' },
                h(
                  'div',
                  { className: 'ig-scr-switch-text' },
                  h('div', { className: 'ig-scr-switch-name' }, '啟用定時自動刷動態牆'),
                  h('div', { className: 'ig-scr-hint' }, '依照下方設定的週期在背景自動替主人刷貼文並推坑')
                ),
                h(
                  'button',
                  {
                    className: `ig-scr-toggle ${cfg.autoScrollEnabled ? 'on' : ''}`,
                    onClick: () => updateField('autoScrollEnabled', !cfg.autoScrollEnabled),
                  },
                  h('span', { className: 'ig-scr-toggle-thumb' })
                )
              ),

              h(
                'div',
                { className: 'ig-scr-switch' },
                h(
                  'div',
                  { className: 'ig-scr-switch-text' },
                  h('div', { className: 'ig-scr-switch-name' }, '推薦貼文時自動按讚'),
                  h('div', { className: 'ig-scr-hint' }, '替主人留言推坑的同時，自動在貼文留下愛心點讚')
                ),
                h(
                  'button',
                  {
                    className: `ig-scr-toggle ${cfg.likeOnRecommend ? 'on' : ''}`,
                    onClick: () => updateField('likeOnRecommend', !cfg.likeOnRecommend),
                  },
                  h('span', { className: 'ig-scr-toggle-thumb' })
                )
              ),

              h(
                'div',
                { className: 'ig-scr-grid-2' },
                h(
                  'div',
                  { className: 'ig-scr-field' },
                  h('label', { className: 'ig-scr-label' }, '巡查週期 (分鐘)'),
                  h('input', {
                    type: 'number',
                    className: 'ig-scr-input',
                    value: cfg.scrollIntervalMinutes ?? 60,
                    onChange: (e) => updateField('scrollIntervalMinutes', Number(e.target.value)),
                  }),
                  h('div', { className: 'ig-scr-hint' }, '背景自動執行的時間間隔')
                ),
                h(
                  'div',
                  { className: 'ig-scr-field' },
                  h('label', { className: 'ig-scr-label' }, '每日向主人推坑上限 (則)'),
                  h('input', {
                    type: 'number',
                    className: 'ig-scr-input',
                    value: cfg.dailyRecommendCap ?? 5,
                    onChange: (e) => updateField('dailyRecommendCap', Number(e.target.value)),
                  }),
                  h('div', { className: 'ig-scr-hint' }, '每日達到此推坑則數後自動停止留評 @主人')
                )
              ),

              h(
                'div',
                { className: 'ig-scr-grid-2' },
                h(
                  'div',
                  { className: 'ig-scr-field' },
                  h('label', { className: 'ig-scr-label' }, '最低推薦分數門檻 (0-100)'),
                  h('input', {
                    type: 'number',
                    className: 'ig-scr-input',
                    value: cfg.minScore ?? 75,
                    onChange: (e) => updateField('minScore', Number(e.target.value)),
                  }),
                  h('div', { className: 'ig-scr-hint' }, '高於此分數的貼文才會在留言區 @主人')
                ),
                h(
                  'div',
                  { className: 'ig-scr-field' },
                  h('label', { className: 'ig-scr-label' }, '每輪審閱抓取數量'),
                  h('input', {
                    type: 'number',
                    className: 'ig-scr-input',
                    value: cfg.batchSize ?? 15,
                    onChange: (e) => updateField('batchSize', Number(e.target.value)),
                  }),
                  h('div', { className: 'ig-scr-hint' }, '單次滾動審閱貼文筆數')
                )
              )
            )
          : null,

        // 底部儲存動作列
        h(
          'div',
          { className: 'ig-scr-footer' },
          h('div', { style: { fontSize: '11.5px', color: '#64748b' } }, '修改設定後請點擊儲存，新設定將即刻寫入配置檔並生效。'),
          h(
            'button',
            {
              className: 'ig-scr-btn primary',
              disabled: saving,
              onClick: save,
            },
            h(Icon.Save, { size: 14 }),
            saving ? '正在儲存...' : '儲存所有設定'
          )
        )
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        try {
          if (!document.querySelector('style[data-plugin-css="dsh-instagram-scroll"]')) {
            const style = document.createElement('style')
            style.setAttribute('data-plugin-css', 'dsh-instagram-scroll')
            style.textContent = CSS
            document.head.appendChild(style)
            if (typeof ctx?.effect === 'function') {
              ctx.effect(() => () => style.remove(), 'dsh-instagram-scroll: style')
            }
          }
        } catch (e) {}

        const slots = (typeof ctx.get === 'function' ? ctx.get('slots') : undefined) || ctx.slots
        if (!slots) return

        try {
          slots.inject('settings.section', () =>
            slots.register(
              {
                name: 'settings.section',
                id: 'instagram-scroll',
                order: 33,
                label: 'Instagram 滾動推坑',
              },
              () => h(ScrollPanel)
            )
          )
        } catch (e) {}

        try {
          slots.inject('settings.plugins.tab', () =>
            slots.register(
              {
                name: 'settings.plugins.tab',
                id: 'instagram-scroll',
                order: 33,
                label: 'Instagram 滾動推坑',
              },
              () => h(ScrollPanel)
            )
          )
        } catch (e) {}

        try {
          slots.inject('plugins.item', () =>
            slots.register(
              {
                name: 'plugins.item',
                id: 'instagram-scroll',
                order: 33,
                label: 'Instagram 滾動探索與推坑',
              },
              () => h(ScrollPanel)
            )
          )
        } catch (e) {}
      },
    }
  },
})
