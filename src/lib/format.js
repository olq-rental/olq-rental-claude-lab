// ── AI Activity Log：source → 日本語表示名・家族キーの対応表 ──
// 新しい自走AI処理を繋ぐ時はここに1行追記するだけでバーに札が出る。
export const AI_SOURCE_MAP = {
  market_report_submit:   { label: "市場レポート", family: "market_report" },
  market_report_retrieve: { label: "市場レポート", family: "market_report" },
  qa_generate:            { label: "Q&A生成",      family: "qa_generate" },
  refine_knowledge:       { label: "改善統合",      family: "refine_knowledge" },
  ga4_sync:               { label: "GA4同期",       family: "ga4_sync" },
  concept_update:         { label: "コンセプト更新", family: "concept_update" },
  freee_sync:             { label: "freee同期",     family: "freee_sync" },
  line_inbox:             { label: "LINE受信",     family: "line_inbox" },
};
export function aiSourceMeta(source) {
  return AI_SOURCE_MAP[source] || { label: source, family: source };
}

export const taxIn  = n => Math.round((n||0)*1.1);
export const taxEx  = n => Math.round((n||0)/1.1);
export const fmt    = n => `¥${Number(n||0).toLocaleString()}`;
export const fmtD   = d => d ? new Date(d).toLocaleDateString("ja-JP") : "―";
export const uid    = () => `${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
export const today  = () => {const d=new Date();return d.getFullYear()+"-"+(String(d.getMonth()+1).padStart(2,"0"))+"-"+(String(d.getDate()).padStart(2,"0"));};
