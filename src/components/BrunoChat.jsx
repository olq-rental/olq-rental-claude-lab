import React, { useState, useEffect, useRef } from "react";
import { supabase } from '../supabaseClient';

// ---- Bruno会話 UI文言 ----
const BRUNO_UI = {
  ja: {
    title: 'Bruno 会話',
    placeholder: 'メッセージを入力…',
    preview: '翻訳プレビュー',
    send: '送信',
    sending: '送信中…',
    previewing: '翻訳中…',
    aiNotes: 'AIの指摘',
    weekOf: d => `${d.getMonth()+1}/${d.getDate()}の週`,
    errorAuth: '認証エラー。再ログインしてください。',
    errorGeneral: '送信に失敗しました。',
    errorPreview: '翻訳プレビューに失敗しました。',
    loading: '読み込み中…',
    empty: 'メッセージはまだありません',
    editedHint: '※ 内容が変更されました。再プレビューしてください。',
    reportTitle: '今日の市場レポート',
    copy: '📋 コピー',
    copied: '✅ コピーしました',
  },
  en: {
    title: 'Bruno Chat',
    placeholder: 'Type a message…',
    preview: 'Translation Preview',
    send: 'Send',
    sending: 'Sending…',
    previewing: 'Translating…',
    aiNotes: 'AI Notes',
    weekOf: d => `Week of ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]} ${d.getDate()}`,
    errorAuth: 'Auth error. Please log in again.',
    errorGeneral: 'Failed to send.',
    errorPreview: 'Translation preview failed.',
    loading: 'Loading…',
    empty: 'No messages yet',
    editedHint: '* Text changed. Please re-preview.',
    reportTitle: "Today's Market Report (Japanese)",
    copy: '📋 Copy',
    copied: '✅ Copied',
  },
};
const BRUNO_NAMES = { ja: { y_inoue: '雄太', bruno: 'Bruno' }, en: { y_inoue: 'Yuta', bruno: 'Bruno' } };

function getJSTMonday(date) {
  // JST = UTC+9
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const day = jst.getUTCDay(); // 0=Sun
  const diff = day === 0 ? 6 : day - 1; // days since Monday
  const mon = new Date(jst);
  mon.setUTCDate(mon.getUTCDate() - diff);
  const y = mon.getUTCFullYear();
  const m = String(mon.getUTCMonth() + 1).padStart(2, '0');
  const d = String(mon.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function BrunoChat({ session, isBruno }) {
  const viewerLang = isBruno ? 'en' : 'ja';
  const T = BRUNO_UI[viewerLang];
  const nameMap = BRUNO_NAMES[viewerLang];

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [previewData, setPreviewData] = useState(null); // {translation, notes, originalText}
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const [report, setReport] = useState(null); // {text, generatedAt}
  const [reportOpen, setReportOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const INPUT_LINE_H = 21; // fontSize14 × lineHeight1.5
  const INPUT_MAX_H = INPUT_LINE_H * 8 + 16; // 8行 + padding上下

  const scrollToBottom = () => {
    setTimeout(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 100);
  };
  const autoResize = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, INPUT_MAX_H) + 'px';
    el.style.overflowY = el.scrollHeight > INPUT_MAX_H ? 'auto' : 'hidden';
  };
  const resetInputHeight = () => {
    const el = inputRef.current;
    if (el) { el.style.height = 'auto'; el.style.overflowY = 'hidden'; }
  };

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('bruno_logs')
        .select('*')
        .order('created_at', { ascending: true });
      if (err) throw err;
      setMessages(data || []);
    } catch (e) {
      console.error('bruno_logs fetch error', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMessages().then(scrollToBottom);
    // 市場レポート取得（1回）
    (async () => {
      try {
        const { data, error: err } = await supabase
          .from('market_reports')
          .select('report, generated_at')
          .eq('cadence', 'daily')
          .maybeSingle();
        if (err) throw err;
        if (data) setReport({ text: data.report?.report_text || '', generatedAt: data.generated_at });
      } catch (e) { console.error('market_reports fetch error', e); }
    })();
  }, []);

  useEffect(() => {
    if (!loading) scrollToBottom();
  }, [messages, loading]);

  const senderKey = (email) => {
    if (email === 'y_inoue@olq.co.jp') return 'y_inoue';
    if (email === 'bruno@olq.co.jp') return 'bruno';
    return email || '?';
  };
  const isMe = (msg) => msg.sender_email === session?.user?.email;

  // ---- 翻訳プレビュー ----
  const handlePreview = async () => {
    if (!input.trim()) return;
    setError('');
    setPreviewing(true);
    try {
      const { data: { session: freshSession } } = await supabase.auth.getSession();
      const tok = freshSession?.access_token;
      if (!tok) { setError(T.errorAuth); setPreviewing(false); return; }
      const res = await fetch('https://olq-sync-worker.y-inoue-567.workers.dev/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tok}` },
        body: JSON.stringify({ text: input.trim(), lang: viewerLang }),
      });
      if (res.status === 401 || res.status === 403) { setError(T.errorAuth); setPreviewing(false); return; }
      if (!res.ok) { const b = await res.text().catch(()=>''); console.error('/translate error', res.status, b); setError(T.errorPreview); setPreviewing(false); return; }
      const json = await res.json();
      setPreviewData({ translation: json.translation, notes: json.notes, originalText: input.trim() });
    } catch (e) {
      console.error('/translate fetch error', e);
      setError(T.errorPreview);
    }
    setPreviewing(false);
  };

  // 送信可否: プレビュー済み原文と現在の入力が完全一致する間だけ有効
  const canSend = previewData && input.trim() === previewData.originalText && !sending;

  // ---- 送信 ----
  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    setError('');
    try {
      const weekStart = getJSTMonday(new Date());
      const email = session.user.email;
      const row = {
        week_start: weekStart,
        sender_email: email,
        original_lang: viewerLang,
        body_ja: viewerLang === 'ja' ? input.trim() : previewData.translation,
        body_en: viewerLang === 'en' ? input.trim() : previewData.translation,
      };
      const { error: insErr } = await supabase.from('bruno_logs').insert([row]);
      if (insErr) {
        console.error('bruno_logs insert error', insErr);
        if (insErr.code === '42501' || insErr.message?.includes('policy')) {
          setError(T.errorAuth);
        } else {
          setError(T.errorGeneral);
        }
        setSending(false);
        return;
      }
      setInput('');
      setPreviewData(null);
      resetInputHeight();
      await fetchMessages();
      scrollToBottom();
    } catch (e) {
      console.error('bruno send error', e);
      setError(T.errorGeneral);
    }
    setSending(false);
  };

  // ---- 週区切り判定 ----
  const weekLabel = (weekStart) => {
    if (!weekStart) return '';
    const parts = weekStart.split('-');
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return T.weekOf(d);
  };

  // 編集検知
  const edited = previewData && input.trim() !== previewData.originalText;

  return (
    <div style={{ padding: '24px 16px', maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 180px)' }}>
      <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 700 }}>{T.title}</h2>

      {/* 市場レポートカード */}
      {report && report.text && (
        <div
          onClick={() => setReportOpen(o => !o)}
          style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: '10px 14px', marginBottom: 10, cursor: 'pointer', fontSize: 13 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, color: '#166534' }}>{T.reportTitle}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#64748b' }}>
              {report.generatedAt ? new Date(report.generatedAt).toLocaleString(viewerLang === 'ja' ? 'ja-JP' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
              <button
                onClick={e => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(report.text).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1800);
                  }).catch(err => console.error('clipboard write failed', err));
                }}
                style={{ background: copied ? '#dcfce7' : '#e2e8f0', border: 'none', borderRadius: 6, padding: '2px 8px', fontSize: 11, cursor: 'pointer', color: copied ? '#166534' : '#475569', whiteSpace: 'nowrap' }}
              >
                {copied ? T.copied : T.copy}
              </button>
              {reportOpen ? '▲' : '▼'}
            </span>
          </div>
          {reportOpen && (
            <div style={{ marginTop: 8, color: '#1e293b', whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.6, maxHeight: 750, overflowY: 'auto', textAlign: 'left' }}>
              {report.text}
            </div>
          )}
        </div>
      )}

      {/* メッセージ一覧 */}
      <div style={{ flex: 1, overflowY: 'auto', background: '#f0f4f8', borderRadius: 12, padding: '12px 10px', marginBottom: 12 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 13 }}>{T.loading}</div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 13 }}>{T.empty}</div>
        ) : (
          <>
            {messages.map((msg, i) => {
              const prevWeek = i > 0 ? messages[i - 1].week_start : null;
              const showWeekDivider = msg.week_start !== prevWeek;
              const me = isMe(msg);
              const body = viewerLang === 'ja' ? msg.body_ja : msg.body_en;
              const sk = senderKey(msg.sender_email);
              const displayName = nameMap[sk] || sk;
              const time = msg.created_at ? new Date(msg.created_at).toLocaleString(viewerLang === 'ja' ? 'ja-JP' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
              return (
                <React.Fragment key={msg.id || i}>
                  {showWeekDivider && (
                    <div style={{ textAlign: 'center', margin: '14px 0 8px', fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
                      <span style={{ background: '#e2e8f0', borderRadius: 8, padding: '3px 12px' }}>{weekLabel(msg.week_start)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: me ? 'flex-end' : 'flex-start', marginBottom: 6 }}>
                    <div style={{ maxWidth: '75%' }}>
                      {!me && <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2, marginLeft: 4 }}>{displayName}</div>}
                      <div style={{
                        background: me ? '#2563eb' : '#fff',
                        color: me ? '#fff' : '#1e293b',
                        borderRadius: me ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        padding: '8px 14px',
                        fontSize: 14,
                        lineHeight: 1.5,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        textAlign: 'left',
                      }}>
                        {body || ''}
                      </div>
                      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2, textAlign: me ? 'right' : 'left', marginLeft: 4, marginRight: 4 }}>{time}</div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* プレビューカード */}
      {previewData && (
        <div style={{ background: '#fffbeb', border: '1px solid #fbbf24', borderRadius: 10, padding: '10px 14px', marginBottom: 8, fontSize: 13 }}>
          <div style={{ fontWeight: 600, color: '#92400e', marginBottom: 4, fontSize: 12 }}>Translation</div>
          <div style={{ color: '#1e293b', whiteSpace: 'pre-wrap', marginBottom: previewData.notes ? 6 : 0 }}>{previewData.translation}</div>
          {previewData.notes && (
            <>
              <div style={{ fontWeight: 600, color: '#92400e', marginBottom: 2, marginTop: 6, fontSize: 11 }}>{T.aiNotes}</div>
              <div style={{ color: '#78716c', fontSize: 12, whiteSpace: 'pre-wrap' }}>{previewData.notes}</div>
            </>
          )}
          {edited && <div style={{ color: '#dc2626', fontSize: 11, marginTop: 6, fontWeight: 600 }}>{T.editedHint}</div>}
        </div>
      )}

      {/* エラー */}
      {error && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 6, fontWeight: 600 }}>{error}</div>}

      {/* 入力欄 */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => { setInput(e.target.value); autoResize(); }}
          placeholder={T.placeholder}
          rows={1}
          style={{ flex: 1, border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '8px 12px', fontSize: 14, resize: 'none', fontFamily: 'inherit', lineHeight: 1.5, outline: 'none', overflowY: 'hidden' }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && canSend) { e.preventDefault(); handleSend(); } }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button
            onClick={handlePreview}
            disabled={previewing || !input.trim()}
            style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 700, cursor: previewing || !input.trim() ? 'default' : 'pointer', opacity: previewing || !input.trim() ? 0.5 : 1, whiteSpace: 'nowrap' }}
          >
            {previewing ? T.previewing : T.preview}
          </button>
          <button
            onClick={handleSend}
            disabled={!canSend}
            style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 700, cursor: canSend ? 'pointer' : 'default', opacity: canSend ? 1 : 0.4, whiteSpace: 'nowrap' }}
          >
            {sending ? T.sending : T.send}
          </button>
        </div>
      </div>
    </div>
  );
}
