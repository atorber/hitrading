window.__ModuleLoader__.load({
  id: '@atorber/hitrading',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useCallback, useRef } = React;

    const NS = 'hitrading';
    const PANEL_ID = 'hitrading';

    async function api(op, args = {}) {
      const res = await fetch('/api/hitrading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ op, args }),
      });
      let data;
      try { data = await res.json(); } catch { data = {}; }
      if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
      return data.value;
    }

    const fmt = (n) => (n == null ? '-' : n);

    const CSS = `
/* ===== HiTrading 控制台设计系统（专业终端风格）===== */
/* 骨架 */
.htx-page{box-sizing:border-box;width:100%;height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font-size:13px;line-height:1.6}
.htx-head{flex:none;display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:.5px solid var(--dsw-alias-border-l3)}
.htx-title{margin:0;font-size:15px;font-weight:650;line-height:22px;letter-spacing:.01em}
.htx-sub{color:var(--dsw-alias-label-tertiary);font-size:11.5px;line-height:18px}
.htx-body{flex:1;min-height:0;overflow:auto;padding:14px 16px 32px;position:relative;scrollbar-gutter:stable}

/* Tabs：工作区在左、参考在右（弱化 + 分隔线） */
.htx-tabs{flex:none;display:flex;align-items:center;gap:2px;padding:0 12px;border-bottom:.5px solid var(--dsw-alias-border-l3);overflow-x:auto;scrollbar-width:none}
.htx-tab{flex:none;padding:7px 12px;border:none;border-bottom:2px solid transparent;background:0 0;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12.5px;line-height:18px;cursor:pointer;white-space:nowrap;transition:color .12s}
.htx-tab:hover{color:var(--dsw-alias-label-primary)}
.htx-tab[aria-selected=true]{color:var(--dsw-alias-state-business-primary);border-bottom-color:var(--dsw-alias-state-business-primary);font-weight:600}
.htx-tabRef{color:var(--dsw-alias-label-tertiary);font-size:12px}
.htx-tabRef[aria-selected=true]{color:var(--dsw-alias-label-primary);border-bottom-color:var(--dsw-alias-border-l3);font-weight:600}
.htx-tabsRule{flex:none;width:1px;height:16px;margin:0 8px;background:var(--dsw-alias-border-l3)}
.htx-tabsGap{flex:1}

/* 工具栏：带字段标签的专业筛选器 */
.htx-toolbar{display:flex;flex-wrap:wrap;gap:10px 14px;align-items:flex-end;padding:10px 12px;margin-bottom:12px;border:1px solid var(--dsw-alias-border-l3);border-radius:12px;background:var(--dsw-specific-sidebar-fill)}
.htx-field{display:flex;flex-direction:column;gap:4px;min-width:0}
.htx-fieldLabel{font-size:10.5px;font-weight:600;letter-spacing:.05em;color:var(--dsw-alias-label-tertiary);line-height:14px;white-space:nowrap}
.htx-toolbarSep{align-self:stretch;width:1px;background:var(--dsw-alias-border-l3);margin:0 2px}
.htx-meta{margin-left:auto;font-size:11.5px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;align-self:center}
.htx-metaWarn{color:var(--dsw-alias-state-warn-primary);font-weight:600}
.htx-refresh{flex:none;display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border:1px solid var(--dsw-alias-border-l3);border-radius:7px;background:0 0;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:12.5px;line-height:1;padding:0;cursor:pointer;align-self:center}
.htx-refresh:hover{color:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-state-business-primary);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 6%,transparent)}
.htx-refreshIcon{display:inline-block;line-height:1}
.htx-refreshOn .htx-refreshIcon{animation:htxSpin .8s linear infinite}
@keyframes htxSpin{to{transform:rotate(360deg)}}
.htx-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}

/* 控件 */
.htx-input{box-sizing:border-box;height:30px;padding:0 10px;border:.5px solid var(--dsw-alias-border-l3);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;outline:none;transition:border-color .12s}
.htx-input:focus{border-color:var(--dsw-alias-state-business-primary)}
.htx-input::placeholder{color:var(--dsw-alias-label-caption)}
.htx-btn{height:30px;padding:0 14px;border:1px solid var(--dsw-alias-border-l3);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;cursor:pointer;transition:background-color .1s}
.htx-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.htx-btn:disabled{opacity:.45;cursor:default}
.htx-btnPrimary{border-color:transparent;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}
.htx-btnPrimary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}
.htx-btnDanger{color:var(--dsw-alias-state-error-primary)}
.htx-btnSm{height:24px;padding:0 9px;font-size:11.5px;border-radius:7px}
.htx-seg{display:inline-flex;border:.5px solid var(--dsw-alias-border-l3);border-radius:8px;overflow:hidden;background:var(--dsw-alias-bg-base)}
.htx-segBtn{height:28px;padding:0 13px;border:none;background:0 0;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer;white-space:nowrap}
.htx-segBtn+.htx-segBtn{border-left:.5px solid var(--dsw-alias-border-l3)}
.htx-segBtn[aria-pressed=true]{background:var(--dsw-alias-interactive-bg-active);color:var(--dsw-alias-label-primary);font-weight:600}

/* 表格：数字右对齐 + 等宽数字 */
.htx-table{width:100%;border-collapse:collapse;font-size:12px}
.htx-table th{position:sticky;top:0;background:var(--dsw-alias-bg-base);text-align:left;font-size:11px;font-weight:600;color:var(--dsw-alias-label-tertiary);padding:6px 8px;border-bottom:.5px solid var(--dsw-alias-border-l3);white-space:nowrap;z-index:1}
.htx-table td{padding:5px 8px;border-bottom:.5px solid var(--dsw-alias-border-l3);white-space:nowrap;font-variant-numeric:tabular-nums}
.htx-table tbody tr:hover td{background:var(--dsw-alias-interactive-bg-hover)}
.htx-num{text-align:right}
.htx-up{color:var(--dsw-alias-state-error-primary)}
.htx-down{color:var(--dsw-alias-state-success-primary)}

/* 指标条 */
.htx-metrics{display:grid;grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:8px;margin-bottom:12px}
.htx-metric{border:1px solid var(--dsw-alias-border-l3);border-radius:10px;padding:8px 11px}
.htx-metricLabel{color:var(--dsw-alias-label-tertiary);font-size:10.5px;font-weight:600;letter-spacing:.05em;margin:0 0 2px;line-height:14px}
.htx-metricValue{margin:0;font-size:15px;font-weight:650;font-variant-numeric:tabular-nums;line-height:22px}

/* 全局 toast */
.htx-toasts{position:absolute;top:8px;right:16px;z-index:30;display:flex;flex-direction:column;gap:6px;pointer-events:none;max-width:min(420px,80%)}
.htx-toast{padding:8px 12px;border-radius:10px;font-size:12px;line-height:1.5;border:1px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-elevated,var(--dsw-alias-bg-base));box-shadow:0 4px 16px rgba(0,0,0,.14)}
.htx-toast-ok{color:var(--dsw-alias-state-success-primary)}
.htx-toast-warn{color:var(--dsw-alias-state-warn-primary)}
.htx-toast-error{color:var(--dsw-alias-state-error-primary)}

/* 旧版行内 toast（过渡保留） */
.htx-toastInline{margin:0 0 12px;padding:8px 12px;border-radius:8px;font-size:12px;line-height:1.6;border:1px solid var(--dsw-alias-border-l3)}

/* 标签编辑器（chips + 候选 + 输入） */
.htx-tagEd{display:flex;flex-direction:column;gap:7px;width:286px;max-width:100%;box-sizing:border-box;overflow:visible}
/* 浮层模式：固定定位，脱离表格单元格，避免行高重排与裁切 */
.htx-tagEdBox{position:fixed;z-index:56;width:304px;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l3);border-radius:10px;padding:10px;background:var(--dsw-alias-bg-elevated,var(--dsw-alias-bg-base));box-shadow:0 16px 40px rgba(0,0,0,.22)}
.htx-tagPopMask{position:fixed;inset:0;z-index:55;background:0 0}
.htx-tagChip{display:inline-flex;align-items:center;gap:3px;height:19px;padding:0 3px 0 8px;border-radius:999px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-business-primary) 40%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 8%,transparent);color:var(--dsw-alias-state-business-primary);font-size:10.5px;line-height:1;cursor:pointer}
.htx-tagChip:hover{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 16%,transparent)}
.htx-tagChipX{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;border:none;border-radius:999px;background:0 0;color:inherit;font-size:11px;line-height:1;cursor:pointer;padding:0;opacity:.55}
.htx-tagChipX:hover{opacity:1;background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 25%,transparent)}
.htx-tagEdRow{display:flex;flex-wrap:wrap;gap:4px;align-items:center;min-height:24px}
.htx-tagSel{display:inline-flex;align-items:center;gap:4px;height:20px;padding:0 4px 0 8px;border-radius:999px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-business-primary) 40%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 10%,transparent);color:var(--dsw-alias-state-business-primary);font-size:10.5px;line-height:1}
.htx-tagSelX{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;border:none;border-radius:999px;background:0 0;color:inherit;font-size:11px;line-height:1;cursor:pointer;padding:0}
.htx-tagSelX:hover{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 25%,transparent)}
.htx-tagEdInput{box-sizing:border-box;flex:1;min-width:110px;height:24px;padding:0 6px;border:.5px solid var(--dsw-alias-border-l3);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:11.5px;outline:none}
.htx-tagEdInput:focus{border-color:var(--dsw-alias-state-business-primary)}
.htx-tagEdCands{display:flex;flex-wrap:wrap;gap:4px;align-items:center;min-width:0}
.htx-tagEdCandsLabel{font-size:10px;color:var(--dsw-alias-label-tertiary);margin-right:2px;flex:none}
/* 已有标签候选：自适应宽度的胶囊（不是圆形按钮），避免文字溢出重叠 */
.htx-tagCand{display:inline-flex;align-items:center;height:19px;max-width:100%;padding:0 8px;box-sizing:border-box;border:1px dashed var(--dsw-alias-border-l3);border-radius:999px;background:0 0;color:var(--dsw-alias-label-secondary);font-family:inherit;font-size:10.5px;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;flex:0 1 auto;min-width:0}
.htx-tagCand:hover{color:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-state-business-primary);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 8%,transparent)}
.htx-tagEdBtns{display:flex;gap:6px;justify-content:flex-end}

/* 表头列筛选（多选菜单） */
.htx-thCell{display:inline-flex;align-items:center;gap:5px}
.htx-thFilter{position:relative;display:inline-flex}
.htx-filterBtn{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border:1px solid transparent;border-radius:5px;background:0 0;color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:1;cursor:pointer;padding:0}
.htx-filterBtn:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l3)}
.htx-filterOn{color:var(--dsw-alias-state-business-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-business-primary) 50%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 12%,transparent)}
.htx-filterMenu{position:absolute;top:calc(100% + 4px);left:0;z-index:50;min-width:170px;max-width:260px;max-height:300px;overflow:auto;border:1px solid var(--dsw-alias-border-l3);border-radius:10px;background:var(--dsw-alias-bg-elevated,var(--dsw-alias-bg-base));box-shadow:0 10px 28px rgba(0,0,0,.18);padding:4px}
.htx-filterBar{display:flex;gap:6px;align-items:center;padding:4px 6px 8px;border-bottom:.5px solid var(--dsw-alias-border-l3);margin-bottom:4px}
.htx-filterCount{font-size:10.5px;color:var(--dsw-alias-label-tertiary);margin-left:auto}
.htx-filterItem{display:flex;gap:8px;align-items:center;padding:5px 8px;border-radius:7px;font-size:12px;cursor:pointer;color:var(--dsw-alias-label-primary)}
.htx-filterItem:hover{background:var(--dsw-alias-interactive-bg-hover)}
.htx-filterItem input{accent-color:var(--dsw-alias-state-business-primary)}
.htx-filterItemLabel{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* 可排序表头 */
.htx-thBtn{display:inline-flex;align-items:center;gap:3px;border:none;background:0 0;padding:0;font:inherit;font-size:11px;font-weight:600;color:inherit;cursor:pointer;white-space:nowrap}
.htx-thBtn:hover{color:var(--dsw-alias-label-primary)}
.htx-thArrow{font-size:9px;line-height:1;color:var(--dsw-alias-label-tertiary)}
.htx-thArrowOn{color:var(--dsw-alias-state-business-primary)}

/* 搜索建议下拉 */
.htx-sugWrap{position:relative;display:flex;flex-direction:column}
.htx-sug{position:absolute;top:calc(100% + 4px);left:0;z-index:40;min-width:300px;max-width:380px;max-height:288px;overflow:auto;border:1px solid var(--dsw-alias-border-l3);border-radius:10px;background:var(--dsw-alias-bg-elevated,var(--dsw-alias-bg-base));box-shadow:0 10px 28px rgba(0,0,0,.18);padding:4px}
.htx-sugItem{display:flex;align-items:center;gap:10px;width:100%;padding:6px 10px;border:none;border-radius:8px;background:0 0;font:inherit;font-size:12px;line-height:1.5;text-align:left;cursor:pointer;color:var(--dsw-alias-label-primary)}
.htx-sugItem:hover,.htx-sugOn{background:var(--dsw-alias-interactive-bg-hover)}
.htx-sugCode{font-weight:650;font-variant-numeric:tabular-nums;color:var(--dsw-alias-state-business-primary);min-width:52px}
.htx-sugName{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.htx-sugBadge{flex:none;font-size:10px;line-height:1;padding:2px 7px;color:var(--dsw-alias-label-tertiary);border:1px solid var(--dsw-alias-border-l3);border-radius:999px}
.htx-sugMeta{flex:none;font-size:10.5px;color:var(--dsw-alias-label-tertiary)}

/* 标签 chip */
.htx-tags{display:flex;flex-wrap:wrap;gap:4px;max-width:230px}
.htx-tag{display:inline-flex;align-items:center;height:18px;padding:0 8px;border-radius:999px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-business-primary) 40%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 8%,transparent);color:var(--dsw-alias-state-business-primary);font-size:10.5px;line-height:1;white-space:nowrap;cursor:pointer}
.htx-tag:hover{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 16%,transparent)}
.htx-tagOn{border-color:var(--dsw-alias-state-business-primary);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 18%,transparent)}
.htx-tagAdd{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;padding:0;border:1px dashed var(--dsw-alias-border-l3);border-radius:999px;background:0 0;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1;cursor:pointer}
.htx-tagAdd:hover{color:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-state-business-primary)}
.htx-tagCloud{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 12px}
.htx-tagCloudLabel{color:var(--dsw-alias-label-tertiary);font-size:11px;font-weight:600;letter-spacing:.05em}
.htx-chipRow{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 12px}

/* 状态反馈 */
.htx-empty{padding:36px 20px;text-align:center;color:var(--dsw-alias-label-tertiary)}
.htx-emptyTitle{margin:0;font-size:13px;font-weight:500;color:var(--dsw-alias-label-secondary)}
.htx-emptyHint{margin:4px 0 0;font-size:12px;line-height:19px}
.htx-error{color:var(--dsw-alias-state-error-primary);font-size:12.5px;margin:8px 0}
.htx-callout{border:1px solid var(--dsw-alias-border-l3);border-left:3px solid var(--dsw-alias-state-warn-primary);border-radius:10px;padding:10px 14px;font-size:12px;color:var(--dsw-alias-label-secondary)}

/* 卡片与详情 */
.htx-card{border:1px solid var(--dsw-alias-border-l3);border-radius:12px;padding:14px 16px;margin-bottom:12px;background:var(--dsw-alias-bg-base)}
.htx-cardTitle{margin:0 0 10px;font-size:13.5px;font-weight:650}

/* 量能：状态徽标 + 图注 */
.htx-badge{display:inline-flex;align-items:center;height:19px;padding:0 8px;border-radius:999px;font-size:10.5px;line-height:1;font-weight:600;letter-spacing:.02em;border:1px solid transparent;white-space:nowrap}
.htx-badgeUp{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 45%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,transparent)}
.htx-badgeDown{color:var(--dsw-alias-state-success-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 45%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 10%,transparent)}
.htx-badgeFlat{color:var(--dsw-alias-label-secondary);border-color:var(--dsw-alias-border-l3);background:var(--dsw-specific-sidebar-fill)}
.htx-chartNote{margin:6px 0 0;font-size:11px;line-height:1.7;color:var(--dsw-alias-label-tertiary)}
.htx-chartNote b{font-weight:600;color:var(--dsw-alias-label-secondary)}
.htx-inlineUp{color:var(--dsw-alias-state-error-primary)}
.htx-inlineDown{color:var(--dsw-alias-state-success-primary)}

/* 强势股：左侧日期导航 + 右侧内容 */
.htx-dateNav{flex:none;width:168px;box-sizing:border-box;display:flex;flex-direction:column;gap:4px;padding:8px;border:1px solid var(--dsw-alias-border-l3);border-radius:12px;background:var(--dsw-specific-sidebar-fill);align-self:flex-start}
.htx-dateNavBtn{display:flex;align-items:center;gap:6px;width:100%;box-sizing:border-box;padding:7px 10px;border:1px solid transparent;border-radius:9px;background:0 0;font:inherit;font-size:12px;color:var(--dsw-alias-label-secondary);cursor:pointer;text-align:left;white-space:nowrap}
.htx-dateNavBtn:hover{background:var(--dsw-alias-interactive-bg-hover)}
.htx-dateNavOn{border-color:color-mix(in srgb,var(--dsw-alias-state-business-primary) 45%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 10%,transparent);color:var(--dsw-alias-state-business-primary);font-weight:650}
.htx-dateNavDate{font-variant-numeric:tabular-nums}
.htx-dateNavWk{font-size:10.5px;color:var(--dsw-alias-label-tertiary)}
.htx-dateNavOn .htx-dateNavWk{color:inherit;opacity:.75}
.htx-dateNavCnt{margin-left:auto;font-size:10.5px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-tertiary)}
.htx-dateNavOn .htx-dateNavCnt{color:inherit}
.htx-dateNavHint{padding:6px 4px 2px;font-size:10.5px;line-height:1.6;color:var(--dsw-alias-label-tertiary);border-top:.5px solid var(--dsw-alias-border-l3);margin-top:2px}
.htx-split{display:flex;gap:12px;min-height:0;align-items:flex-start}
.htx-kv{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.htx-kvItem{font-size:12.5px}
.htx-kvItem b{color:var(--dsw-alias-label-secondary);font-weight:500}

/* 列表（资讯） */
/* 资讯页重构：时间轴 / 分类 chips / 龙虎榜图 */
.htx-tl{position:relative;list-style:none;margin:0;padding:0 0 0 74px}
.htx-tl:before{content:"";position:absolute;inset-block:6px;left:62px;width:1px;background:var(--dsw-alias-border-l3)}
.htx-tl>li{position:relative;padding:5px 0 12px}
.htx-tlTime{position:absolute;left:-74px;top:6px;width:52px;text-align:right;font-size:11px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-tertiary);line-height:1.5}
.htx-tlDot{position:absolute;left:-15.5px;top:11px;width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-border-l3);box-shadow:0 0 0 2px var(--dsw-alias-bg-base)}
.htx-tl>li.reg .htx-tlDot{background:var(--dsw-alias-state-error-primary)}
.htx-tl>li.macro .htx-tlDot{background:var(--dsw-alias-state-business-primary)}
.htx-tl>li.mkt .htx-tlDot{background:var(--dsw-alias-state-warn-primary)}
.htx-tlTitle{font-size:12.5px;font-weight:600;color:var(--dsw-alias-label-primary);line-height:1.55;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.htx-tlSum{font-size:11.5px;color:var(--dsw-alias-label-tertiary);line-height:1.6;margin-top:2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.htx-tlDate{margin:10px 0 4px;font-size:11px;font-weight:600;color:var(--dsw-alias-label-tertiary);letter-spacing:.04em}
.htx-tl>li:first-child .htx-tlDate{margin-top:0}
.htx-watchToggle{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border:1px solid var(--dsw-alias-border-l3);border-radius:8px;background:var(--dsw-alias-bg-base);font:inherit;font-size:12px;color:var(--dsw-alias-label-secondary);cursor:pointer;user-select:none;white-space:nowrap}
.htx-watchToggle:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-tertiary)}
.htx-watchToggle:has(input:checked){border-color:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-state-business-primary);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 8%,transparent);font-weight:600}
.htx-watchToggle input{accent-color:var(--dsw-alias-state-business-primary);margin:0;cursor:pointer}
.htx-catChips{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 12px}
.htx-catChip{display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 9px;border-radius:999px;border:1px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-base);font:inherit;font-size:11.5px;color:var(--dsw-alias-label-secondary);cursor:pointer;line-height:1}
.htx-catChip:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-tertiary)}
.htx-catChip[aria-pressed=true]{border-color:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-state-business-primary);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 8%,transparent);font-weight:600}
.htx-catChip b{font-weight:650;font-variant-numeric:tabular-nums}
.htx-tag{display:inline-flex;align-items:center;height:16px;padding:0 6px;border-radius:5px;font-size:10px;font-weight:600;line-height:1;white-space:nowrap}
.htx-tagReg{color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,transparent)}
.htx-tagMacro{color:var(--dsw-alias-state-business-primary);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 10%,transparent)}
.htx-tagMkt{color:var(--dsw-alias-state-warn-primary);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 12%,transparent)}
.htx-tagOther{color:var(--dsw-alias-label-tertiary);background:var(--dsw-specific-sidebar-fill)}
.htx-sumCard{border:1px solid var(--dsw-alias-border-l3);border-inline-start:3px solid var(--dsw-alias-state-business-primary);border-radius:10px;padding:10px 14px;font-size:12px;line-height:1.7;color:var(--dsw-alias-label-secondary);margin-bottom:12px;background:var(--dsw-alias-bg-base)}
.htx-sumCard b{color:var(--dsw-alias-label-primary);font-weight:650}
.htx-sumCard .htx-up,.htx-sumCard .htx-down{font-weight:650}
.htx-lhbChart{display:flex;flex-direction:column;gap:7px;margin:2px 0 4px}
.htx-lhbRow{display:grid;grid-template-columns:76px 1fr 76px;gap:10px;align-items:center;cursor:pointer;border-radius:8px;padding:2px 4px}
.htx-lhbRow:hover{background:var(--dsw-alias-interactive-bg-hover)}
.htx-lhbName{font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.htx-lhbTrack{position:relative;height:14px;border-radius:4px;background:var(--dsw-specific-sidebar-fill)}
.htx-lhbTrack:before{content:"";position:absolute;left:50%;top:-2px;bottom:-2px;width:1px;background:var(--dsw-alias-border-l3)}
.htx-lhbBar{position:absolute;top:1px;bottom:1px;border-radius:3px;min-width:2px}
.htx-lhbBar.buy{left:50%;background:linear-gradient(90deg,color-mix(in srgb,var(--dsw-alias-state-error-primary) 55%,transparent),var(--dsw-alias-state-error-primary))}
.htx-lhbBar.sell{right:50%;background:linear-gradient(270deg,color-mix(in srgb,var(--dsw-alias-state-success-primary) 55%,transparent),var(--dsw-alias-state-success-primary))}
.htx-lhbAmt{font-size:11.5px;font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}
.htx-reasonChips{display:flex;flex-wrap:wrap;gap:4px;margin-top:2px}
.htx-reasonChip{font-size:10.5px;line-height:1.5;color:var(--dsw-alias-label-tertiary);background:var(--dsw-specific-sidebar-fill);border:1px solid var(--dsw-alias-border-l3);border-radius:5px;padding:1px 6px}
.htx-list{list-style:none;margin:0;padding:0}
.htx-list li{padding:8px 4px;border-bottom:.5px solid var(--dsw-alias-border-l3);font-size:12.5px;line-height:1.7}
.htx-listDate{color:var(--dsw-alias-label-tertiary);margin-right:8px;font-variant-numeric:tabular-nums}

/* 服务状态栏 */
.htx-svc{margin-left:auto;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.htx-dot{width:7px;height:7px;border-radius:50%;flex:none;background:var(--dsw-alias-label-caption)}
.htx-dot-up{background:var(--dsw-alias-state-success-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-state-success-primary) 22%,transparent)}
.htx-dot-down{background:var(--dsw-alias-state-error-primary)}
.htx-dot-unknown{background:var(--dsw-alias-label-caption)}
.htx-svcLabel{font-size:11.5px;color:var(--dsw-alias-label-secondary);white-space:nowrap}
.htx-svcMsg{font-size:11px;color:var(--dsw-alias-state-business-primary);white-space:nowrap}
.htx-svcBtns{display:flex;gap:4px}
.htx-svcBtn{height:24px;padding:0 8px;border:1px solid var(--dsw-alias-border-l3);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;cursor:pointer;white-space:nowrap}
.htx-svcBtn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.htx-svcBtn:disabled{opacity:.4;cursor:default}
.htx-tierSel{height:24px;padding:0 4px;font-size:11.5px;min-width:78px;border-radius:7px}

/* API / 文档 */
.htx-api{display:flex;flex-direction:column;gap:18px;max-width:900px}
.htx-apiH2{margin:0;font-size:13px;font-weight:650;border-bottom:.5px solid var(--dsw-alias-border-l3);padding-bottom:6px}
.htx-apiBlock{font-size:12.5px;line-height:1.75;color:var(--dsw-alias-label-secondary)}
.htx-apiBlock p{margin:4px 0}
.htx-code{margin:0;padding:11px 13px;border:1px solid var(--dsw-alias-border-l3);border-radius:10px;background:var(--dsw-specific-sidebar-fill);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11.5px;line-height:1.7;overflow:auto;white-space:pre;color:var(--dsw-alias-label-primary)}
.htx-inline{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11.5px;background:var(--dsw-alias-interactive-bg-hover);padding:1px 5px;border-radius:4px;color:var(--dsw-alias-state-business-primary)}
.htx-apiTable{width:100%;border-collapse:collapse;font-size:12px}
.htx-apiTable th{text-align:left;font-weight:600;color:var(--dsw-alias-label-tertiary);padding:6px 8px;border-bottom:.5px solid var(--dsw-alias-border-l3);white-space:nowrap;font-size:11px}
.htx-apiTable td{padding:6px 8px;border-bottom:.5px solid var(--dsw-alias-border-l3);vertical-align:top;line-height:1.6}
.htx-apiCard{border:1px solid var(--dsw-alias-border-l3);border-radius:10px;padding:13px 15px;display:flex;flex-direction:column;gap:8px}
.htx-apiOp{margin:0;font-size:12.5px;font-weight:600;display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
.htx-apiDesc{color:var(--dsw-alias-label-tertiary);font-size:11.5px;font-weight:400}
.htx-apiLabel{margin:4px 0 0;font-size:10.5px;font-weight:600;letter-spacing:.05em;color:var(--dsw-alias-label-tertiary)}
.htx-docHead{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.htx-skillDoc{max-height:440px}

/* Agent 技能 */
.htx-skillIntro{border:1px solid var(--dsw-alias-border-l3);border-left:3px solid var(--dsw-alias-state-business-primary);border-radius:10px;padding:10px 14px;font-size:12px;color:var(--dsw-alias-label-secondary);margin-bottom:14px;line-height:1.7}
.htx-skillGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}
.htx-skillCard{border:1px solid var(--dsw-alias-border-l3);border-radius:10px;padding:12px 13px;display:flex;flex-direction:column;gap:7px}
.htx-skillName{margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11.5px;font-weight:600;color:var(--dsw-alias-state-business-primary)}
.htx-skillDesc{margin:0;font-size:12px;color:var(--dsw-alias-label-secondary)}
.htx-prompt{margin:0;padding:6px 9px;border-radius:8px;background:var(--dsw-specific-sidebar-fill);font-size:12px;color:var(--dsw-alias-label-primary);display:flex;gap:8px;align-items:flex-start;justify-content:space-between;line-height:1.6}
.htx-copy{flex:none;border:none;background:0 0;color:var(--dsw-alias-state-business-primary);font:inherit;font-size:11px;cursor:pointer;padding:0;white-space:nowrap}
.htx-copy:hover{text-decoration:underline}

@media (prefers-reduced-motion:reduce){.htx-tab,.htx-btn,.htx-input{transition:none}}
`;

    function Spinner() { return h('div', { className: 'htx-empty' }, '加载中…'); }
    function ErrorBox({ error }) { return error ? h('div', { className: 'htx-error' }, String(error)) : null; }
    function Empty({ text }) { return h('div', { className: 'htx-empty' }, text); }
    /** 手动刷新小按钮：拉取中图标旋转。 */
    function RefreshBtn({ onClick, busy = false, label = '立即刷新' }) {
      return h('button', {
        type: 'button', className: 'htx-refresh' + (busy ? ' htx-refreshOn' : ''),
        title: label, 'aria-label': label,
        onClick,
      }, h('span', { className: 'htx-refreshIcon', 'aria-hidden': 'true' }, '⟳'));
    }
    // ---------- 全局 toast（事件总线，Console 层统一渲染） ----------
    const toastBus = { listeners: [] };
    const notify = (kind, text) => { toastBus.listeners.forEach((f) => f({ kind, text })); };
    const notifyOk = (t) => notify('ok', t);
    const notifyWarn = (t) => notify('warn', t);
    const notifyError = (t) => notify('error', t);

    function ToastHost() {
      const [items, setItems] = useState([]);
      useEffect(() => {
        const on = (m) => {
          const id = Date.now() + Math.random();
          setItems((cur) => [...cur.slice(-4), { ...m, id }]);
          window.setTimeout(() => setItems((cur) => cur.filter((i) => i.id !== id)), 3200);
        };
        toastBus.listeners.push(on);
        return () => { toastBus.listeners = toastBus.listeners.filter((f) => f !== on); };
      }, []);
      if (!items.length) return null;
      return h('div', { className: 'htx-toasts' },
        items.map((i) => h('div', { key: i.id, className: `htx-toast htx-toast-${i.kind}` }, i.text)));
    }

    // ---------- 工具栏原语 ----------
    /** 字段：标签在上、控件在下（专业筛选器布局）。 */
    function Field({ label, children }) {
      return h('div', { className: 'htx-field' }, label ? h('span', { className: 'htx-fieldLabel' }, label) : null, children);
    }
    /** 分段控件。 */
    function Seg({ options, value, onChange, ariaLabel }) {
      return h('div', { className: 'htx-seg', role: 'group', 'aria-label': ariaLabel },
        options.map((o) => h('button', {
          key: o.value, type: 'button', className: 'htx-segBtn', 'aria-pressed': value === o.value,
          onClick: () => onChange(o.value),
        }, o.label)));
    }

    /**
     * 标签编辑器：已选 chips（×移除）+ 已有标签候选（点击添加）+ 输入新标签（回车/逗号确认）。
     * 约束与后端一致：单个≤12字、每只≤10个、自动去重。
     * props: value(数组)、onChange(数组)、allTags(已有标签候选)、onDone/onCancel(可选，浮层模式)。
     */
    function TagEditor({ value, onChange, allTags = [], onDone, onCancel, boxed = false, style = null }) {
      const [draft, setDraft] = useState('');
      const inputRef = useRef(null);
      useEffect(() => { inputRef.current && inputRef.current.focus(); }, []);
      const tags = Array.isArray(value) ? value : [];
      const add = (raw) => {
        const parts = String(raw || '').split(/[,，;；、\s]+/).map((t) => t.trim().slice(0, 12)).filter(Boolean);
        const next = [...tags];
        for (const p of parts) if (!next.includes(p) && next.length < 10) next.push(p);
        onChange(next);
        setDraft('');
      };
      const remove = (t) => onChange(tags.filter((x) => x !== t));
      const candidates = allTags.filter((t) => !tags.includes(t)).slice(0, 8);
      return h('div', { className: 'htx-tagEd' + (boxed ? ' htx-tagEdBox' : ''), style: style || undefined },
        h('div', { className: 'htx-tagEdRow' },
          tags.map((t) => h('span', { key: t, className: 'htx-tagSel' }, t,
            h('button', { type: 'button', className: 'htx-tagSelX', 'aria-label': `移除标签 ${t}`, onClick: () => remove(t) }, '×'))),
          h('input', {
            ref: inputRef, className: 'htx-tagEdInput', value: draft,
            placeholder: tags.length ? '输入新标签' : '输入标签，回车添加',
            onChange: (e) => setDraft(e.target.value),
            onKeyDown: (e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (draft.trim()) add(draft);
                else if (onDone) onDone();   // 空输入回车 = 完成
              }
              if (e.key === 'Escape') { e.preventDefault(); onCancel ? onCancel() : setDraft(''); }
              if (e.key === 'Backspace' && !draft && tags.length) remove(tags[tags.length - 1]);
            },
          })),
        candidates.length ? h('div', { className: 'htx-tagEdCands' },
          h('span', { className: 'htx-tagEdCandsLabel' }, '已有'),
          candidates.map((t) => h('button', {
            key: t, type: 'button', className: 'htx-tagCand',
            title: '添加该标签',
            onMouseDown: (e) => e.preventDefault(),  // 防止 input blur
            onClick: () => add(t),
          }, '＋ ' + t))) : null,
        onDone ? h('div', { className: 'htx-tagEdBtns' },
          onCancel ? h('button', { type: 'button', className: 'htx-btn htx-btnSm', onClick: onCancel }, '取消') : null,
          h('button', { type: 'button', className: 'htx-btn htx-btnSm htx-btnPrimary', onClick: onDone }, '完成')) : null,
      );
    }

    /**
     * 表头列筛选：多选菜单，勾选即时生效，点击外部关闭。
     * selected=null 表示不过滤（全选）；勾满全部自动回到 null。
     * options: [{value, label, count?}]
     */
    function ColFilter({ options, selected, onChange, ariaLabel }) {
      const [open, setOpen] = useState(false);
      const boxRef = useRef(null);
      useEffect(() => {
        if (!open) return undefined;
        const onDoc = (e) => {
          if (boxRef.current && e && e.target && typeof boxRef.current.contains === 'function'
            && !boxRef.current.contains(e.target)) setOpen(false);
        };
        window.addEventListener('mousedown', onDoc);
        return () => window.removeEventListener('mousedown', onDoc);
      }, [open]);
      const allValues = options.map((o) => o.value);
      const active = selected != null;
      const checkedSet = new Set(selected == null ? allValues : selected);
      const toggle = (v) => {
        if (selected == null) onChange(allValues.filter((x) => x !== v));
        else {
          const next = selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v];
          onChange(next.length === allValues.length ? null : next);
        }
      };
      return h('span', { className: 'htx-thFilter', ref: boxRef },
        h('button', {
          type: 'button', className: 'htx-filterBtn' + (active ? ' htx-filterOn' : ''),
          'aria-label': `筛选${ariaLabel || ''}`, 'aria-expanded': open,
          title: active ? `已筛选 ${selected.length}/${allValues.length}（点击修改）` : '筛选（多选）',
          onClick: () => setOpen((o) => !o),
        }, '▾'),
        open ? h('div', { className: 'htx-filterMenu', role: 'menu' },
          h('div', { className: 'htx-filterBar' },
            h('button', { type: 'button', className: 'htx-btn htx-btnSm', onClick: () => onChange(null) }, '全选'),
            h('button', { type: 'button', className: 'htx-btn htx-btnSm', onClick: () => onChange([]) }, '清空'),
            h('span', { className: 'htx-filterCount' }, active ? `${selected.length}/${allValues.length}` : `全部 ${allValues.length}`)),
          options.map((o) => h('label', { key: o.value, className: 'htx-filterItem' },
            h('input', { type: 'checkbox', checked: checkedSet.has(o.value), onChange: () => toggle(o.value) }),
            h('span', { className: 'htx-filterItemLabel' }, o.label),
            o.count != null ? h('span', { className: 'htx-filterCount' }, String(o.count)) : null))) : null);
    }


    function useData(fn, deps, { refreshMs = 0 } = {}) {
      const [state, setState] = useState({ loading: true, refreshing: false, value: null, error: null, updatedAt: null });
      const [tick, setTick] = useState(0);
      const reload = useCallback(() => setTick((t) => t + 1), []);
      const prevDeps = useRef(null);
      // eslint-disable-next-line react-hooks/exhaustive-deps
      useEffect(() => {
        // 查询条件未变（仅定时/手动 reload）且已有数据 ⇒ 静默刷新：
        // 不进 loading、不重挂内容，数据到达后原位替换，UI（滚动/浮层/筛选/输入框）不受打扰。
        const sameQuery = !!(prevDeps.current && prevDeps.current.length === deps.length
          && prevDeps.current.every((d, i) => Object.is(d, deps[i])));
        prevDeps.current = deps;
        let alive = true;
        setState((s) => (sameQuery && s.value
          ? { ...s, refreshing: true, error: null }
          : { ...s, loading: true, refreshing: false, error: null }));
        fn().then((value) => { if (alive) setState({ loading: false, refreshing: false, value, error: null, updatedAt: Date.now() }); })
          .catch((error) => {
            if (!alive) return;
            const msg = error.message || String(error);
            // 刷新失败：旧数据继续展示，仅记录错误供轻提示；首次加载失败才置空
            setState((s) => (s.value
              ? { ...s, loading: false, refreshing: false, error: msg }
              : { loading: false, refreshing: false, value: null, error: msg, updatedAt: null }));
          });
        return () => { alive = false; };
      }, [...deps, tick]);
      useEffect(() => {
        if (!refreshMs) return;
        const t = window.setInterval(reload, refreshMs);
        return () => window.clearInterval(t);
      }, [refreshMs, reload]);
      return { ...state, reload };
    }

    /**
     * 通用数据表：支持列对齐与表头排序。
     * 排序列在列定义上给 sortable:true + sortValue(r)（返回数值或 null，null 沉底）；
     * 组件不持有排序状态，由父组件传入 sort={key,dir} 与 onSortChange(key)（三态：desc → asc → 取消）。
     */
    function DataTable({ columns, rows, getKey, sort, onSortChange }) {
      const th = (c) => {
        const sortable = !!(c.sortable && c.sortValue && onSortChange);
        const isSorted = sortable && sort && sort.key === c.label && sort.dir;
        const ariaSort = sortable ? (isSorted ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none') : undefined;
        const arrow = isSorted ? (sort.dir === 'asc' ? '↑' : '↓') : '⇅';
        const label = sortable
          ? h('button', {
              type: 'button', className: 'htx-thBtn', onClick: () => onSortChange(c.label),
              'aria-label': `按 ${c.label} 排序`,
            },
              c.label,
              h('span', { className: 'htx-thArrow' + (isSorted ? ' htx-thArrowOn' : ''), 'aria-hidden': true }, arrow))
          : c.label;
        return h('th', {
          key: c.label,
          className: c.align === 'right' ? 'htx-num' : (c.headerClass || undefined),
          title: c.headerTitle,
          'aria-sort': ariaSort,
        },
          c.filter ? h('span', { className: 'htx-thCell' }, label, h(ColFilter, { ...c.filter, ariaLabel: c.label })) : label);
      };
      return h('table', { className: 'htx-table' },
        h('thead', null, h('tr', null, columns.map(th))),
        h('tbody', null, rows.map((r, i) =>
          h('tr', { key: getKey ? getKey(r) : i },
            columns.map((c, j) => {
              const cell = c.render ? c.render(r) : fmt(r[c.key]);
              const num = c.align === 'right' ? ' htx-num' : '';
              return h('td', { key: j, className: (c.className ? c.className(r) : '') + num || undefined }, cell);
            })))));
    }

    function CandleChart({ bars, height = 220 }) {
      if (!bars || bars.length === 0) return null;
      const W = 720;
      const H = height;
      const pad = 8;
      const lo = Math.min(...bars.map((b) => b.low));
      const hi = Math.max(...bars.map((b) => b.high));
      const range = hi - lo || 1;
      const step = (W - pad * 2) / bars.length;
      const bw = Math.max(1.5, step * 0.6);
      const y = (p) => pad + (hi - p) / range * (H - pad * 2);
      const candles = bars.map((b, i) => {
        const x = pad + i * step + step / 2;
        const up = b.close >= b.open;
        const color = up ? '#e63946' : '#2a9d8f';
        const top = y(Math.max(b.open, b.close));
        const bottom = y(Math.min(b.open, b.close));
        return h('g', { key: i },
          h('line', { x1: x, y1: y(b.high), x2: x, y2: y(b.low), stroke: color, strokeWidth: 1 }),
          h('rect', { x: x - bw / 2, y: top, width: bw, height: Math.max(1, bottom - top), fill: color }));
      });
      return h('svg', { viewBox: `0 0 ${W} ${H}`, style: { width: '100%', height: 'auto', display: 'block' }, 'aria-hidden': true },
        h('g', null, candles));
    }

    function CurveChart({ values, height = 160, color = '#2f6fed', baseline }) {
      if (!values || values.length < 2) return null;
      const W = 720;
      const H = height;
      const pad = 8;
      const lo = baseline != null ? Math.min(baseline, ...values) : Math.min(...values);
      const hi = baseline != null ? Math.max(baseline, ...values) : Math.max(...values);
      const range = hi - lo || 1;
      const step = (W - pad * 2) / (values.length - 1);
      const y = (p) => pad + (hi - p) / range * (H - pad * 2);
      const pts = values.map((p, i) => `${pad + i * step},${y(p)}`).join(' ');
      const elems = [h('polyline', { key: 'line', points: pts, fill: 'none', stroke: color, strokeWidth: 1.6 })];
      if (baseline != null) elems.push(h('line', { key: 'base', x1: 0, y1: y(baseline), x2: W, y2: y(baseline), stroke: 'var(--dsw-alias-border-l3)', strokeWidth: 1 }));
      return h('svg', { viewBox: `0 0 ${W} ${H}`, style: { width: '100%', height: 'auto', display: 'block' }, 'aria-hidden': true }, h('g', null, elems));
    }

    // ---------- 行情/自选 ----------
    const TIER_OPTIONS = [
      { value: 'basic', label: '基础股' },
      { value: 'selected', label: '精选股' },
      { value: 'trading', label: '交易股' },
    ];
    const tierLabel = (v) => (TIER_OPTIONS.find((t) => t.value === v) || TIER_OPTIONS[0]).label;
    /** 领域分类（单选，''=未分类）。 */
    const DOMAIN_OPTIONS = [
      { value: 'finance', label: '大金融' },
      { value: 'consumer', label: '消费' },
      { value: 'cyclical', label: '周期' },
      { value: 'tech', label: '科技' },
    ];
    const domainLabel = (v) => (DOMAIN_OPTIONS.find((d) => d.value === v) || {}).label || '未分类';

    /** 从用户输入提取 6 位代码：支持逗号/空格/换行分隔，批量粘贴。 */
    const parseSymbols = (raw) => {
      const parts = String(raw || '').split(/[\s,，;；、]+/).filter(Boolean);
      const codes = [];
      for (const p of parts) {
        const m = String(p).match(/\d{6}/);
        if (m) codes.push(m[0]);
      }
      return [...new Set(codes)];
    };

    /** 把用户输入切成标签数组（逗号/空格分隔）。 */
    const parseTags = (raw) => String(raw || '').split(/[,，;；、\s]+/).map((t) => t.trim()).filter(Boolean);
    function MarketView() {
      const [symbol, setSymbol] = useState('');
      const [newTier, setNewTier] = useState('basic');
      const [newDomain, setNewDomain] = useState('');   // 添加时的领域分类（''=未分类）
      const [newTagList, setNewTagList] = useState([]);   // 添加时的新标签（数组）
      const [tierSel, setTierSel] = useState(null);   // null=不过滤；数组=命中的 tier（多选）
      const [domainSel, setDomainSel] = useState(null); // null=不过滤；数组=命中的领域（多选）
      const [tagSel, setTagSel] = useState(null);       // null=不过滤；数组=任一命中的标签（多选 OR）
      const [detail, setDetail] = useState(null);
      const [busy, setBusy] = useState(false);
      const [editing, setEditing] = useState(null);
      const [editTags, setEditTags] = useState([]);       // 行内编辑中的标签（数组）
      const [editPos, setEditPos] = useState(null);       // 浮层坐标 {top,left}
      const inputRef = useRef(null);
      const [sug, setSug] = useState([]);
      const [sugIdx, setSugIdx] = useState(0);
      const [sort, setSort] = useState({ key: null, dir: null });
      const sugSeq = useRef(0);
      const sugTimer = useRef(0);
      const list = useData(() => api('watchlist.list'), [], { refreshMs: 15000 });

      useEffect(() => { inputRef.current && inputRef.current.focus(); }, []);

      // 浮层是固定定位：页面滚动/缩放时直接关闭，避免浮层与锚点脱位
      useEffect(() => {
        if (!editing) return undefined;
        const close = () => { setEditing(null); setEditPos(null); };
        window.addEventListener('scroll', close, true);
        window.addEventListener('resize', close);
        return () => {
          window.removeEventListener('scroll', close, true);
          window.removeEventListener('resize', close);
        };
      }, [editing]);

      // 输入变化 → 防抖 250ms 搜索（名称/拼音/代码），过期响应丢弃
      useEffect(() => {
        window.clearTimeout(sugTimer.current);
        const q = symbol.trim();
        if (!q || busy) { setSug([]); setSugIdx(0); return; }
        const seq = ++sugSeq.current;
        sugTimer.current = window.setTimeout(() => {
          api('suggest', { q }).then((v) => {
            if (sugSeq.current !== seq) return;
            setSug(v.items || []);
            setSugIdx(0);
          }).catch(() => { /* 搜索失败不打扰手动输入 */ });
        }, 250);
        return () => window.clearTimeout(sugTimer.current);
      }, [symbol, busy]);

      const closeSug = () => { setSug([]); setSugIdx(0); };
      const pickSug = async (item) => {
        closeSug();
        setSymbol('');
        setBusy(true);
        try {
          const v = await api('watchlist.add', { symbols: [item.code], tier: newTier, domain: newDomain || undefined, tags: newTagList });
          list.reload();
          if (v.added?.length) notifyOk(`已加入 ${item.name}(${item.code})`);
          else if (v.existed?.length) notifyWarn(`${item.code} 已在自选（保留原关注度与标签）`);
        } catch (e) { notifyError(e.message); } finally { setBusy(false); }
      };

      const add = async () => {
        const codes = parseSymbols(symbol);
        if (!codes.length) { notifyError('请输入有效的 6 位 A股代码（如 600519）'); return; }
        setBusy(true);
        try {
          const v = await api('watchlist.add', { symbols: codes, tier: newTier, domain: newDomain || undefined, tags: newTagList });
          setSymbol('');
          setNewDomain('');
          list.reload();
          if (v.added && v.added.length) notifyOk(`已加入 ${v.added.map((x) => `${x.name}(${x.symbol})`).join('、')}`);
          else if (v.existed && v.existed.length) notifyWarn(`已在自选：${v.existed.map((x) => x.symbol).join('、')}（保留原关注度与标签）`);
        } catch (e) {
          notifyError(e.message || String(e));
        } finally { setBusy(false); }
      };
      const remove = async (code) => {
        if (!window.confirm(`确定从自选移除 ${code}？`)) return;
        try { await api('watchlist.remove', { symbols: [code] }); list.reload(); notifyOk(`已移除 ${code}`); } catch (e) { notifyError(e.message); }
      };
      const setTier = async (code, tier) => {
        try { await api('watchlist.setTier', { symbols: [code], tier }); list.reload(); } catch (e) { notifyError(e.message); }
      };
      const setDomain = async (code, domain) => {
        try {
          await api('watchlist.setDomain', { symbols: [code], domain: domain || '' });
          list.reload();
          const label = DOMAIN_OPTIONS.find((d) => d.value === domain)?.label;
          notifyOk(label ? `${code} 领域已设为「${label}」` : `${code} 已清除领域分类`);
        } catch (e) { notifyError(e.message); }
      };
      const removeTag = async (code, tag) => {
        const r = items.find((x) => x.symbol === code);
        const next = (r?.tags || []).filter((t) => t !== tag);
        try {
          await api('watchlist.setTags', { symbols: [code], tags: next });
          list.reload();
          notifyOk(`${code} 已移除标签「${tag}」`);
        } catch (e) { notifyError(e.message); }
      };

      const saveTags = async (code, tags) => {
        setEditing(null);
        setEditPos(null);
        try {
          await api('watchlist.setTags', { symbols: [code], tags: tags || [] });
          list.reload();
          notifyOk((tags || []).length ? `${code} 标签已更新：${(tags || []).join('、')}` : `${code} 标签已清空`);
        } catch (e) { notifyError(e.message); }
      };

      const allTagList = (list.value?.tagCloud || []).map((t) => t.tag);

      /** 打开标签浮层：以点击元素为锚点，放不下时向上翻。 */
      const openTagEditor = (code, tags, ev) => {
        const next = [...(tags || [])];
        setEditTags(next);
        setEditing(code);
        const r = ev && ev.currentTarget ? ev.currentTarget.getBoundingClientRect() : null;
        if (!r) { setEditPos(null); return; }
        const W = 304, H = 188, GAP = 6;
        const vw = window.innerWidth || 1280;
        const vh = window.innerHeight || 800;
        const left = Math.max(8, Math.min(r.left - 8, vw - W - 8));
        const below = r.bottom + GAP;
        const top = below + H > vh - 8 ? Math.max(8, r.top - H - GAP) : below;
        setEditPos({ top, left });
      };

      const tagsCell = (r) => h('span', { className: 'htx-tags' },
        (r.tags || []).map((t) => h('span', {
          key: t, className: 'htx-tagChip', title: '点击编辑标签',
          onClick: (e) => openTagEditor(r.symbol, r.tags, e),
        },
          t,
          h('button', {
            type: 'button', className: 'htx-tagChipX', 'aria-label': `移除标签 ${t}`,
            title: '移除该标签',
            onClick: (e) => { e.stopPropagation(); removeTag(r.symbol, t); },
          }, '×'))),
        h('button', {
          className: 'htx-tagAdd', title: '编辑标签',
          onClick: (e) => openTagEditor(r.symbol, r.tags, e),
        }, '＋'));

      /** T-n 涨跌幅列：最新价 vs n 个交易日前收盘，右对齐 + 涨跌色。 */
      const tnCol = (n) => ({
        label: `T-${n}`,
        headerTitle: `最新价相对 T-${n + 1} 日收盘的累计涨跌幅（近 ${n + 1} 个交易日）`,
        render: (r) => {
          const v = r.pctN ? r.pctN[n] : null;
          return v == null ? '-' : `${v >= 0 ? '+' : ''}${v}%`;
        },
        className: (r) => {
          const v = r.pctN ? r.pctN[n] : null;
          return v == null ? '' : v >= 0 ? 'htx-up' : 'htx-down';
        },
        sortable: true,
        sortValue: (r) => (r.pctN ? (r.pctN[n] ?? null) : null),
        align: 'right',
      });
      const TN_LIST = [1, 2, 3, 4, 5, 10, 15, 20, 30];

      const columns = [
        { label: '代码', render: (r) => h('a', { href: '#', style: { color: 'var(--dsw-alias-state-business-primary)', textDecoration: 'none', fontWeight: 600 }, onClick: (e) => { e.preventDefault(); setDetail(r.symbol); } }, r.symbol) },
        { label: '名称', key: 'name' },
        { label: '现价', key: 'price', align: 'right' },
        { label: '最新涨跌幅', headerTitle: '最新价相对上一交易日收盘（当日涨跌）', sortable: true, sortValue: (r) => (r.pctChange ?? null), render: (r) => (r.pctChange != null ? `${r.pctChange >= 0 ? '+' : ''}${r.pctChange}%` : '-'), className: (r) => (r.pctChange >= 0 ? 'htx-up' : 'htx-down'), align: 'right' },
        ...TN_LIST.map(tnCol),
        {
          label: '关注度',
          filter: {
            options: TIER_OPTIONS.map((o) => ({ value: o.value, label: o.label, count: ((list.value?.counts) || {})[o.value] ?? 0 })),
            selected: tierSel,
            onChange: setTierSel,
          },
          render: (r) => h('select', {
            className: 'htx-input htx-tierSel', value: r.tier || 'basic',
            onChange: (e) => setTier(r.symbol, e.target.value),
          }, TIER_OPTIONS.map((o) => h('option', { key: o.value, value: o.value }, o.label))),
        },
        {
          label: '领域',
          headerTitle: '领域分类（单选：大金融/消费/周期/科技，可空）',
          filter: {
            options: [
              { value: '', label: '未分类', count: (list.value?.items || []).filter((i) => !i.domain).length },
              ...DOMAIN_OPTIONS.map((o) => ({ value: o.value, label: o.label, count: (list.value?.items || []).filter((i) => i.domain === o.value).length })),
            ],
            selected: domainSel,
            onChange: setDomainSel,
          },
          render: (r) => h('select', {
            className: 'htx-input htx-tierSel', value: r.domain || '',
            title: '设置领域分类',
            onChange: (e) => setDomain(r.symbol, e.target.value),
          },
            h('option', { key: '', value: '' }, '未分类'),
            DOMAIN_OPTIONS.map((o) => h('option', { key: o.value, value: o.value }, o.label))),
        },
        {
          label: '标签',
          filter: {
            options: (list.value?.tagCloud || []).map((t) => ({ value: t.tag, label: t.tag, count: t.count })),
            selected: tagSel,
            onChange: setTagSel,
          },
          render: tagsCell,
        },
        { label: '', render: (r) => h('button', { className: 'htx-btn htx-btnSm htx-btnDanger', onClick: () => remove(r.symbol) }, '移除') },
      ];

      const items = list.value?.items || [];

      /** 表头排序三态：desc → asc → 取消。 */
      const onSortChange = (key) => setSort((s) => (
        s.key !== key ? { key, dir: 'desc' } : s.dir === 'desc' ? { key, dir: 'asc' } : { key: null, dir: null }
      ));

      // 客户端多选过滤：关注度（命中任一）→ 标签（命中任一，OR）
      const filtered = items
        .filter((i) => (tierSel == null ? true : tierSel.includes(i.tier || 'basic')))
        .filter((i) => (domainSel == null ? true : domainSel.includes(i.domain || '')))
        .filter((i) => (tagSel == null ? true : (i.tags || []).some((t) => tagSel.includes(t))));

      const sortCol = sort.key && sort.dir ? columns.find((c) => c.label === sort.key) : null;
      const displayRows = sortCol && sortCol.sortValue
        ? [...filtered].sort((a, b) => {
            const va = sortCol.sortValue(a), vb = sortCol.sortValue(b);
            if (va == null && vb == null) return 0;
            if (va == null) return 1;   // 数据不足沉底
            if (vb == null) return -1;
            return sort.dir === 'asc' ? va - vb : vb - va;
          })
        : filtered;

      const counts = list.value?.counts || null;
      const upCount = filtered.filter((i) => (i.pctChange ?? 0) > 0).length;
      const downCount = filtered.filter((i) => (i.pctChange ?? 0) < 0).length;

      return h('div', null,
        // 工具栏：添加组 | 筛选组 | 统计
        h('div', { className: 'htx-toolbar' },
          h(Field, { label: '添加（名称/代码）' },
            h('div', { className: 'htx-sugWrap' },
              h('input', {
                ref: inputRef, className: 'htx-input', style: { width: 185 },
                placeholder: '名称/代码；批量粘贴代码', value: symbol, disabled: busy,
                onChange: (e) => setSymbol(e.target.value),
                onKeyDown: (e) => {
                  if (sug.length) {
                    if (e.key === 'ArrowDown') { e.preventDefault(); setSugIdx((i) => Math.min(i + 1, sug.length - 1)); return; }
                    if (e.key === 'ArrowUp') { e.preventDefault(); setSugIdx((i) => Math.max(i - 1, 0)); return; }
                    if (e.key === 'Escape') { e.preventDefault(); closeSug(); return; }
                    if (e.key === 'Enter' && !busy) { e.preventDefault(); pickSug(sug[sugIdx] || sug[0]); return; }
                  }
                  if (e.key === 'Enter' && !busy) add();
                },
              }),
              sug.length ? h('div', { className: 'htx-sug', role: 'listbox', 'aria-label': '搜索建议' },
                sug.map((s, i) => {
                  const inList = !!items.find((x) => x.symbol === s.code);
                  return h('button', {
                    key: s.code, type: 'button', role: 'option', 'aria-selected': i === sugIdx,
                    className: 'htx-sugItem' + (i === sugIdx ? ' htx-sugOn' : ''),
                    onMouseEnter: () => setSugIdx(i),
                    onClick: () => pickSug(s),
                  },
                    h('span', { className: 'htx-sugCode' }, s.code),
                    h('span', { className: 'htx-sugName' }, s.name),
                    inList ? h('span', { className: 'htx-sugBadge' }, '已在自选') : null,
                    h('span', { className: 'htx-sugMeta' }, s.market.toUpperCase()));
                })) : null)),
          h(Field, { label: '关注度' },
            h('select', { className: 'htx-input', value: newTier, onChange: (e) => setNewTier(e.target.value) },
              TIER_OPTIONS.map((o) => h('option', { key: o.value, value: o.value }, o.label)))),
          h(Field, { label: '领域' },
            h('select', { className: 'htx-input', value: newDomain, onChange: (e) => setNewDomain(e.target.value), title: '领域分类（可选）' },
              h('option', { key: '', value: '' }, '未分类'),
              DOMAIN_OPTIONS.map((o) => h('option', { key: o.value, value: o.value }, o.label)))),
          h(Field, { label: '标签' },
            h(TagEditor, { value: newTagList, onChange: setNewTagList, allTags: allTagList })),
          h('button', { className: 'htx-btn htx-btnPrimary', disabled: busy, onClick: add }, busy ? '加入中…' : '加入自选'),
          h('span', { className: 'htx-meta' },
            `共 ${displayRows.length}/${items.length} 只`,
            list.updatedAt ? ` · ${new Date(list.updatedAt).toLocaleTimeString('zh-CN', { hour12: false })}` : '',
            list.error ? h('span', { className: 'htx-metaWarn', title: `刷新失败：${list.error}` }, ' · 刷新失败') : null),
          h(RefreshBtn, { busy: list.refreshing, onClick: () => list.reload() }),
        ),
        // 领域快速筛选：单选切换（与表头 ColFilter 共享 domainSel）
        h('div', { className: 'htx-chipRow' },
          h('span', { className: 'htx-tagCloudLabel' }, '领域'),
          [{ value: '', label: '未分类' }, ...DOMAIN_OPTIONS].map((o) => {
            const on = domainSel != null && domainSel.includes(o.value);
            const count = items.filter((i) => (i.domain || '') === o.value).length;
            return h('button', {
              key: o.value || 'none', type: 'button',
              className: 'htx-tag' + (on ? ' htx-tagOn' : ''),
              title: on ? '点击取消该领域筛选' : `点击只看${o.label}（${count} 只）`,
              onClick: () => setDomainSel(on ? (domainSel.length > 1 ? domainSel.filter((x) => x !== o.value) : null) : [o.value]),
            }, `${o.label} ${count}`);
          }),
          domainSel != null && domainSel.length ? h('button', {
            type: 'button', className: 'htx-tag', style: { borderStyle: 'dashed' },
            onClick: () => setDomainSel(null),
          }, '清除') : null),
        // 标签快速筛选：单选切换（再点取消；与表头多选菜单共享 tagSel）
        allTagList.length ? h('div', { className: 'htx-chipRow' },
          h('span', { className: 'htx-tagCloudLabel' }, '标签'),
          allTagList.map((t) => {
            const on = tagSel != null && tagSel.includes(t);
            return h('button', {
              key: t, type: 'button',
              className: 'htx-tag' + (on ? ' htx-tagOn' : ''),
              title: on ? '点击取消该标签筛选' : '点击只看该标签',
              onClick: () => setTagSel(on ? (tagSel.length > 1 ? tagSel.filter((x) => x !== t) : null) : [...(tagSel || []), t]),
            }, t);
          }),
          tagSel != null && tagSel.length ? h('button', {
            type: 'button', className: 'htx-tag', style: { borderStyle: 'dashed' },
            onClick: () => setTagSel(null),
          }, '清除') : null) : null,
        // 汇总指标条
        items.length ? h('div', { className: 'htx-metrics' },
          h('div', { className: 'htx-metric' }, h('p', { className: 'htx-metricLabel' }, '当前显示'), h('p', { className: 'htx-metricValue' }, `${filtered.length}${filtered.length !== items.length ? ` / ${items.length}` : ''}`)),
          h('div', { className: 'htx-metric' }, h('p', { className: 'htx-metricLabel' }, '今日上涨'), h('p', { className: 'htx-metricValue htx-up' }, String(upCount))),
          h('div', { className: 'htx-metric' }, h('p', { className: 'htx-metricLabel' }, '今日下跌'), h('p', { className: 'htx-metricValue htx-down' }, String(downCount))),
          (tierSel || domainSel || tagSel) ? h('div', { className: 'htx-metric' }, h('p', { className: 'htx-metricLabel' }, '筛选'), h('p', { className: 'htx-metricValue' }, [tierSel ? `关注度 ${tierSel.length}` : '', domainSel ? `领域 ${domainSel.length}` : '', tagSel ? `标签 ${tagSel.length}` : ''].filter(Boolean).join(' · '))) : null,
        ) : null,
        // 数据优先：已有数据就一直显示表格（静默刷新只换数据），仅首次加载才转圈/报错
        list.value == null
          ? (list.error ? h(ErrorBox, { error: list.error }) : h(Spinner))
          : !items.length ? h(Empty, {
              text: '自选股为空',
              hint: '在上方输入代码或名称，回车即可加入',
            })
          : !displayRows.length ? h(Empty, {
              text: '当前筛选条件下没有自选股',
              hint: '点击表头的关注度 / 标签筛选图标，勾选更多选项',
            })
          : h(DataTable, { columns, rows: displayRows, getKey: (r) => r.symbol, sort, onSortChange }),
        // 标签编辑浮层：固定定位，浮在表格之上，不参与行高计算
        editing ? h('div', {
          className: 'htx-tagPopMask',
          onMouseDown: () => { setEditing(null); setEditPos(null); },
        },
          h('div', { onMouseDown: (e) => e.stopPropagation() },
            h(TagEditor, {
              key: editing,
              value: editTags,
              onChange: setEditTags,
              allTags: allTagList,
              boxed: true,
              style: editPos ? { top: editPos.top, left: editPos.left } : { top: 120, left: 60 },
              onDone: () => saveTags(editing, editTags),
              onCancel: () => { setEditing(null); setEditPos(null); },
            }))) : null,
        detail ? h(DetailView, { symbol: detail, onClose: () => setDetail(null) }) : null,
      );
    }

    // ---------- 个股详情 ----------
    function DetailView({ symbol, onClose }) {
      const data = useData(() => api('analysis', { symbol }), [symbol]);
      const kline = useData(() => api('kline', { symbol, period: 'day', limit: 60 }), [symbol]);
      if (data.loading) return h(Spinner);
      if (data.error) return h('div', null, h(ErrorBox, { error: data.error }), h('button', { className: 'htx-btn', onClick: onClose }, '返回'));
      const v = data.value;
      const ind = v.indicators || {};
      const q = v.quote || {};
      const items = [
        ['现价', q.price], ['涨跌幅', q.pctChange != null ? `${q.pctChange}%` : '-'], ['市盈率', q.pe],
        ['市净率', q.pb], ['总市值(亿)', q.totalMcap], ['MA5', ind.ma5], ['MA20', ind.ma20],
        ['MACD柱', ind.hist], ['RSI14', ind.rsi14], ['KDJ·K', ind.k],
      ];
      return h('div', { className: 'htx-card' },
        h('div', { className: 'htx-row', style: { justifyContent: 'space-between' } },
          h('h3', { className: 'htx-cardTitle', style: { margin: 0 } }, `${q.name || ''}（${symbol}）`),
          h('button', { className: 'htx-btn', onClick: onClose }, '返回')),
        h('div', { className: 'htx-kv' }, items.map(([k, val]) => h('div', { className: 'htx-kvItem', key: k }, h('b', null, k + ' '), fmt(val)))),
        h('div', { style: { marginTop: 12 } }, kline.loading ? h(Spinner) : kline.value ? h(CandleChart, { bars: kline.value.bars }) : null),
        h('div', { className: 'htx-callout', style: { marginTop: 10 } }, '以上为技术指标数值，仅描述现状，不构成买卖建议。'));
    }

    // ---------- 选股 ----------
    function ScreenView() {
      const [form, setForm] = useState({ sort: 'changepercent', limit: 50, pctMin: '', peMax: '', mcapMinYi: '', turnoverMin: '' });
      const [run, setRun] = useState(null);
      const [picked, setPicked] = useState({});
      const [busy, setBusy] = useState(false);
      const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
      const submit = () => {
        const args = { sort: form.sort, limit: Math.min(100, Number(form.limit) || 50) };
        for (const k of ['pctMin', 'peMax', 'mcapMinYi', 'turnoverMin']) if (form[k] !== '') args[k] = Number(form[k]);
        setPicked({});
        setRun({ ...args });
      };
      const data = useData(() => (run ? api('screen', run) : Promise.resolve(null)), [run]);
      const rows = data.value?.rows || [];
      const pickedCodes = Object.keys(picked).filter((k) => picked[k]);
      const toggle = (code) => setPicked((p) => ({ ...p, [code]: !p[code] }));
      const allOn = rows.length > 0 && pickedCodes.length === rows.length;

      const quickAdd = async (codes) => {
        if (!codes.length) return;
        setBusy(true);
        try {
          const v = await api('watchlist.add', { symbols: codes });
          if (v.added?.length) notifyOk(`已加入自选：${v.added.map((x) => x.symbol).join('、')}`);
          if (v.existed?.length) notifyWarn(`已在自选：${v.existed.map((x) => x.symbol).join('、')}`);
          setPicked({});
        } catch (e) { notifyError(e.message); } finally { setBusy(false); }
      };

      const columns = [
        { label: '', render: (r) => h('input', { type: 'checkbox', checked: !!picked[r.code], onChange: () => toggle(r.code), 'aria-label': `选择 ${r.code}` }) },
        { label: '代码', render: (r) => h('span', { style: { fontWeight: 600 } }, r.code) },
        { label: '名称', key: 'name' },
        { label: '现价', key: 'price', align: 'right' },
        { label: '涨跌幅', render: (r) => (r.pctChange != null ? `${r.pctChange >= 0 ? '+' : ''}${r.pctChange}%` : '-'), className: (r) => (r.pctChange >= 0 ? 'htx-up' : 'htx-down'), align: 'right' },
        { label: '市盈率', key: 'pe', align: 'right' },
        { label: '市值(亿)', key: 'totalMcapYi', align: 'right' },
        { label: '换手率%', key: 'turnover', align: 'right' },
        { label: '', render: (r) => h('button', { className: 'htx-btn htx-btnSm', disabled: busy, onClick: () => quickAdd([r.code]) }, '+ 自选') },
      ];

      return h('div', null,
        h('div', { className: 'htx-toolbar' },
          h(Field, { label: '排序' },
            h('select', { className: 'htx-input', value: form.sort, onChange: set('sort') },
              h('option', { value: 'changepercent' }, '涨跌幅'), h('option', { value: 'amount' }, '成交额'),
              h('option', { value: 'turnoverratio' }, '换手率'), h('option', { value: 'mktcap' }, '总市值'))),
          h(Field, { label: '涨幅下限%' }, h('input', { className: 'htx-input', style: { width: 88 }, placeholder: '不限', value: form.pctMin, onChange: set('pctMin') })),
          h(Field, { label: '市盈率上限' }, h('input', { className: 'htx-input', style: { width: 96 }, placeholder: '不限', value: form.peMax, onChange: set('peMax') })),
          h(Field, { label: '市值下限(亿)' }, h('input', { className: 'htx-input', style: { width: 100 }, placeholder: '不限', value: form.mcapMinYi, onChange: set('mcapMinYi') })),
          h(Field, { label: '换手率下限%' }, h('input', { className: 'htx-input', style: { width: 96 }, placeholder: '不限', value: form.turnoverMin, onChange: set('turnoverMin') })),
          h(Field, { label: '数量' }, h('input', { className: 'htx-input', style: { width: 64 }, value: form.limit, onChange: set('limit') })),
          h('button', { className: 'htx-btn htx-btnPrimary', onClick: submit }, '筛选'),
          run ? h('span', { className: 'htx-meta' }, `命中 ${rows.length} 只`) : null),
        run && rows.length ? h('div', { className: 'htx-chipRow' },
          h('button', { className: 'htx-btn htx-btnSm', onClick: () => setPicked({}) },
            allOn ? '取消全选' : '全选'),
          h('button', { className: 'htx-btn htx-btnSm htx-btnPrimary', disabled: busy || !pickedCodes.length, onClick: () => quickAdd(pickedCodes) },
            busy ? '加入中…' : `加入自选${pickedCodes.length ? ` (${pickedCodes.length})` : ''}`),
          pickedCodes.length ? h('span', { className: 'htx-meta', style: { marginLeft: 0 } }, `已选 ${pickedCodes.length}`) : null) : null,
        data.error ? h(ErrorBox, { error: data.error })
          : !run ? h(Empty, { text: '设置筛选条件', hint: '配置上方条件后点击「筛选」，命中结果可直接加入自选' })
          : data.loading ? h(Spinner)
          : !rows.length ? h(Empty, { text: '没有符合条件的股票', hint: '放宽条件后再试' })
          : h(DataTable, { columns, rows, getKey: (r) => r.code }));
    }

    // ---------- 量能 ----------
    /** 取整刻度的纵轴上限与网格（亿元）。 */
    const niceScale = (hi) => {
      const steps = [500, 1000, 2000, 2500, 5000, 10000, 20000, 50000];
      const s = steps.find((x) => hi / x <= 5) || 50000;
      const max = Math.ceil(hi / s) * s;
      const ticks = [];
      for (let v = 0; v <= max + 1e-9; v += s) ticks.push(v);
      return { max, ticks };
    };

    /** 量能图：柱=日合计成交额（红涨绿跌），折线=MA5。 */
    function EnergyChart({ series, height = 250 }) {
      if (!series || series.length < 2) return null;
      const W = 780, H = height;
      const padL = 54, padR = 12, padT = 12, padB = 26;
      const totals = series.map((r) => r.total ?? 0);
      const maVals = series.map((r) => r.ma5).filter((v) => v != null);
      const { max, ticks } = niceScale(Math.max(...totals, ...(maVals.length ? maVals : [0])));
      const step = (W - padL - padR) / series.length;
      const bw = Math.max(2.5, step * 0.62);
      const y = (v) => padT + (1 - v / max) * (H - padT - padB);
      const xMid = (i) => padL + i * step + step / 2;
      const grid = ticks.map((t) => h('g', { key: `g${t}` },
        h('line', { x1: padL, y1: y(t), x2: W - padR, y2: y(t), stroke: 'var(--dsw-alias-border-l3)', strokeWidth: t === 0 ? 1 : 0.5, strokeDasharray: t === 0 ? '0' : '3 3' }),
        h('text', { x: padL - 8, y: y(t) + 3.5, textAnchor: 'end', fontSize: 9.5, fill: 'var(--dsw-alias-label-tertiary)', style: { fontVariantNumeric: 'tabular-nums' } }, String(t))));
      const bands = series.map((r, i) => {
        const up = (r.pctSh ?? 0) >= 0;
        return h('rect', {
          key: `b${r.date}`, x: xMid(i) - bw / 2, y: y(r.total ?? 0), width: bw,
          height: Math.max(1, y(0) - y(r.total ?? 0)),
          fill: up ? '#e63946' : '#2a9d8f', rx: 1,
        }, h('title', null, `${r.date} 合计 ${r.total} 亿（沪 ${r.sh} / 深 ${r.sz} / 京 ${r.bj}） 上证 ${r.pctSh >= 0 ? '+' : ''}${r.pctSh}%`));
      });
      const maPts = series.map((r, i) => (r.ma5 == null ? null : `${xMid(i)},${y(r.ma5)}`)).filter(Boolean).join(' ');
      const labels = [];
      let lastMonth = '';
      series.forEach((r, i) => {
        const month = r.date.slice(5, 7);
        const isLast = i === series.length - 1;
        if (i === 0 || month !== lastMonth) labels.push(h('text', { key: `x${i}`, x: xMid(i), y: H - 8, textAnchor: 'middle', fontSize: 9.5, fill: 'var(--dsw-alias-label-tertiary)' }, `${month}月`));
        if (isLast) labels.push(h('text', { key: 'xlast', x: xMid(i), y: H - 8, textAnchor: 'middle', fontSize: 9.5, fill: 'var(--dsw-alias-label-secondary)' }, r.date.slice(5)));
        lastMonth = month;
      });
      return h('svg', { viewBox: `0 0 ${W} ${H}`, style: { width: '100%', height: 'auto', display: 'block' }, role: 'img', 'aria-label': '成交额趋势图' },
        h('g', null, grid),
        h('g', null, bands),
        maPts ? h('polyline', { points: maPts, fill: 'none', stroke: '#2f6fed', strokeWidth: 1.6, strokeLinejoin: 'round' }) : null,
        h('g', null, labels));
    }

    const yi = (v, d = 1) => (v == null ? '-' : Number(v).toLocaleString('zh-CN', { maximumFractionDigits: d, minimumFractionDigits: 0 }));
    const signed = (v, d = 1) => (v == null ? '-' : `${v > 0 ? '+' : ''}${yi(v, d)}`);
    const pctStr = (v) => (v == null ? '-' : `${v > 0 ? '+' : ''}${v}%`);

    function EnergyView() {
      const [days, setDays] = useState(20);
      const [sort, setSort] = useState({ key: null, dir: null });
      const data = useData(() => api('energy', { days }), [days], { refreshMs: 60_000 });
      const v = data.value || {};
      const series = v.series || [];
      const st = v.stats || {};

      const columns = [
        { label: '日期', render: (r) => h('span', { style: { fontVariantNumeric: 'tabular-nums' } }, r.date) },
        { label: '沪市(亿)', render: (r) => yi(r.sh), align: 'right' },
        { label: '深市(亿)', render: (r) => yi(r.sz), align: 'right' },
        { label: '京市(亿)', render: (r) => yi(r.bj), align: 'right', headerTitle: '北证50成分股成交额（京市口径）' },
        {
          label: '合计(亿)', headerTitle: '沪市 + 深市 + 京市', align: 'right', sortable: true,
          render: (r) => h('span', { style: { fontWeight: 600 } }, yi(r.total)),
          sortValue: (r) => r.total ?? null,
        },
        {
          label: '较前日(亿)', align: 'right', sortable: true,
          render: (r) => signed(r.delta),
          className: (r) => (r.delta == null ? '' : r.delta > 0 ? 'htx-up' : r.delta < 0 ? 'htx-down' : ''),
          sortValue: (r) => r.delta ?? null,
        },
        { label: '上证涨跌', align: 'right', render: (r) => pctStr(r.pctSh), className: (r) => (r.pctSh == null ? '' : r.pctSh >= 0 ? 'htx-up' : 'htx-down') },
        { label: '创业板涨跌', align: 'right', render: (r) => pctStr(r.pctCyb), className: (r) => (r.pctCyb == null ? '' : r.pctCyb >= 0 ? 'htx-up' : 'htx-down') },
        { label: '科创50涨跌', align: 'right', render: (r) => pctStr(r.pctKc), className: (r) => (r.pctKc == null ? '' : r.pctKc >= 0 ? 'htx-up' : 'htx-down') },
      ];

      const onSortChange = (key) => setSort((s) => (
        s.key !== key ? { key, dir: 'desc' } : s.dir === 'desc' ? { key, dir: 'asc' } : { key: null, dir: null }
      ));
      const sortCol = sort.key && sort.dir ? columns.find((c) => c.label === sort.key) : null;
      const rows = [...series].reverse();   // 最新交易日在前
      const displayRows = sortCol && sortCol.sortValue
        ? [...rows].sort((a, b) => {
            const va = sortCol.sortValue(a), vb = sortCol.sortValue(b);
            if (va == null && vb == null) return 0;
            if (va == null) return 1;
            if (vb == null) return -1;
            return sort.dir === 'asc' ? va - vb : vb - va;
          })
        : rows;

      const statusClass = st.status === '放量' ? ' htx-badgeUp' : st.status === '缩量' ? ' htx-badgeDown' : st.status === '平量' ? ' htx-badgeFlat' : ' htx-badgeFlat';
      const metric = (label, value, cls) => h('div', { className: 'htx-metric' },
        h('p', { className: 'htx-metricLabel' }, label),
        h('p', { className: 'htx-metricValue' + (cls ? ' ' + cls : '') }, value));

      return h('div', null,
        h('div', { className: 'htx-toolbar' },
          h(Field, { label: '区间' },
            h(Seg, {
              value: days, ariaLabel: '统计区间',
              options: [{ value: 20, label: '近20日' }, { value: 40, label: '近40日' }, { value: 60, label: '近60日' }],
              onChange: setDays,
            })),
          h('span', { className: 'htx-meta' },
            st.status ? `量能状态 · ${st.status}${st.vsMa5Pct != null ? `（较5日均额 ${pctStr(st.vsMa5Pct)}）` : ''}` : '量能状态 · -',
            data.updatedAt ? ` · ${new Date(data.updatedAt).toLocaleTimeString('zh-CN', { hour12: false })}` : '',
            data.error ? h('span', { className: 'htx-metaWarn', title: `刷新失败：${data.error}` }, ' · 刷新失败') : null),
          h(RefreshBtn, { busy: data.refreshing, onClick: () => data.reload(), label: '立即刷新量能数据' })),

        data.value == null
          ? (data.error ? h(ErrorBox, { error: data.error }) : h(Spinner))
          : h('div', null,
            h('div', { className: 'htx-card' },
              h('div', { className: 'htx-row', style: { justifyContent: 'space-between', marginBottom: 10 } },
                h('div', { className: 'htx-row', style: { margin: 0, gap: 8 } },
                  h('h3', { className: 'htx-cardTitle', style: { margin: 0 } }, 'A股量能趋势 · 沪深京合计成交额'),
                  h('span', { className: 'htx-badge' + statusClass, title: v.notes?.status || '' }, st.status || '-')),
                h('span', { className: 'htx-meta', style: { marginLeft: 0 } }, `最新交易日 ${st.date || '-'}`)),

              h('div', { className: 'htx-metrics', style: { gridTemplateColumns: 'repeat(auto-fill,minmax(112px,1fr))' } },
                metric('最新合计（亿）', yi(st.total)),
                metric('较前日（亿）', signed(st.delta), st.delta == null ? '' : st.delta > 0 ? 'htx-up' : st.delta < 0 ? 'htx-down' : ''),
                metric('5日均额（亿）', yi(st.ma5)),
                metric('区间均额（亿）', yi(st.rangeAvg)),
                metric('区间最高（亿）', yi(st.rangeMax)),
                metric('区间最低（亿）', yi(st.rangeMin)),
                metric('上证涨跌', pctStr(st.pctSh), st.pctSh == null ? '' : st.pctSh >= 0 ? 'htx-up' : 'htx-down'),
                metric('创业板涨跌', pctStr(st.pctCyb), st.pctCyb == null ? '' : st.pctCyb >= 0 ? 'htx-up' : 'htx-down'),
                metric('科创50涨跌', pctStr(st.pctKc), st.pctKc == null ? '' : st.pctKc >= 0 ? 'htx-up' : 'htx-down')),

              h(EnergyChart, { series }),
              h('p', { className: 'htx-chartNote' },
                '柱=沪深京合计成交额（亿元），', h('b', null, '红'), '=上证收涨、', h('b', null, '绿'), '=上证收跌；折线=MA5（5 日移动均额）。',
                '口径：沪市取上证指数成交额、深市取深证综指成交额、京市取北证50成分股成交额（北交所无全市场指数）；盘中最新一根为当日累计值。',
                '数据每 60 秒自动刷新，仅供参考，不构成投资建议。')),

            h('div', { className: 'htx-card', style: { paddingTop: 10 } },
              h(DataTable, { columns, rows: displayRows, getKey: (r) => r.date, sort, onSortChange }))));
    }

    // ---------- 强势股 ----------
    const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

    function PowerfulView() {
      const [date, setDate] = useState('');           // '' = 最新交易日
      const [sort, setSort] = useState({ key: null, dir: null });
      const data = useData(() => api('powerful', date ? { date } : {}), [date], { refreshMs: 60_000 });
      const v = data.value || {};
      const items = v.items || [];
      const st = v.stats || {};
      const dates = v.dates || [];
      const isLatest = !date || date === (dates.find((d) => d.isLatest)?.date || '');

      const quickAdd = async (code) => {
        try {
          const res = await api('watchlist.add', { symbols: [code] });
          if (res.added?.length) notifyOk(`已加入自选：${code}`);
          else notifyWarn(`${code} 已在自选`);
        } catch (e) { notifyError(e.message); }
      };

      const columns = [
        { label: '代码', render: (r) => h('span', { style: { fontWeight: 600 } }, r.code) },
        { label: '名称', render: (r) => r.name },
        {
          label: '当日涨幅', align: 'right', sortable: true,
          render: (r) => `${r.pct > 0 ? '+' : ''}${r.pct}%`,
          className: () => 'htx-up',
          sortValue: (r) => r.pct ?? null,
          headerTitle: isLatest ? '实时涨跌幅（盘中变化）' : '当日涨幅（前复权收盘价计算）',
        },
        {
          label: '涨停', align: 'right', sortable: true,
          render: (r) => (r.zt ? (r.zt.lbc > 1 ? `${r.zt.lbc}连板` : '涨停') : '-'),
          sortValue: (r) => (r.zt?.lbc ?? 1) || 1,
          headerTitle: '东财涨停池：连板数',
        },
        { label: '首封时间', align: 'right', render: (r) => r.zt?.fbt || '-' },
        { label: '行业', render: (r) => r.industry || '-' },
        {
          label: '最新涨跌幅', align: 'right', sortable: true,
          render: (r) => (r.latestPct == null ? '-' : `${r.latestPct >= 0 ? '+' : ''}${r.latestPct}%`),
          className: (r) => (r.latestPct == null ? '' : r.latestPct >= 0 ? 'htx-up' : 'htx-down'),
          sortValue: (r) => r.latestPct ?? null,
          headerTitle: '该股当前实时涨跌幅（隔日视角）',
        },
        { label: '', render: (r) => h('button', { className: 'htx-btn htx-btnSm', onClick: () => quickAdd(r.code) }, '+ 自选') },
      ];

      const onSortChange = (key) => setSort((s) => (
        s.key !== key ? { key, dir: 'desc' } : s.dir === 'desc' ? { key, dir: 'asc' } : { key: null, dir: null }
      ));
      const sortCol = sort.key && sort.dir ? columns.find((c) => c.label === sort.key) : null;
      const displayRows = sortCol && sortCol.sortValue
        ? [...items].sort((a, b) => {
            const va = sortCol.sortValue(a), vb = sortCol.sortValue(b);
            if (va == null && vb == null) return 0;
            if (va == null) return 1;
            if (vb == null) return -1;
            return sort.dir === 'asc' ? va - vb : vb - va;
          })
        : items;

      const pctStr = (x) => (x == null ? '-' : `${x > 0 ? '+' : ''}${x}%`);
      const active = date || dates.find((d) => d.isLatest)?.date || '';

      return h('div', { className: 'htx-split' },
        // 左侧日期导航（最近10个交易日，最新在最上）
        h('div', { className: 'htx-dateNav', role: 'navigation', 'aria-label': '交易日列表' },
          h('span', { className: 'htx-fieldLabel', style: { padding: '0 4px 2px' } }, '交易日'),
          dates.map((d) => h('button', {
            key: d.date,
            type: 'button',
            className: 'htx-dateNavBtn' + (active === d.date ? ' htx-dateNavOn' : ''),
            onClick: () => setDate(d.isLatest ? '' : d.date),
            title: d.isLatest ? '最新交易日（盘中实时）' : `${d.date} 强势股`,
          },
            h('span', { className: 'htx-dateNavDate' }, d.date.slice(5), h('span', { className: 'htx-dateNavWk' }, ' ' + WEEK[d.date ? new Date(d.date + 'T00:00:00').getDay() : 0])),
            d.isLatest
              ? h('span', { className: 'htx-dateNavCnt' }, '实时')
              : h('span', { className: 'htx-dateNavCnt' }, d.count != null ? `${d.count}只` : '·'))),
          h('span', { className: 'htx-dateNavHint' }, '点击日期切换；历史日期首次打开需扫描全市场日K（约20秒），结果缓存后秒出')),

        // 右侧内容
        h('div', { style: { flex: 1, minWidth: 0 } },
          h('div', { className: 'htx-toolbar' },
            h('div', { className: 'htx-row', style: { marginBottom: 0 } },
              h('h3', { className: 'htx-cardTitle', style: { margin: 0 } }, `强势股 · ${v.date || '加载中'}`),
              isLatest
                ? h('span', { className: 'htx-badge htx-badgeUp' }, '盘中实时')
                : h('span', { className: 'htx-badge htx-badgeFlat' }, '已收盘'),
              v.pct ? h('span', { className: 'htx-meta', style: { marginLeft: 0 } }, `当日涨幅 > ${v.pct}%`) : null),
            h('span', { className: 'htx-meta' },
              `强势 ${items.length} 只 · 涨停 ${st.ztCount ?? 0} · 最高连板 ${st.maxLbc ?? '-'} · 平均涨幅 ${pctStr(st.avgPct)}`,
              data.updatedAt ? ` · ${new Date(data.updatedAt).toLocaleTimeString('zh-CN', { hour12: false })}` : '',
              data.error ? h('span', { className: 'htx-metaWarn', title: `刷新失败：${data.error}` }, ' · 刷新失败') : null),
            h(RefreshBtn, { busy: data.refreshing, onClick: () => data.reload(), label: '立即刷新强势股' })),

          data.value == null
            ? (data.error ? h(ErrorBox, { error: data.error }) : h(Spinner))
            : h('div', null,
              !items.length ? h(Empty, { text: `${v.date} 没有涨幅超过 ${v.pct}% 的股票` })
                : h(DataTable, { columns, rows: displayRows, getKey: (r) => r.code, sort, onSortChange }),
              h('p', { className: 'htx-chartNote' },
                isLatest
                  ? '最新交易日为盘中实时数据（60 秒自动刷新），收盘后自动定稿缓存；「涨停 / 连板」来自东财涨停池。'
                  : '历史日期由前复权日K计算（当日收盘 / 前一日收盘 − 1），结果已缓存；「最新涨跌幅」为该股当前实时涨跌。',
                ' 强势股仅供短线情绪观察，不构成投资建议。'))));
    }

    // ---------- 持仓 ----------
    function PortfolioView() {
      const [form, setForm] = useState({ symbol: '', shares: '', costPrice: '' });
      const [busy, setBusy] = useState(false);
      const [sort, setSort] = useState({ key: null, dir: null });
      const data = useData(() => api('portfolio.list'), [], { refreshMs: 15000 });
      const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
      const add = async () => {
        setBusy(true);
        try {
          await api('portfolio.add', { symbol: form.symbol.trim(), shares: Number(form.shares), costPrice: Number(form.costPrice) });
          setForm({ symbol: '', shares: '', costPrice: '' });
          data.reload();
          notifyOk('已建仓');
        } catch (e) { notifyError(e.message); } finally { setBusy(false); }
      };
      const remove = async (code) => {
        if (!window.confirm(`确定清仓 ${code}？此操作会删除该持仓记录。`)) return;
        try { await api('portfolio.remove', { symbol: code }); data.reload(); notifyOk(`已清仓 ${code}`); } catch (e) { notifyError(e.message); }
      };
      const columns = [
        { label: '代码', render: (r) => h('span', { style: { fontWeight: 600 } }, r.symbol) },
        { label: '名称', key: 'name' },
        { label: '持股', key: 'shares', align: 'right' },
        { label: '成本价', key: 'costPrice', align: 'right' },
        { label: '现价', key: 'price', align: 'right' },
        { label: '最新涨跌幅', headerTitle: '当日涨跌幅（现价 vs 昨收）', render: (r) => (r.pctChange == null ? '-' : `${r.pctChange >= 0 ? '+' : ''}${r.pctChange}%`), className: (r) => (r.pctChange == null ? '' : r.pctChange >= 0 ? 'htx-up' : 'htx-down'), align: 'right', sortable: true, sortValue: (r) => (r.pctChange ?? null) },
        { label: '市值', key: 'marketValue', align: 'right' },
        { label: '盈亏', render: (r) => `${fmt(r.pnl)} (${fmt(r.pnlPct)}%)`, className: (r) => (r.pnl >= 0 ? 'htx-up' : 'htx-down'), align: 'right' },
        { label: '', render: (r) => h('button', { className: 'htx-btn htx-btnSm htx-btnDanger', onClick: () => remove(r.symbol) }, '清仓') },
      ];
      const items = data.value?.items || [];
      const tp = data.value?.totalPnl;
      // 排序三态：desc → asc → 取消（与自选页一致，null 沉底）
      const onSortChange = (key) => setSort((s) => (
        s.key !== key ? { key, dir: 'desc' } : s.dir === 'desc' ? { key, dir: 'asc' } : { key: null, dir: null }
      ));
      const sortCol = sort.key && sort.dir ? columns.find((c) => c.label === sort.key) : null;
      const displayRows = sortCol && sortCol.sortValue
        ? [...items].sort((a, b) => {
            const va = sortCol.sortValue(a), vb = sortCol.sortValue(b);
            if (va == null && vb == null) return 0;
            if (va == null) return 1;
            if (vb == null) return -1;
            return sort.dir === 'asc' ? va - vb : vb - va;
          })
        : items;
      return h('div', null,
        h('div', { className: 'htx-toolbar' },
          h(Field, { label: '代码' }, h('input', { className: 'htx-input', style: { width: 110 }, placeholder: '600519', value: form.symbol, onChange: set('symbol') })),
          h(Field, { label: '股数' }, h('input', { className: 'htx-input', style: { width: 90 }, placeholder: '100', value: form.shares, onChange: set('shares') })),
          h(Field, { label: '成本价' }, h('input', { className: 'htx-input', style: { width: 90 }, placeholder: '1400', value: form.costPrice, onChange: set('costPrice') })),
          h('button', { className: 'htx-btn htx-btnPrimary', disabled: busy, onClick: add }, busy ? '保存中…' : '建仓'),
          h('span', { className: 'htx-meta' },
            `持仓 ${items.length} 只`,
            data.updatedAt ? ` · ${new Date(data.updatedAt).toLocaleTimeString('zh-CN', { hour12: false })}` : '',
            data.error ? h('span', { className: 'htx-metaWarn', title: `刷新失败：${data.error}` }, ' · 刷新失败') : null),
          h(RefreshBtn, { busy: data.refreshing, onClick: () => data.reload() })),
        items.length ? h('div', { className: 'htx-metrics' },
          h('div', { className: 'htx-metric' }, h('p', { className: 'htx-metricLabel' }, '总市值'), h('p', { className: 'htx-metricValue' }, fmt(data.value.totalValue))),
          h('div', { className: 'htx-metric' }, h('p', { className: 'htx-metricLabel' }, '总盈亏'), h('p', { className: 'htx-metricValue ' + (tp >= 0 ? 'htx-up' : 'htx-down') }, fmt(tp))),
          h('div', { className: 'htx-metric' }, h('p', { className: 'htx-metricLabel' }, '持仓数'), h('p', { className: 'htx-metricValue' }, String(items.length)))) : null,
        // 数据优先：已有数据就一直显示表格，静默刷新只换数据
        data.value == null
          ? (data.error ? h(ErrorBox, { error: data.error }) : h(Spinner))
          : !items.length ? h(Empty, { text: '持仓为空', hint: '在上方输入代码、股数与成本价即可建仓' })
          : h(DataTable, { columns, rows: displayRows, getKey: (r) => r.symbol, sort, onSortChange }));
    }

    // ---------- 回测 ----------
    function BacktestView() {
      const [form, setForm] = useState({ symbol: '600519', strategy: 'ma_cross', limit: '250', initial: '100000', fast: '5', slow: '20' });
      const [run, setRun] = useState(null);
      const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
      const submit = () => {
        const args = { symbol: form.symbol.trim(), strategy: form.strategy, limit: Number(form.limit) || 250, initial: Number(form.initial) || 100000 };
        if (form.strategy === 'ma_cross') { args.fast = Number(form.fast) || 5; args.slow = Number(form.slow) || 20; }
        setRun({ ...args });
      };
      const data = useData(() => (run ? api('backtest', run) : Promise.resolve(null)), [run]);
      const v = data.value;
      return h('div', null,
        h('div', { className: 'htx-toolbar' },
          h(Field, { label: '代码' }, h('input', { className: 'htx-input', style: { width: 100 }, value: form.symbol, onChange: set('symbol') })),
          h(Field, { label: '策略' },
            h('select', { className: 'htx-input', value: form.strategy, onChange: set('strategy') },
              h('option', { value: 'ma_cross' }, '双均线'), h('option', { value: 'macd_cross' }, 'MACD'), h('option', { value: 'rsi_reversal' }, 'RSI 超买超卖'))),
          form.strategy === 'ma_cross' ? h(Field, { label: '快 / 慢线' },
            h('span', { style: { display: 'flex', gap: 4 } },
              h('input', { className: 'htx-input', style: { width: 52 }, value: form.fast, onChange: set('fast') }),
              h('input', { className: 'htx-input', style: { width: 52 }, value: form.slow, onChange: set('slow') }))) : null,
          h(Field, { label: 'K线数' }, h('input', { className: 'htx-input', style: { width: 72 }, value: form.limit, onChange: set('limit') })),
          h(Field, { label: '初始资金' }, h('input', { className: 'htx-input', style: { width: 96 }, value: form.initial, onChange: set('initial') })),
          h('button', { className: 'htx-btn htx-btnPrimary', onClick: submit }, '运行')),
        data.error ? h(ErrorBox, { error: data.error })
          : !run ? h(Empty, { text: '设置策略参数', hint: '选择策略与标的，点击「运行」开始回测' })
          : data.loading ? h(Spinner)
          : h('div', null,
              h('div', { className: 'htx-metrics' },
                h('div', { className: 'htx-metric' }, h('p', { className: 'htx-metricLabel' }, '期末资金'), h('p', { className: 'htx-metricValue' }, fmt(v.final))),
                h('div', { className: 'htx-metric' }, h('p', { className: 'htx-metricLabel' }, '总收益'), h('p', { className: 'htx-metricValue ' + (v.totalReturnPct >= 0 ? 'htx-up' : 'htx-down') }, `${v.totalReturnPct}%`)),
                h('div', { className: 'htx-metric' }, h('p', { className: 'htx-metricLabel' }, '最大回撤'), h('p', { className: 'htx-metricValue' }, `${v.maxDrawdownPct}%`)),
                h('div', { className: 'htx-metric' }, h('p', { className: 'htx-metricLabel' }, '夏普'), h('p', { className: 'htx-metricValue' }, fmt(v.sharpe))),
                h('div', { className: 'htx-metric' }, h('p', { className: 'htx-metricLabel' }, '交易 / 胜率'), h('p', { className: 'htx-metricValue' }, `${v.tradeCount} / ${fmt(v.winRate)}%`))),
              h(CurveChart, { values: v.equityCurve, baseline: v.initial, height: 180 }),
              h('div', { className: 'htx-callout', style: { marginTop: 10 } }, '以上为历史数据回测，不构成投资建议，未来表现不可预知。')));
    }

    // ---------- 资讯 ----------
    function NewsView() {
      const [type, setType] = useState('news');
      const [symbol, setSymbol] = useState('');
      const [run, setRun] = useState({ type: 'news', count: 30 });
      const [cat, setCat] = useState(null);            // 选中的分类 key（null = 全部）
      const [onlyWatch, setOnlyWatch] = useState(false); // 只看自选相关
      const data = useData(() => api('news', run), [run]);
      const watch = useData(() => api('watchlist.list'), [], { refreshMs: 60000 });
      const search = (t, sy) => { setType(t); setCat(null); setRun({ type: t, ...(sy ? { symbol: sy } : {}), count: 30 }); };
      const items = data.value?.items || [];
      // 自选股匹配集合：代码 + 名称（快讯正文一般提名称不提代码）
      const watchRows = watch.value?.items || [];
      const watchByCode = new Map(watchRows.map((w) => [w.symbol, w]));
      const matchWatch = (n) => {
        if (n.code && watchByCode.has(String(n.code))) return true;
        const text = `${n.title || ''}${n.summary || ''}`;
        return watchRows.some((w) => w.name && w.name.length >= 2 && text.includes(w.name));
      };
      const itemsWatched = onlyWatch ? items.filter(matchWatch) : items;

      // —— 分类规则：先命中先归类 ——
      const NEWS_CATS = [
        { key: 'reg', label: '监管动态', words: ['证监会', '交易所', '上交所', '深交所', '北交所', '立案', '处罚', '监管函', '问询', '纪律处分', '先行赔付', '违法', '虚假陈述'] },
        { key: 'macro', label: '宏观', words: ['央行', '美联储', '国务院', '财政部', '统计局', 'GDP', 'CPI', 'PMI', 'LPR', '降准', '降息', '加息', '外汇', '汇率', '国债', '关税', '伊朗', '中东'] },
        { key: 'mkt', label: '市场行情', words: ['指数', '沪指', '深成指', '创业板', '科创', '涨停', '跌停', '成交额', '北向', '两融', '期货', '黄金', '原油', '钯金', '美元', '盎司', '涨%', '跌%'] },
      ];
      const ANN_CATS = [
        { key: 'perf', label: '业绩报告', words: ['业绩', '季报', '半年报', '年报', '快报', '预告', '说明会'] },
        { key: 'incentive', label: '股权激励', words: ['激励', '员工持股'] },
        { key: 'ma', label: '投资并购', words: ['重组', '收购', '合并', '要约', '购买', '出售资产', '对外投资', '土地', '项目'] },
        { key: 'shares', label: '增减持回购', words: ['增持', '减持', '回购', '质押'] },
        { key: 'dividend', label: '分红派息', words: ['分红', '派息', '利润分配', '权益分派'] },
        { key: 'raise', label: '融资发行', words: ['定增', '非公开发行', '发行', '募集', '可转债'] },
        { key: 'gov', label: '公司治理', words: ['股东会', '董事会', '监事会', '决议', '法律意见', '章程', '换届', '提名', '自查'] },
      ];
      const classify = (item) => {
        const text = `${item.title || ''}${item.summary || ''}`;
        const cats = type === 'news' ? NEWS_CATS : ANN_CATS;
        for (const c of cats) if (c.words.some((w) => text.includes(w))) return c;
        return null;
      };
      const catLabel = (key) => (type === 'news' ? NEWS_CATS : ANN_CATS).find((c) => c.key === key)?.label || '其他';
      const catClass = (key) => (key === 'reg' ? 'htx-tagReg' : key === 'macro' ? 'htx-tagMacro' : key === 'mkt' ? 'htx-tagMkt' : 'htx-tagOther');
      const withCat = itemsWatched.map((n) => {
        const c = classify(n);
        return { ...n, cat: c ? c.key : 'other', catLabel: c ? c.label : '其他' };
      });
      const catCount = (key) => withCat.filter((x) => x.cat === key).length;
      const cats = (type === 'news' ? NEWS_CATS : ANN_CATS).map((c) => ({ ...c, count: catCount(c.key) })).filter((c) => c.count > 0);
      const otherCount = withCat.filter((x) => x.cat === 'other').length;
      const filtered = cat ? withCat.filter((x) => x.cat === cat) : withCat;

      const [adding, setAdding] = useState(null);   // 正在加入的 code（防重复点击）
      const quickAdd = async (code) => {
        const c = String(code ?? '').trim();
        if (!/^\d{6}$/.test(c)) { notifyError(`无效代码：${code}`); return; }
        if (adding === c) return;                    // 同一只正在处理，忽略重复点击
        setAdding(c);
        try {
          const v = await api('watchlist.add', { symbols: [c] });
          if (v.added?.length) notifyOk(`已加入自选：${c}`);
          else notifyWarn(`${c} 已在自选`);
        } catch (e) { notifyError(`加入自选失败：${e.message}`); }
        finally { setAdding(null); }
      };
      const yi = (v) => (v / 1e8).toFixed(2);
      const pct = (v) => (v == null ? '-' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`);

      // —— 龙虎榜：按代码聚合（同一股票可因多个原因上榜，金额为同日同一笔，不重复计）——
      const lhbAgg = (() => {
        if (type !== 'lhb') return { rows: [], buyers: [], sellers: [], dates: [] };
        const map = new Map();
        for (const it of itemsWatched) {
          const cur = map.get(it.code);
          if (!cur) { map.set(it.code, { ...it, reasons: [it.reason || '—'] }); continue; }
          if (it.reason && !cur.reasons.includes(it.reason)) cur.reasons.push(it.reason);
          if (Math.abs(it.netBuyAmt) > Math.abs(cur.netBuyAmt)) { cur.netBuyAmt = it.netBuyAmt; cur.buyAmt = it.buyAmt; cur.sellAmt = it.sellAmt; }
        }
        const rows = [...map.values()];
        const buyers = rows.filter((x) => x.netBuyAmt > 0).sort((a, b) => b.netBuyAmt - a.netBuyAmt);
        const sellers = rows.filter((x) => x.netBuyAmt <= 0).sort((a, b) => a.netBuyAmt - b.netBuyAmt);
        const dates = [...new Set(items.map((x) => x.date))].sort().reverse();
        return { rows, buyers, sellers, dates };
      })();
      const topBuy = lhbAgg.buyers[0];
      const topSell = lhbAgg.sellers[0];
      const sumBuy = lhbAgg.buyers.reduce((a, b) => a + b.netBuyAmt, 0);
      const sumSellAbs = Math.abs(lhbAgg.sellers.reduce((a, b) => a + b.netBuyAmt, 0));
      const chartRows = [
        ...lhbAgg.buyers.slice(0, 7),
        ...lhbAgg.sellers.slice(0, 5),
      ].sort((a, b) => b.netBuyAmt - a.netBuyAmt);
      const maxAbs = Math.max(1, ...chartRows.map((r) => Math.abs(r.netBuyAmt)));

      // —— 快讯：时间轴分组 ——
      const newsGroups = (() => {
        if (type !== 'news') return [];
        const groups = [];
        let cur = null;
        for (const n of filtered) {
          const date = (n.showTime || '').slice(0, 10) || '未知';
          if (!cur || cur.date !== date) { cur = { date, items: [] }; groups.push(cur); }
          cur.items.push(n);
        }
        return groups;
      })();
      const lastHourCount = withCat.filter((n) => {
        const t = Date.now() - new Date((n.showTime || '').replace(' ', 'T') + '+08:00').getTime();
        return t >= 0 && t < 3600_000;
      }).length;
      const regCount = catCount('reg');
      const macroCount = catCount('macro');

      // —— 公告：分类统计 ——
      const annStats = type === 'announcement' ? cats.map((c) => ({ ...c })) : [];

      const columns = type === 'lhb' ? [
        { label: '名称', render: (r) => h('span', { style: { fontWeight: 600 } }, r.name) },
        { label: '代码', render: (r) => h('span', { style: { fontVariantNumeric: 'tabular-nums', color: 'var(--dsw-alias-label-tertiary)' } }, r.code) },
        { label: '收盘', render: (r) => r.close, align: 'right' },
        { label: '涨跌幅', render: (r) => pct(r.changeRate), className: (r) => (r.changeRate >= 0 ? 'htx-up' : 'htx-down'), align: 'right' },
        { label: '净买额(亿)', render: (r) => yi(r.netBuyAmt), className: (r) => (r.netBuyAmt >= 0 ? 'htx-up' : 'htx-down'), align: 'right', sortable: true, sortValue: (r) => r.netBuyAmt },
        { label: '总成交(亿)', render: (r) => ((r.buyAmt + r.sellAmt) / 2 / 1e8).toFixed(2), align: 'right' },
        { label: '换手%', render: (r) => r.turnover, align: 'right' },
        { label: '上榜原因', render: (r) => h('div', { className: 'htx-reasonChips' }, r.reasons.slice(0, 3).map((x, i) => h('span', { key: i, className: 'htx-reasonChip', title: x }, x.length > 18 ? x.slice(0, 17) + '…' : x))) },
        { label: '', render: (r) => h('button', { className: 'htx-btn htx-btnSm', disabled: adding === String(r.code), onClick: () => quickAdd(r.code) }, adding === String(r.code) ? '加入中…' : '+ 自选') },
      ] : null;
      const [lhbSort, setLhbSort] = useState({ key: null, dir: null });
      const onLhbSort = (key) => setLhbSort((s0) => (s0.key !== key ? { key, dir: 'desc' } : s0.dir === 'desc' ? { key, dir: 'asc' } : { key: null, dir: null }));
      const lhbSortCol = type === 'lhb' && lhbSort.key && lhbSort.dir ? columns.find((c) => c.label === lhbSort.key) : null;
      const lhbRows = lhbSortCol && lhbSortCol.sortValue
        ? [...lhbAgg.rows].sort((a, b) => {
            const va = lhbSortCol.sortValue(a), vb = lhbSortCol.sortValue(b);
            if (va == null && vb == null) return 0;
            if (va == null) return 1;
            if (vb == null) return -1;
            return lhbSort.dir === 'asc' ? va - vb : vb - va;
          })
        : lhbAgg.rows;

      const tagFor = (key) => h('span', { className: `htx-tag ${catClass(key)}` }, catLabel(key));

      return h('div', null,
        h('div', { className: 'htx-toolbar' },
          h(Field, { label: '资讯类型' },
            h(Seg, {
              ariaLabel: '资讯类型',
              value: type,
              onChange: (t) => search(t, t === 'announcement' ? symbol.trim() : ''),
              options: [{ value: 'news', label: '快讯' }, { value: 'lhb', label: '龙虎榜' }, { value: 'announcement', label: '公告' }],
            })),
          h('label', { className: 'htx-watchToggle', title: '只显示与自选股相关的条目（龙虎榜/公告按代码匹配，快讯按标题/摘要中的股票名称匹配）' },
            h('input', {
              type: 'checkbox', checked: onlyWatch,
              onChange: (e) => setOnlyWatch(e.target.checked),
            }),
            '只看自选'),
          type === 'announcement' ? h(Field, { label: '代码（可空）' },
            h('span', { style: { display: 'flex', gap: 4 } },
              h('input', { className: 'htx-input', style: { width: 110 }, placeholder: '600519', value: symbol, onChange: (e) => setSymbol(e.target.value), onKeyDown: (e) => e.key === 'Enter' && search('announcement', symbol.trim()) }),
              h('button', { className: 'htx-btn htx-btnSm', onClick: () => search('announcement', symbol.trim()) }, '查询'))) : null,
          h('span', { className: 'htx-meta' },
            `${data.value?.title || ''} ${onlyWatch ? `${filtered.length}/${items.length}` : items.length} 条`,
            onlyWatch && watch.loading ? ' · 自选加载中' : '',
            data.updatedAt ? ` · ${new Date(data.updatedAt).toLocaleTimeString('zh-CN', { hour12: false })}` : '',
            data.error ? h('span', { className: 'htx-metaWarn', title: `刷新失败：${data.error}` }, ' · 刷新失败') : null),
          h(RefreshBtn, { busy: data.refreshing, onClick: () => data.reload() })),

        data.error ? h(ErrorBox, { error: data.error }) : data.loading ? h(Spinner)
          : !items.length ? h(Empty, { text: '暂无内容', hint: '换个类型或稍后再试' })
          : onlyWatch && !filtered.length ? h(Empty, { text: '自选股相关的资讯暂无', hint: '关闭「只看自选」查看全部，或在自选股中加入更多个股' })
          : h('div', null,

            // ===== 龙虎榜：资金摘要 + 分歧图 + 聚合表 =====
            type === 'lhb' ? h('div', null,
              h('div', { className: 'htx-sumCard' },
                h('b', null, `${lhbAgg.rows.length} 家上榜`),
                `（${lhbAgg.dates.length > 1 ? lhbAgg.dates.join('、') : lhbAgg.dates[0] || ''}）：机构/营业部合计`,
                h('b', { className: 'htx-up' }, ` 净买 ${yi(sumBuy)} 亿`),
                '、',
                h('b', { className: 'htx-down' }, `净卖 ${yi(sumSellAbs)} 亿`),
                '。资金分歧最大的是 ',
                topBuy ? h('b', null, `${topBuy.name}（净买 ${yi(topBuy.netBuyAmt)} 亿，${pct(topBuy.changeRate)}）`) : null,
                topBuy && topSell ? '；' : null,
                topSell ? h('b', null, `${topSell.name}（净卖 ${yi(Math.abs(topSell.netBuyAmt))} 亿，${pct(topSell.changeRate)}）`) : null,
                '。'),
              h('div', { className: 'htx-metrics' },
                h('div', { className: 'htx-metric' }, h('p', { className: 'htx-metricLabel' }, '上榜家数'), h('p', { className: 'htx-metricValue' }, String(lhbAgg.rows.length))),
                h('div', { className: 'htx-metric' }, h('p', { className: 'htx-metricLabel' }, '净买合计(亿)'), h('p', { className: 'htx-metricValue htx-up' }, yi(sumBuy))),
                h('div', { className: 'htx-metric' }, h('p', { className: 'htx-metricLabel' }, '净卖合计(亿)'), h('p', { className: 'htx-metricValue htx-down' }, yi(sumSellAbs))),
                topBuy ? h('div', { className: 'htx-metric' }, h('p', { className: 'htx-metricLabel' }, '净买王'), h('p', { className: 'htx-metricValue' }, topBuy.name)) : null,
                topSell ? h('div', { className: 'htx-metric' }, h('p', { className: 'htx-metricLabel' }, '净卖王'), h('p', { className: 'htx-metricValue' }, topSell.name)) : null),
              chartRows.length ? h('div', { className: 'htx-card' },
                h('h3', { className: 'htx-cardTitle' }, '多空分歧榜（净买 ←→ 净卖，点行加入自选）'),
                h('div', { className: 'htx-lhbChart' },
                  chartRows.map((r) => {
                    const w = `${(Math.abs(r.netBuyAmt) / maxAbs * 50).toFixed(1)}%`;
                    const buy = r.netBuyAmt > 0;
                    return h('div', {
                      key: `${r.code}-${r.reason}`, className: 'htx-lhbRow',
                      title: adding === String(r.code) ? '加入中…' : '点击加入自选',
                      style: adding === String(r.code) ? { opacity: 0.55, cursor: 'wait' } : undefined,
                      onClick: () => quickAdd(r.code),
                    },
                      h('span', { className: 'htx-lhbName' }, r.name),
                      h('div', { className: 'htx-lhbTrack' },
                        h('div', { className: `htx-lhbBar ${buy ? 'buy' : 'sell'}`, style: buy ? { width: w } : { width: w } })),
                      h('span', { className: `htx-lhbAmt ${buy ? 'htx-up' : 'htx-down'}` }, `${buy ? '+' : ''}${yi(r.netBuyAmt)} 亿`));
                  }))) : null,
              lhbRows.length ? h('div', { className: 'htx-card', style: { paddingTop: 10 } },
                h(DataTable, { columns, rows: lhbRows, getKey: (r) => `${r.code}-${r.reason}`, sort: lhbSort, onSortChange: onLhbSort })) : null) : null,

            // ===== 快讯：摘要 + 分类筛选 + 时间轴 =====
            type === 'news' ? h('div', null,
              h('div', { className: 'htx-metrics' },
                h('div', { className: 'htx-metric' }, h('p', { className: 'htx-metricLabel' }, '快讯总数'), h('p', { className: 'htx-metricValue' }, String(items.length))),
                h('div', { className: 'htx-metric' }, h('p', { className: 'htx-metricLabel' }, '最近 1 小时'), h('p', { className: 'htx-metricValue' }, String(lastHourCount))),
                h('div', { className: 'htx-metric' }, h('p', { className: 'htx-metricLabel' }, '监管动态'), h('p', { className: 'htx-metricValue' }, String(regCount))),
                h('div', { className: 'htx-metric' }, h('p', { className: 'htx-metricLabel' }, '宏观'), h('p', { className: 'htx-metricValue' }, String(macroCount)))),
              (cats.length || otherCount) ? h('div', { className: 'htx-catChips' },
                h('button', { type: 'button', className: 'htx-catChip', 'aria-pressed': cat == null, onClick: () => setCat(null) }, '全部', h('b', null, String(withCat.length))),
                cats.map((c) => h('button', { key: c.key, type: 'button', className: 'htx-catChip', 'aria-pressed': cat === c.key, onClick: () => setCat(cat === c.key ? null : c.key) }, c.label, h('b', null, String(c.count)))),
                otherCount ? h('button', { type: 'button', className: 'htx-catChip', 'aria-pressed': cat === 'other', onClick: () => setCat(cat === 'other' ? null : 'other') }, '其他', h('b', null, String(otherCount))) : null) : null,
              regCount ? h('div', { className: 'htx-sumCard', style: { borderInlineStartColor: 'var(--dsw-alias-state-error-primary)' } },
                h('b', null, '监管动态提醒：'), '近期有 ', h('b', { className: 'htx-up' }, `${regCount} 条监管相关`),
                ' 快讯——', withCat.filter((x) => x.cat === 'reg').slice(0, 2).map((x) => x.title).join('；') || '',
                '。相关个股请留意公告与风险提示。') : null,
              h('ul', { className: 'htx-tl' },
                newsGroups.flatMap((g0) => [
                  h('li', { key: `d-${g0.date}`, className: 'htx-tlDate', style: { position: 'static', listStyle: 'none' } }, g0.date),
                  ...g0.items.map((n, i) => h('li', { key: `${g0.date}-${i}`, className: n.cat === 'other' ? '' : n.cat },
                    h('span', { className: 'htx-tlTime' }, (n.showTime || '').slice(11, 16)),
                    h('span', { className: 'htx-tlDot' }),
                    h('div', { className: 'htx-tlTitle' }, n.title || n.summary, tagFor(n.cat)),
                    n.summary && n.summary !== n.title ? h('div', { className: 'htx-tlSum' }, n.summary) : null)),
                ]))) : null,

            // ===== 公告：分类统计 chips + 分类标记列表 =====
            type === 'announcement' ? h('div', null,
              annStats.length ? h('div', { className: 'htx-catChips' },
                h('button', { type: 'button', className: 'htx-catChip', 'aria-pressed': cat == null, onClick: () => setCat(null) }, '全部', h('b', null, String(withCat.length))),
                annStats.map((c) => h('button', { key: c.key, type: 'button', className: 'htx-catChip', 'aria-pressed': cat === c.key, onClick: () => setCat(cat === c.key ? null : c.key) }, c.label, h('b', null, String(c.count)))),
                otherCount ? h('button', { type: 'button', className: 'htx-catChip', 'aria-pressed': cat === 'other', onClick: () => setCat(cat === 'other' ? null : 'other') }, '其他', h('b', null, String(otherCount))) : null) : null,
              h('ul', { className: 'htx-tl', style: { paddingInlineStart: 0 } },
                filtered.map((n, i) => h('li', { key: i, style: { listStyle: 'none', paddingInlineStart: 0 } },
                  h('div', { style: { display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 4px', borderBottom: '0.5px solid var(--dsw-alias-border-l3)' } },
                    h('span', { className: 'htx-tlDate', style: { margin: 0, flex: 'none', minWidth: 56 } }, (n.noticeDate || '').slice(0, 10)),
                    h('span', { className: 'htx-badge htx-badgeFlat', style: { flex: 'none' }, title: n.code || '' }, `${n.name || n.code || '—'}`),
                    h('div', { style: { flex: 1, minWidth: 0 } },
                      h('div', { className: 'htx-tlTitle', style: { fontWeight: 500 } }, n.title, tagFor(n.cat))),
                    h('button', { className: 'htx-btn htx-btnSm', style: { flex: 'none' }, disabled: adding === String(n.code), onClick: () => quickAdd(n.code) }, adding === String(n.code) ? '加入中…' : '+ 自选')))))) : null));
    }

    // ---------- 预警 ----------
    function AlertsView() {
      const [form, setForm] = useState({ symbol: '', condition: 'price_above', value: '' });
      const data = useData(() => api('alerts.list'), []);
      const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
      const create = async () => {
        try {
          await api('alerts.create', { symbol: form.symbol.trim(), condition: form.condition, value: Number(form.value) });
          setForm({ symbol: '', condition: 'price_above', value: '' });
          data.reload();
          notifyOk('预警规则已创建');
        } catch (e) { notifyError(e.message); }
      };
      const del = async (id) => {
        if (!window.confirm('确定删除这条预警规则？')) return;
        try { await api('alerts.delete', { id }); data.reload(); notifyOk('已删除'); } catch (e) { notifyError(e.message); }
      };
      const condLabel = { price_above: '价高于', price_below: '价低于', pct_above: '涨幅高于', pct_below: '涨幅低于' };
      const columns = [
        { label: '代码', render: (r) => h('span', { style: { fontWeight: 600 } }, r.symbol) },
        { label: '名称', key: 'name' },
        { label: '条件', render: (r) => `${condLabel[r.condition] || r.condition} ${r.value}` },
        { label: '状态', render: (r) => (r.triggered ? '已触发' : r.enabled ? '监控中' : '停用'), className: (r) => (r.triggered ? 'htx-up' : undefined) },
        { label: '最近触发', render: (r) => (r.lastTriggeredAt ? String(r.lastTriggeredAt).slice(0, 16).replace('T', ' ') : '-') },
        { label: '', render: (r) => h('button', { className: 'htx-btn htx-btnSm htx-btnDanger', onClick: () => del(r.id) }, '删除') },
      ];
      const items = data.value?.items || [];
      return h('div', null,
        h('div', { className: 'htx-toolbar' },
          h(Field, { label: '代码' }, h('input', { className: 'htx-input', style: { width: 110 }, placeholder: '600519', value: form.symbol, onChange: set('symbol'), onKeyDown: (e) => e.key === 'Enter' && create() })),
          h(Field, { label: '条件' },
            h('select', { className: 'htx-input', value: form.condition, onChange: set('condition') },
              h('option', { value: 'price_above' }, '价高于'), h('option', { value: 'price_below' }, '价低于'),
              h('option', { value: 'pct_above' }, '涨幅高于'), h('option', { value: 'pct_below' }, '涨幅低于'))),
          h(Field, { label: '阈值' }, h('input', { className: 'htx-input', style: { width: 90 }, placeholder: '1500', value: form.value, onChange: set('value'), onKeyDown: (e) => e.key === 'Enter' && create() })),
          h('button', { className: 'htx-btn htx-btnPrimary', onClick: create }, '创建'),
          h('span', { className: 'htx-meta' }, `共 ${items.length} 条`)),
        data.error ? h(ErrorBox, { error: data.error }) : data.loading ? h(Spinner)
          : !items.length ? h(Empty, { text: '暂无预警规则', hint: '在上方设置条件与阈值即可创建，交易时段自动检查' })
          : h(DataTable, { columns, rows: items, getKey: (r) => r.id }));
    }

    // ---------- API 说明 ----------
    const API_OPS = [
      {
        op: 'suggest', title: '证券模糊搜索（股票/ETF 名称·拼音·代码）',
        params: [
          ['q', 'string', '是', '关键词：股票名称（茅台）、拼音缩写（gzmt）、代码（600519）或 ETF 名称（沪深300ETF）'],
          ['count', 'number', '否', '最多返回条数，默认 8，上限 10'],
        ],
        req: `GET /api?op=suggest&q=茅台

POST /api
{"op":"suggest","args":{"q":"宁德"}}`,
        res: `{
  "ok": true,
  "value": {
    "items": [
      { "market": "sh", "code": "600519", "name": "贵州茅台", "pinyin": "gzmt" }
    ]
  }
}`,
      },
      {
        op: 'quote', title: '批量实时行情',
        params: [
          ['symbols', 'string[]', '是', 'A股 6 位代码。GET 用逗号分隔，POST 用数组'],
        ],
        req: `# GET
GET /api?op=quote&symbols=600519,000001

# POST
POST /api
{"op":"quote","args":{"symbols":["600519","000001"]}}`,
        res: `{
  "ok": true,
  "value": {
    "quotes": [
      {
        "code": "600519",
        "name": "贵州茅台",
        "price": 1453,
        "prevClose": 1452,
        "open": 1450,
        "high": 1457.72,
        "low": 1436,
        "volume": 42848,        // 手
        "amount": 619953,       // 万元
        "change": 1,
        "pctChange": 0.07,      // %
        "turnover": 0.34,       // 换手率 %
        "pe": 22.11,
        "pb": 6.7,
        "totalMcap": 18163.69,  // 亿元
        "floatMcap": 18163.69,
        "amplitude": 1.5,
        "limitUp": 1597.2,
        "limitDown": 1306.8,
        "time": "20261106161458",
        "source": "tencent"
      }
    ],
    "source": "tencent(+sina)",
    "fetchedAt": "2026-11-06T09:17:44.494Z"
  }
}`,
      },
      {
        op: 'kline', title: '历史 K线',
        params: [
          ['symbol', 'string', '是', '6 位 A股代码'],
          ['period', 'string', '否', 'day（默认）/week/month/m5/m15/m30/m60'],
          ['limit', 'number', '否', '条数 1~1000，默认 60'],
        ],
        req: `GET /api?op=kline&symbol=600519&period=day&limit=5

POST /api
{"op":"kline","args":{"symbol":"600519","period":"day","limit":5}}`,
        res: `{
  "ok": true,
  "value": {
    "symbol": "600519",
    "period": "day",
    "bars": [
      {
        "date": "2026-11-05",
        "open": 1446.7,
        "high": 1466,
        "low": 1430,
        "close": 1452,
        "volume": 4671220     // 股
      }
      // …共 limit 条
    ]
  }
}`,
      },
      {
        op: 'analysis', title: '技术面 + 基本面概览',
        params: [
          ['symbol', 'string', '是', '6 位 A股代码'],
        ],
        req: `GET /api?op=analysis&symbol=600519`,
        res: `{
  "ok": true,
  "value": {
    "symbol": "600519",
    "quote": { "code":"600519", "name":"贵州茅台", "price":1453, "pctChange":0.07, "pe":22.11, "pb":6.7, "totalMcap":18163.69 /* …同 quote */ },
    "indicators": {
      "ma5": 1454.108, "ma10": 1405.322,
      "ma20": 1358.2055, "ma60": 1312.6608,
      "dif": 44.0837, "dea": 31.5278, "hist": 25.1118,
      "macdSignal": "多头",
      "rsi14": 70.55, "rsiSignal": "超买",
      "k": 85.37, "d": 87.32, "j": 81.48, "kdjSignal": "-",
      "close": 1453
    },
    "bars": [ /* 最近 120 根日线 */ ],
    "barCount": 120,
    "at": "2026-11-06T09:17:44.644Z"
  }
}`,
      },
      {
        op: 'screen', title: '全市场排序 / 区间过滤',
        params: [
          ['sort', 'string', '否', 'amount（默认）/changepercent/turnoverratio/mktcap'],
          ['limit', 'number', '否', '1~300，默认 30'],
          ['peMin / peMax', 'number', '否', '市盈率区间（>0）'],
          ['mcapMinYi / mcapMaxYi', 'number', '否', '总市值区间（亿元）'],
          ['pctMin / pctMax', 'number', '否', '涨跌幅区间（%）'],
          ['turnoverMin', 'number', '否', '换手率下限（%）'],
        ],
        req: `GET /api?op=screen&sort=changepercent&pctMin=5&turnoverMin=3&limit=20

POST /api
{"op":"screen","args":{"sort":"changepercent","pctMin":5,"turnoverMin":3,"limit":20}}`,
        res: `{
  "ok": true,
  "value": {
    "rows": [
      {
        "code": "920085",
        "symbol": "bj920085",
        "name": "N森峰",
        "price": 39.25,
        "change": 21.46,
        "pctChange": 120.63,
        "prevClose": 17.79, "open": 45, "high": 49.98, "low": 39.25,
        "volume": 17486703, "amount": 800999638,
        "pe": 22.82, "pb": 3.621,
        "totalMcapYi": 29.83, "floatMcapYi": 7.31,
        "turnover": 93.89424
      }
      // …最多 limit 条
    ],
    "sortLabel": "涨跌幅",
    "count": 20
  }
}`,
      },
      {
        op: 'energy', title: '市场量能（沪深京日成交额 + 指数涨跌）',
        params: [
          ['days', 'number', '否', '统计区间：20（默认）/40/60 个交易日'],
        ],
        req: `GET /api?op=energy&days=20

POST /api
{"op":"energy","args":{"days":20}}`,
        res: `{
  "ok": true,
  "value": {
    "days": 20,
    "stats": {
      "date": "2026-11-09", "total": 14947.2, "delta": -1770.7,
      "ma5": 18139.3, "rangeAvg": 16536, "rangeMax": 21353.2, "rangeMin": 14265.9,
      "pctSh": 0.32, "pctCyb": -0.27, "pctKc": 0.3,
      "vsMa5Pct": -17.6, "status": "缩量"
    },
    "series": [
      { "date": "2026-11-09", "sh": 6825.3, "sz": 8000.8, "bj": 121.1,
        "total": 14947.2, "delta": -1770.7, "ma5": 18139.3,
        "pctSh": 0.32, "pctCyb": -0.27, "pctKc": 0.3 }
      // …按日期升序，最后一条为最新交易日
    ],
    "notes": { "bj": "北证50成交额（京市口径）", "total": "沪市 + 深市 + 京市" },
    "source": "eastmoney"
  }
}`,
      },
      {
        op: 'powerful', title: '强势股（当日涨幅 > 7%，最近 10 个交易日）',
        params: [
          ['date', 'string', '否', '交易日 YYYY-MM-DD，默认最新交易日；仅支持最近 10 个交易日'],
        ],
        req: `GET /api?op=powerful
GET /api?op=powerful&date=2026-11-06

POST /api
{"op":"powerful","args":{"date":"2026-11-06"}}`,
        res: `{
  "ok": true,
  "value": {
    "pct": 7,
    "date": "2026-11-06",
    "dates": [   // 降序：date 交易日 / count 强势股数 / isLatest
      { "date": "2026-11-09", "count": 130, "isLatest": true },
      { "date": "2026-11-06", "count": 54, "isLatest": false }
      // …共最近 10 个交易日；未扫描的历史日 count=null
    ],
    "items": [
      { "code": "301697", "name": "贝特利", "pct": 20, "close": 36.6,
        "industry": "光伏设备",
        "zt": { "lbc": 3, "fbt": "09:34:06", "fund": 83161641,
                "zbc": 1, "zttj": { "days": 3, "ct": 3 } },   // 涨停池信息，非涨停为 null
        "latestPct": -4.26, "latestPrice": 35.04 }             // 当前实时涨跌
    ],
    "stats": { "count": 54, "ztCount": 32, "maxLbc": 5, "avgPct": 10.2 },
    "note": "历史日期由前复权日K计算（收盘价为前复权口径），已缓存",
    "source": "eastmoney"
  }
}`,
      },
      {
        op: 'news', title: '快讯 / 公告 / 龙虎榜',
        params: [
          ['type', 'string', '是', 'news 快讯 / announcement 公告 / lhb 龙虎榜'],
          ['symbol', 'string', '否', '公告按代码过滤（announcement 用）'],
          ['count', 'number', '否', '1~50，默认 20'],
        ],
        req: `# 快讯
GET /api?op=news&type=news&count=5

# 个股公告
GET /api?op=news&type=announcement&symbol=600519

# 龙虎榜
GET /api?op=news&type=lhb`,
        res: `// type=news
{
  "ok": true,
  "value": {
    "title": "A股快讯",
    "items": [
      {
        "title": "…新闻标题",
        "summary": "…摘要",
        "showTime": "2026-11-06 17:16:33",
        "code": "202611063924889684"
      }
    ]
  }
}

// type=lhb
{
  "ok": true,
  "value": {
    "title": "龙虎榜",
    "items": [
      {
        "date": "2026-11-06",
        "code": "000603", "name": "盛达资源",
        "close": 26.53, "changeRate": 1.8426,
        "netBuyAmt": 152721281.91,   // 元
        "buyAmt": 532117587.27,
        "sellAmt": 379396305.36,
        "reason": "连续三个交易日内，涨幅偏离值累计达到20%的证券",
        "turnover": 12.0592,
        "title": "000603 盛达资源 净买额 15272 万"
      }
    ]
  }
}

// type=announcement
{ "ok": true, "value": { "title": "600519 公告", "items": [
  { "code":"600519", "name":"贵州茅台", "title":"…公告标题",
    "noticeDate":"2026-11-03 00:00:00", "artCode":"AN2026…" } ] } }`,
      },
      {
        op: 'backtest', title: '策略回测',
        params: [
          ['symbol', 'string', '是', '6 位 A股代码'],
          ['strategy', 'string', '是', 'ma_cross / macd_cross / rsi_reversal'],
          ['limit', 'number', '否', '回看日线根数，默认 250'],
          ['initial', 'number', '否', '初始资金，默认 100000'],
          ['fast / slow', 'number', '否', 'ma_cross 快/慢线周期，默认 5 / 20'],
          ['rsiLow / rsiHigh', 'number', '否', 'rsi_reversal 超卖/超买阈值，默认 30 / 70'],
        ],
        req: `GET /api?op=backtest&symbol=000001&strategy=ma_cross&limit=250&initial=100000

POST /api
{"op":"backtest","args":{"symbol":"000001","strategy":"ma_cross","limit":250,"fast":5,"slow":20}}`,
        res: `{
  "ok": true,
  "value": {
    "symbol": "000001",
    "strategy": "ma_cross",
    "label": "双均线交叉",
    "params": { "fast": 5, "slow": 20 },
    "initial": 100000,
    "final": 101244.14,
    "totalReturnPct": 1.24,
    "annualizedPct": 2.63,
    "maxDrawdownPct": 7.13,
    "sharpe": 0.28,
    "tradeCount": 3,
    "winRate": 66.67,
    "trades": [
      { "buyDate":"2026-06-10", "buyPrice":11.32,
        "sellDate":"2026-06-18", "sellPrice":10.52,
        "shares":8800, "pnl":-7040, "pnlPct":-7.07 }
    ],
    "holdingShares": 8500,
    "equityCurve": [100000, 99800, /* …每根 K线一个权益值 */ ],
    "barCount": 120
  }
}`,
      },
      {
        op: 'watchlist.list / add / remove / setTier / setDomain / setTags', title: '自选股 查 / 增 / 删 / 设关注度 / 设领域 / 设标签',
        params: [
          ['op', 'string', '是', 'list 查询 / add 新增 / remove 删除 / setTier 设置关注度 / setTags 设置标签'],
          ['symbols', 'string[]', '增删改时是', 'A股代码数组；GET 用逗号分隔'],
          ['tier', 'string', '否', '关注度：basic 基础股（默认）/ selected 精选股 / trading 交易股'],
          ['tags', 'string[]', '否', '标签数组（每只≤10个，单个≤12字）：add 随新增写入；setTags 全量替换'],
          ['tier / tag（list 时）', 'string', '否', 'list 按关注度或标签过滤'],
        ],
        req: `# 查询（可按关注度/标签过滤）
GET /api?op=watchlist.list
GET /api?op=watchlist.list&tier=selected
GET /api?op=watchlist.list&tag=白酒

# 新增（默认基础股，可带标签）
POST /api
{"op":"watchlist.add","args":{"symbols":["600519"],"tier":"selected","tags":["白酒","核心资产"]}}

# 改关注度
POST /api
{"op":"watchlist.setTier","args":{"symbols":["600519"],"tier":"trading"}}

# 设置标签（全量替换）
POST /api
{"op":"watchlist.setTags","args":{"symbols":["600519"],"tags":["白酒","龙头"]}}

# 删除
POST /api
{"op":"watchlist.remove","args":{"symbols":["600519"]}}`,
        res: `// watchlist.list
{
  "ok": true,
  "value": {
    "items": [
      {
        "symbol": "600519",
        "name": "贵州茅台",
        "price": 1453,
        "pctChange": 0.07,
        "tier": "selected",
        "tags": ["白酒", "核心资产"],
        "addedAt": "2026-11-06T09:00:41.234Z",
        "pctN": { "1": -1.2, "2": 3.4, "3": 5.6, "4": 7.8, "5": 9.0,
                   "10": 12.3, "15": -4.5, "20": 6.7, "30": 9.9 }
        // T-n = 最新价较 T-(n+1) 收盘的累计涨跌幅（T-1 即近 2 个交易日累计）
      }
    ],
    "tiers": { "basic": "基础股", "selected": "精选股", "trading": "交易股" },
    "counts": { "basic": 0, "selected": 1, "trading": 0 },
    "tagCloud": [ { "tag": "白酒", "count": 1 } ]
  }
}

// add / setTier / setTags（返回受影响项，含实时行情）
{ "ok": true, "value": { "items": [ { "symbol":"600519", "name":"贵州茅台", "tier":"trading", "tags":["白酒"] } ], "added": [...], "existed": [...] } }`,
      },
      {
        op: 'portfolio.list / add / remove', title: '持仓 查 / 建仓 / 清仓',
        params: [
          ['op', 'string', '是', 'portfolio.list / portfolio.add / portfolio.remove'],
          ['symbol', 'string', 'add/remove 是', '6 位 A股代码'],
          ['shares', 'number', 'add 是', '持股数量（股）'],
          ['costPrice', 'number', 'add 是', '成本价（元）'],
        ],
        req: `# 查询（含实时市值/盈亏）
GET /api?op=portfolio.list

# 建仓
POST /api
{"op":"portfolio.add","args":{"symbol":"000001","shares":100,"costPrice":11.5}}

# 清仓
POST /api
{"op":"portfolio.remove","args":{"symbol":"000001"}}`,
        res: `// portfolio.list
{
  "ok": true,
  "value": {
    "items": [
      {
        "symbol": "000001",
        "name": "平安银行",
        "shares": 100,
        "costPrice": 11.5,
        "price": 11.81,
        "marketValue": 1181,
        "pnl": 31,
        "pnlPct": 2.7
      }
    ],
    "totalPnl": 31,
    "totalValue": 1181
  }
}`,
      },
      {
        op: 'alerts.list / create / delete', title: '预警 查 / 建 / 删',
        params: [
          ['op', 'string', '是', 'alerts.list / alerts.create / alerts.delete'],
          ['symbol', 'string', 'create 是', '6 位 A股代码'],
          ['condition', 'string', 'create 是', 'price_above / price_below / pct_above / pct_below'],
          ['value', 'number', 'create 是', '阈值（价格元 或 涨跌幅%）'],
          ['id', 'string', 'delete 是', 'create 返回的规则 id'],
        ],
        req: `# 查询
GET /api?op=alerts.list

# 创建：600519 价格上破 1500 提醒
POST /api
{"op":"alerts.create","args":{"symbol":"600519","condition":"price_above","value":1500}}

# 删除
POST /api
{"op":"alerts.delete","args":{"id":"83c439f5-94d1-4ceb-a0db-970f1dc71a2b"}}`,
        res: `// alerts.list（触发后 triggered=true）
{
  "ok": true,
  "value": {
    "items": [
      {
        "id": "83c439f5-94d1-4ceb-a0db-970f1dc71a2b",
        "symbol": "600519",
        "name": "贵州茅台",
        "condition": "price_above",
        "value": 1500,
        "enabled": true,
        "createdAt": "2026-11-06T09:17:51.997Z",
        "triggered": false,
        "lastTriggeredAt": null
      }
    ]
  }
}`,
      },
    ];

    function ApiView() {
      const code = (text) => h('pre', { className: 'htx-code' }, h('code', null, text));
      const h2 = (t) => h('h3', { className: 'htx-apiH2' }, t);
      const block = (...children) => h('div', { className: 'htx-apiBlock' }, ...children);
      const ic = (t) => h('code', { className: 'htx-inline' }, t);
      const label = (t) => h('p', { className: 'htx-apiLabel' }, t);

      const paramTable = (params) => h('table', { className: 'htx-apiTable' },
        h('thead', null, h('tr', null,
          h('th', null, '参数'), h('th', null, '类型'), h('th', null, '必填'), h('th', null, '说明'))),
        h('tbody', null, params.map(([name, type, req, desc]) => h('tr', { key: name },
          h('td', null, h('code', { className: 'htx-inline' }, name)),
          h('td', null, type), h('td', null, req), h('td', null, desc)))));

      return h('div', { className: 'htx-api' },
        h2('独立 HTTP 服务'),
        block(h('p', null, h('b', null, '随插件自动启动'), '，默认监听 ', ic('http://127.0.0.1:8099'), '；插件停用即关闭。也可在 Harness 未运行时手动 ', ic('node server.js'), '。任何本机程序均可调用，返回 JSON，与 GUI / Agent 共享同一份 SQLite。')),
        block(h('p', null, '环境变量：', ic('HITRADING_PORT'), '（默认 8099）、', ic('HITRADING_HOST'), '（默认 127.0.0.1）、', ic('HITRADING_TOKEN'), '（可选，设置后需 ', ic('Authorization: Bearer <token>'), '）、', ic('HITRADING_DB'), '（默认 ', ic('~/.dsh/storages/hitrading.db'), '）。')),

        h2('端点与通用返回'),
        block(h('p', null, ic('GET /health'), ' — 健康检查')),
        block(h('p', null, ic('GET /api?op=<op>&<参数>=…'), ' — 查询型调用（参数走 query）')),
        block(h('p', null, ic('POST /api'), ' — 所有调用均可 POST，body 为 ', ic('{"op":"<op>","args":{…}}'))),
        block(h('p', null, '成功：'), ic('{ "ok": true, "value": <结果> }'), '；失败：', ic('{ "ok": false, "error": "<原因>" }'), '（HTTP 400）。'),
        code(`{
  "ok": true,
  "value": { /* 各 op 的结构见下 */ }
}`),

        h2('接口详情'),
        block(h('p', null, '每个接口下列出：请求参数表 → 请求示例 → 响应示例。所有示例均为真实返回结构。')),

        ...API_OPS.map((spec) => h('div', { className: 'htx-apiCard', key: spec.op },
          h('p', { className: 'htx-apiOp' },
            h('code', { className: 'htx-inline' }, spec.op),
            h('span', { className: 'htx-apiDesc' }, spec.title)),
          label('请求参数'),
          paramTable(spec.params),
          label('请求示例'),
          code(spec.req),
          label('响应示例'),
          code(spec.res))),

        h2('Python 示例'),
        code(`import requests
B = "http://127.0.0.1:8099"

# 行情 / K线 / 选股
requests.get(f"{B}/api", params={"op":"quote","symbols":"600519,000001"}).json()["value"]["quotes"]
requests.get(f"{B}/api", params={"op":"kline","symbol":"600519","period":"day","limit":60}).json()["value"]["bars"]
requests.get(f"{B}/api", params={"op":"screen","sort":"changepercent","pctMin":5}).json()["value"]["rows"]

# 自选（与 GUI 共享）
requests.post(f"{B}/api", json={"op":"watchlist.add","args":{"symbols":["600519"]}})
requests.get(f"{B}/api", params={"op":"watchlist.list"}).json()["value"]["items"]`),

        h2('curl 示例'),
        code(`curl "http://127.0.0.1:8099/api?op=quote&symbols=600519,000001"
curl -X POST http://127.0.0.1:8099/api \\
  -H "Content-Type: application/json" \\
  -d '{"op":"backtest","args":{"symbol":"600519","strategy":"ma_cross","limit":250}}'`),
      );
    }

    // ---------- Agent 技能 ----------
    const SKILLS = [
      {
        tool: 'hitrading_quote', desc: '批量实时行情（现价/涨跌幅/PE/PB/市值/换手）',
        prompts: ['查一下 600519 和 000001 的行情', '看看宁德时代 300750 现在多少钱'],
      },
      {
        tool: 'hitrading_kline', desc: '历史 K线（日/周/月/分钟）',
        prompts: ['看 600519 最近 60 根日K', '拉一下 300750 的周线'],
      },
      {
        tool: 'hitrading_analysis', desc: '个股技术面（MA/MACD/RSI/KDJ）+ 估值概览',
        prompts: ['分析一下 600519', '600519 现在的 MACD 和 RSI 怎么样'],
      },
      {
        tool: 'hitrading_screen', desc: '全市场排序 + 区间过滤选股',
        prompts: ['筛选涨跌幅超 5% 且换手率超 3% 的股票', '找市盈率低于 20、市值 100 亿以上的票'],
      },
      {
        tool: 'hitrading_market_energy', desc: '沪深京三市日成交额与量能状态（放量/缩量）',
        prompts: ['今天市场是放量还是缩量？', '看看最近 40 个交易日沪深京成交额趋势'],
      },
      {
        tool: 'hitrading_powerful', desc: '强势股：按交易日看当日涨幅>7%的股票（涨停/连板/行业）',
        prompts: ['今天有哪些强势股？', '看看 11 月 6 日的强势股都是哪些，连板高度如何'],
      },
      {
        tool: 'hitrading_watchlist', desc: '自选股增删查（与面板共享）',
        prompts: ['把 600519 加入自选', '看看我的自选股现在什么情况'],
      },
      {
        tool: 'hitrading_portfolio', desc: '本地持仓与盈亏（不接券商）',
        prompts: ['记录持仓 600519 100股 成本1400', '看看我持仓的盈亏'],
      },
      {
        tool: 'hitrading_news', desc: '快讯 / 个股公告 / 龙虎榜',
        prompts: ['看看今日龙虎榜', '600519 最近有什么公告'],
      },
      {
        tool: 'hitrading_backtest', desc: '内置策略回测（双均线/MACD/RSI）',
        prompts: ['回测 600519 双均线策略', '用 MACD 策略回测一下 000001 近一年'],
      },
      {
        tool: 'hitrading_alert', desc: '价格/涨跌幅预警规则',
        prompts: ['设置 600519 价格上破 1500 时提醒', '看看我设了哪些预警'],
      },
    ];

    // ---------- 试用：新开会话并预填提示词 ----------
    /** apply 时注入的客户端 ctx，供面板里的「试用」触发导航。 */
    let appCtx = null;

    function SkillsView() {
      const [copied, setCopied] = useState('');
      const doc = useData(() => api('skill.doc'), []);
      const h2 = (t) => h('h3', { className: 'htx-apiH2' }, t);
      const block = (...c) => h('div', { className: 'htx-apiBlock' }, ...c);
      const ic = (t) => h('code', { className: 'htx-inline' }, t);
      const copy = async (text, tag) => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(tag ?? text);
          window.setTimeout(() => setCopied(''), 1500);
        } catch { /* 剪贴板不可用时静默 */ }
      };
      const tryPrompt = async (p) => {
        const c = appCtx;
        const get = (n) => (c && typeof c.get === 'function' ? c.get(n) : undefined);
        const uiWorkspace = get('uiWorkspace');
        const workspaces = get('workspaces');
        const sessions = get('sessions');
        const conversation = get('conversation');
        const sleep = (ms) => new Promise((r) => window.setTimeout(r, ms));
        let workspaceId;
        try {
          if (!uiWorkspace || !workspaces || !sessions) throw new Error('客户端服务未就绪');
          const items = workspaces.list.getSnapshot().items || [];
          if (!items.length) throw new Error('还没有工作区');
          // 优先选「已有空白会话」的工作区，便于复用而不是每次新建
          workspaceId = items[0].workspaceId;
          try {
            const s = sessions.list.getSnapshot();
            const blank = (s.ids || []).find((id) => s.byId[id] && s.byId[id].blank);
            const hit = blank ? items.find((w) => w.sessionIds.includes(blank)) : undefined;
            if (hit) workspaceId = hit.workspaceId;
          } catch { /* ignore */ }

          // 首选：connect（复用空白或新建）→ 打开 → 等 binding → 写入草稿
          if (typeof uiWorkspace.connectWorkspace === 'function' && conversation && conversation.input) {
            const sessionId = await uiWorkspace.connectWorkspace(workspaceId, {});
            uiWorkspace.openSession(sessionId);
            for (let i = 0; i < 40; i++) {
              const binding = typeof sessions.binding === 'function' ? sessions.binding(sessionId) : undefined;
              if (binding) {
                const result = conversation.input.requestDraftInitialization(binding, { prompt: p, clearPreviousDraft: true });
                if (result === 'applied') return;
                throw new Error('草稿初始化被拒（' + result + '）');
              }
              await sleep(50);
            }
            throw new Error('会话未就绪');
          }

          // 次选：官方 startSession（显式工作区）
          uiWorkspace.startSession(workspaceId, { prompt: p, clearPreviousDraft: true });
          return;
        } catch (e) {
          // 最后再试一次 startSession，仍失败则复制并提示
          try {
            if (uiWorkspace && workspaceId && typeof uiWorkspace.startSession === 'function') {
              uiWorkspace.startSession(workspaceId, { prompt: p, clearPreviousDraft: true });
              return;
            }
          } catch { /* ignore */ }
          const msg = e && e.message ? e.message : String(e);
          notifyWarn('试用失败：' + msg + '（已复制提示词）');
          copy(p);
        }
      };
      const download = () => {
        try {
          const text = doc.value?.content || '';
          const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'SKILL.md';
          a.click();
          URL.revokeObjectURL(a.href);
        } catch (e) { window.alert('下载失败：' + e.message); }
      };
      const fetchCmd = `curl -o <技能目录>/hitrading/SKILL.md http://127.0.0.1:8099/skill.md`;
      const agentPrompt = `请把 http://127.0.0.1:8099/skill.md 安装到你的 skills 目录（例如 ~/.agents/skills/hitrading/SKILL.md），然后按其中的说明使用 A股能力。`;

      return h('div', { className: 'htx-api' },
        h2('在对话里用'),
        h('div', { className: 'htx-skillIntro' },
          '在对话框里直接说下面任意一句，Agent 会自动调用对应的 HiTrading 工具并返回结果。',
          '也可以切到「行情自选 / 选股 / 持仓 / 回测 / 资讯 / 预警」Tab 直接点选操作——两者读写的是同一份数据。'),
        h('div', { className: 'htx-skillGrid' }, SKILLS.map((s) => h('div', { className: 'htx-skillCard', key: s.tool },
          h('p', { className: 'htx-skillName' }, s.tool),
          h('p', { className: 'htx-skillDesc' }, s.desc),
          ...s.prompts.map((p) => h('div', { className: 'htx-prompt', key: p },
            h('span', null, p),
            h('span', { style: { display: 'flex', gap: 8, flexShrink: 0 } },
              h('button', { className: 'htx-copy', onClick: () => copy(p) }, copied === p ? '已复制' : '复制'),
              h('button', { className: 'htx-copy', onClick: () => tryPrompt(p) }, '试用'))),
        )))),
        h('div', { className: 'htx-callout', style: { marginTop: 14 } },
          '结果仅供研究参考，不构成投资建议；数据来自公开免费接口，可能存在延迟或误差。'),

        h2('给其他 Agent 用'),
        block(h('p', null, '技能就是一份 ', ic('SKILL.md'), '：先启动服务（', ic('node server.js'), '），再把它放进目标 Agent 的技能目录，安装交给 Agent 自己完成。')),
        block(h('p', null, '通用命令（把 ', ic('<技能目录>'), ' 换成你的）：')),
        block(h('pre', { className: 'htx-code' }, h('code', null, fetchCmd),
          h('button', { className: 'htx-copy', style: { marginTop: 6 }, onClick: () => copy(fetchCmd, 'fetch') }, copied === 'fetch' ? '已复制' : '复制命令'))),
        block(h('p', null, '更省事：把下面这句话直接发给目标 Agent，它自己会装 ——')),
        block(h('pre', { className: 'htx-code' }, h('code', null, agentPrompt),
          h('button', { className: 'htx-copy', style: { marginTop: 6 }, onClick: () => copy(agentPrompt, 'prompt') }, copied === 'prompt' ? '已复制' : '复制'))),
        block(h('p', null, '常见技能目录：', ic('~/.agents/skills'), '、', ic('~/.claude/skills'), '、', ic('~/.cursor/skills'), '（按你用的 Agent 选一个即可）。')),

        h2('技能文档（SKILL.md）'),
        h('div', { className: 'htx-docHead' },
          block(h('p', null, doc.loading ? '加载中…' : doc.error ? `读取失败：${doc.error}` : '以下内容与安装后的 SKILL.md 完全一致，含全部接口、示例与任务配方。')),
          h('div', { style: { display: 'flex', gap: 8 } },
            h('button', { className: 'htx-btn', onClick: () => copy(doc.value?.content || '', 'doc') }, copied === 'doc' ? '已复制' : '复制全文'),
            h('button', { className: 'htx-btn htx-btnPrimary', onClick: download }, '下载 SKILL.md'))),
        doc.error ? null : h('pre', { className: 'htx-code htx-skillDoc' }, h('code', null, doc.value?.content || '')),

        h2('HTTP 读写要点'),
        block(h('p', null, '读：', ic('GET /api?op=quote&symbols=600519'), '、', ic('GET /api?op=screen&pctMin=5'), ' 等。')),
        block(h('p', null, '写：', ic('POST /api'), '，body ', ic('{"op":"watchlist.add","args":{"symbols":["600519"]}}'), '。')),
        block(h('p', null, '写入会立即影响面板与 Harness 内 Agent 看到的数据（共享同一份 SQLite）；执行前应确认用户意图。')),

        h2('安全提示'),
        block(h('p', null, '服务默认只监听 ', ic('127.0.0.1'), '，仅本机可访问。若设置了 ', ic('HITRADING_TOKEN'), '，所有请求需带 ', ic('Authorization: Bearer <token>'), '。')),
      );
    }

    // ---------- 使用说明 ----------
    function GuideView() {
      const h2 = (t) => h('h3', { className: 'htx-apiH2' }, t);
      const block = (...c) => h('div', { className: 'htx-apiBlock' }, ...c);
      const ic = (t) => h('code', { className: 'htx-inline' }, t);
      const code = (t) => h('pre', { className: 'htx-code' }, h('code', null, t));
      const tabs = [
        ['行情自选', '加自选、看实时行情表；点个股代码看 K线图 + 指标详情'],
        ['量能', '沪深京三市日成交额趋势（柱 + MA5）：区间 20/40/60 日、量能状态、指数涨跌与明细表'],
        ['强势股', '按交易日看当日涨幅 > 7% 的股票：左侧日期导航切换，含涨停连板、首封时间、行业与最新涨跌'],
        ['选股', '按涨跌幅/成交额/换手/市值排序，叠加市盈率、市值、涨幅、换手区间过滤'],
        ['持仓', '记录持股与成本，实时算市值、盈亏、盈亏率'],
        ['回测', '双均线/MACD/RSI 策略回测，出权益曲线、收益、回撤、夏普、胜率'],
        ['资讯', 'A股快讯、个股公告、龙虎榜'],
        ['预警', '设置价格/涨跌幅阈值，交易时段由定时器检查并标记「已触发」'],
        ['Agent 技能', '11 个工具的可复制提示词示例——照抄到对话框即可'],
        ['API', '独立 HTTP 服务的完整接口文档（参数表 + 请求/响应示例）'],
      ];
      return h('div', { className: 'htx-api' },
        h2('HiTrading 是什么'),
        block(h('p', null, '一个运行在 DeepSeek Harness 内的 A股研究助手：**11 个 Agent 工具 + 一个可交互控制台**。数据存在本机 SQLite，纯分析，不连接券商、不真实下单。')),

        h2('三种用法'),
        block(h('p', null, h('b', null, '① 控制台：'), '点左侧栏 HiTrading 图标，用下面这些 Tab 直接点击操作。')),
        block(h('p', null, h('b', null, '② 对话：'), '在聊天框直接说需求（示例见「Agent 技能」Tab），Agent 会自动调用对应工具并返回结果。')),
        block(h('p', null, h('b', null, '③ 外部程序：'), '随插件自动启动（', ic('127.0.0.1:8099'), '），无需手动；用 HTTP API 接入，适合 Python / R 量化脚本（见「API」Tab）。')),

        h2('Tab 速览'),
        h('table', { className: 'htx-apiTable' },
          h('thead', null, h('tr', null, h('th', null, 'Tab'), h('th', null, '作用'))),
          h('tbody', null, tabs.map(([t, d]) => h('tr', { key: t },
            h('td', null, h('b', null, t)), h('td', null, d))))),

        h2('数据与存储'),
        block(h('p', null, '自选 / 持仓 / 预警存在 ', ic('~/.dsh/storages/hitrading.db'), '（SQLite，WAL 模式）。')),
        block(h('p', null, '控制台、Agent 工具、外部 HTTP 服务，', h('b', null, '读写的都是同一份'), '，任意一处修改其余两处立即可见。')),
        block(h('p', null, '行情 / K线 / 资讯不落盘：实时从公开接口拉取并做短时内存缓存，避免限流。')),
        block(h('p', null, '每小时自动快照一份到 ', ic('hitrading.db.bak'), '；误删/误改可用它恢复（把 .bak 复制回 .db 即可）。')),

        h2('数据来源'),
        block(h('p', null, '行情：腾讯（主）+ 新浪（兜底）；K线与全市场列表：新浪；量能（指数日成交额）：东方财富；资讯 / 公告 / 龙虎榜：东方财富。')),
        block(h('p', null, '均为公开免费接口，', h('b', null, '可能存在延迟或误差'), '，不保证实时性与准确性。')),

        h2('启动独立 API 服务'),
        code(`cd /Users/luyuchao/Documents/workgo/hitrading
node server.js          # 默认 http://127.0.0.1:8099
# 可选：HITRADING_PORT / HITRADING_TOKEN / HITRADING_DB`),

        h2('风险提示'),
        h('div', { className: 'htx-callout', style: { marginTop: 4 } },
          '所有行情、指标、选股与回测结果仅供研究参考，', h('b', null, '不构成任何投资建议'), '。投资有风险，请自行核实并独立决策。'),
      );
    }

    // ---------- App ----------
    const TABS = [
      { id: 'market', label: '行情自选', group: 'work', render: () => h(MarketView) },
      { id: 'energy', label: '量能', group: 'work', render: () => h(EnergyView) },
      { id: 'powerful', label: '强势股', group: 'work', render: () => h(PowerfulView) },
      { id: 'screen', label: '选股', group: 'work', render: () => h(ScreenView) },
      { id: 'portfolio', label: '持仓', group: 'work', render: () => h(PortfolioView) },
      { id: 'backtest', label: '回测', group: 'work', render: () => h(BacktestView) },
      { id: 'news', label: '资讯', group: 'work', render: () => h(NewsView) },
      { id: 'alerts', label: '预警', group: 'work', render: () => h(AlertsView) },
      { id: 'skills', label: 'Agent 技能', group: 'ref', render: () => h(SkillsView) },
      { id: 'api', label: 'API', group: 'ref', render: () => h(ApiView) },
      { id: 'guide', label: '使用说明', group: 'ref', render: () => h(GuideView) },
    ];

    /** 服务状态灯 + 启动/停止/重启（面板头部常驻）。 */
    function ServiceBar() {
      const [st, setSt] = useState(null);
      const [busy, setBusy] = useState('');
      const [msg, setMsg] = useState('');

      const load = useCallback(async () => {
        try {
          setSt(await api('service.status'));
        } catch (e) {
          setSt({ running: false, error: e.message });
        }
      }, []);

      useEffect(() => {
        load();
        const timer = window.setInterval(load, 5000);
        return () => window.clearInterval(timer);
      }, [load]);

      const act = async (name) => {
        setBusy(name);
        setMsg('');
        try {
          const v = await api('service.' + name);
          if (v && v.message) {
            setMsg(v.message);
            window.setTimeout(() => setMsg(''), 2500);
          }
        } catch (e) {
          setMsg('操作失败：' + e.message);
        }
        await load();
        setBusy('');
      };

      const running = !!(st && st.running);
      const port = st && st.port ? st.port : 8099;
      const tone = st == null ? 'unknown' : running ? 'up' : 'down';
      const label = st == null ? '检测中…' : running ? `服务 :${port} 运行中` : `服务 :${port} 已停止`;

      return h('div', { className: 'htx-svc' },
        h('span', { className: `htx-dot htx-dot-${tone}`, 'aria-hidden': true }),
        h('span', { className: 'htx-svcLabel', title: st && st.pid ? `pid ${st.pid}` : '' }, label),
        msg ? h('span', { className: 'htx-svcMsg' }, msg) : null,
        h('span', { className: 'htx-svcBtns' },
          h('button', { className: 'htx-svcBtn', disabled: !!busy || running, onClick: () => act('start') }, busy === 'start' ? '…' : '启动'),
          h('button', { className: 'htx-svcBtn', disabled: !!busy || !running, onClick: () => act('stop') }, busy === 'stop' ? '…' : '停止'),
          h('button', { className: 'htx-svcBtn', disabled: !!busy, onClick: () => act('restart') }, busy === 'restart' ? '…' : '重启')),
      );
    }

    function Console() {
      const [tab, setTab] = useState('market');
      const active = TABS.find((t) => t.id === tab);
      const workTabs = TABS.filter((t) => t.group === 'work');
      const refTabs = TABS.filter((t) => t.group === 'ref');
      const tabBtn = (t) => h('button', {
        key: t.id,
        className: t.group === 'ref' ? 'htx-tab htx-tabRef' : 'htx-tab',
        'aria-selected': tab === t.id,
        onClick: () => setTab(t.id),
      }, t.label);
      return h('section', { className: 'htx-page', 'aria-label': 'HiTrading', 'data-plugin-panel': PANEL_ID },
        h('style', { key: 'style' }, CSS),
        h('header', { className: 'htx-head' },
          h('h1', { className: 'htx-title' }, 'HiTrading'),
          h('span', { className: 'htx-sub' }, '选赛道，做减法，精选股'),
          h(ServiceBar)),
        h('nav', { className: 'htx-tabs', 'aria-label': '导航' },
          workTabs.map(tabBtn),
          h('span', { className: 'htx-tabsGap' }),
          h('span', { className: 'htx-tabsRule', 'aria-hidden': true }),
          refTabs.map(tabBtn)),
        h('div', { className: 'htx-body' },
          h(ToastHost),
          active.render()));
    }
    function Glyph(props) {
      return h('svg', { width: props.size || 18, height: props.size || 18, viewBox: '0 0 64 64', fill: 'none', 'aria-hidden': true, style: { display: 'block' } },
        h('path', { d: 'M12 46 L30 32 L44 20 L54 12', stroke: 'currentColor', strokeWidth: 4, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }),
        h('g', null,
          h('line', { x1: 22, y1: 26, x2: 22, y2: 48, stroke: '#e63946', strokeWidth: 2 }),
          h('line', { x1: 32, y1: 18, x2: 32, y2: 40, stroke: '#e63946', strokeWidth: 2 }),
          h('line', { x1: 42, y1: 10, x2: 42, y2: 32, stroke: '#e63946', strokeWidth: 2 }),
          h('rect', { x: 18, y: 30, width: 8, height: 11, rx: 1, fill: '#e63946' }),
          h('rect', { x: 28, y: 22, width: 8, height: 13, rx: 1, fill: '#e63946' }),
          h('rect', { x: 38, y: 14, width: 8, height: 11, rx: 1, fill: '#e63946' })));
    }

    function apply(ctx) {
      appCtx = ctx;

      ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
        name: 'sidebar.panellist', id: PANEL_ID, order: 21, locale: NS, label: () => 'HiTrading',
      }, Glyph));

      ctx.slots.inject('main', () => ctx.slots.register({
        name: 'main', key: PANEL_ID, locale: NS,
      }, Console));
    }

    return { inject: ['slots', 'locale', 'uiWorkspace', 'layout'], apply };
  },
});