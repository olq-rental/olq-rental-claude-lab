import React, { useState, useEffect } from "react";
import { supabase } from '../supabaseClient';
import { S } from '../lib/ui';

export function CouncilCard({ showToast }) {
  const [weeks, setWeeks] = useState([]);
  const [selId, setSelId] = useState(null);
  const [replies, setReplies] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  // 週次一覧の取得
  const fetchWeeks = async () => {
    const { data } = await supabase
      .from('council_weekly')
      .select('id, week_date, status, report_text, completed_at')
      .order('created_at', { ascending: false });
    const rows = data || [];
    setWeeks(rows);
    if (rows.length > 0 && !selId) setSelId(rows[0].id);
    setLoading(false);
  };

  // スレッド取得
  const fetchReplies = async (cid) => {
    if (!cid) return;
    const { data } = await supabase
      .from('council_replies')
      .select('*')
      .eq('council_id', cid)
      .order('created_at', { ascending: true });
    setReplies(data || []);
  };

  useEffect(() => { fetchWeeks(); }, []);
  useEffect(() => { if (selId) fetchReplies(selId); }, [selId]);

  const selWeek = weeks.find(w => w.id === selId);
  const isIncomplete = selWeek && selWeek.status !== 'completed';

  // 返信送信（幽霊伝票封鎖の原則: DB成功後のみ画面反映）
  const handleSend = async () => {
    if (!text.trim() || !selId || sending) return;
    setSending(true);
    try {
      const { error } = await supabase
        .from('council_replies')
        .insert({ council_id: selId, reply_text: text.trim() });
      if (error) throw error;
      setText("");
      await fetchReplies(selId);
      showToast("返信を送信しました");
    } catch (e) {
      showToast("送信失敗: " + e.message, false);
    }
    setSending(false);
  };

  const fmtTime = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    const pad = n => String(n).padStart(2, '0');
    return `${jst.getUTCMonth() + 1}/${pad(jst.getUTCDate())} ${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}`;
  };

  if (loading) return <div style={{ textAlign: "center", padding: 40, color: "#94a3b8", fontSize: 13 }}>読み込み中...</div>;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "16px", textAlign: "left" }}>
      {/* 週セレクタ */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <select
          value={selId || ""}
          onChange={e => { setSelId(e.target.value); setExpanded(false); }}
          style={{ ...S.inp, width: 240 }}
        >
          {weeks.map(w => (
            <option key={w.id} value={w.id}>
              {w.week_date}{w.status !== 'completed' ? ' (生成中)' : ''}
            </option>
          ))}
        </select>
        <button onClick={() => { fetchWeeks(); if (selId) fetchReplies(selId); }} style={S.btn("#64748b", true)}>
          更新
        </button>
      </div>

      {/* 生成中バナー */}
      {isIncomplete && (
        <div style={{ background: "#fef9c3", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#92400e" }}>
          ⏳ 生成中（段階: {selWeek.status || 'pending'}）— 毎時:15の心拍で段階回収されます。完了まで report_text は不完全な場合があります。
        </div>
      )}

      {/* 判断書バブル（先頭） */}
      {selWeek && (
        <div style={{ ...S.card, padding: "18px 20px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 8 }}>📋 週次判断書 — {selWeek.week_date}</div>
          {selWeek.report_text ? (
            <>
              <div style={{
                whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.7, color: "#1e293b",
                maxHeight: expanded ? "none" : "60vh", overflow: expanded ? "visible" : "auto"
              }}>
                {selWeek.report_text}
              </div>
              <button
                onClick={() => setExpanded(!expanded)}
                style={{ background: "none", border: "none", color: "#2563eb", fontSize: 11, cursor: "pointer", marginTop: 6, padding: 0 }}
              >
                {expanded ? "折りたたむ" : "全文表示"}
              </button>
            </>
          ) : (
            <div style={{ color: "#94a3b8", fontSize: 13 }}>（レポート未生成）</div>
          )}
        </div>
      )}

      {/* 返信スレッド（LINE式） */}
      <div style={{ marginBottom: 14 }}>
        {replies.map((r, i) => {
          const isMe = r.author === 'y_inoue';
          return (
            <div key={r.id || i} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", marginBottom: 8 }}>
              <div style={{
                maxWidth: "75%", padding: "10px 14px", borderRadius: 12,
                background: isMe ? "#dcfce7" : "#eff6ff",
                border: isMe ? "1px solid #bbf7d0" : "1px solid #dbeafe",
              }}>
                {!isMe && <div style={{ fontSize: 10, fontWeight: 700, color: "#3b82f6", marginBottom: 3 }}>{r.author}</div>}
                <div style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.6, color: "#1e293b" }}>{r.reply_text}</div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4, textAlign: isMe ? "right" : "left" }}>{fmtTime(r.created_at)}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 返信欄 */}
      <div style={{ ...S.card, padding: 16 }}>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="返信を入力..."
          style={{ ...S.inp, height: 80, resize: "vertical", marginBottom: 10 }}
        />
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={handleSend} disabled={sending || !text.trim()} style={{ ...S.btn("#0f172a"), opacity: sending || !text.trim() ? 0.5 : 1, cursor: sending || !text.trim() ? "not-allowed" : "pointer" }}>
            {sending ? "送信中..." : "送信"}
          </button>
          <button onClick={() => setText(t => "問い直し: " + t)} style={S.btn("#dc2626", true)}>前提が違う</button>
          <button onClick={() => setText(t => "⑦-1: " + t)} style={S.btn("#2563eb", true)}>⑦へ返信</button>
        </div>
        <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 10 }}>
          ※ 対話ターン: 評議会の応答生成は当面ターミナルの curl（/council-respond）で実行。上の「更新」ボタンでスレッドを再取得できます。
        </div>
      </div>
    </div>
  );
}
