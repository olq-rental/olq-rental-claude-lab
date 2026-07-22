import React, { useState, useEffect, useRef } from "react";
import { supabase } from './supabaseClient';
import { ALL_PRODUCTS, PRESET_CUSTOMERS, K, calcDays } from './lib/constants';
import { AI_SOURCE_MAP, aiSourceMeta, taxIn, taxEx, fmt, fmtD, uid, today } from './lib/format';
import { expandMonthlyOpenRecord, applyBillingTable, calcBillingDays, chainBillingDays, chainBillingDetail, buildChainBlocks, calcExpectedAmount, resolvePrice, spName, syncSPs, getLines } from './lib/billing';
import { genReceiptNo, makeExtFlatItems, buildExtLines, genDeliveryNo, downloadPrintHTML } from './lib/print';
import { PwInput } from './components/PwInput';
import { SearchableSelect } from './components/SearchableSelect';
import { Ico, I } from './components/Ico';
import { Toast } from './components/Toast';
import { AdjAmountInput } from './components/AdjAmountInput';
import { DeliveryCustomer } from './components/DeliveryCustomer';
import { DeliveryCopy } from './components/DeliveryCopy';
import { ReceiptPage } from './components/ReceiptPage';


const KNOWLEDGE_TEMPLATES = [
  {id:"time",    icon:"⏱", label:"何時間使えますか？",    multiProduct:false},
  {id:"combo",   icon:"🔗", label:"組み合わせは？",        multiProduct:true},
  {id:"caution", icon:"⚠️", label:"注意点は？",            multiProduct:false},
  {id:"tips",    icon:"💡", label:"使いこなしのコツ",      multiProduct:false},
  {id:"flow",    icon:"🏢", label:"レンタルフローについて",multiProduct:false},
  {id:"free",    icon:"✏️", label:"自由入力",              multiProduct:false},
];

const SCENARIO_TAGS = [
  "インタビュー","ライブ配信","ドキュメンタリー","イベント収録",
  "屋外撮影","暗所撮影","長時間収録","雨天対応","主観視点の撮影",
  "車載撮影","水中撮影","レンタルフロー",
];

// ---- データストア（Supabase版）----
const _TABLE = { [K.p]:'products', [K.c]:'customers', [K.r]:'cases' };

async function sGetAll(table, selectCols) {
  const PAGE = 1000;
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from(table).select(selectCols).range(from, from + PAGE - 1);
    if (error) { console.error('sGetAll error', table, error); return null; }
    if (!data?.length) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function sGet(k) {
  try {
    if (_TABLE[k]) {
      const isProducts = _TABLE[k] === 'products';
      const selectCols = isProducts ? 'id, data, ec_url' : 'id, data';
      const data = await sGetAll(_TABLE[k], selectCols);
      if (!data?.length) return null;
      return data.map(row => isProducts ? { ...row.data, ec_url: row.ec_url || '' } : row.data);
    }
    if (k === K.inv) {
      const data = await sGetAll('invoices', 'id, data, is_locked');
      if (!data?.length) return null;
      const result = {};
      data.forEach(row => { result[row.id] = { ...row.data, is_locked: row.is_locked }; });
      return result;
    }
    const { data } = await supabase.from('settings').select('value').eq('key', k).maybeSingle();
    return data?.value ?? null;
  } catch(e) { console.error('sGet exception', k, e); return null; }
}

async function sSet(k, val) {
  try {
    if (_TABLE[k]) {
      if (!Array.isArray(val)) return;
      const rows = val.map(item => ({ id: String(item.id), data: item, updated_at: new Date().toISOString() }));
      if (rows.length > 0) {
        const { error } = await supabase.from(_TABLE[k]).upsert(rows, { onConflict: 'id' });
        if (error) {
          console.error('sSet upsert error', k, error);
          alert('保存に失敗しました: ' + error.message);
          return;
        }
      }
      return;
    }
    if (k === K.inv) {
      if (!val || typeof val !== 'object') return;
      const rows = Object.entries(val).map(([id, v]) => ({
        id, data: v, is_locked: v?.status === 'locked', updated_at: new Date().toISOString()
      }));
      if (rows.length > 0) await supabase.from('invoices').upsert(rows, { onConflict: 'id' });
      return;
    }
    if (k === K.pw) return;
    await supabase.from('settings').upsert({ key: k, value: String(val) }, { onConflict: 'key' });
  } catch(e) { console.error('sSet exception', k, e); }
}

async function verifyPw(inputPw) {
  const { data, error } = await supabase.rpc('verify_lock_password', { input_pw: inputPw });
  if (error) { console.error('verifyPw error', error); return false; }
  return !!data;
}

async function updateLockPw(newPw) {
  await supabase.rpc('update_lock_password', { new_pw: newPw });
}


const S = {
  lbl:{display:"block",fontSize:11,fontWeight:700,color:"#64748b",marginBottom:4},
  inp:{width:"100%",padding:"8px 11px",border:"1.5px solid #e2e8f0",borderRadius:7,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit",background:"#fff"},
  td:{border:"1px solid #d1d5db",padding:"6px 10px"},
  btn:(bg,sm)=>({background:bg,color:"#fff",border:"none",borderRadius:7,padding:sm?"6px 12px":"8px 16px",fontSize:sm?12:13,fontWeight:600,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:5,whiteSpace:"nowrap"}),
  ib:c=>({background:"none",border:`1.5px solid ${c}`,color:c,borderRadius:6,padding:"3px 7px",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:3,fontSize:12,whiteSpace:"nowrap"}),
  card:{background:"#fff",borderRadius:12,boxShadow:"0 2px 12px rgba(0,0,0,0.07)",overflow:"hidden"},
};




export default function App() {
  // ---- Auth ----
  const [session,     setSession]     = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showImport,    setShowImport]    = useState(false);
  const [showSnapshot,  setShowSnapshot]  = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  const isAdmin = session?.user?.user_metadata?.role === 'admin';
  const isOwner = session?.user?.email === 'y_inoue@olq.co.jp';
  const isBruno = session?.user?.email === 'bruno@olq.co.jp';
  const isBrunoTab = isOwner || isBruno;

  // ---- 自動バックアップ（1日1回）----
  useEffect(() => {
    if (!session) return;
    if (session.user.email !== 'y_inoue@olq.co.jp') return;
    const d2=new Date();const today=d2.getFullYear()+"-"+(String(d2.getMonth()+1).padStart(2,"0"))+"-"+(String(d2.getDate()).padStart(2,"0"));
    if (localStorage.getItem('olqLastBackup') === today) return;
    (async () => {
      try {
        const [pRes, cRes, rRes, invRes, dnoRes, inoRes, cmsRes, incRes] = await Promise.all([
          supabase.from('products').select('data'),
          supabase.from('customers').select('data'),
          supabase.from('cases').select('data'),
          supabase.from('invoices').select('id,data'),
          supabase.from('settings').select('value').eq('key','olqDNo7').maybeSingle(),
          supabase.from('settings').select('value').eq('key','olqINo7').maybeSingle(),
          supabase.from('settings').select('value').eq('key','crossMonthSplits').maybeSingle(),
          supabase.from('incidents').select('*'),
        ]);
        const invMap = {};
        (invRes.data||[]).forEach(row => { invMap[row.id] = row.data; });
        const payload = {
          backupDate: today,
          olqP7: (pRes.data||[]).map(r=>r.data),
          olqC7: (cRes.data||[]).map(r=>r.data),
          olqR7: (rRes.data||[]).map(r=>r.data),
          olqInv7: invMap,
          olqDNo7: dnoRes.data?.value ?? "",
          olqINo7: inoRes.data?.value ?? "",
          olqCrossMonthSplits: (cmsRes.data&&cmsRes.data.value)||"{}",
          olqIncidents: incRes.data||[],
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `olq-backup-${today}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
        localStorage.setItem('olqLastBackup', today);
      } catch(e) { console.warn('自動バックアップ失敗:', e); }
    })();
  }, [session]);

  // ---- App state ----
  const [products,  setProducts]  = useState([]);
  const [customers, setCustomers] = useState([]);
  const [records,   setRecords]   = useState([]);
  const [invoiceData, setInvoiceData] = useState({});
  const [tab,       setTab]       = useState("records");
  const [incidents, setIncidents] = useState([]);
  const [newsFeed, setNewsFeed] = React.useState([]);
  React.useEffect(()=>{ supabase.from('settings').select('value').eq('key','news_feed').maybeSingle().then(({data})=>{ if(data?.value){try{setNewsFeed(JSON.parse(data.value));}catch{}} }); }, []);

  // ── 自動AIの窓 ──
  const [aiLogs, setAiLogs] = useState([]);
  const [aiLogOpen, setAiLogOpen] = useState(false);
  const [aiLogExpandedId, setAiLogExpandedId] = useState(null);
  useEffect(() => {
    if (!session) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('ai_activity_log')
          .select('id, source, status, recorded_at, detail')
          .order('recorded_at', { ascending: false })
          .limit(200);
        if (error) { console.error('ai_activity_log fetch error', error); return; }
        setAiLogs(data || []);
      } catch (e) { console.error('ai_activity_log exception', e); }
    })();
  }, [session]);

  const [openCustomerId, setOpenCustomerId] = useState(null);
  const [autoOpenDelivery, setAutoOpenDelivery] = useState(null);
  const [toast,     setToast]     = useState(null);
  const [globalQ,    setGlobalQ]    = useState("");
  const [showKnowledgeModal, setShowKnowledgeModal] = useState(false);
  const [knowledgeStep, setKnowledgeStep] = useState(1);
  const [knowledgeTemplate, setKnowledgeTemplate] = useState(null);
  const [knowledgeSelectedProducts, setKnowledgeSelectedProducts] = useState([]);
  const [knowledgeProductSearch, setKnowledgeProductSearch] = useState("");
  const [knowledgeQuestion, setKnowledgeQuestion] = useState("");
  const [knowledgeAnswer, setKnowledgeAnswer] = useState("");
  const [knowledgeSelectedTags, setKnowledgeSelectedTags] = useState([]);
  const [knowledgeSaving, setKnowledgeSaving] = useState(false);
  const [knowledgeList, setKnowledgeList] = useState([]);
  const [knowledgeListLoading, setKnowledgeListLoading] = useState(false);
  const [knowledgeListSearch, setKnowledgeListSearch] = useState("");
  const [knowledgeFilter, setKnowledgeFilter] = useState("all");
  const [knowledgeIsInternal, setKnowledgeIsInternal] = useState(false);
  const [editingKnowledge, setEditingKnowledge] = useState(null);
  const [editKnowledgeQuestion, setEditKnowledgeQuestion] = useState("");
  const [editKnowledgeAnswer, setEditKnowledgeAnswer] = useState("");
  const [editKnowledgeIsInternal, setEditKnowledgeIsInternal] = useState(false);
  const [editKnowledgePublicStatus, setEditKnowledgePublicStatus] = useState('internal_only');
  const [editKnowledgeSaving, setEditKnowledgeSaving] = useState(false);
  const [knowledgeDeleteConfirmId, setKnowledgeDeleteConfirmId] = useState(null);
  const [sourceKnowledgeMap, setSourceKnowledgeMap] = useState({});
  const [refineModeEnabled, setRefineModeEnabled] = useState(false);
  const [refineModeSaving, setRefineModeSaving] = useState(false);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [staffList, setStaffList] = useState([]);
  const [assignModal, setAssignModal] = useState(null);
  const [assignTarget, setAssignTarget] = useState('');
  const [pendingSearch, setPendingSearch] = useState('');
  const [knowledgeConcepts, setKnowledgeConcepts] = useState([]);
  const [knowledgeConceptId, setKnowledgeConceptId] = useState('');
  const [editKnowledgeConceptId, setEditKnowledgeConceptId] = useState('');
  const [knowledgeCategoryFilter, setKnowledgeCategoryFilter] = useState('');
  const [knowledgePendingList, setKnowledgePendingList] = useState([]);
  const [pendingListLoading, setPendingListLoading] = useState(false);
  const [shelvedCount, setShelvedCount] = useState(0);
  const [knowledgeSubTab, setKnowledgeSubTab] = useState('list');
  const [editingPending, setEditingPending] = useState(null);
  const [editPendingQuestion, setEditPendingQuestion] = useState('');
  const [editPendingAnswer, setEditPendingAnswer] = useState('');
  const [editPendingSaving, setEditPendingSaving] = useState(false);
  const [editPendingPublicStatus, setEditPendingPublicStatus] = useState('internal_only');
  const [editPendingRiskLevel, setEditPendingRiskLevel] = useState('low');
  const [editPendingNeedsHumanCheck, setEditPendingNeedsHumanCheck] = useState(false);
  const [editPendingCorrectionNote, setEditPendingCorrectionNote] = useState('');
  const [editPendingReferenceUrls, setEditPendingReferenceUrls] = useState([]);
  const [editPendingImageFiles, setEditPendingImageFiles] = useState([]);
  const [editPendingImageUrls, setEditPendingImageUrls] = useState([]);
  const [editPendingImageUploading, setEditPendingImageUploading] = useState(false);
  const [haikuAnswers, setHaikuAnswers] = useState({});
  const [questionModalStep, setQuestionModalStep] = useState(0);
  const [questionCategory, setQuestionCategory] = useState('');
  const [questionInput, setQuestionInput] = useState('');
  const [questionSearchResults, setQuestionSearchResults] = useState([]);
  const [questionSearchDone, setQuestionSearchDone] = useState(false);
  const [questionSearching, setQuestionSearching] = useState(false);
  const [questionSaving, setQuestionSaving] = useState(false);
  const [questionSelectedProducts, setQuestionSelectedProducts] = useState([]);
  const [questionProductSearch, setQuestionProductSearch] = useState('');
  const [knowledgeSearchMode, setKnowledgeSearchMode] = useState('text');
  const [presetModal, setPresetModal] = useState(false);

  // ── 受信箱 ──
  const [inboxMessages, setInboxMessages] = useState([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxExpandedId, setInboxExpandedId] = useState(null);
  const [inboxUnreadCount, setInboxUnreadCount] = useState(0);

  const showToast = (msg, ok=true) => { setToast({msg,ok}); setTimeout(()=>setToast(null),3000); };

  // ── 受信箱: Web Audio API ビープ ──
  const playInboxBeep = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const notes = [523, 659, 784]; // C5→E5→G5 上昇アルペジオ
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        const t = ctx.currentTime + i * 0.2;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.6, t + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.start(t);
        osc.stop(t + 0.35);
      });
    } catch (e) { /* Autoplay policy — silent until user interaction */ }
  };

  const linkifyText = (text) => {
    if (!text) return '(本文なし)';
    const urlRe = /https?:\/\/[^\s\u3000-\u9FFF\uFF00-\uFFEF)）」』】。、，,]+/g;
    const parts = [];
    let last = 0;
    let m;
    while ((m = urlRe.exec(text)) !== null) {
      if (m.index > last) parts.push(text.slice(last, m.index));
      const url = m[0].replace(/[.,;:!?]+$/, '');
      parts.push(<a key={m.index} href={url} target="_blank" rel="noopener noreferrer" style={{color:'#2563eb',textDecoration:'underline'}} onClick={e=>e.stopPropagation()}>{url}</a>);
      last = m.index + url.length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts;
  };

  const fetchInbox = async () => {
    setInboxLoading(true);
    try {
      const { data, error } = await supabase
        .from('email_inbox')
        .select('*')
        .is('deleted_at', null)
        .order('received_at', { ascending: false })
        .limit(100);
      if (error) { console.error('email_inbox fetch error', error); return; }
      setInboxMessages(data || []);
      setInboxUnreadCount((data || []).filter(m => !m.read_at).length);
    } catch (e) { console.error('email_inbox exception', e); }
    setInboxLoading(false);
  };

  // 受信箱: 初回未読カウント取得（タブバッジ用）
  useEffect(() => {
    if (!session) return;
    (async () => {
      try {
        const { count, error } = await supabase
          .from('email_inbox')
          .select('id', { count: 'exact', head: true })
          .is('read_at', null)
          .is('deleted_at', null);
        if (!error && count !== null) setInboxUnreadCount(count);
      } catch (e) { console.error('inbox unread count error', e); }
    })();
  }, [session]);

  // 受信箱: タブ切替時にfetch
  useEffect(() => {
    if (tab === 'inbox') fetchInbox();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // ---- 初期データロード ----
  useEffect(() => {
    if (!session) return;
    (async () => {
      const [p, c, r, inv] = await Promise.all([
        sGet(K.p), sGet(K.c), sGet(K.r), sGet(K.inv)
      ]);
      if (p?.length) setProducts(p);
      if (c === null) {
        console.error('顧客データ読み込みエラー');
        alert('顧客データの読み込みに失敗しました。ページを再読み込みしてください。');
      } else if (c.length > 0) {
        setCustomers(c);
      } else {
        setPresetModal(true);
      }
      if (r?.length) setRecords(r);
      if (inv) setInvoiceData(inv);
    })();
  }, [session]);

  useEffect(()=>{
    supabase.from('incidents').select('*').order('occurred_date',{ascending:false}).then(({data})=>{
      if(data) setIncidents(data);
    });
  },[]);

  // ---- Realtime（5PC同時同期）----
  useEffect(() => {
    if (!session) return;
    const reload = async (table) => {
      if (table === 'products')  { const d = await sGet(K.p); if(d?.length) setProducts(d); }
      if (table === 'customers') { const d = await sGet(K.c); if(d?.length) setCustomers(d); }
      if (table === 'cases')     { const d = await sGet(K.r); if(d?.length) setRecords(d); }
      if (table === 'invoices')  { const d = await sGet(K.inv); if(d) setInvoiceData(d); }
    };
    const channels = ['products','customers','cases','invoices'].map(table =>
      supabase.channel(`rt_${table}`)
        .on('postgres_changes', { event:'*', schema:'public', table }, () => reload(table))
        .subscribe()
    );
    // 受信箱 Realtime（INSERT検知で新着音＋リスト更新）
    const inboxCh = supabase.channel('rt_email_inbox')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'email_inbox' }, () => {
        fetchInbox();
        playInboxBeep();
      })
      .subscribe();
    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
      supabase.removeChannel(inboxCh);
    };
  }, [session]);

  const doPresetInsert=async()=>{
    setPresetModal(false);
    setCustomers(PRESET_CUSTOMERS);
    await sSet(K.c, PRESET_CUSTOMERS);
    showToast("プリセット38社を投入しました");
  };

  const fetchKnowledgeSearchMode = async () => {
    const {data} = await supabase.from('settings').select('value').eq('key','knowledge_search_mode').single();
    if(data) setKnowledgeSearchMode(JSON.parse(data.value));
  };

  const searchKnowledge = async (q) => {
    setQuestionSearching(true);
    const lower = q.toLowerCase();
    const {data} = await supabase
      .from('knowledge')
      .select('*')
      .eq('status','approved')
      .is('deleted_at', null)
      .order('priority',{ascending:false});
    const results = (data||[]).filter(k=>
      (k.question_text||'').toLowerCase().includes(lower)||
      (k.answer_text||'').toLowerCase().includes(lower)
    ).slice(0,3);
    setQuestionSearchResults(results);
    setQuestionSearchDone(true);
    setQuestionSearching(false);
  };

  const submitQuestion = async () => {
    if(!questionInput.trim()) return;
    setQuestionSaving(true);
    const row = {
      question_text: questionInput.trim(),
      answer_text: null,
      status: 'pending',
      priority: 5,
      original_priority: 5,
      related_product_ids: questionSelectedProducts.map(p=>String(p.id)),
      scenario_tags: [],
      source_type: 'manual',
      public_status: 'internal_only',
      created_by: (await supabase.auth.getUser()).data?.user?.email || '',
    };
    await supabase.from('knowledge').insert([row]);
    setQuestionSaving(false);
    setQuestionModalStep(0);
    setQuestionInput('');
    setQuestionSelectedProducts([]);
    setQuestionSearchResults([]);
    setQuestionSearchDone(false);
    setKnowledgePendingList(prev=>[...prev,{...row,id:Date.now()}]);
    showToast('質問を登録しました');
  };

  const fetchPendingList = async () => {
    setPendingListLoading(true);
    const isYuta = session&&session.user.email==='y_inoue@olq.co.jp';
    // 1. ec_contact を上限なしで先に取得
    let ecQuery = supabase.from('knowledge').select('*').eq('status','pending').eq('source_type','ec_contact').is('deleted_at', null);
    if(isYuta){
      ecQuery = ecQuery.not('review_status','eq','assigned');
    } else {
      ecQuery = ecQuery.eq('assigned_to', session?session.user.email:'');
    }
    ecQuery = ecQuery.order('created_at',{ascending:true});
    const {data:ecData, error:ecError} = await ecQuery;
    if(ecError) console.error('fetchPendingList ec_contact error',ecError);
    // 2. 通常の pending を既存の順序でfetch
    let query = supabase.from('knowledge').select('*').eq('status','pending').neq('source_type','ec_contact').is('deleted_at', null);
    if(isYuta){
      query = query.not('review_status','eq','assigned');
    } else {
      query = query.eq('assigned_to', session?session.user.email:'');
    }
    query = query.order('priority',{ascending:false}).order('created_at',{ascending:true});
    const {data,error} = await query;
    setPendingListLoading(false);
    if(error){console.error('fetchPendingList error',error);return;}
    // 3. ec_contact を先頭に結合
    const list = [...(ecData||[]), ...(data||[])];
    setKnowledgePendingList(list);
    const sourceIds = [];
    for(const k of list){
      if(k.refine_source_id) sourceIds.push(k.refine_source_id);
      if(k.merge_source_ids&&k.merge_source_ids.length) k.merge_source_ids.forEach(id=>sourceIds.push(id));
    }
    if(sourceIds.length>0){
      const unique=[...new Set(sourceIds)];
      const {data:srcData}=await supabase.from('knowledge').select('id,question_text,answer_text,yuta_correction_note').in('id',unique);
      const map={};
      (srcData||[]).forEach(q=>{map[q.id]=q;});
      setSourceKnowledgeMap(map);
    }
    // 4. shelved件数取得
    const {count:sc}=await supabase.from('knowledge').select('id',{count:'exact',head:true}).eq('status','shelved').is('deleted_at',null);
    setShelvedCount(sc||0);
  };

  // 棚から1件昇格
  const promoteShelved = async () => {
    const {data:rows,error:err}=await supabase.from('knowledge').select('id').eq('status','shelved').is('deleted_at',null).order('created_at',{ascending:false}).limit(1);
    if(err||!rows||rows.length===0) return;
    const {error:upErr}=await supabase.from('knowledge').update({status:'pending',promoted_at:new Date().toISOString()}).eq('id',rows[0].id).eq('status','shelved');
    if(upErr){console.error('promoteShelved error',upErr);return;}
    await fetchPendingList();
    showToast('棚から1件を承認待ちに昇格しました');
  };

  const approveKnowledge = async (id) => {
    const now = new Date();
    const pad = n => String(n).padStart(2,'0');
    const approvedAt = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}+09:00`;
    const {error} = await supabase.from('knowledge').update({status:'approved',approved_by:'y_inoue@olq.co.jp',approved_at:approvedAt,edited_by_human:true}).eq('id',id);
    if(error){console.error(error);return;}
    setKnowledgePendingList(prev=>prev.filter(k=>k.id!==id));
    showToast('承認しました');
  };

  const rejectKnowledge = async (id, reason='') => {
    const target = knowledgePendingList.find(k=>k.id===id);
    const {error} = await supabase.from('knowledge').update({
      status:'rejected',
      rejection_reason: reason.trim()||null,
    }).eq('id',id);
    if(error){console.error(error);return;}
    // refine系なら元Q&AのIDのlast_refined_atを更新
    if(target){
      const sourceIds=[];
      if(target.refine_source_id) sourceIds.push(target.refine_source_id);
      if(target.merge_source_ids&&target.merge_source_ids.length) target.merge_source_ids.forEach(id=>sourceIds.push(id));
      if(sourceIds.length>0){
        const now=new Date().toISOString();
        for(const sid of sourceIds){
          await supabase.from('knowledge').update({last_refined_at:now}).eq('id',sid);
        }
      }
    }
    setKnowledgePendingList(prev=>prev.filter(k=>k.id!==id));
    setRejectModal(null);
    setRejectReason('');
    showToast('却下しました');
  };

  const approveWithReplace = async (pending) => {
    const now = new Date();
    const pad = n => String(n).padStart(2,'0');
    const approvedAt = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}+09:00`;
    const {error} = await supabase.from('knowledge').update({status:'approved',approved_by:'y_inoue@olq.co.jp',approved_at:approvedAt,edited_by_human:true}).eq('id',pending.id);
    if(error){console.error(error);return;}
    if(pending.refine_source_id){
      await supabase.from('knowledge').update({ deleted_at: new Date().toISOString(), status: 'superseded' }).eq('id',pending.refine_source_id);
    }
    setKnowledgePendingList(prev=>prev.filter(k=>k.id!==pending.id));
    showToast('承認して差し替えました');
  };

  const approveHaikuQuestion = async (id, answerText) => {
    if(!answerText.trim()){showToast('回答を入力してください');return;}
    const now=new Date();
    const pad=n=>String(n).padStart(2,'0');
    const approvedAt=`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}+09:00`;
    const {error}=await supabase.from('knowledge').update({
      status:'approved',
      answer_text:answerText.trim(),
      approved_by:'y_inoue@olq.co.jp',
      approved_at:approvedAt,
      edited_by_human:true,
    }).eq('id',id);
    if(error){console.error(error);return;}
    setKnowledgePendingList(prev=>prev.filter(k=>k.id!==id));
    setHaikuAnswers(prev=>{const n={...prev};delete n[id];return n;});
    showToast('回答して承認しました');
  };

  const approveMerge = async (pending) => {
    const now = new Date();
    const pad = n => String(n).padStart(2,'0');
    const approvedAt = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}+09:00`;
    const {error} = await supabase.from('knowledge').update({status:'approved',approved_by:'y_inoue@olq.co.jp',approved_at:approvedAt,edited_by_human:true}).eq('id',pending.id);
    if(error){console.error(error);return;}
    for(const sourceId of (pending.merge_source_ids||[])){
      await supabase.from('knowledge').update({ deleted_at: new Date().toISOString(), status: 'superseded' }).eq('id',sourceId);
    }
    setKnowledgePendingList(prev=>prev.filter(k=>k.id!==pending.id));
    showToast('統合して承認しました（元の'+((pending.merge_source_ids||[]).length)+'件を削除）');
  };

  const fetchRefineModeEnabled = async () => {
    const {data}=await supabase.from('settings').select('value').eq('key','refine_mode_enabled').single();
    if(data){try{setRefineModeEnabled(JSON.parse(data.value));}catch{}}
  };

  const fetchStaffList = async () => {
    const {data} = await supabase.rpc('get_staff_list');
    setStaffList((data||[]).filter(u=>u.email!=='y_inoue@olq.co.jp'));
  };

  const assignToStaff = async (id, email) => {
    const {error} = await supabase.from('knowledge').update({
      assigned_to: email,
      review_status: 'assigned',
    }).eq('id', id);
    if(error){console.error(error);return;}
    setKnowledgePendingList(prev=>prev.filter(k=>k.id!==id));
    setAssignModal(null);
    setAssignTarget('');
    showToast('スタッフに送りました');
  };

  const reviewComplete = async (id) => {
    const {error} = await supabase.from('knowledge').update({
      review_status: 'reviewed',
      assigned_to: null,
    }).eq('id', id);
    if(error){console.error(error);return;}
    setKnowledgePendingList(prev=>prev.filter(k=>k.id!==id));
    showToast('レビューを完了しました。雄太さんの確認待ちに戻します。');
  };

  const toggleRefineMode = async () => {
    setRefineModeSaving(true);
    const next=!refineModeEnabled;
    await supabase.from('settings').update({value:JSON.stringify(next)}).eq('key','refine_mode_enabled');
    setRefineModeEnabled(next);
    setRefineModeSaving(false);
    showToast(next?'ブラッシュアップモードをONにしました':'ブラッシュアップモードをOFFにしました');
  };

  const updateKnowledgePriority = async (id, priority) => {
    await supabase.from('knowledge').update({priority:Number(priority)}).eq('id',id);
    setKnowledgePendingList(prev=>prev.map(k=>k.id===id?{...k,priority:Number(priority)}:k).sort((a,b)=>b.priority-a.priority));
  };

  const approveWithEdit = async () => {
    if(!editingPending) return;
    setEditPendingSaving(true);
    // 新規画像をSupabase Storageにアップロード
    let uploadedUrls = [...editPendingImageUrls];
    if(editPendingImageFiles.length>0){
      setEditPendingImageUploading(true);
      for(const file of editPendingImageFiles){
        try{
          const ext=file.name.split('.').pop();
          const path=`knowledge/${editingPending.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
          const {error:upErr}=await supabase.storage.from('knowledge-images').upload(path,file,{upsert:false});
          if(!upErr){
            const {data:urlData}=supabase.storage.from('knowledge-images').getPublicUrl(path);
            if(urlData&&urlData.publicUrl) uploadedUrls.push(urlData.publicUrl);
          }
        }catch(e){console.error('image upload error',e);}
      }
      setEditPendingImageUploading(false);
    }
    const now = new Date();
    const pad = n => String(n).padStart(2,'0');
    const approvedAt = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}+09:00`;
    const {error} = await supabase.from('knowledge').update({
      question_text: editPendingQuestion.trim(),
      answer_text: editPendingAnswer.trim(),
      status: 'approved',
      public_status: editPendingPublicStatus,
      risk_level: editPendingRiskLevel,
      needs_human_check: editPendingNeedsHumanCheck,
      yuta_correction_note: editPendingCorrectionNote.trim()||null,
      reference_urls: editPendingReferenceUrls,
      image_urls: uploadedUrls,
      edited_by_human: true,
      approved_by: 'y_inoue@olq.co.jp',
      approved_at: approvedAt,
    }).eq('id',editingPending.id);
    setEditPendingSaving(false);
    if(error){console.error(error);return;}
    // customer_question の場合、メール送信
    const editId = editingPending.id;
    let kData = null;
    try {
      const { data, error: selErr } = await supabase
        .from('knowledge')
        .select('structured_data, question_text, answer_text, related_product_ids, source_type')
        .eq('id', editId)
        .single();
      if (selErr) console.error('[mail] knowledge select error:', selErr);
      kData = data;
    } catch (e) {
      console.error('[mail] knowledge select exception:', e);
    }
    console.log('[mail] kData.source_type:', kData?.source_type, 'email:', kData?.structured_data?.email);
    if (kData?.source_type === 'ec_contact' && kData?.structured_data?.email) {
      const productId = (kData.related_product_ids || [])[0];
      const mailUrl = `${import.meta.env.VITE_WORKER_URL}/send-faq-reply`;
      console.log('[mail] POST先URL:', mailUrl);
      try {
        const { data: _sd } = await supabase.auth.getSession();
        const _token = _sd?.session?.access_token;
        const mailRes = await fetch(mailUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${_token}`,
          },
          body: JSON.stringify({
            email: kData.structured_data.email,
            question_text: kData.question_text,
            answer_text: kData.answer_text,
            product_id: productId,
            faq_page_url: productId
              ? `https://faq.olqrental.com/faq-page?product_id=${productId}`
              : null,
          }),
        });
        console.log('[mail] response.status:', mailRes.status);
        if (!mailRes.ok) {
          const errText = await mailRes.text();
          console.log('[mail] response.body:', errText);
          showToast(`メール送信に失敗（status=${mailRes.status}）`, false);
        }
      } catch (e) {
        console.error('[mail] fetch exception:', e);
        showToast('メール送信に失敗（通信エラー）', false);
      }
    }
    if(editingPending.source_type==='refine_improve'&&editingPending.refine_source_id){
      await supabase.from('knowledge').update({ deleted_at: new Date().toISOString(), status: 'superseded' }).eq('id',editingPending.refine_source_id);
    }
    if(editingPending.source_type==='refine_merge'&&(editingPending.merge_source_ids||[]).length>0){
      for(const sid of editingPending.merge_source_ids){
        await supabase.from('knowledge').update({ deleted_at: new Date().toISOString(), status: 'superseded' }).eq('id',sid);
      }
    }
    setKnowledgePendingList(prev=>prev.filter(k=>k.id!==editingPending.id));
    setEditingPending(null);
    setEditPendingImageFiles([]);
    setEditPendingImageUrls([]);
    showToast('訂正して承認しました');
  };

  const fetchKnowledgeConcepts = async () => {
    const {data} = await supabase
      .from('knowledge_concepts')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    setKnowledgeConcepts(data||[]);
  };

  const fetchKnowledgeList = async () => {
    setKnowledgeListLoading(true);
    const {data,error} = await supabase
      .from('knowledge')
      .select('*')
      .eq('status','approved')
      .is('deleted_at', null)
      .order('created_at',{ascending:false});
    setKnowledgeListLoading(false);
    if(error){console.error('knowledge fetch error',error);return;}
    setKnowledgeList(data||[]);
  };
  React.useEffect(()=>{
    if(tab==='knowledge'){fetchKnowledgeList();fetchKnowledgeConcepts();fetchPendingList();fetchKnowledgeSearchMode();fetchRefineModeEnabled();fetchStaffList();}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[tab]);

  const logActivity = async (action, targetType, targetName, detail="") => {
    if (!session?.user) return;
    try {
      await supabase.from('activity_logs').insert({
        user_id: session.user.id,
        user_name: session.user.user_metadata?.name || session.user.email,
        action,
        target_type: targetType,
        target_name: targetName,
        detail,
      });
    } catch(e) { console.error('logActivity error:', e); }
  };

  const saveProd = async n => {
    const merged = n.map(p => {
      const existing = products.find(x => x.id === p.id);
      return {
        ...p,
        noBillingDiscount: p.noBillingDiscount ?? existing?.noBillingDiscount ?? false,
        memo: p.memo ?? existing?.memo ?? ""
      };
    });
    setProducts(merged);
    await sSet(K.p, merged);
    // 製品マスタ変更時、全顧客の特別価格を自動同期
    const updated = customers.map(c => {
      if (!(c.specialPrices||[]).length) return c;
      const synced = syncSPs(c.specialPrices, n);
      if (synced.length === c.specialPrices.length && synced.every((s,i)=>s.productName===c.specialPrices[i].productName)) return c;
      return {...c, specialPrices: synced};
    });
    const changed = updated.some((c, i) => c !== customers[i]);
    if (changed) { setCustomers(updated); await sSet(K.c, updated); }
  };
  const saveCust = async (n, logInfo) => {
    setCustomers(n);
    await sSet(K.c, n);
    if (logInfo) await logActivity(logInfo.action, 'customer', logInfo.name, logInfo.detail||"");
  };
  const saveRec = async (n, logInfo, changed) => {
    const toUpsert = changed || n;
    const rows = toUpsert.map(item => ({ id: String(item.id), data: item, updated_at: new Date().toISOString() }));
    if (rows.length > 0) {
      const { error } = await supabase.from('cases').upsert(rows, { onConflict: 'id' });
      if (error) { console.error('saveRec upsert error', error); throw new Error(error.message); }
    }
    setRecords(n);
    try { if (logInfo) await logActivity(logInfo.action, 'record', logInfo.name, logInfo.detail||""); } catch(e) { console.error('logActivity error (ignored)', e); }
  };
  const deleteCust = async (custId, custName) => {
    const filtered = customers.filter(x => x.id !== custId);
    setCustomers(filtered);
    await supabase.from('customers').delete().eq('id', String(custId));
    await logActivity("削除", "customer", custName, "顧客を削除しました");
  };
  const deleteRec = async (id, logInfo) => {
    const { error } = await supabase.from('cases').delete().eq('id', String(id));
    if (error) { console.error('deleteRec error', error); throw new Error(error.message); }
    setRecords(prev => prev.filter(x => x.id !== id));
    try { if (logInfo) await logActivity(logInfo.action, 'record', logInfo.name, logInfo.detail||""); } catch(e) { console.error('logActivity error (ignored)', e); }
  };
  const saveInv  = async n => { setInvoiceData(n); await sSet(K.inv, n); };

  const invoiceGroups = {};
  const _addToGroup = (c, projKey, billingMonth, split, consolidate, entry) => {
    const key = `${entry.customerId}||${projKey}||${billingMonth}`;
    if (!invoiceGroups[key]) {
      invoiceGroups[key] = {
        customerId:entry.customerId, customer:c||null, customerName:c?.name||"不明",
        projectName:projKey, month:billingMonth, items:[], split, consolidate
      };
    }
    invoiceGroups[key].items.push(entry);
  };
  // 締め済みキーセット（展開時に月別名ガードで使用 — (C)の完全一致ロジックと同一）
  const lockedKeysForExpand = new Set(
    Object.entries(invoiceData||{}).filter(([,d])=>d.status==="locked").map(([k])=>k)
  );
  records.forEach(r => {
    const c = customers.find(x=>x.id===r.customerId);
    const split = c?.splitInvoice !== false;
    const projKey = split ? (r.projectName||"") : "";
    const consolidate = !!(c?.consolidateMonth);

    if (r.endDateOpen && r.billingType === 'monthly') {
      // 終了未定月極：月ごとに展開
      const entries = expandMonthlyOpenRecord(r, calcBillingDays, today, products, c);
      entries.forEach(entry => {
        const defKey = `${r.customerId}||${projKey}||${entry._billingMonth}`;
        const mpn = lockedKeysForExpand.has(defKey) ? (r.projectName ?? "") : (r.monthlyProjectNames?.[entry._billingMonth] ?? r.projectName ?? "");
        entry.projectName = mpn;
        const mpk = split ? mpn : "";
        _addToGroup(c, mpk, entry._billingMonth, split, consolidate, entry);
      });
    } else if (r.billingType === 'monthly' && r.startDate) {
      // 固定月数の月極
      const rLns = (r.lines&&r.lines.length)?r.lines:[{productId:r.productId||"",equipNo:r.equipNo||"",unitPrice:r.unitPrice,quantity:r.quantity,lineNote:r.lineNote||"",subItems:r.subItems||[],equipmentName:r.equipmentName||""}];
      const pad = n=>String(n).padStart(2,"0");
      const hasExtension = records.some(x => x.extendedFrom === r.id);

      if (r.endDate && hasExtension) {
        // 延長済み月極：startDate〜endDate を月ごとに展開（満了月=月極、端数月=日極）
        const startD = new Date(r.startDate + 'T00:00:00');
        const limitD = new Date(r.endDate + 'T00:00:00');
        const limitMonth = limitD.getFullYear() * 12 + limitD.getMonth();
        let n = 0;
        while (n <= 120) {
          const pStart = new Date(startD);
          pStart.setMonth(pStart.getMonth() + n);
          const pStartMonth = pStart.getFullYear() * 12 + pStart.getMonth();
          if (pStartMonth > limitMonth) break;
          if (pStart > limitD) break; // 同月でも日付が超えていたら終了（幽霊エントリ防止）
          const pEnd = new Date(pStart);
          pEnd.setMonth(pEnd.getMonth() + 1);
          pEnd.setDate(pEnd.getDate() - 1);
          const bMonth = `${pStart.getFullYear()}-${pad(pStart.getMonth()+1)}`;
          const pStartStr = `${pStart.getFullYear()}-${pad(pStart.getMonth()+1)}-${pad(pStart.getDate())}`;
          const pEndStr = `${pEnd.getFullYear()}-${pad(pEnd.getMonth()+1)}-${pad(pEnd.getDate())}`;
          const defKey1 = `${r.customerId}||${projKey}||${bMonth}`;
          const mpn1 = lockedKeysForExpand.has(defKey1) ? (r.projectName ?? "") : (r.monthlyProjectNames?.[bMonth] ?? r.projectName ?? "");
          const mpk1 = split ? mpn1 : "";

          if (limitD >= pStart && limitD < pEnd) {
            // 端数月：endDateが月の途中（pEnd未満）→ 部分期間を日極で計上
            const days = Math.max(1, Math.ceil((limitD - pStart) / 86400000) + 1);
            const bDays = calcBillingDays(days);
            const lines = rLns.map(ln => {
              const prod = (products||[]).find(p => p.id === ln.productId);
              const dailyPrice = prod ? resolvePrice(prod, c) : Number(ln.dailyUnitPrice || ln.unitPrice || 0);
              const qty = Number(ln.quantity) || 1;
              const noDisc = ln.noBillingDiscount || (prod && prod.noBillingDiscount);
              const useDays = noDisc ? days : bDays;
              const monthlyPrice = Number(ln.unitPrice || 0) * qty;
              const rawAmt = dailyPrice * qty * useDays;
              const amount = monthlyPrice > 0 ? Math.min(rawAmt, monthlyPrice) : rawAmt;
              return {...ln, unitPrice: dailyPrice, amount};
            });
            const amt = lines.reduce((s,ln)=>s+(ln.amount||0),0);
            const entry = {...r, id:r.id+'__ret__'+bMonth,
              projectName:mpn1,
              startDate:pStartStr, endDate:r.endDate,
              billingType:'daily', billingDays:bDays, days,
              isMonthlyEntry:true, isReturnEntry:true, amount:amt, lines,
              _billingMonth:bMonth};
            _addToGroup(c, mpk1, bMonth, split, consolidate, entry);
            break;
          } else {
            // 満了月：月極価格
            const lines = rLns.map(ln => {
              const up = Number(ln.unitPrice||0);
              const qty = Number(ln.quantity)||1;
              return {...ln, amount: up * qty * 1};
            });
            const amt = lines.reduce((s,ln)=>s+(ln.amount||0),0);
            const entry = {...r, id:r.id+'__mo__'+bMonth,
              projectName:mpn1,
              startDate:pStartStr, endDate:pEndStr,
              billingType:'monthly', months:1,
              isMonthlyEntry:true, amount:amt, lines,
              _billingMonth:bMonth};
            _addToGroup(c, mpk1, bMonth, split, consolidate, entry);
          }
          n++;
        }
      } else {
        // 従来の固定月数展開（returnDateなし）
        const months_ = Number(r.months) || 1;
        for (let n = 0; n < months_; n++) {
          const pStart = new Date(r.startDate + 'T00:00:00');
          pStart.setMonth(pStart.getMonth() + n);
          const pEnd = new Date(pStart);
          pEnd.setMonth(pEnd.getMonth() + 1);
          pEnd.setDate(pEnd.getDate() - 1);
          const bMonth = `${pStart.getFullYear()}-${pad(pStart.getMonth()+1)}`;
          const pStartStr = `${pStart.getFullYear()}-${pad(pStart.getMonth()+1)}-${pad(pStart.getDate())}`;
          const pEndStr = `${pEnd.getFullYear()}-${pad(pEnd.getMonth()+1)}-${pad(pEnd.getDate())}`;
          const defKey2 = `${r.customerId}||${projKey}||${bMonth}`;
          const mpn2 = lockedKeysForExpand.has(defKey2) ? (r.projectName ?? "") : (r.monthlyProjectNames?.[bMonth] ?? r.projectName ?? "");
          const mpk2 = split ? mpn2 : "";
          const lines = rLns.map(ln => {
            const up = Number(ln.unitPrice||0);
            const qty = Number(ln.quantity)||1;
            return {...ln, amount: up * qty * 1};
          });
          const amt = lines.reduce((s,ln)=>s+(ln.amount||0),0);
          const entry = {...r, id:r.id+'__mo__'+bMonth,
            projectName:mpn2,
            startDate:pStartStr, endDate:pEndStr,
            billingType:'monthly', months:1,
            isMonthlyEntry:true, amount:amt, lines,
            _billingMonth:bMonth};
          _addToGroup(c, mpk2, bMonth, split, consolidate, entry);
        }
      }
    } else {
      // 通常案件（日極）：既存ロジック
      let billingMonth = r.startDate?.slice(0,7)||"";
      if (consolidate && r.startDate && r.endDate) {
        const sm = r.startDate.slice(0,7);
        const em = r.endDate.slice(0,7);
        if (sm !== em) {
          const smEnd = new Date(sm.replace("-","/")+"/01");
          smEnd.setMonth(smEnd.getMonth()+1); smEnd.setDate(0);
          const smDays = calcDays(r.startDate, smEnd.toISOString().slice(0,10));
          const emDays = calcDays(new Date(em.replace("-","/")+"/01").toISOString().slice(0,10), r.endDate);
          billingMonth = smDays >= emDays ? sm : em;
        }
      }
      _addToGroup(c, projKey, billingMonth, split, consolidate, r);
    }
  });


  const TABS = [
    {id:"records",  label:"案件管理",    icon:I.list},
    {id:"delivery", label:"納品書",      icon:I.file},
    {id:"invoice",  label:"請求書",      icon:I.print},
    {id:"customers",label:"顧客管理",    icon:I.users},
    {id:"products", label:"製品マスタ",  icon:I.box},
    {id:"actlogs",  label:"作業履歴",    icon:I.list},
    {id:"incidents",label:"修理/紛失",   icon:I.list},
    {id:"knowledge",label:"📖 オルク辞典"},
    {id:"inbox",    label:"受信箱",     icon:I.mail},
    {id:"bruno",    label:"Bruno"},
  ];

  // ナレッジ質問文の自動生成
  const buildKnowledgeQuestion = (template, selectedProds) => {
    if(!template) return "";
    const names = selectedProds.map(p=>(p&&p.name)||"").filter(Boolean);
    if(template.id==="flow"||template.id==="free") return "";
    if(names.length===0) return "";
    const subject = names.length===1 ? names[0] : names.join("と");
    const suffix = {
      time:"は何時間使えますか？",
      combo:"の組み合わせについて",
      caution:"の注意点について",
      tips:"の使いこなしのコツについて",
    };
    return subject + (suffix[template.id]||"について");
  };

  const saveKnowledge = async () => {
    if(!knowledgeQuestion.trim()||!knowledgeAnswer.trim()) return;
    setKnowledgeSaving(true);
    const row = {
      question_text: knowledgeQuestion.trim(),
      answer_text: knowledgeAnswer.trim(),
      related_product_ids: knowledgeSelectedProducts.map(p=>String(p.id)),
      scenario_tags: knowledgeSelectedTags,
      created_by: session?.user?.user_metadata?.name||session?.user?.email||"",
      source_type: 'manual',
      is_internal: knowledgeIsInternal,
      public_status: 'internal_only',
      concept_id: knowledgeConceptId || null,
    };
    const {error} = await supabase.from('knowledge').insert([row]);
    setKnowledgeSaving(false);
    if(error){ alert('保存に失敗しました: '+error.message); return; }
    showToast('ナレッジを保存しました');
    setShowKnowledgeModal(false);
    setKnowledgeConceptId('');
    setKnowledgeStep(1);setKnowledgeIsInternal(false);
    setKnowledgeTemplate(null);
    setKnowledgeSelectedProducts([]);
    setKnowledgeProductSearch("");
    setKnowledgeQuestion("");
    setKnowledgeAnswer("");
    setKnowledgeSelectedTags([]);
  };

  const deleteKnowledge = async (id) => {
    const {error} = await supabase.from('knowledge').update({ deleted_at: new Date().toISOString() }).eq('id',id);
    if(error){console.error('deleteKnowledge error',error);showToast('削除に失敗しました');return;}
    setKnowledgeList(prev=>prev.filter(k=>k.id!==id));
    showToast('削除しました');
  };

  const updateKnowledge = async () => {
    if(!editKnowledgeQuestion.trim()||!editKnowledgeAnswer.trim()) return;
    setEditKnowledgeSaving(true);
    const now = new Date().toISOString();
    const updates = {
      question_text: editKnowledgeQuestion.trim(),
      answer_text: editKnowledgeAnswer.trim(),
      is_internal: editKnowledgeIsInternal,
      public_status: editKnowledgePublicStatus,
      concept_id: editKnowledgeConceptId || null,
      edited_by_human: true,
      edited_by: session?.user?.email||"",
      edited_at: now,
      updated_at: now,
    };
    const {error} = await supabase.from('knowledge').update(updates).eq('id',editingKnowledge.id);
    setEditKnowledgeSaving(false);
    if(error){showToast('更新に失敗しました');return;}
    showToast('更新しました');
    setKnowledgeList(prev=>prev.map(k=>k.id===editingKnowledge.id?{...k,...updates}:k));
    setEditKnowledgeConceptId('');
    setEditingKnowledge(null);
  };

  // ---- auth guard ----
  if (authLoading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",fontFamily:"'Noto Sans JP',sans-serif",fontSize:14,color:"#64748b"}}>読み込み中...</div>
  );
  if (!session) return <LoginScreen />;
  if (showImport) return <ImportScreen onDone={()=>setShowImport(false)} showToast={showToast} setCustomers={setCustomers} setRecords={setRecords} setInvoiceData={setInvoiceData} setProducts={setProducts} />;
  if (showSnapshot && isOwner) return <SnapshotScreen onDone={()=>setShowSnapshot(false)} showToast={showToast} setCustomers={setCustomers} setRecords={setRecords} setInvoiceData={setInvoiceData} setProducts={setProducts} />;

  return (
    <div style={{fontFamily:"'Noto Sans JP','Hiragino Sans',sans-serif",minHeight:"100vh",background:"#f1f5f9",color:"#1e293b"}}>
      <Toast t={toast}/>



      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}@media print{.app-header,.app-tabs,.np{display:none!important}body,html{margin:0;padding:0;background:#fff}}.ph-faint::placeholder{color:#e2e8f0!important}`}</style>
      <header className="app-header" style={{background:"#0f172a",color:"#fff",padding:"0 20px",height:52,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 16px rgba(0,0,0,.4)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{background:"#fff",borderRadius:"50%",width:25,height:25,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden",padding:3}}>
            <img src="/olq-logo.png" alt="olq" style={{width:"100%",height:"100%",objectFit:"contain"}}/>
          </div>
          <span style={{fontWeight:800,fontSize:15,letterSpacing:2}}>オルク レンタル伝票管理</span><span style={{fontSize:10,color:"#94a3b8",marginLeft:8,fontWeight:400}}>Ver.1.83</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          {isAdmin && <button onClick={()=>setShowImport(true)} style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",color:"#fbbf24",borderRadius:5,padding:"3px 10px",fontSize:11,cursor:"pointer",fontWeight:600}}>📥 データ移行</button>}
          {isAdmin && isOwner && <button onClick={()=>setShowSnapshot(true)} style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",color:"#7dd3fc",borderRadius:5,padding:"3px 10px",fontSize:11,cursor:"pointer",fontWeight:600}}>🕐 スナップショット</button>}
          <span style={{fontSize:11,color:"#94a3b8"}}>
            <span onClick={()=>setTab("products")}  style={{cursor:"pointer"}} onMouseEnter={e=>e.target.style.textDecoration="underline"} onMouseLeave={e=>e.target.style.textDecoration="none"}>製品{products.length}件</span>
            {" / "}
            <span onClick={()=>setTab("customers")} style={{cursor:"pointer"}} onMouseEnter={e=>e.target.style.textDecoration="underline"} onMouseLeave={e=>e.target.style.textDecoration="none"}>顧客{customers.length}社</span>
            {" / "}
            <span onClick={()=>setTab("records")}   style={{cursor:"pointer"}} onMouseEnter={e=>e.target.style.textDecoration="underline"} onMouseLeave={e=>e.target.style.textDecoration="none"}>案件{records.length}件</span>
          </span>
          <span style={{fontSize:11,color:"#64748b"}}>{session.user.user_metadata?.name||session.user.email}</span>
          <button onClick={()=>supabase.auth.signOut()} style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",color:"#f87171",borderRadius:5,padding:"3px 10px",fontSize:11,cursor:"pointer",fontWeight:600}}>ログアウト</button>
        </div>
      </header>

      {newsFeed.length>0&&(()=>{const pn=newsFeed.filter(n=>n.source==="pronews");const sn=newsFeed.filter(n=>n.source==="snrec");const itemStyle={color:"#334155",fontSize:10,textDecoration:"none",background:"#fff",border:"1px solid #e2e8f0",borderRadius:4,padding:"2px 8px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",flex:"1",display:"block",boxShadow:"0 1px 2px rgba(0,0,0,.05)"};return(<div style={{background:"#f1f5f9",borderTop:"1px solid #e2e8f0",borderBottom:"1px solid #e2e8f0",padding:"4px 18px",display:"flex",flexDirection:"column",gap:4}}><span style={{color:"#64748b",fontSize:9,fontWeight:700,letterSpacing:1}}>業界NEWS</span>{[{items:pn,color:"#2563eb",icon:"📹"},{items:sn,color:"#059669",icon:"🎵"}].map((row,ri)=>(<div key={ri} style={{display:"flex",gap:6,alignItems:"center"}}>{row.items.map((n,i)=><a key={i} href={n.url} target="_blank" rel="noopener noreferrer" style={itemStyle}><span style={{color:row.color,marginRight:3}}>{row.icon}</span>{n.title}</a>)}</div>))}</div>);})()}

      {/* ── 自動AIの窓（信号灯バー）── 雄太ログイン時のみ表示 */}
      {isOwner&&(()=>{
        const today = new Date(); today.setHours(0,0,0,0);
        const todayLogs = aiLogs.filter(l => new Date(l.recorded_at) >= today);
        const failedCount = todayLogs.filter(l => l.status === 'failed').length;
        const isOk = failedCount === 0;
        // 家族単位で集約
        const familyMap = {};
        todayLogs.forEach(l => {
          const m = aiSourceMeta(l.source);
          if (!familyMap[m.family]) familyMap[m.family] = { label: m.label, hasFailed: false, latestAt: l.recorded_at };
          if (l.status === 'failed') familyMap[m.family].hasFailed = true;
          if (l.recorded_at > familyMap[m.family].latestAt) familyMap[m.family].latestAt = l.recorded_at;
        });
        const families = Object.values(familyMap);
        const latestAt = aiLogs.length > 0 ? new Date(aiLogs[0].recorded_at) : null;
        const timeStr = latestAt ? `${String(latestAt.getHours()).padStart(2,'0')}:${String(latestAt.getMinutes()).padStart(2,'0')}` : '--:--';
        return (
          <div>
            <div onClick={()=>setAiLogOpen(o=>!o)} style={{
              background: isOk ? "#f0fdf4" : "#fef2f2",
              borderBottom:"1px solid "+(isOk ? "#bbf7d0" : "#fecaca"),
              padding:"5px 18px", display:"flex", alignItems:"center", gap:10,
              cursor:"pointer", userSelect:"none", fontSize:11
            }}>
              <span style={{fontWeight:700, color: isOk ? "#16a34a" : "#dc2626", fontSize:10, letterSpacing:1}}>
                {isOk ? "自動AI ・ すべて正常" : `自動AI ・ ${failedCount}件の失敗`}
              </span>
              {families.map((f,i) => (
                <span key={i} style={{
                  background:"#fff", border:"1px solid "+(f.hasFailed ? "#fca5a5" : "#86efac"),
                  borderRadius:4, padding:"1px 8px", fontSize:10, display:"inline-flex", alignItems:"center", gap:3
                }}>
                  {f.label}
                  <span style={{color: f.hasFailed ? "#dc2626" : "#16a34a", fontWeight:700}}>
                    {f.hasFailed ? "✕" : "✓"}
                  </span>
                </span>
              ))}
              <span style={{marginLeft:"auto", color:"#94a3b8", fontSize:10}}>
                最終 {timeStr}
              </span>
              <span style={{color:"#94a3b8", fontSize:10}}>
                {aiLogOpen ? "▲ 閉じる" : "▼ 詳細を見る"}
              </span>
            </div>
            {aiLogOpen && (
              <div style={{background:"#fff", borderBottom:"1px solid #e2e8f0", padding:"8px 18px", maxHeight:400, overflowY:"auto"}}>
                <table style={{width:"100%", borderCollapse:"collapse", fontSize:12}}>
                  <thead>
                    <tr style={{borderBottom:"1px solid #e2e8f0"}}>
                      <th style={{textAlign:"left", padding:"4px 8px", color:"#64748b", fontWeight:600, fontSize:10}}>時刻</th>
                      <th style={{textAlign:"left", padding:"4px 8px", color:"#64748b", fontWeight:600, fontSize:10}}>処理名</th>
                      <th style={{textAlign:"left", padding:"4px 8px", color:"#64748b", fontWeight:600, fontSize:10}}>状態</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aiLogs.map(l => {
                      const d = new Date(l.recorded_at);
                      const ts = `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
                      const m = aiSourceMeta(l.source);
                      const ok = l.status === 'succeeded';
                      const expanded = aiLogExpandedId === l.id;
                      return (
                        <React.Fragment key={l.id}>
                          <tr onClick={()=>setAiLogExpandedId(expanded ? null : l.id)}
                            style={{borderBottom:"1px solid #f1f5f9", cursor:"pointer", background: expanded ? "#f8fafc" : "transparent"}}>
                            <td style={{padding:"5px 8px", color:"#334155", whiteSpace:"nowrap"}}>{ts}</td>
                            <td style={{padding:"5px 8px", color:"#334155"}}>{m.label}</td>
                            <td style={{padding:"5px 8px"}}>
                              <span style={{
                                display:"inline-block", padding:"1px 8px", borderRadius:4, fontSize:10, fontWeight:600,
                                background: ok ? "#f0fdf4" : "#fef2f2", color: ok ? "#16a34a" : "#dc2626",
                                border:"1px solid "+(ok ? "#bbf7d0" : "#fecaca")
                              }}>
                                {ok ? "成功" : "失敗"}
                              </span>
                            </td>
                          </tr>
                          {expanded && l.detail && (
                            <tr><td colSpan={3} style={{padding:"6px 8px 10px", background:"#f8fafc"}}>
                              <pre onClick={e=>{e.stopPropagation();navigator.clipboard.writeText(JSON.stringify(l.detail,null,2)).catch(()=>{});}}
                                style={{margin:0, fontSize:11, color:"#475569", background:"#f1f5f9", borderRadius:4,
                                  padding:"8px 10px", whiteSpace:"pre-wrap", wordBreak:"break-all", cursor:"copy",
                                  border:"1px solid #e2e8f0", maxHeight:200, overflowY:"auto"}}>
                                {JSON.stringify(l.detail, null, 2)}
                              </pre>
                              <span style={{fontSize:9, color:"#94a3b8", marginTop:2, display:"block"}}>クリックでコピー</span>
                            </td></tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                    {aiLogs.length === 0 && (
                      <tr><td colSpan={3} style={{padding:"12px 8px", color:"#94a3b8", textAlign:"center", fontSize:11}}>
                        ログがありません
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      <div className="app-tabs" style={{background:"#fff",borderBottom:"1px solid #e2e8f0",padding:"0 18px",display:"flex"}}>
        {TABS.filter(t=> t.id!=='bruno' || isBrunoTab).map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{background:"none",border:"none",padding:"13px 16px",fontSize:13,fontWeight:600,cursor:"pointer",color:tab===t.id?"#2563eb":"#64748b",borderBottom:tab===t.id?"2px solid #2563eb":"2px solid transparent",display:"flex",alignItems:"center",gap:6,marginBottom:-1}}>
            {t.icon&&<Ico d={t.icon} size={14} color={tab===t.id?"#2563eb":"#64748b"}/>}{t.label}
            {t.id==='inbox'&&inboxUnreadCount>0&&<span style={{background:'#dc2626',color:'#fff',borderRadius:10,padding:'1px 6px',fontSize:10,fontWeight:700,marginLeft:2}}>{inboxUnreadCount}</span>}
          </button>
        ))}
      </div>

      {/* グローバル検索バー（案件・納品書・請求書タブのみ表示） */}
      {["records","delivery","invoice"].includes(tab)&&(
        <div style={{background:"#f8fafc",borderBottom:"1px solid #e2e8f0",padding:"8px 18px",display:"flex",alignItems:"center",gap:8}}>
          <div style={{position:"relative",flex:1,maxWidth:400}}>
            <div style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",opacity:.4}}><Ico d={I.search} size={14}/></div>
            <input value={globalQ} onChange={e=>setGlobalQ(e.target.value)}
              placeholder="顧客名・製品名・案件名で横断検索..."
              style={{...S.inp,paddingLeft:30,fontSize:13}}/>
          </div>
          {globalQ&&(
            <>
              <span style={{fontSize:12,color:"#64748b"}}>
                「{globalQ}」で絞り込み中
              </span>
              <button onClick={()=>setGlobalQ("")} style={{background:"none",border:"1px solid #e2e8f0",borderRadius:5,padding:"3px 10px",fontSize:12,cursor:"pointer",color:"#64748b"}}>✕ クリア</button>
            </>
          )}
        </div>
      )}

      <div style={{maxWidth:1280,margin:"0 auto",padding:"20px 16px"}}>
        {tab==="records"   && <RecordsTab   records={records}   customers={customers} products={products} onSave={saveRec} onDeleteRec={deleteRec} showToast={showToast} onGoToCustomer={(id)=>{setOpenCustomerId(id);setTab("customers");}} onAfterSubmit={(rec)=>{setTab("delivery");if(rec) setAutoOpenDelivery(rec.id);}} invoiceData={invoiceData} globalQ={globalQ} session={session}/>}
        {tab==="delivery"  && <DeliveryTab  records={records}   customers={customers} groups={Object.values(invoiceGroups)} showToast={showToast} globalQ={globalQ} onSave={saveRec} autoOpenRecord={autoOpenDelivery} onClearAutoOpen={()=>setAutoOpenDelivery(null)}/>}
        {tab==="invoice"   && isAdmin && <InvoiceTab groups={Object.values(invoiceGroups)} customers={customers} products={products} onSaveCust={saveCust} invoiceData={invoiceData} onSaveInv={saveInv} showToast={showToast} globalQ={globalQ} records={records} onSaveRec={saveRec} incidents={incidents}/>}
        {tab==="invoice"   && !isAdmin && <div style={{padding:40,textAlign:"center",color:"#94a3b8",fontSize:14}}>請求書タブは管理者のみ閲覧できます。</div>}
        {tab==="customers" && <CustomersTab customers={customers} products={products} records={records} onSave={saveCust} onDeleteCust={deleteCust} onLogActivity={logActivity} showToast={showToast} presetCustomers={PRESET_CUSTOMERS} openCustomerId={openCustomerId} onOpenHandled={()=>setOpenCustomerId(null)}/>}
        {tab==="products"  && <ProductsTab  products={products}  customers={customers} onSave={saveProd} saveCust={saveCust} showToast={showToast} allProducts={ALL_PRODUCTS}/>}
        {tab==="actlogs"   && <ActivityLogsTab session={session}/>}
        {tab==="incidents" && <IncidentsTab incidents={incidents} setIncidents={setIncidents} customers={customers} records={records} showToast={showToast} onGoToDelivery={(id)=>{setTab("delivery");if(id&&id!=="none")setAutoOpenDelivery(id);}}/>}
        {tab==='bruno' && isBrunoTab && <BrunoChat session={session} isBruno={isBruno}/>}
        {tab==='inbox'&&(
          <div style={{padding:"24px 16px",maxWidth:800,margin:"0 auto"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <h2 style={{margin:0,fontSize:18,fontWeight:700,display:"flex",alignItems:"center",gap:8}}>
                <Ico d={I.mail} size={18}/> 受信箱
                {inboxUnreadCount>0&&<span style={{background:'#dc2626',color:'#fff',borderRadius:10,padding:'2px 8px',fontSize:12,fontWeight:700}}>{inboxUnreadCount}件 未読</span>}
              </h2>
              <button onClick={fetchInbox}
                style={{background:"none",border:"1px solid #e2e8f0",borderRadius:6,padding:"6px 12px",fontSize:12,cursor:"pointer",color:"#64748b"}}>
                🔄 更新
              </button>
            </div>
            {inboxLoading?<div style={{textAlign:"center",color:"#94a3b8",padding:40}}>読み込み中…</div>
            :inboxMessages.length===0?<div style={{textAlign:"center",color:"#94a3b8",padding:40}}>メールはまだありません</div>
            :<div style={{display:"flex",flexDirection:"column",gap:1}}>
              {inboxMessages.map(msg=>{
                const isUnread=!msg.read_at;
                const isExpanded=inboxExpandedId===msg.id;
                const attachments=Array.isArray(msg.attachment_names)?msg.attachment_names:[];
                return(
                  <div key={msg.id}
                    onClick={async()=>{
                      setInboxExpandedId(isExpanded?null:msg.id);
                      if(isUnread){
                        await supabase.from('email_inbox')
                          .update({read_at:new Date().toISOString(),read_by:session.user.email})
                          .eq('id',msg.id)
                          .is('read_at',null);
                        setInboxMessages(prev=>prev.map(m=>m.id===msg.id?{...m,read_at:new Date().toISOString(),read_by:session.user.email}:m));
                        setInboxUnreadCount(prev=>Math.max(0,prev-1));
                      }
                    }}
                    style={{background:isUnread?'#eff6ff':'#fff',border:'1px solid #e2e8f0',borderRadius:8,padding:'12px 16px',cursor:'pointer',transition:'background .15s'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}>
                      <div style={{flex:1,minWidth:0,textAlign:'left'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                          {isUnread&&<span style={{width:8,height:8,borderRadius:4,background:'#2563eb',flexShrink:0}}/>}
                          <span style={{fontSize:13,fontWeight:isUnread?700:500,color:'#1e293b',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                            {msg.from_name||msg.from_addr||'(差出人不明)'}
                          </span>
                        </div>
                        <div style={{fontSize:13,fontWeight:isUnread?700:400,color:'#334155',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                          {msg.subject||'(件名なし)'}
                        </div>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
                        <span style={{fontSize:11,color:'#94a3b8',whiteSpace:'nowrap'}}>
                          {msg.received_at?new Date(msg.received_at).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):''}
                        </span>
                        <button onClick={async(e)=>{
                          e.stopPropagation();
                          if(!confirm('このメールを削除しますか？'))return;
                          const{error}=await supabase.from('email_inbox').update({deleted_at:new Date().toISOString(),deleted_by:session.user.email}).eq('id',msg.id);
                          if(error){console.error('inbox delete error',error);alert('削除に失敗しました');return;}
                          setInboxMessages(prev=>prev.filter(m=>m.id!==msg.id));
                          if(isUnread)setInboxUnreadCount(prev=>Math.max(0,prev-1));
                        }} style={{background:'none',border:'none',cursor:'pointer',padding:'2px 4px',fontSize:14,color:'#94a3b8',borderRadius:4}} title="削除">🗑</button>
                      </div>
                    </div>
                    {isExpanded&&(
                      <div style={{marginTop:12,borderTop:'1px solid #e2e8f0',paddingTop:12,textAlign:'left'}} onClick={e=>e.stopPropagation()}>
                        <div style={{fontSize:11,color:'#94a3b8',marginBottom:8,textAlign:'left'}}>
                          From: {msg.from_name?`${msg.from_name} <${msg.from_addr}>`:msg.from_addr} → {msg.to_addr}
                        </div>
                        <pre style={{fontSize:13,color:'#334155',whiteSpace:'pre-wrap',wordBreak:'break-word',margin:0,fontFamily:'inherit',lineHeight:1.6,maxHeight:400,overflow:'auto',textAlign:'left'}}>
                          {linkifyText(msg.body_text)}
                        </pre>
                        {attachments.length>0&&(
                          <div style={{marginTop:10,fontSize:12,color:'#64748b'}}>
                            📎 添付: {attachments.join(', ')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>}
          </div>
        )}
        {tab==='knowledge'&&(
          <div style={{padding:"24px 16px",maxWidth:800,margin:"0 auto"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <h2 style={{margin:0,fontSize:18,fontWeight:700}}>📖 オルク辞典</h2>
              <button onClick={()=>{fetchKnowledgeList();fetchPendingList();}}
                style={{background:"none",border:"1px solid #e2e8f0",borderRadius:6,padding:"6px 12px",fontSize:12,cursor:"pointer",color:"#64748b"}}>
                🔄 更新
              </button>
            </div>
            {session&&(
              <div style={{display:'flex',gap:6,marginBottom:12}}>
                <button onClick={()=>setKnowledgeSubTab('list')}
                  style={{padding:'5px 14px',borderRadius:6,fontSize:13,fontWeight:600,border:'none',cursor:'pointer',
                    background:knowledgeSubTab==='list'?'#0f172a':'#f1f5f9',
                    color:knowledgeSubTab==='list'?'#fff':'#64748b'}}>
                  📚 辞典一覧 {knowledgeList.length>0&&`(${knowledgeList.length})`}
                </button>
                <button onClick={()=>setKnowledgeSubTab('pending')}
                  style={{padding:'5px 14px',borderRadius:6,fontSize:13,fontWeight:600,border:'none',cursor:'pointer',
                    background:knowledgeSubTab==='pending'?'#dc2626':'#fef2f2',
                    color:knowledgeSubTab==='pending'?'#fff':'#dc2626'}}>
                  ✅ 承認待ち {knowledgePendingList.length>0&&`(${knowledgePendingList.length})`}
                </button>
              </div>
            )}

            {knowledgeSubTab==='list'&&(
            <>{/* フィルター */}
            <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
              {[{id:"all",label:"全て"},{id:"manual",label:"✏️ 手動"},{id:"ec_auto",label:"🤖 自動EC"},{id:"internal",label:"🔒 内部のみ"}].map(f=>(
                <button key={f.id} onClick={()=>setKnowledgeFilter(f.id)}
                  style={{padding:"5px 12px",borderRadius:20,fontSize:12,cursor:"pointer",fontWeight:500,border:"none",
                    background:knowledgeFilter===f.id?"#0f172a":"#f1f5f9",
                    color:knowledgeFilter===f.id?"#fff":"#64748b"}}>
                  {f.label}
                </button>
              ))}
              <select
                value={knowledgeCategoryFilter}
                onChange={e=>setKnowledgeCategoryFilter(e.target.value)}
                style={{padding:"5px 10px",borderRadius:20,fontSize:12,border:"1px solid #e2e8f0",color:"#475569",background:"#f8fafc",cursor:"pointer"}}>
                <option value="">📂 カテゴリ: 全て</option>
                {knowledgeConcepts.filter(c=>!(c.parent_id)).map(parent=>(
                  <optgroup key={parent.id} label={parent.name}>
                    {knowledgeConcepts.filter(c=>c.parent_id===parent.id).map(child=>(
                      <option key={child.id} value={child.id}>{child.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* 検索 */}
            <input
              type="text"
              placeholder="質問・回答で検索..."
              value={knowledgeListSearch}
              onChange={e=>setKnowledgeListSearch(e.target.value)}
              style={{width:"100%",padding:"8px 12px",borderRadius:6,border:"1px solid #e2e8f0",fontSize:13,marginBottom:16,boxSizing:"border-box"}}
            />

            {knowledgeListLoading&&<div style={{color:"#94a3b8",fontSize:13}}>読み込み中...</div>}

            {!knowledgeListLoading&&(
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {knowledgeList
                  .filter(k=>{
                    if(knowledgeFilter==="manual"&&k.source_type!=="manual") return false;
                    if(knowledgeFilter==="ec_auto"&&k.source_type!=="ec_auto") return false;
                    if(knowledgeFilter==="internal"&&k.public_status!=='internal_only') return false;
                    if(knowledgeCategoryFilter&&k.concept_id!==knowledgeCategoryFilter) return false;
                    const q=knowledgeListSearch.toLowerCase();
                    if(!q) return true;
                    const relatedProds=(k.related_product_ids||[]).map(id=>products.find(p=>String(p.id)===String(id))).filter(Boolean);
                    const prodNames=relatedProds.map(p=>(p&&p.name)||'').join(' ').toLowerCase();
                    const tags=(k.scenario_tags||[]).join(' ').toLowerCase();
                    const conceptName=(()=>{const c=knowledgeConcepts.find(x=>x.id===k.concept_id);return c?(c.name||''):'';})().toLowerCase();
                    return (k.question_text||'').toLowerCase().includes(q)
                      ||(k.answer_text||'').toLowerCase().includes(q)
                      ||prodNames.includes(q)
                      ||tags.includes(q)
                      ||conceptName.includes(q);
                  })
                  .map(k=>{
                    const relatedProds=(k.related_product_ids||[]).map(id=>products.find(p=>String(p.id)===String(id))).filter(Boolean);
                    const isConfirmDelete=knowledgeDeleteConfirmId===k.id;
                    return(
                      <div key={k.id} style={{background:"#fff",border:isConfirmDelete?"1px solid #fca5a5":"1px solid #e2e8f0",borderRadius:10,padding:16}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                          <div style={{fontWeight:600,fontSize:14,color:"#0f172a",flex:1}}>❓ {k.question_text||"（質問なし）"}</div>
                          <div style={{display:"flex",gap:6,marginLeft:8,flexShrink:0}}>
                            {!isConfirmDelete&&session&&session.user.email==='y_inoue@olq.co.jp'&&(
                              <>
                                <button onClick={()=>{setEditingKnowledge(k);setEditKnowledgeQuestion(k.question_text||"");setEditKnowledgeAnswer(k.answer_text||"");setEditKnowledgeIsInternal(k.is_internal||false);setEditKnowledgeConceptId(k.concept_id||'');setEditKnowledgePublicStatus(k.public_status||'internal_only');}}
                                  style={{background:"none",border:"1px solid #e2e8f0",borderRadius:5,padding:"3px 8px",fontSize:11,cursor:"pointer",color:"#64748b"}}>編集</button>
                                <button onClick={()=>setKnowledgeDeleteConfirmId(k.id)}
                                  style={{background:"none",border:"1px solid #fecaca",borderRadius:5,padding:"3px 8px",fontSize:11,cursor:"pointer",color:"#ef4444"}}>削除</button>
                              </>
                            )}
                            {isConfirmDelete&&(
                              <>
                                <button onClick={()=>{deleteKnowledge(k.id);setKnowledgeDeleteConfirmId(null);}}
                                  style={{background:"#ef4444",border:"none",borderRadius:5,padding:"3px 10px",fontSize:11,cursor:"pointer",color:"#fff",fontWeight:600}}>本当に削除</button>
                                <button onClick={()=>setKnowledgeDeleteConfirmId(null)}
                                  style={{background:"none",border:"1px solid #e2e8f0",borderRadius:5,padding:"3px 8px",fontSize:11,cursor:"pointer",color:"#64748b"}}>キャンセル</button>
                              </>
                            )}
                          </div>
                        </div>
                        {isConfirmDelete&&<div style={{fontSize:12,color:"#ef4444",marginBottom:8}}>このエントリを削除しますか？</div>}
                        <div style={{fontSize:13,color:"#334155",marginBottom:10,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{k.answer_text}</div>
                        {(k.image_urls||[]).length>0&&(
                          <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:8}}>
                            {(k.image_urls||[]).map((url,i)=>(
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                <img src={url} alt="" style={{width:72,height:56,objectFit:'cover',borderRadius:4,border:'1px solid #e2e8f0'}}/>
                              </a>
                            ))}
                          </div>
                        )}
                        <div style={{display:"flex",flexWrap:"wrap",gap:6,alignItems:"center"}}>
                          {relatedProds.map(p=>(
                            <span key={(p&&p.id)||""} style={{display:'inline-flex',alignItems:'center',gap:4,background:"#f1f5f9",color:"#475569",borderRadius:4,padding:"2px 8px",fontSize:11}}>
                              📷 {(p&&p.name)||""}
                              {(p&&p.ec_url)&&(
                                <a href={p.ec_url} target="_blank" rel="noopener noreferrer"
                                  style={{color:'#2563eb',fontSize:10,textDecoration:'none'}} title="ECサイトで見る">🛒</a>
                              )}
                            </span>
                          ))}
                          {(k.scenario_tags||[]).map(tag=>(<span key={tag} style={{background:"#eff6ff",color:"#3b82f6",borderRadius:4,padding:"2px 8px",fontSize:11}}>{tag}</span>))}
                          {(()=>{
                            const ps=k.public_status;
                            if(ps==='public_safe') return <span style={{background:"#f0fdf4",color:"#16a34a",borderRadius:4,padding:"2px 8px",fontSize:11}}>✅ 顧客公開可</span>;
                            if(ps==='public_with_caution') return <span style={{background:"#fffbeb",color:"#d97706",borderRadius:4,padding:"2px 8px",fontSize:11}}>⚠️ 注意書き付き</span>;
                            if(ps==='do_not_answer') return <span style={{background:"#fff1f2",color:"#e11d48",borderRadius:4,padding:"2px 8px",fontSize:11}}>🚫 回答しない</span>;
                            return <span style={{background:"#fef3c7",color:"#d97706",borderRadius:4,padding:"2px 8px",fontSize:11}}>🔒 社内限定</span>;
                          })()}
                          <span style={{background:k.source_type==="ec_auto"?"#f0fdf4":k.source_type==="ec_contact"?"#fef2f2":"#f8fafc",color:k.source_type==="ec_auto"?"#16a34a":k.source_type==="ec_contact"?"#dc2626":"#64748b",borderRadius:4,padding:"2px 8px",fontSize:11}}>
                            {k.source_type==="ec_auto"?"🤖 自動EC":k.source_type==="ec_contact"?"👤 EC顧客質問":"✏️ 手動"}
                          </span>
                          {k.concept_id&&(()=>{const c=knowledgeConcepts.find(x=>x.id===k.concept_id);return c?(<span style={{background:"#f0f9ff",color:"#0369a1",borderRadius:4,padding:"2px 8px",fontSize:11}}>📂 {c.name}</span>):null;})()}
                          <span style={{marginLeft:"auto",fontSize:11,color:"#94a3b8"}}>{k.created_by} · {new Date(k.created_at).toLocaleDateString('ja-JP')}</span>
                        </div>
                      </div>
                    );
                  })}
                {knowledgeList.filter(k=>{
                  if(knowledgeFilter==="manual"&&k.source_type!=="manual") return false;
                  if(knowledgeFilter==="ec_auto"&&k.source_type!=="ec_auto") return false;
                  if(knowledgeFilter==="internal"&&k.public_status!=='internal_only') return false;
                  if(knowledgeCategoryFilter&&k.concept_id!==knowledgeCategoryFilter) return false;
                  const q=knowledgeListSearch.toLowerCase();
                  if(!q) return true;
                  const relatedProds=(k.related_product_ids||[]).map(id=>products.find(p=>String(p.id)===String(id))).filter(Boolean);
                  const prodNames=relatedProds.map(p=>(p&&p.name)||'').join(' ').toLowerCase();
                  const tags=(k.scenario_tags||[]).join(' ').toLowerCase();
                  const conceptName=(()=>{const c=knowledgeConcepts.find(x=>x.id===k.concept_id);return c?(c.name||''):'';})().toLowerCase();
                  return (k.question_text||'').toLowerCase().includes(q)
                    ||(k.answer_text||'').toLowerCase().includes(q)
                    ||prodNames.includes(q)
                    ||tags.includes(q)
                    ||conceptName.includes(q);
                }).length===0&&(
                  <div style={{color:"#94a3b8",fontSize:13,textAlign:"center",padding:40}}>まだエントリがありません。「＋」ボタンから追加してください。</div>
                )}
              </div>
            )}
            </>)}

            {/* 承認待ちリスト */}
            {knowledgeSubTab==='pending'&&session&&(
              <div>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12,padding:'10px 14px',background:'#f8fafc',borderRadius:8,border:'1px solid #e2e8f0'}}>
                  <span style={{fontSize:13,color:'#64748b'}}>🔍 検索モード</span>
                  <button onClick={async()=>{
                    const next=knowledgeSearchMode==='text'?'ai':'text';
                    await supabase.from('settings').update({value:JSON.stringify(next)}).eq('key','knowledge_search_mode');
                    setKnowledgeSearchMode(next);
                  }}
                    style={{padding:'4px 14px',borderRadius:20,fontSize:12,fontWeight:600,border:'none',cursor:'pointer',
                      background:knowledgeSearchMode==='ai'?'#0f172a':'#e2e8f0',
                      color:knowledgeSearchMode==='ai'?'#fff':'#64748b'}}>
                    {knowledgeSearchMode==='ai'?'🤖 AI':'📝 テキスト'}
                  </button>
                  <span style={{fontSize:11,color:'#94a3b8'}}>{knowledgeSearchMode==='text'?'テキストマッチで検索中':'Haikuが意味で判断中'}</span>
                </div>
                {pendingListLoading&&<div style={{color:'#94a3b8',fontSize:13}}>読み込み中...</div>}
                {!pendingListLoading&&knowledgePendingList.length===0&&(
                  <div style={{color:'#94a3b8',fontSize:13,textAlign:'center',padding:40}}>承認待ちはありません 🎉</div>
                )}
                {/* ブラッシュアップモードスイッチ */}
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12,padding:'10px 14px',background:'#fafafa',borderRadius:8,border:'1px solid #e2e8f0'}}>
                  <span style={{fontSize:13,color:'#64748b'}}>🔧 ブラッシュアップモード</span>
                  <button onClick={toggleRefineMode} disabled={refineModeSaving}
                    style={{padding:'4px 14px',borderRadius:20,fontSize:12,fontWeight:600,border:'none',cursor:'pointer',
                      background:refineModeEnabled?'#0f172a':'#e2e8f0',
                      color:refineModeEnabled?'#fff':'#64748b'}}>
                    {refineModeSaving?'...':(refineModeEnabled?'ON':'OFF')}
                  </button>
                  <span style={{fontSize:11,color:'#94a3b8'}}>{refineModeEnabled?'毎朝8時に改善・統合提案を自動生成中':'Phase 2移行後にONにする'}</span>
                </div>
                {/* 棚から昇格ボタン */}
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12,padding:'10px 14px',background:'#faf5ff',borderRadius:8,border:'1px solid #e9d5ff'}}>
                  <button onClick={promoteShelved} disabled={shelvedCount===0}
                    style={{padding:'5px 14px',borderRadius:8,fontSize:12,fontWeight:700,border:'none',cursor:shelvedCount===0?'default':'pointer',
                      background:shelvedCount>0?'#7c3aed':'#e2e8f0',color:shelvedCount>0?'#fff':'#94a3b8'}}>
                    📥 次のFAQを出す
                  </button>
                  <span style={{fontSize:12,color:shelvedCount>0?'#7c3aed':'#94a3b8',fontWeight:600}}>棚に{shelvedCount}件</span>
                </div>
                {/* 承認待ち検索 */}
                <div style={{marginBottom:12}}>
                  <input
                    value={pendingSearch}
                    onChange={e=>setPendingSearch(e.target.value)}
                    placeholder="質問・回答・製品名・タグで検索..."
                    style={{width:'100%',padding:'8px 12px',borderRadius:8,border:'1px solid #e2e8f0',fontSize:13,color:'#334155',boxSizing:'border-box'}}
                  />
                </div>

                {!pendingListLoading&&(()=>{
                  const CREATOR_MAP={'y_inoue':'井上 雄太','k_matsuzaka':'松坂 穫','bruno':'Bruno','j_goto':'後藤 潤一郎','h_iwamoto':'岩本 一志','t_katsuo':'勝男 拓海','k_sato':'佐藤 康祐'};
                  const creatorName=(v)=>{if(!v)return null;const key=v.includes('@')?v.split('@')[0]:v;return CREATOR_MAP[key]||key;};
                  return knowledgePendingList.filter(k=>{
                  if(!pendingSearch.trim()) return true;
                  const q=pendingSearch.toLowerCase();
                  const relProds=(k.related_product_ids||[]).map(id=>products.find(p=>String(p.id)===String(id))).filter(Boolean);
                  const prodNames=relProds.map(p=>(p&&p.name)||'').join(' ').toLowerCase();
                  const tags=(k.scenario_tags||[]).join(' ').toLowerCase();
                  return (k.question_text||'').toLowerCase().includes(q)
                    ||(k.answer_text||'').toLowerCase().includes(q)
                    ||prodNames.includes(q)
                    ||tags.includes(q);
                }).sort((a,b)=>((['ec_contact','manual'].includes(a.source_type))?0:1)-((['ec_contact','manual'].includes(b.source_type))?0:1)).map(k=>{
                  const relatedProds=(k.related_product_ids||[]).map(id=>products.find(p=>String(p.id)===String(id))).filter(Boolean);

                  // 🔧 改善提案カード
                  if(k.source_type==='refine_improve'){
                    const sourceQA=sourceKnowledgeMap[k.refine_source_id];
                    return(
                      <div key={k.id} style={{background:'#fff',border:'2px solid #f59e0b',borderRadius:10,padding:16,marginBottom:12}}>
                        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:10}}>
                          <span style={{background:'#fef3c7',color:'#d97706',borderRadius:6,padding:'2px 10px',fontSize:11,fontWeight:700}}>🔧 改善提案</span>
                          {relatedProds.map(p=>(<span key={(p&&p.id)||''} style={{background:'#f1f5f9',color:'#475569',borderRadius:4,padding:'2px 8px',fontSize:11}}>📷 {(p&&p.name)||''}</span>))}
                        </div>
                        {sourceQA&&(
                          <div style={{background:'#f8fafc',borderRadius:6,padding:10,marginBottom:8,border:'1px solid #e2e8f0'}}>
                            <div style={{fontSize:11,color:'#94a3b8',marginBottom:4}}>元のQ&A</div>
                            <div style={{fontWeight:600,fontSize:13,color:'#64748b',marginBottom:4}}>Q: {sourceQA.question_text}</div>
                            <div style={{fontSize:12,color:'#94a3b8',lineHeight:1.5,whiteSpace:'pre-wrap'}}>A: {sourceQA.answer_text}</div>
                            {sourceQA.yuta_correction_note&&<div style={{fontSize:11,color:'#f59e0b',marginTop:4}}>訂正メモ: {sourceQA.yuta_correction_note}</div>}
                          </div>
                        )}
                        <div style={{background:'#fffbeb',borderRadius:6,padding:10,marginBottom:10,border:'1px solid #fde68a'}}>
                          <div style={{fontSize:11,color:'#d97706',marginBottom:4}}>改善版</div>
                          <div style={{fontWeight:600,fontSize:14,color:'#0f172a',marginBottom:6}}>Q: {k.question_text}</div>
                          <div style={{fontSize:13,color:'#334155',lineHeight:1.6,whiteSpace:'pre-wrap'}}>A: {k.answer_text}</div>
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                          <button onClick={()=>approveWithReplace(k)}
                            style={{padding:'5px 14px',borderRadius:6,fontSize:12,border:'none',background:'#d97706',color:'#fff',fontWeight:600,cursor:'pointer'}}>
                            ✅ 承認して差し替え
                          </button>
                          <button onClick={()=>{setEditingPending(k);setEditPendingQuestion(k.question_text||'');setEditPendingAnswer(k.answer_text||'');setEditPendingPublicStatus(k.public_status||'internal_only');setEditPendingRiskLevel(k.risk_level||'low');setEditPendingNeedsHumanCheck(k.needs_human_check||false);setEditPendingCorrectionNote('');setEditPendingReferenceUrls(k.reference_urls||[]);setEditPendingImageFiles([]);setEditPendingImageUrls(k.image_urls||[]);}}
                            style={{padding:'5px 12px',borderRadius:6,fontSize:12,border:'1px solid #e2e8f0',background:'#fff',cursor:'pointer',color:'#475569'}}>
                            ✏️ 訂正して承認
                          </button>
                          <button onClick={()=>{setRejectModal(k.id);setRejectReason('');}}
                            style={{padding:'5px 12px',borderRadius:6,fontSize:12,border:'1px solid #fecaca',background:'#fff',color:'#ef4444',cursor:'pointer'}}>
                            却下
                          </button>
                        </div>
                      </div>
                    );
                  }

                  // 🔗 統合提案カード
                  if(k.source_type==='refine_merge'){
                    const sourceQAs=(k.merge_source_ids||[]).map(id=>sourceKnowledgeMap[id]).filter(Boolean);
                    return(
                      <div key={k.id} style={{background:'#fff',border:'2px solid #8b5cf6',borderRadius:10,padding:16,marginBottom:12}}>
                        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:10}}>
                          <span style={{background:'#ede9fe',color:'#7c3aed',borderRadius:6,padding:'2px 10px',fontSize:11,fontWeight:700}}>🔗 統合提案（元{(k.merge_source_ids||[]).length}件を削除）</span>
                          {relatedProds.map(p=>(<span key={(p&&p.id)||''} style={{background:'#f1f5f9',color:'#475569',borderRadius:4,padding:'2px 8px',fontSize:11}}>📷 {(p&&p.name)||''}</span>))}
                        </div>
                        {sourceQAs.map((sq,i)=>(
                          <div key={sq.id} style={{background:'#f8fafc',borderRadius:6,padding:10,marginBottom:6,border:'1px solid #e2e8f0'}}>
                            <div style={{fontSize:11,color:'#94a3b8',marginBottom:4}}>元のQ&A {i+1}</div>
                            <div style={{fontWeight:600,fontSize:13,color:'#64748b',marginBottom:4}}>Q: {sq.question_text}</div>
                            <div style={{fontSize:12,color:'#94a3b8',lineHeight:1.5,whiteSpace:'pre-wrap'}}>A: {sq.answer_text}</div>
                            {sq.yuta_correction_note&&<div style={{fontSize:11,color:'#f59e0b',marginTop:4}}>訂正メモ: {sq.yuta_correction_note}</div>}
                          </div>
                        ))}
                        <div style={{background:'#f5f3ff',borderRadius:6,padding:10,marginBottom:10,border:'1px solid #ddd6fe'}}>
                          <div style={{fontSize:11,color:'#7c3aed',marginBottom:4}}>統合版</div>
                          <div style={{fontWeight:600,fontSize:14,color:'#0f172a',marginBottom:6}}>Q: {k.question_text}</div>
                          <div style={{fontSize:13,color:'#334155',lineHeight:1.6,whiteSpace:'pre-wrap'}}>A: {k.answer_text}</div>
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                          <button onClick={()=>approveMerge(k)}
                            style={{padding:'5px 14px',borderRadius:6,fontSize:12,border:'none',background:'#7c3aed',color:'#fff',fontWeight:600,cursor:'pointer'}}>
                            ✅ 承認して統合・元{(k.merge_source_ids||[]).length}件削除
                          </button>
                          <button onClick={()=>{setEditingPending(k);setEditPendingQuestion(k.question_text||'');setEditPendingAnswer(k.answer_text||'');setEditPendingPublicStatus(k.public_status||'internal_only');setEditPendingRiskLevel(k.risk_level||'low');setEditPendingNeedsHumanCheck(k.needs_human_check||false);setEditPendingCorrectionNote('');setEditPendingReferenceUrls(k.reference_urls||[]);setEditPendingImageFiles([]);setEditPendingImageUrls(k.image_urls||[]);}}
                            style={{padding:'5px 12px',borderRadius:6,fontSize:12,border:'1px solid #e2e8f0',background:'#fff',cursor:'pointer',color:'#475569'}}>
                            ✏️ 訂正して承認
                          </button>
                          <button onClick={()=>{setRejectModal(k.id);setRejectReason('');}}
                            style={{padding:'5px 12px',borderRadius:6,fontSize:12,border:'1px solid #fecaca',background:'#fff',color:'#ef4444',cursor:'pointer'}}>
                            却下
                          </button>
                        </div>
                      </div>
                    );
                  }

                  // ❓ Haikuからの質問カード
                  if(k.source_type==='haiku_question'){
                    return(
                      <div key={k.id} style={{background:'#fff',border:'2px solid #f97316',borderRadius:10,padding:16,marginBottom:12}}>
                        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:10}}>
                          <span style={{background:'#fff7ed',color:'#ea580c',borderRadius:6,padding:'2px 10px',fontSize:11,fontWeight:700}}>❓ Haikuからの質問</span>
                          {relatedProds.map(p=>(<span key={(p&&p.id)||''} style={{background:'#f1f5f9',color:'#475569',borderRadius:4,padding:'2px 8px',fontSize:11}}>📷 {(p&&p.name)||''}</span>))}
                        </div>
                        <div style={{fontWeight:600,fontSize:14,color:'#0f172a',marginBottom:4}}>Q: {k.question_text}</div>
                        <div style={{fontSize:12,color:'#94a3b8',marginBottom:10}}>※ Haikuが製品情報から回答できなかった質問です。雄太さんが直接回答してください。</div>
                        <textarea
                          value={haikuAnswers[k.id]||''}
                          onChange={e=>setHaikuAnswers(prev=>({...prev,[k.id]:e.target.value}))}
                          placeholder="回答を入力..."
                          rows={4}
                          style={{width:'100%',padding:'8px 10px',border:'1px solid #fed7aa',borderRadius:6,fontSize:13,resize:'vertical',boxSizing:'border-box',fontFamily:'inherit',marginBottom:8}}
                        />
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <button onClick={()=>approveHaikuQuestion(k.id,haikuAnswers[k.id]||'')}
                            style={{padding:'5px 14px',borderRadius:6,fontSize:12,border:'none',background:'#ea580c',color:'#fff',fontWeight:600,cursor:'pointer'}}>
                            ✅ 回答して承認
                          </button>
                          <button onClick={()=>{setRejectModal(k.id);setRejectReason('');}}
                            style={{padding:'5px 12px',borderRadius:6,fontSize:12,border:'1px solid #fecaca',background:'#fff',color:'#ef4444',cursor:'pointer'}}>
                            却下
                          </button>
                        </div>
                      </div>
                    );
                  }

                  // 👤 ECサイトからの質問カード
                  if(k.source_type==='ec_contact'){
                    return(
                      <div key={k.id} style={{background:'#fff7ed',border:'2px solid #dc2626',borderRadius:10,padding:16,marginBottom:12}}>
                        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:10}}>
                          <span style={{background:'#dc2626',color:'#fff',borderRadius:6,padding:'3px 12px',fontSize:12,fontWeight:700}}>👤 ECサイトからの質問</span>
                          <span style={{background:'#fef3c7',color:'#92400e',borderRadius:4,padding:'2px 8px',fontSize:11,fontWeight:600}}>お客様</span>
                          {relatedProds.map(p=>(<span key={(p&&p.id)||''} style={{background:'#f1f5f9',color:'#475569',borderRadius:4,padding:'2px 8px',fontSize:11}}>📷 {(p&&p.name)||''}</span>))}
                        </div>
                        {k.structured_data?.email&&(
                          <div style={{fontSize:11,color:'#dc2626',marginBottom:8,fontWeight:600}}>📧 返信先: {k.structured_data.email}</div>
                        )}
                        <div style={{fontWeight:600,fontSize:14,color:'#0f172a',marginBottom:4}}>Q: {k.question_text||'（質問なし）'}</div>
                        <div style={{fontSize:13,color:'#334155',marginBottom:10,lineHeight:1.6,whiteSpace:'pre-wrap'}}>{k.answer_text}</div>
                        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                          <button onClick={()=>{setEditingPending(k);setEditPendingQuestion(k.question_text||'');setEditPendingAnswer(k.answer_text||'');setEditPendingPublicStatus(k.public_status||'internal_only');setEditPendingRiskLevel(k.risk_level||'low');setEditPendingNeedsHumanCheck(k.needs_human_check||false);setEditPendingCorrectionNote('');setEditPendingReferenceUrls(k.reference_urls||[]);setEditPendingImageFiles([]);setEditPendingImageUrls(k.image_urls||[]);}}
                            style={{padding:'5px 14px',borderRadius:6,fontSize:12,border:'none',background:'#dc2626',color:'#fff',fontWeight:600,cursor:'pointer'}}>
                            ✅ 訂正して承認・返信
                          </button>
                          <button onClick={()=>{setRejectModal(k.id);setRejectReason('');}}
                            style={{padding:'5px 12px',borderRadius:6,fontSize:12,border:'1px solid #fecaca',background:'#fff',color:'#ef4444',cursor:'pointer'}}>
                            却下
                          </button>
                        </div>
                      </div>
                    );
                  }

                  // 通常カード（ec_auto / manual）
                  const isYuta = session&&session.user.email==='y_inoue@olq.co.jp';
                  return(
                    <div key={k.id} style={{background:'#fff',border:k.review_status==='reviewed'?'2px solid #22c55e':'1px solid #e2e8f0',borderRadius:10,padding:16,marginBottom:12}}>
                      {k.review_status==='reviewed'&&(
                        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8,padding:'4px 10px',background:'#f0fdf4',borderRadius:6,border:'1px solid #bbf7d0',width:'fit-content'}}>
                          <span style={{fontSize:12,color:'#16a34a',fontWeight:600}}>✔ スタッフ確認済み</span>
                          {k.assigned_to&&<span style={{fontSize:11,color:'#86efac'}}>{k.assigned_to}</span>}
                        </div>
                      )}
                      <div style={{fontWeight:600,fontSize:14,color:'#0f172a',marginBottom:6}}>❓ {k.question_text||'（質問なし）'}</div>
                      <div style={{fontSize:13,color:'#334155',marginBottom:10,lineHeight:1.6,whiteSpace:'pre-wrap'}}>{k.answer_text}</div>
                      <div style={{display:'flex',flexWrap:'wrap',gap:6,alignItems:'center',marginBottom:10}}>
                        {relatedProds.map(p=>(<span key={(p&&p.id)||''} style={{background:'#f1f5f9',color:'#475569',borderRadius:4,padding:'2px 8px',fontSize:11}}>📷 {(p&&p.name)||''}</span>))}
                        <span style={{background:k.source_type==='ec_auto'?'#f0fdf4':'#f8fafc',color:k.source_type==='ec_auto'?'#16a34a':'#64748b',borderRadius:4,padding:'2px 8px',fontSize:11}}>
                          {k.source_type==='ec_auto'?'🤖 自動EC':'✏️ 手動'}
                        </span>
                        {k.source_type==='manual'&&creatorName(k.created_by)&&(
                          <span style={{background:'#ede9fe',color:'#6d28d9',borderRadius:4,padding:'2px 8px',fontSize:11,fontWeight:600}}>✍️ {creatorName(k.created_by)}</span>
                        )}
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                        {isYuta&&(<>
                          <label style={{fontSize:12,color:'#64748b'}}>優先度</label>
                          <select value={k.priority||5} onChange={e=>updateKnowledgePriority(k.id,e.target.value)}
                            style={{padding:'3px 8px',borderRadius:6,border:'1px solid #e2e8f0',fontSize:12,color:'#334155'}}>
                            {[10,9,8,7,6,5,4,3,2,1].map(n=>(<option key={n} value={n}>{n}</option>))}
                          </select>
                        </>)}
                        <button onClick={()=>{setEditingPending(k);setEditPendingQuestion(k.question_text||'');setEditPendingAnswer(k.answer_text||'');setEditPendingPublicStatus(k.public_status||'internal_only');setEditPendingRiskLevel(k.risk_level||'low');setEditPendingNeedsHumanCheck(k.needs_human_check||false);setEditPendingCorrectionNote('');setEditPendingReferenceUrls(k.reference_urls||[]);setEditPendingImageFiles([]);setEditPendingImageUrls(k.image_urls||[]);}}
                          style={{padding:'5px 12px',borderRadius:6,fontSize:12,border:'1px solid #e2e8f0',background:'#fff',cursor:'pointer',color:'#475569'}}>
                          ✏️ 訂正する
                        </button>
                        {isYuta&&(<>
                          <button onClick={()=>approveKnowledge(k.id)}
                            style={{padding:'5px 14px',borderRadius:6,fontSize:12,border:'none',background:'#0f172a',color:'#fff',fontWeight:600,cursor:'pointer'}}>
                            ✅ 承認
                          </button>
                          <button onClick={()=>{setAssignModal(k.id);setAssignTarget('');}}
                            style={{padding:'5px 12px',borderRadius:6,fontSize:12,border:'1px solid #bfdbfe',background:'#fff',color:'#2563eb',cursor:'pointer'}}>
                            👤 スタッフに送る
                          </button>
                        </>)}
                        {!isYuta&&(
                          <button onClick={()=>reviewComplete(k.id)}
                            style={{padding:'5px 14px',borderRadius:6,fontSize:12,border:'none',background:'#16a34a',color:'#fff',fontWeight:600,cursor:'pointer'}}>
                            ✅ レビュー完了
                          </button>
                        )}
                        <button onClick={()=>{setRejectModal(k.id);setRejectReason('');}}
                          style={{padding:'5px 12px',borderRadius:6,fontSize:12,border:'1px solid #fecaca',background:'#fff',color:'#ef4444',cursor:'pointer'}}>
                          却下
                        </button>
                      </div>
                    </div>
                  );
                });})()}
              </div>
            )}

            {/* 編集モーダル */}
            {editingKnowledge&&(
              <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:9002,display:"flex",alignItems:"center",justifyContent:"center"}}
                onClick={e=>{if(e.target===e.currentTarget)setEditingKnowledge(null);}}>
                <div style={{background:"#fff",borderRadius:12,padding:24,width:"90%",maxWidth:480,maxHeight:"80vh",overflowY:"auto"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                    <span style={{fontWeight:700,fontSize:16}}>📖 エントリを編集</span>
                    <button onClick={()=>setEditingKnowledge(null)} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:"#64748b"}}>×</button>
                  </div>
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:12,color:"#64748b",marginBottom:4}}>質問</div>
                    <textarea value={editKnowledgeQuestion} onChange={e=>setEditKnowledgeQuestion(e.target.value)}
                      style={{width:"100%",padding:"8px 12px",borderRadius:6,border:"1px solid #e2e8f0",fontSize:13,minHeight:60,resize:"vertical",boxSizing:"border-box"}}/>
                  </div>
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:12,color:"#64748b",marginBottom:4}}>回答</div>
                    <textarea value={editKnowledgeAnswer} onChange={e=>setEditKnowledgeAnswer(e.target.value)}
                      style={{width:"100%",padding:"8px 12px",borderRadius:6,border:"1px solid #e2e8f0",fontSize:13,minHeight:100,resize:"vertical",boxSizing:"border-box"}}/>
                  </div>
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:12,color:"#64748b",marginBottom:4}}>カテゴリ</div>
                    <select
                      value={editKnowledgeConceptId}
                      onChange={e=>setEditKnowledgeConceptId(e.target.value)}
                      style={{width:"100%",padding:"8px 12px",borderRadius:6,border:"1px solid #e2e8f0",fontSize:13,color:"#334155",background:"#fff"}}>
                      <option value="">未分類</option>
                      {knowledgeConcepts.filter(c=>!(c.parent_id)).map(parent=>(
                        <optgroup key={parent.id} label={parent.name}>
                          {knowledgeConcepts.filter(c=>c.parent_id===parent.id).map(child=>(
                            <option key={child.id} value={child.id}>{child.name}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div style={{marginBottom:16}}>
                    <div style={{fontSize:12,color:"#64748b",marginBottom:4}}>公開ステータス</div>
                    <select value={editKnowledgePublicStatus} onChange={e=>setEditKnowledgePublicStatus(e.target.value)}
                      style={{width:"100%",padding:"8px 12px",borderRadius:6,border:"1px solid #e2e8f0",fontSize:13,color:"#334155",background:"#fff"}}>
                      <option value="internal_only">🔒 社内限定</option>
                      <option value="public_safe">✅ 顧客公開可</option>
                      <option value="public_with_caution">⚠️ 注意書き付きで公開</option>
                      <option value="do_not_answer">🚫 回答しない</option>
                    </select>
                  </div>
                  <button onClick={updateKnowledge} disabled={editKnowledgeSaving}
                    style={{width:"100%",padding:"10px",background:"#0f172a",color:"#fff",border:"none",borderRadius:8,fontSize:14,fontWeight:600,cursor:"pointer"}}>
                    {editKnowledgeSaving?"保存中...":"保存する"}
                  </button>
                </div>
              </div>
            )}

            {/* 訂正して承認モーダル */}
            {editingPending&&(
              <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:9003,display:'flex',alignItems:'center',justifyContent:'center'}}
                onClick={e=>{if(e.target===e.currentTarget)setEditingPending(null);}}>
                <div style={{background:'#fff',borderRadius:12,padding:24,width:'90%',maxWidth:480,maxHeight:'80vh',overflowY:'auto'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                    <span style={{fontWeight:700,fontSize:16}}>✏️ 訂正して承認</span>
                    <button onClick={()=>setEditingPending(null)} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#64748b'}}>×</button>
                  </div>
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:12,color:'#64748b',marginBottom:4}}>質問</div>
                    <textarea value={editPendingQuestion} onChange={e=>setEditPendingQuestion(e.target.value)}
                      style={{width:'100%',padding:'8px 12px',borderRadius:6,border:'1px solid #e2e8f0',fontSize:13,minHeight:60,resize:'vertical',boxSizing:'border-box'}}/>
                  </div>
                  <div style={{marginBottom:16}}>
                    <div style={{fontSize:12,color:'#64748b',marginBottom:4}}>回答</div>
                    <textarea value={editPendingAnswer} onChange={e=>setEditPendingAnswer(e.target.value)}
                      style={{width:'100%',padding:'8px 12px',borderRadius:6,border:'1px solid #e2e8f0',fontSize:13,minHeight:100,resize:'vertical',boxSizing:'border-box'}}/>
                  </div>
                  {editingPending&&editingPending.source_url&&(
                    <div style={{marginBottom:12,padding:'8px 12px',background:'#f8fafc',borderRadius:6,border:'1px solid #e2e8f0'}}>
                      <div style={{fontSize:11,color:'#94a3b8',marginBottom:4}}>📎 参照元URL（確認用）</div>
                      <a href={editingPending.source_url} target="_blank" rel="noopener noreferrer" style={{fontSize:12,color:'#2563eb',wordBreak:'break-all'}}>{editingPending.source_url}</a>
                    </div>
                  )}
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:12,color:'#64748b',marginBottom:4}}>公開ステータス</div>
                    <select value={editPendingPublicStatus} onChange={e=>setEditPendingPublicStatus(e.target.value)}
                      style={{width:'100%',padding:'8px 12px',borderRadius:6,border:'1px solid #e2e8f0',fontSize:13,color:'#334155',background:'#fff'}}>
                      <option value="internal_only">🔒 社内限定</option>
                      <option value="public_safe">✅ 顧客公開可</option>
                      <option value="public_with_caution">⚠️ 注意書き付きで公開</option>
                      <option value="do_not_answer">🚫 回答しない</option>
                    </select>
                  </div>
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:12,color:'#64748b',marginBottom:4}}>リスクレベル</div>
                    <select value={editPendingRiskLevel} onChange={e=>setEditPendingRiskLevel(e.target.value)}
                      style={{width:'100%',padding:'8px 12px',borderRadius:6,border:'1px solid #e2e8f0',fontSize:13,color:'#334155',background:'#fff'}}>
                      <option value="low">🟢 low：仕様・スペック・一般情報</option>
                      <option value="medium">🟡 medium：使いこなし・組み合わせ・注意事項</option>
                      <option value="high">🔴 high：現場リスク直結・損害の可能性あり</option>
                    </select>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
                    <input type="checkbox" id="editNeedsHumanCheck" checked={editPendingNeedsHumanCheck} onChange={e=>setEditPendingNeedsHumanCheck(e.target.checked)}/>
                    <label htmlFor="editNeedsHumanCheck" style={{fontSize:13,color:'#475569',cursor:'pointer'}}>👤 スタッフ確認が必要（LINE Botで自動回答しない）</label>
                  </div>
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:12,color:'#64748b',marginBottom:6}}>参考URL（任意・複数追加可）</div>
                    {editPendingReferenceUrls.map((ref,i)=>(
                      <div key={i} style={{display:'flex',gap:6,marginBottom:6,alignItems:'center'}}>
                        <input value={ref.label||''} onChange={e=>setEditPendingReferenceUrls(prev=>prev.map((r,j)=>j===i?{...r,label:e.target.value}:r))}
                          placeholder="ラベル（例：メーカー公式）"
                          style={{flex:'0 0 130px',padding:'6px 8px',borderRadius:6,border:'1px solid #e2e8f0',fontSize:12}}/>
                        <input value={ref.url||''} onChange={e=>setEditPendingReferenceUrls(prev=>prev.map((r,j)=>j===i?{...r,url:e.target.value}:r))}
                          placeholder="https://..."
                          style={{flex:1,padding:'6px 8px',borderRadius:6,border:'1px solid #e2e8f0',fontSize:12}}/>
                        <button type="button" onClick={()=>setEditPendingReferenceUrls(prev=>prev.filter((_,j)=>j!==i))}
                          style={{padding:'4px 8px',borderRadius:6,border:'1px solid #fecaca',background:'#fff',color:'#ef4444',fontSize:12,cursor:'pointer',flexShrink:0}}>×</button>
                      </div>
                    ))}
                    <button type="button" onClick={()=>setEditPendingReferenceUrls(prev=>[...prev,{label:'',url:''}])}
                      style={{padding:'5px 12px',borderRadius:6,border:'1px solid #e2e8f0',background:'#f8fafc',fontSize:12,cursor:'pointer',color:'#475569'}}>
                      ＋ URLを追加
                    </button>
                  </div>
                  <div style={{marginBottom:16}}>
                    <div style={{fontSize:12,color:'#64748b',marginBottom:4}}>訂正メモ（任意）</div>
                    <textarea value={editPendingCorrectionNote} onChange={e=>setEditPendingCorrectionNote(e.target.value)}
                      placeholder="AIの回答をどう訂正したか・なぜ変えたかを記録（学習データになります）"
                      style={{width:'100%',padding:'8px 12px',borderRadius:6,border:'1px solid #e2e8f0',fontSize:13,minHeight:60,resize:'vertical',boxSizing:'border-box'}}/>
                  </div>
                  <div style={{marginBottom:16}}>
                    <div style={{fontSize:12,color:'#64748b',marginBottom:6}}>画像（任意・複数可）</div>
                    {editPendingImageUrls.length>0&&(
                      <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:8}}>
                        {editPendingImageUrls.map((url,i)=>(
                          <div key={i} style={{position:'relative'}}>
                            <img src={url} alt="" style={{width:72,height:56,objectFit:'cover',borderRadius:4,border:'1px solid #e2e8f0'}}/>
                            <button type="button" onClick={()=>setEditPendingImageUrls(prev=>prev.filter((_,j)=>j!==i))}
                              style={{position:'absolute',top:-4,right:-4,width:16,height:16,borderRadius:'50%',background:'#ef4444',border:'none',color:'#fff',fontSize:10,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:0}}>×</button>
                          </div>
                        ))}
                      </div>
                    )}
                    {editPendingImageFiles.length>0&&(
                      <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:8}}>
                        {editPendingImageFiles.map((f,i)=>(
                          <div key={i} style={{position:'relative'}}>
                            <img src={URL.createObjectURL(f)} alt="" style={{width:72,height:56,objectFit:'cover',borderRadius:4,border:'1px solid #fbbf24'}}/>
                            <button type="button" onClick={()=>setEditPendingImageFiles(prev=>prev.filter((_,j)=>j!==i))}
                              style={{position:'absolute',top:-4,right:-4,width:16,height:16,borderRadius:'50%',background:'#ef4444',border:'none',color:'#fff',fontSize:10,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:0}}>×</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <label style={{display:'inline-block',padding:'5px 12px',borderRadius:6,border:'1px solid #e2e8f0',background:'#f8fafc',fontSize:12,cursor:'pointer',color:'#475569'}}>
                      📷 画像を追加
                      <input type="file" accept="image/*" multiple style={{display:'none'}} onChange={e=>{
                        const files=Array.from(e.target.files||[]);
                        setEditPendingImageFiles(prev=>[...prev,...files]);
                        e.target.value='';
                      }}/>
                    </label>
                    {editPendingImageUploading&&<span style={{fontSize:12,color:'#94a3b8',marginLeft:8}}>アップロード中...</span>}
                  </div>
                  <button onClick={approveWithEdit} disabled={editPendingSaving}
                    style={{width:'100%',padding:'10px',background:'#0f172a',color:'#fff',border:'none',borderRadius:8,fontSize:14,fontWeight:600,cursor:'pointer'}}>
                    {editPendingSaving?'保存中...':'訂正して承認する'}
                  </button>
                </div>
              </div>
            )}
            {/* 却下理由モーダル */}
            {rejectModal&&(
              <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:9004,display:'flex',alignItems:'center',justifyContent:'center'}}
                onClick={e=>{if(e.target===e.currentTarget){setRejectModal(null);setRejectReason('');}}}>
                <div style={{background:'#fff',borderRadius:12,padding:24,width:'90%',maxWidth:400}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                    <span style={{fontWeight:700,fontSize:16}}>却下理由（任意）</span>
                    <button onClick={()=>{setRejectModal(null);setRejectReason('');}} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#64748b'}}>×</button>
                  </div>
                  <textarea value={rejectReason} onChange={e=>setRejectReason(e.target.value)}
                    placeholder="例：提案の方向性が違う / 既に承認済みと重複 / 情報が古い（任意）"
                    style={{width:'100%',padding:'8px 12px',borderRadius:6,border:'1px solid #e2e8f0',fontSize:13,minHeight:80,resize:'vertical',boxSizing:'border-box',marginBottom:16}}/>
                  <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                    <button onClick={()=>{setRejectModal(null);setRejectReason('');}}
                      style={{padding:'8px 16px',borderRadius:6,border:'1px solid #e2e8f0',background:'#fff',cursor:'pointer',fontSize:13}}>キャンセル</button>
                    <button onClick={()=>rejectKnowledge(rejectModal,rejectReason)}
                      style={{padding:'8px 20px',borderRadius:6,border:'none',background:'#ef4444',color:'#fff',fontWeight:600,cursor:'pointer',fontSize:13}}>却下する</button>
                  </div>
                </div>
              </div>
            )}
            {/* スタッフ送信モーダル */}
            {assignModal&&(
              <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:9005,display:'flex',alignItems:'center',justifyContent:'center'}}
                onClick={e=>{if(e.target===e.currentTarget){setAssignModal(null);setAssignTarget('');}}}>
                <div style={{background:'#fff',borderRadius:12,padding:24,width:'90%',maxWidth:400}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                    <span style={{fontWeight:700,fontSize:16}}>👤 スタッフに送る</span>
                    <button onClick={()=>{setAssignModal(null);setAssignTarget('');}} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#64748b'}}>×</button>
                  </div>
                  <div style={{marginBottom:16}}>
                    <div style={{fontSize:12,color:'#64748b',marginBottom:6}}>担当スタッフを選択</div>
                    <select value={assignTarget} onChange={e=>setAssignTarget(e.target.value)}
                      style={{width:'100%',padding:'8px 12px',borderRadius:6,border:'1px solid #e2e8f0',fontSize:13,color:'#334155',background:'#fff'}}>
                      <option value="">選択してください</option>
                      {staffList.map(s=>(<option key={s.id} value={s.email}>{s.email}</option>))}
                    </select>
                  </div>
                  <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                    <button onClick={()=>{setAssignModal(null);setAssignTarget('');}}
                      style={{padding:'8px 16px',borderRadius:6,border:'1px solid #e2e8f0',background:'#fff',cursor:'pointer',fontSize:13}}>キャンセル</button>
                    <button onClick={()=>{if(assignTarget)assignToStaff(assignModal,assignTarget);}}
                      disabled={!assignTarget}
                      style={{padding:'8px 20px',borderRadius:6,border:'none',background:assignTarget?'#2563eb':'#e2e8f0',color:assignTarget?'#fff':'#94a3b8',fontWeight:600,cursor:assignTarget?'pointer':'default',fontSize:13}}>送る</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ＋ナレッジ 浮遊ボタン */}
      {session && (
        <>
          <button
            onClick={()=>setQuestionModalStep(1)}
            style={{
              position:"fixed",bottom:24,right:24,zIndex:9000,
              background:"#0f172a",color:"#fff",border:"none",
              borderRadius:"50%",width:52,height:52,
              fontSize:22,cursor:"pointer",
              boxShadow:"0 4px 16px rgba(0,0,0,0.25)",
              display:"flex",alignItems:"center",justifyContent:"center",
              fontWeight:700
            }}
            title="質問を登録"
          >❓</button>

          {questionModalStep>0&&(
            <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:9001,display:'flex',alignItems:'center',justifyContent:'center'}}
              onClick={e=>{if(e.target===e.currentTarget){setQuestionModalStep(0);setQuestionInput('');setQuestionSelectedProducts([]);setQuestionSearchResults([]);setQuestionSearchDone(false);}}}>
              <div style={{background:'#fff',borderRadius:12,padding:24,width:'90%',maxWidth:480,maxHeight:'80vh',overflowY:'auto'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                  <span style={{fontWeight:700,fontSize:16}}>❓ 質問を登録</span>
                  <button onClick={()=>{setQuestionModalStep(0);setQuestionInput('');setQuestionSelectedProducts([]);setQuestionSearchResults([]);setQuestionSearchDone(false);}}
                    style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#64748b'}}>×</button>
                </div>

                {/* ステップ1: 入り口選択 */}
                {questionModalStep===1&&(
                  <div style={{display:'flex',flexDirection:'column',gap:10}}>
                    <div style={{fontSize:13,color:'#64748b',marginBottom:4}}>どちらについての質問ですか？</div>
                    <button onClick={()=>{setQuestionCategory('product');setQuestionModalStep(2);}}
                      style={{padding:'14px 16px',borderRadius:8,border:'1px solid #e2e8f0',background:'#f8fafc',cursor:'pointer',textAlign:'left',fontSize:14,fontWeight:500,color:'#0f172a'}}>
                      📷 機材について
                    </button>
                    <button onClick={()=>{setQuestionCategory('general');setQuestionModalStep(3);}}
                      style={{padding:'14px 16px',borderRadius:8,border:'1px solid #e2e8f0',background:'#f8fafc',cursor:'pointer',textAlign:'left',fontSize:14,fontWeight:500,color:'#0f172a'}}>
                      🏢 社内・その他について
                    </button>
                  </div>
                )}

                {/* ステップ2: 機材選択 */}
                {questionModalStep===2&&(
                  <div>
                    <button onClick={()=>setQuestionModalStep(1)}
                      style={{background:'none',border:'none',color:'#64748b',cursor:'pointer',fontSize:13,marginBottom:12,padding:0}}>← 戻る</button>
                    <div style={{fontSize:13,color:'#64748b',marginBottom:8}}>機材を選択（任意）</div>
                    {questionSelectedProducts.length>0&&(
                      <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:10}}>
                        {questionSelectedProducts.map(p=>(
                          <span key={p.id} style={{background:'#0f172a',color:'#fff',borderRadius:20,padding:'4px 10px',fontSize:12,display:'flex',alignItems:'center',gap:6}}>
                            {(p&&p.name)||''}
                            <button onClick={()=>setQuestionSelectedProducts(s=>s.filter(x=>x.id!==p.id))}
                              style={{background:'none',border:'none',color:'#94a3b8',cursor:'pointer',padding:0,fontSize:14,lineHeight:1}}>×</button>
                          </span>
                        ))}
                      </div>
                    )}
                    <input type="text" placeholder="機材名で検索..." value={questionProductSearch}
                      onChange={e=>setQuestionProductSearch(e.target.value)}
                      style={{width:'100%',padding:'8px 12px',borderRadius:6,border:'1px solid #e2e8f0',fontSize:13,marginBottom:6,boxSizing:'border-box'}}/>
                    {questionProductSearch.trim()&&(
                      <div style={{border:'1px solid #e2e8f0',borderRadius:6,maxHeight:160,overflowY:'auto',marginBottom:10}}>
                        {products.filter(p=>{
                          const n=((p&&p.name)||'').toLowerCase();
                          const b=((p&&p.brand)||'').toLowerCase();
                          const q=questionProductSearch.toLowerCase();
                          return (n.includes(q)||b.includes(q))&&!questionSelectedProducts.some(s=>s.id===p.id);
                        }).slice(0,8).map(p=>(
                          <div key={p.id} onClick={()=>{setQuestionSelectedProducts(s=>[...s,p]);setQuestionProductSearch('');}}
                            style={{padding:'8px 12px',cursor:'pointer',fontSize:13,borderBottom:'1px solid #f1f5f9'}}
                            onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'}
                            onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
                            <span style={{color:'#94a3b8',fontSize:11,marginRight:6}}>{(p&&p.brand)||''}</span>{(p&&p.name)||''}
                          </div>
                        ))}
                      </div>
                    )}
                    <button onClick={()=>setQuestionModalStep(3)}
                      style={{width:'100%',padding:'10px',borderRadius:8,border:'none',background:'#0f172a',color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',marginTop:8}}>
                      次へ →
                    </button>
                  </div>
                )}

                {/* ステップ3: 質問入力・検索 */}
                {questionModalStep===3&&(
                  <div>
                    <button onClick={()=>setQuestionModalStep(questionCategory==='product'?2:1)}
                      style={{background:'none',border:'none',color:'#64748b',cursor:'pointer',fontSize:13,marginBottom:12,padding:0}}>← 戻る</button>
                    <div style={{fontSize:13,color:'#64748b',marginBottom:8}}>質問を入力してください</div>
                    <textarea value={questionInput} onChange={e=>{setQuestionInput(e.target.value);setQuestionSearchDone(false);setQuestionSearchResults([]);}}
                      placeholder="例：外気温が低い時のバッテリーはどうすれば..."
                      rows={3}
                      style={{width:'100%',padding:'8px 12px',borderRadius:6,border:'1px solid #e2e8f0',fontSize:13,resize:'vertical',boxSizing:'border-box',marginBottom:10}}/>
                    {!questionSearchDone&&(
                      <button onClick={()=>searchKnowledge(questionInput)} disabled={!questionInput.trim()||questionSearching}
                        style={{width:'100%',padding:'10px',borderRadius:8,border:'none',
                          background:questionInput.trim()&&!questionSearching?'#0f172a':'#e2e8f0',
                          color:questionInput.trim()&&!questionSearching?'#fff':'#94a3b8',
                          fontSize:14,fontWeight:600,cursor:'pointer',marginBottom:10}}>
                        {questionSearching?'検索中...':'🔍 検索する'}
                      </button>
                    )}
                    {questionSearchDone&&questionSearchResults.length>0&&(
                      <div style={{marginBottom:12}}>
                        <div style={{fontSize:12,color:'#0369a1',fontWeight:600,marginBottom:8}}>💡 似た質問が見つかりました</div>
                        {questionSearchResults.map(k=>(
                          <div key={k.id} style={{background:'#f0f9ff',border:'1px solid #bae6fd',borderRadius:8,padding:12,marginBottom:8}}>
                            <div style={{fontWeight:600,fontSize:13,marginBottom:4}}>❓ {k.question_text}</div>
                            <div style={{fontSize:12,color:'#334155',lineHeight:1.6}}>{k.answer_text}</div>
                          </div>
                        ))}
                        <button onClick={()=>{setQuestionSearchDone(false);setQuestionSearchResults([]);}}
                          style={{width:'100%',padding:'8px',borderRadius:8,border:'1px solid #e2e8f0',background:'#fff',fontSize:13,cursor:'pointer',color:'#475569',marginTop:4}}>
                          違う・別の質問を登録する
                        </button>
                      </div>
                    )}
                    {questionSearchDone&&questionSearchResults.length===0&&(
                      <div style={{background:'#fefce8',border:'1px solid #fde68a',borderRadius:8,padding:12,marginBottom:12,fontSize:13,color:'#92400e'}}>
                        似た質問は見つかりませんでした。登録しますか？
                      </div>
                    )}
                    {questionSearchDone&&(
                      <button onClick={submitQuestion} disabled={questionSaving}
                        style={{width:'100%',padding:'11px',borderRadius:8,border:'none',background:'#0f172a',color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer'}}>
                        {questionSaving?'登録中...':'❓ 質問を登録する'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {showKnowledgeModal && (
            <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:9001,display:"flex",alignItems:"center",justifyContent:"center"}}
              onClick={e=>{if(e.target===e.currentTarget){setShowKnowledgeModal(false);setKnowledgeStep(1);setKnowledgeIsInternal(false);setKnowledgeTemplate(null);setKnowledgeSelectedProducts([]);setKnowledgeProductSearch("");setKnowledgeQuestion("");setKnowledgeAnswer("");setKnowledgeSelectedTags([]);}}}>
              <div style={{background:"#fff",borderRadius:12,padding:24,width:"90%",maxWidth:480,maxHeight:"80vh",overflowY:"auto"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <span style={{fontWeight:700,fontSize:16}}>📚 ナレッジを追加</span>
                  <button onClick={()=>{setShowKnowledgeModal(false);setKnowledgeStep(1);setKnowledgeIsInternal(false);setKnowledgeTemplate(null);setKnowledgeSelectedProducts([]);setKnowledgeProductSearch("");setKnowledgeQuestion("");setKnowledgeAnswer("");setKnowledgeSelectedTags([]);}}
                    style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:"#64748b"}}>×</button>
                </div>
                <div>
                  {/* ステップ1：テンプレ選択 */}
                  {knowledgeStep===1&&(
                    <div>
                      <div style={{fontSize:13,color:"#64748b",marginBottom:12}}>どんな質問でしたか？</div>
                      <div style={{display:"flex",flexDirection:"column",gap:8}}>
                        {KNOWLEDGE_TEMPLATES.map(t=>(
                          <button key={t.id}
                            onClick={()=>{setKnowledgeTemplate(t);setKnowledgeStep(2);}}
                            style={{
                              display:"flex",alignItems:"center",gap:12,
                              padding:"12px 16px",borderRadius:8,border:"1px solid #e2e8f0",
                              background:"#f8fafc",cursor:"pointer",textAlign:"left",
                              fontSize:14,fontWeight:500,color:"#0f172a",
                              transition:"background 0.15s"
                            }}
                            onMouseEnter={e=>e.currentTarget.style.background="#f1f5f9"}
                            onMouseLeave={e=>e.currentTarget.style.background="#f8fafc"}
                          >
                            <span style={{fontSize:20}}>{t.icon}</span>
                            <span>{t.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ステップ2：機材選択 */}
                  {knowledgeStep===2&&knowledgeTemplate&&(
                    <div>
                      <button onClick={()=>{setKnowledgeStep(1);setKnowledgeTemplate(null);setKnowledgeSelectedProducts([]);setKnowledgeProductSearch("");}}
                        style={{background:"none",border:"none",color:"#64748b",cursor:"pointer",fontSize:13,marginBottom:12,padding:0}}>
                        ← 戻る
                      </button>
                      <div style={{padding:"10px 14px",background:"#f8fafc",borderRadius:8,marginBottom:16,display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontSize:18}}>{knowledgeTemplate.icon}</span>
                        <span style={{fontWeight:600,fontSize:14}}>{knowledgeTemplate.label}</span>
                      </div>

                      {(knowledgeTemplate.id==="flow"||knowledgeTemplate.id==="free")?(
                        <div style={{color:"#64748b",fontSize:13,marginBottom:16}}>機材の選択は不要です。次へ進んでください。</div>
                      ):(
                        <div>
                          <div style={{fontSize:13,color:"#64748b",marginBottom:8}}>
                            {knowledgeTemplate.multiProduct?"関連する機材を選択（複数可）":"機材を選択"}
                          </div>

                          {knowledgeSelectedProducts.length>0&&(
                            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
                              {knowledgeSelectedProducts.map(p=>(
                                <span key={p.id} style={{background:"#0f172a",color:"#fff",borderRadius:20,padding:"4px 10px",fontSize:12,display:"flex",alignItems:"center",gap:6}}>
                                  {(p&&p.name)||""}
                                  <button onClick={()=>setKnowledgeSelectedProducts(s=>s.filter(x=>x.id!==p.id))}
                                    style={{background:"none",border:"none",color:"#94a3b8",cursor:"pointer",padding:0,fontSize:14,lineHeight:1}}>×</button>
                                </span>
                              ))}
                            </div>
                          )}

                          <input
                            type="text"
                            placeholder="機材名で検索..."
                            value={knowledgeProductSearch}
                            onChange={e=>setKnowledgeProductSearch(e.target.value)}
                            style={{width:"100%",padding:"8px 12px",borderRadius:6,border:"1px solid #e2e8f0",fontSize:13,marginBottom:6,boxSizing:"border-box"}}
                          />

                          {knowledgeProductSearch.trim()&&(
                            <div style={{border:"1px solid #e2e8f0",borderRadius:6,maxHeight:200,overflowY:"auto",marginBottom:10}}>
                              {products
                                .filter(p=>{
                                  const n=((p&&p.name)||"").toLowerCase();
                                  const b=((p&&p.brand)||"").toLowerCase();
                                  const q=knowledgeProductSearch.toLowerCase();
                                  return (n.includes(q)||b.includes(q))&&!knowledgeSelectedProducts.some(s=>s.id===p.id);
                                })
                                .slice(0,8)
                                .map(p=>(
                                  <div key={p.id}
                                    onClick={()=>{
                                      if(!knowledgeTemplate.multiProduct) setKnowledgeSelectedProducts([p]);
                                      else setKnowledgeSelectedProducts(s=>[...s,p]);
                                      setKnowledgeProductSearch("");
                                    }}
                                    style={{padding:"8px 12px",cursor:"pointer",fontSize:13,borderBottom:"1px solid #f1f5f9"}}
                                    onMouseEnter={e=>e.currentTarget.style.background="#f8fafc"}
                                    onMouseLeave={e=>e.currentTarget.style.background="#fff"}
                                  >
                                    <span style={{color:"#94a3b8",fontSize:11,marginRight:6}}>{(p&&p.brand)||""}</span>
                                    {(p&&p.name)||""}
                                  </div>
                                ))
                              }
                              {products.filter(p=>{
                                const n=((p&&p.name)||"").toLowerCase();
                                const b=((p&&p.brand)||"").toLowerCase();
                                const q=knowledgeProductSearch.toLowerCase();
                                return (n.includes(q)||b.includes(q))&&!knowledgeSelectedProducts.some(s=>s.id===p.id);
                              }).length===0&&(
                                <div style={{padding:"8px 12px",color:"#94a3b8",fontSize:13}}>該当なし</div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      <button
                        onClick={()=>{setKnowledgeQuestion(buildKnowledgeQuestion(knowledgeTemplate,knowledgeSelectedProducts));setKnowledgeStep(3);}}
                        disabled={
                          knowledgeTemplate.id!=="flow"&&
                          knowledgeTemplate.id!=="free"&&
                          knowledgeSelectedProducts.length===0
                        }
                        style={{
                          width:"100%",padding:"10px",borderRadius:8,border:"none",
                          background:knowledgeSelectedProducts.length>0||knowledgeTemplate.id==="flow"||knowledgeTemplate.id==="free"?"#0f172a":"#e2e8f0",
                          color:knowledgeSelectedProducts.length>0||knowledgeTemplate.id==="flow"||knowledgeTemplate.id==="free"?"#fff":"#94a3b8",
                          fontSize:14,fontWeight:600,cursor:knowledgeSelectedProducts.length>0||knowledgeTemplate.id==="flow"||knowledgeTemplate.id==="free"?"pointer":"not-allowed"
                        }}
                      >次へ →</button>
                    </div>
                  )}

                  {/* ステップ3：回答入力・保存 */}
                  {knowledgeStep===3&&knowledgeTemplate&&(
                    <div>
                      <button onClick={()=>setKnowledgeStep(2)}
                        style={{background:"none",border:"none",color:"#64748b",cursor:"pointer",fontSize:13,marginBottom:12,padding:0}}>
                        ← 戻る
                      </button>

                      <div style={{marginBottom:14}}>
                        <div style={{fontSize:12,color:"#64748b",marginBottom:4,fontWeight:600}}>質問</div>
                        <input
                          type="text"
                          value={knowledgeQuestion}
                          onChange={e=>setKnowledgeQuestion(e.target.value)}
                          placeholder="質問文を入力..."
                          style={{width:"100%",padding:"8px 12px",borderRadius:6,border:"1px solid #e2e8f0",fontSize:13,boxSizing:"border-box"}}
                        />
                      </div>

                      <div style={{marginBottom:14}}>
                        <div style={{fontSize:12,color:"#64748b",marginBottom:4,fontWeight:600}}>回答 <span style={{color:"#ef4444"}}>*</span></div>
                        <textarea
                          value={knowledgeAnswer}
                          onChange={e=>setKnowledgeAnswer(e.target.value)}
                          placeholder="回答を入力してください..."
                          rows={5}
                          style={{width:"100%",padding:"8px 12px",borderRadius:6,border:"1px solid #e2e8f0",fontSize:13,resize:"vertical",boxSizing:"border-box"}}
                        />
                      </div>

                      <div style={{marginBottom:18}}>
                        <div style={{fontSize:12,color:"#64748b",marginBottom:6,fontWeight:600}}>タグ（任意）</div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                          {SCENARIO_TAGS.map(tag=>{
                            const selected=knowledgeSelectedTags.includes(tag);
                            return(
                              <button key={tag}
                                onClick={()=>setKnowledgeSelectedTags(s=>selected?s.filter(t=>t!==tag):[...s,tag])}
                                style={{
                                  padding:"4px 10px",borderRadius:20,fontSize:12,cursor:"pointer",border:"1px solid",
                                  background:selected?"#0f172a":"#f8fafc",
                                  color:selected?"#fff":"#64748b",
                                  borderColor:selected?"#0f172a":"#e2e8f0"
                                }}
                              >{tag}</button>
                            );
                          })}
                        </div>
                      </div>

                      <div style={{marginBottom:12}}>
                        <div style={{fontSize:12,color:"#64748b",marginBottom:4}}>カテゴリ</div>
                        <select
                          value={knowledgeConceptId}
                          onChange={e=>setKnowledgeConceptId(e.target.value)}
                          style={{width:"100%",padding:"8px 12px",borderRadius:6,border:"1px solid #e2e8f0",fontSize:13,color:"#334155",background:"#fff"}}>
                          <option value="">未分類</option>
                          {knowledgeConcepts.filter(c=>!(c.parent_id)).map(parent=>(
                            <optgroup key={parent.id} label={parent.name}>
                              {knowledgeConcepts.filter(c=>c.parent_id===parent.id).map(child=>(
                                <option key={child.id} value={child.id}>{child.name}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                        <input type="checkbox" id="addIsInternal" checked={knowledgeIsInternal} onChange={e=>setKnowledgeIsInternal(e.target.checked)}/>
                        <label htmlFor="addIsInternal" style={{fontSize:13,color:"#475569",cursor:"pointer"}}>🔒 内部のみ（スタッフ限定・LINE Botに出さない）</label>
                      </div>
                      <button
                        onClick={saveKnowledge}
                        disabled={!knowledgeAnswer.trim()||knowledgeSaving}
                        style={{
                          width:"100%",padding:"11px",borderRadius:8,border:"none",
                          background:knowledgeAnswer.trim()&&!knowledgeSaving?"#0f172a":"#e2e8f0",
                          color:knowledgeAnswer.trim()&&!knowledgeSaving?"#fff":"#94a3b8",
                          fontSize:14,fontWeight:700,
                          cursor:knowledgeAnswer.trim()&&!knowledgeSaving?"pointer":"not-allowed"
                        }}
                      >{knowledgeSaving?"保存中...":"💾 保存する"}</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
      {presetModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#fff",borderRadius:12,padding:"28px 32px",minWidth:320,boxShadow:"0 8px 32px rgba(0,0,0,0.2)"}}>
            <div style={{fontSize:15,fontWeight:700,marginBottom:12,color:"#1e293b"}}>📦 プリセットを投入しますか？</div>
            <div style={{fontSize:13,color:"#374151",marginBottom:20}}>プリセット38社を投入します。<br/>※通常は不要な操作です。</div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={doPresetInsert} style={{flex:1,background:"#0f172a",color:"#fff",border:"none",borderRadius:7,padding:"9px 0",fontSize:13,fontWeight:700,cursor:"pointer"}}>投入する</button>
              <button onClick={()=>setPresetModal(false)} style={{flex:1,background:"#f1f5f9",color:"#374151",border:"none",borderRadius:7,padding:"9px 0",fontSize:13,cursor:"pointer"}}>キャンセル</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RecordsTab({records,customers,products,onSave,onDeleteRec,showToast,onGoToCustomer,onAfterSubmit,invoiceData,globalQ,session}){
  // 締め済みキーセット（customerId||projectName||month 完全一致）
  const lockedKeys = new Set(
    Object.entries(invoiceData||{}).filter(([,d])=>d.status==="locked").map(([k])=>k)
  );
  const isRecordLocked = r => {
    if (!r.startDate) return false;
    const c = customers.find(x=>x.id===r.customerId);
    const split = c?.splitInvoice !== false;
    const projKey = split ? (r.projectName||"") : "";
    const month = r.startDate.slice(0,7);
    return lockedKeys.has(`${r.customerId}||${projKey}||${month}`);
  };
  const [pwModal, setPwModal] = useState(null);
  const checkLock = (r, action) => {
    if (!isRecordLocked(r)) return true;
    setPwModal({month:r.startDate.slice(0,7), action, onOk: async (pw)=>{
      const ok = await verifyPw(pw);
      if(ok) return true;
      showToast("パスワードが違います",false);
      return false;
    }});
    return false;
  };
  // パスワード確認後のアクションを保持
  const [pendingAction, setPendingAction] = useState(null);
  const checkLockAsync = (r, action) => new Promise(resolve=>{
    if(!isRecordLocked(r)){resolve(true);return;}
    setPwModal({month:r.startDate.slice(0,7), action, resolve});
  });
  const emptyLine={productId:"",equipNo:"",unitPrice:"",quantity:"1",lineNote:"",subItems:[],equipmentName:"",expandRows:false};
  const emptyManualLine={productId:"",equipNo:"",unitPrice:"",quantity:"1",lineNote:"",subItems:[],equipmentName:"",expandRows:false,isManual:true,isFee:false,noBillingDiscount:false};
  const E={customerId:"",projectName:"",projectDetail:"",ecOrderNo:"",ordererName:"",ourStaff:session?.user?.user_metadata?.name?.split(/[\s　]/)[0]||"",billingType:"daily",months:"1",startDate:today(),endDate:today(),endDateOpen:false,notes:"",lines:[{...emptyLine}],noProjectName:false,issueReceipt:false,receiptDate:"",paymentMethod:"credit",receiptNote:"機材レンタル代として　[クレジット スクエア]",receiptNameCustom:false,receiptNameOverride:"",receiptHonorific:"御中",includeInsurance:false,isExtension:false,extendedFrom:"",extendedFromNo:"",adjustDays:"",adjustReason:"",monthlyProjectNames:{}};
  const [form,setForm]=useState(E);
  const [editId,setEditId]=useState(null);
  const [open,setOpen]=useState(false);
  const [fil,setFil]=useState({q:"",cid:"",month:new Date().toISOString().slice(0,7),locked:""});
  const [expandedCust,setExpandedCust]=useState({}); // {custId: bool}
  const [expandedProj,setExpandedProj]=useState({}); // {custId_projName: bool}
  const [returnModal,setReturnModal]=useState(null);
  // {id, returnDate, billingEndDate, selectedLines:{[lineIdx]:bool}}
  const [extModal,setExtModal]=useState(null); // {record, lines, selected}
  const [lineSearches,setLineSearches]=useState([""]);
  const [custSearch,setCustSearch]=useState(""); // 顧客絞り込み入力
  const [deleteModal,setDeleteModal]=useState(null);
  const [saveErrorModal,setSaveErrorModal]=useState(null);
  const [recSaving,setRecSaving]=useState(false);
  const [monthlyNameModal,setMonthlyNameModal]=useState(null);

  // 旧データ互換
  const getLines=r=>(r.lines&&r.lines.length)?r.lines:[{productId:r.productId||"",equipNo:r.equipNo||"",unitPrice:r.unitPrice,quantity:r.quantity,lineNote:r.lineNote||"",subItems:r.subItems||[],equipmentName:r.equipmentName||""}];
  // ライン単位の計上終了日（なければrecord単位にフォールバック）
  const getLineReturnDate=(ln,r)=>ln.returnDate??r.returnDate??null;
  // ライン単位の実返却日（なければrecord単位にフォールバック）
  const getLineActualReturnDate=(ln,r)=>ln.actualReturnDate??r.actualReturnDate??null;
  // レコードのステータスを導出（active:延長中 / partial:一部返却済 / closed:完了）
  const getRecordStatus=r=>{
    if(!r.isExtension) return 'closed';
    const lines=getLines(r);
    const allClosed=lines.every(ln=>getLineReturnDate(ln,r)!==null);
    const someClosed=lines.some(ln=>getLineReturnDate(ln,r)!==null);
    if(allClosed) return 'closed';
    if(someClosed) return 'partial';
    return 'active';
  };

  const cust = customers.find(c=>c.id===form.customerId);
  const days        = calcDays(form.startDate,form.endDate); // 実日数
  const editingRecord = editId ? records.find(r=>r.id===editId) : null;
  const billingDays = (form.billingType==="daily" && editingRecord && editingRecord.isExtension && !form.endDateOpen && form.endDate)
    ? chainBillingDays(editingRecord, records, form.endDate)
    : calcBillingDays(days);                  // 請求日数
  const chainContext = (() => {
    if (!editingRecord || !editingRecord.isExtension) return null;
    if (form.billingType !== "daily" || form.endDateOpen || !form.startDate || !form.endDate) return null;
    const baseNo = (editingRecord.deliveryNo || "").replace(/E\d+.*$/, "");
    if (!baseNo) return null;
    let rootStart = form.startDate;
    (records || []).forEach(x => {
      if ((x.deliveryNo || "").replace(/E\d+.*$/, "") === baseNo && x.startDate && x.startDate < rootStart) {
        rootStart = x.startDate;
      }
    });
    const cumBefore = Math.max(0, calcDays(rootStart, form.startDate) - 1);
    const cumThrough = calcDays(rootStart, form.endDate);
    const totalBillingDays = calcBillingDays(cumThrough);
    const prevBillingDays = calcBillingDays(cumBefore);
    const thisBillingDays = Math.max(0, totalBillingDays - prevBillingDays);
    return { cumThrough, totalBillingDays, prevBillingDays, thisBillingDays };
  })();
  const adjustedBillingDays = (form.billingType==="daily" && form.adjustDays && Number(form.adjustDays)>0) ? Number(form.adjustDays) : billingDays;
  const billingQty  = form.billingType==="monthly" ? (Number(form.months)||1) : adjustedBillingDays;
  // noDisc集計
  const validLines = (form.lines||[]).filter(ln=>ln.productId||ln.isManual);
  const noDiscLines = validLines.filter(ln=>!ln.isFee&&(products.find(p=>p.id===ln.productId)?.noBillingDiscount||ln.noBillingDiscount));
  const allNoDisc  = validLines.length>0 && noDiscLines.length===validLines.length;
  const someNoDisc = noDiscLines.length>0 && !allNoDisc;
  // 製品ごとのnoBillingDiscountに応じてbillingQtyを切り替え
  const lineAmounts = (form.lines||[]).map(ln=>{
    const prod = products.find(p=>p.id===ln.productId);
    const noDisc = prod?.noBillingDiscount || ln.noBillingDiscount;
    // isFee（手数料）は日数掛けなし（台数×単価のみ）
    const qty = ln.isFee ? 1
              : form.billingType==="monthly" ? (Number(form.months)||1)
              : noDisc ? days : adjustedBillingDays;
    return (Number(ln.unitPrice)||0)*(Number(ln.quantity)||0)*qty;
  });
  const totalAmount = lineAmounts.reduce((s,a)=>s+a,0);
  const insuranceAmount = form.includeInsurance ? Math.round(totalAmount * 0.1) : 0;
  const grandTotal = totalAmount + insuranceAmount;

  // expandRows=trueの時、subItemsを台数分に自動同期
  const syncSubItems=(ln)=>{
    if(!ln.expandRows) return {...ln,subItems:[]};
    const n=Math.max(1,Number(ln.quantity)||1);
    const cur=ln.subItems||[];
    const synced=Array.from({length:n},(_,i)=>cur[i]||{no:"",note:""});
    return {...ln,subItems:synced};
  };

  const setLine=(idx,patch)=>{
    setForm(f=>{
      const lines=[...f.lines];
      let updated={...lines[idx],...patch};
      if(patch.productId){
        const p=products.find(x=>x.id===patch.productId);
        const c=customers.find(x=>x.id===f.customerId);
        updated.unitPrice=String(resolvePrice(p,c));
        updated.equipmentName=(p&&p.name)||"";
        updated.noBillingDiscount=!!p?.noBillingDiscount;
      }
      // expandRows切替 or quantity変更時にsubItemsを同期
      if(patch.expandRows!==undefined||patch.quantity!==undefined){
        updated=syncSubItems(updated);
      }
      lines[idx]=updated;
      return{...f,lines};
    });
  };
  const addLine=()=>{setForm(f=>({...f,lines:[...(f.lines||[]),{...emptyLine}]}));setLineSearches(s=>[...s,""]);}; 
  const addManualLine=()=>{setForm(f=>({...f,lines:[...(f.lines||[]),{...emptyManualLine}]}));setLineSearches(s=>[...s,""]);};
  const removeLine=idx=>{if((form.lines||[]).length<=1)return;setForm(f=>({...f,lines:f.lines.filter((_,i)=>i!==idx)}));setLineSearches(s=>s.filter((_,i)=>i!==idx));};
  const moveLine=(idx,dir)=>{
    setForm(f=>{
      const lines=[...f.lines];
      const target=idx+dir;
      if(target<0||target>=lines.length) return f;
      [lines[idx],lines[target]]=[lines[target],lines[idx]];
      return {...f,lines};
    });
    setLineSearches(s=>{
      const n=[...s];
      const target=idx+dir;
      if(target<0||target>=n.length) return s;
      [n[idx],n[target]]=[n[target],n[idx]];
      return n;
    });
  };
  const setLineProdQ=(idx,v)=>setLineSearches(s=>{const n=[...s];n[idx]=v;return n;});
  const addSub=(li)=>setLine(li,{subItems:[...(form.lines[li].subItems||[]),{no:"",note:""}]});
  const removeSub=(li,si)=>setLine(li,{subItems:form.lines[li].subItems.filter((_,j)=>j!==si)});
  const setSub=(li,si,patch)=>{const subs=[...(form.lines[li].subItems||[])];subs[si]={...subs[si],...patch};setLine(li,{subItems:subs});};
  const APPLE_NOTICE="⚠︎注意⚠︎\niPhoneまたはiPadをご返却の際には、必ずサインアウトしてご返却ください。";
  React.useEffect(()=>{
    const validLines=(form.lines||[]).filter(ln=>ln.productId||ln.isManual);
    const hasApple=validLines.some(ln=>/iPhone|iPad/i.test(ln.equipmentName||(products.find(p=>p.id===ln.productId)?.fullName||"")));
    setForm(f=>{
      const base=(f.notes||"").replace(/\n*⚠︎注意⚠︎\niPhoneまたはiPadをご返却の際には、必ずサインアウトしてご返却ください。/g,"").trimEnd();
      const next=hasApple?(base?(base+"\n\n"+APPLE_NOTICE):APPLE_NOTICE):base;
      if(next===(f.notes||"")) return f;
      return {...f,notes:next};
    });
  },[form.lines.map(ln=>ln.productId).join(","),form.lines.map(ln=>ln.equipmentName).join(",")]);

  React.useEffect(()=>{
    setForm(f=>{
      const reason=(f.adjustReason||"").trim();
      const base=(f.notes||"").replace(/\n*【日数調整】.*$/s,"").trimEnd();
      const next=reason?(base?(base+"\n\n【日数調整】"+reason):"【日数調整】"+reason):base;
      if(next===(f.notes||"")) return f;
      return {...f,notes:next};
    });
  },[form.adjustReason]);

  const submit=async()=>{
    if(recSaving)return;
    if(!form.customerId){showToast("顧客は必須です",false);return;}
    if(form.billingType==="daily"&&form.adjustDays!==""&&form.adjustDays!==undefined){
      if(!Number(form.adjustDays)||Number(form.adjustDays)<1){showToast("調整日数を1以上で入力してください",false);return;}
      if(!form.adjustReason.trim()){showToast("調整理由を入力してください",false);return;}
    }
    if(form.issueReceipt){
      if(!form.receiptDate){showToast("領収日を入力してください",false);return;}
      if(!form.paymentMethod){showToast("支払方法を選択してください",false);return;}
    }
    const validLines=(form.lines||[]).filter(ln=>{
      if(ln.isManual) return !!ln.equipmentName;
      return !!ln.productId;
    });
    if(!validLines.length){showToast("製品を1つ以上追加してください",false);return;}
    const lines=validLines.map(ln=>{
      const p=products.find(x=>x.id===ln.productId);
      const noDisc=p?.noBillingDiscount||ln.noBillingDiscount;
      return{...ln,unitPrice:Number(ln.unitPrice),quantity:Number(ln.quantity)||1,
        equipmentName:ln.isManual?ln.equipmentName:((p&&p.name)||ln.equipmentName||""),
        noBillingDiscount:ln.isManual?!!ln.noBillingDiscount:!!noDisc,
        isFee:!!ln.isFee,isManual:!!ln.isManual};
    });
    const rec={customerId:form.customerId,projectName:form.projectName,noProjectName:!!form.noProjectName,projectDetail:form.projectDetail,ecOrderNo:form.ecOrderNo||"",ordererName:form.ordererName,ourStaff:form.ourStaff,
      billingType:form.billingType,months:form.billingType==="monthly"?(Number(form.months)||1):0,
      days:form.billingType==="monthly"?0:days,billingDays:form.billingType==="monthly"?0:adjustedBillingDays,startDate:form.startDate,endDate:form.endDateOpen?"":form.endDate,endDateOpen:form.billingType==="monthly"&&!!form.endDateOpen,notes:(()=>{const NOTICE="⚠︎注意⚠︎\niPhoneまたはiPadをご返却の際には、必ずサインアウトしてご返却ください。";const hasApple=lines.some(ln=>/iPhone|iPad/i.test(ln.equipmentName||""));const base=(form.notes||"").replace(/\n*⚠︎注意⚠︎\niPhoneまたはiPadをご返却の際には、必ずサインアウトしてご返却ください。/g,"").trimEnd();return hasApple?(base?(base+"\n\n"+NOTICE):NOTICE):base;})(),adjustDays:form.adjustDays||"",adjustReason:form.adjustDays&&form.adjustReason?form.adjustReason:"",monthlyProjectNames:form.billingType==="monthly"&&Object.keys(form.monthlyProjectNames||{}).length>0?form.monthlyProjectNames:undefined,
      issueReceipt:!!form.issueReceipt,receiptDate:form.issueReceipt?(form.receiptDate||""):"",paymentMethod:form.issueReceipt?(form.paymentMethod||"credit"):"",receiptNote:form.issueReceipt?(form.receiptNote||""):"",receiptNameCustom:form.issueReceipt?!!form.receiptNameCustom:false,receiptNameOverride:form.issueReceipt?(form.receiptNameOverride||""):"",receiptHonorific:form.issueReceipt?(form.receiptHonorific||"御中"):"",
      includeInsurance:!!form.includeInsurance,
      lines,amount:totalAmount,insuranceAmount,
      equipmentName:lines.map(l=>l.equipmentName).join(", "),unitPrice:lines[0]?.unitPrice||0,quantity:lines.reduce((s,l)=>s+(Number(l.quantity)||0),0),
      productId:lines[0]?.productId||"",
      id:editId||uid(),updatedAt:Date.now(),createdAt:editId?records.find(r=>r.id===editId)?.createdAt:Date.now()};
    if(editId && isRecordLocked(rec)){
      const orig=records.find(r=>r.id===editId);
      if(orig && ((orig.amount||0)!==(rec.amount||0)||(orig.insuranceAmount||0)!==(rec.insuranceAmount||0))){
        showToast("この案件はロック済み請求書に含まれます。金額を変える保存はできません。先に請求書のロックを解除してください。",false);
        return;
      }
    }
    if(!editId && !rec.deliveryNo) {
      const no = await nextDeliveryNo();
      if(no==='ERR'){showToast("伝票番号の採番に失敗しました。もう一度登録ボタンを押してください。",false);return;}
      rec.deliveryNo = no;
    } else if(editId) {
      const orig = records.find(r=>r.id===editId);
      if(orig?.deliveryNo) {
        const base = orig.deliveryNo.replace(/R(\d+)$/, '');
        const m = orig.deliveryNo.match(/R(\d+)$/);
        const n = m ? parseInt(m[1])+1 : 1;
        rec.deliveryNo = base + 'R' + n;
      }
    }
    const origForExt = records.find(r=>r.id===editId);
    if(origForExt){
      if(origForExt.isExtension) rec.isExtension = true;
      if(origForExt.extendedFrom) rec.extendedFrom = origForExt.extendedFrom;
      if(origForExt.extendedFromNo) rec.extendedFromNo = origForExt.extendedFromNo;
      if(origForExt.isProvisionalClose) rec.isProvisionalClose = true;
    }
    const custName=customers.find(x=>x.id===form.customerId)?.name||"";
    setRecSaving(true);
    try {
      await onSave(editId?records.map(r=>r.id===editId?rec:r):[rec,...records],{action:editId?"更新":"作成",name:form.projectName||custName,detail:custName},[rec]);
    } catch(e) {
      console.error("save error",e);
      setSaveErrorModal("保存に失敗しました。この伝票はまだ保存されていません。\n通信とログイン状態を確認して、もう一度「登録」を押してください。");
      setRecSaving(false);
      return;
    }
    setRecSaving(false);
    const wasNew=!editId;
    showToast(editId?"更新しました":"登録しました");setForm(E);setEditId(null);setOpen(false);setLineSearches([""]);
    if(wasNew&&rec){
      const c=customers.find(x=>x.id===rec.customerId);
      const lns=(rec.lines&&rec.lines.length)?rec.lines:[{equipmentName:rec.equipmentName||"",unitPrice:rec.unitPrice,quantity:rec.quantity,subItems:rec.subItems||[]}];
      const equipName=lns.map(ln=>ln.equipmentName||"").filter(Boolean).join("、");
      const rWithEquip={...rec,equipmentName:rec.equipmentName||equipName};
      const g={customerId:rec.customerId,customer:c||null,customerName:(c&&c.name)||"不明",projectName:rec.projectName||"",month:rec.startDate?rec.startDate.slice(0,7):"",items:[rWithEquip],split:true,consolidate:false};
      downloadPrintHTML(rec.issueReceipt?"delivery-receipt":"delivery",g);
      setTimeout(()=>{setOpen(true);},100);
    }else{
      if(onAfterSubmit) onAfterSubmit(rec);
    }
  };

  const mnths=[...new Set(records.map(r=>r.startDate?.slice(0,7)))].filter(Boolean).sort().reverse();
  const filtered=records.filter(r=>{
    const q=fil.q.toLowerCase(),c=customers.find(x=>x.id===r.customerId);
    const rLns2=getLines(r);
    const gq=(globalQ||"").toLowerCase();
    const matchGQ=!gq||c?.name?.toLowerCase().includes(gq)||r.projectName?.toLowerCase().includes(gq)
      ||rLns2.some(ln=>(ln.equipmentName||"").toLowerCase().includes(gq));
    const matchQ=!q||c?.name?.toLowerCase().includes(q)||r.projectName?.toLowerCase().includes(q)
      ||rLns2.some(ln=>(ln.equipmentName||"").toLowerCase().includes(q))
      ||(r.deliveryNo||"").toLowerCase().includes(q);
    const matchLocked=!fil.locked||(fil.locked==="locked"?isRecordLocked(r):!isRecordLocked(r));
    return matchQ&&matchGQ&&(!fil.cid||r.customerId===fil.cid)&&(!fil.month||r.startDate?.startsWith(fil.month))&&matchLocked;
  });

  return(
    <div>

      {open&&(
        <div style={{...S.card,padding:24,marginBottom:18}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
            <h3 style={{margin:0,fontSize:16,fontWeight:700}}>{editId?"案件を編集":"新規案件登録"}</h3>
            <button onClick={()=>{setOpen(false);setEditId(null);setForm(E);setLineSearches([""]);}} style={{background:"none",border:"none",cursor:"pointer"}}><Ico d={I.x} size={18} color="#94a3b8"/></button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px 20px"}}>
            <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>顧客 *</label>
              <SearchableSelect
                value={form.customerId}
                onChange={v=>setForm(f=>({...f,customerId:v,projectName:"",projectDetail:""}))}
                options={customers.map(c=>{const k=Number(c.discountRate)||0;return {value:c.id,label:c.name+(k>0&&k<10?` (${k}掛)`:"")};})} 
                placeholder="顧客を選択..."
              />
            </div>
            <div style={{gridColumn:"1/-1"}}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:6}}>
                <label style={{...S.lbl,margin:0}}>案件名（請求書の分類）</label>
                <label style={{display:"flex",alignItems:"center",gap:4,fontSize:11,cursor:"pointer",userSelect:"none",color:form.noProjectName?"#ef4444":"#64748b"}}>
                  <input
                    type="checkbox"
                    checked={!!form.noProjectName}
                    onChange={e=>setForm(f=>({...f,noProjectName:e.target.checked,projectName:""}))}
                    style={{cursor:"pointer"}}
                  />
                  案件名なし
                </label>
                {form.customerId&&(
                  <button
                    type="button"
                    onClick={()=>onGoToCustomer&&onGoToCustomer(form.customerId)}
                    style={{...S.ib("#0369a1"),fontSize:11,padding:"3px 8px"}}
                  >
                    ＋ 顧客管理で案件名を追加
                  </button>
                )}
              </div>
              {!form.noProjectName&&(()=>{
                const masterProjects = customers.find(c=>c.id===form.customerId)?.projects||[];
                if(!form.customerId){
                  return <div style={{...S.inp,color:"#94a3b8",display:"flex",alignItems:"center"}}>先に顧客を選択してください</div>;
                }
                if(masterProjects.length===0){
                  return <div style={{...S.inp,color:"#f59e0b",display:"flex",alignItems:"center",fontSize:12}}>⚠ 上の「顧客管理で案件名を追加」から登録してください</div>;
                }
                return(
                  <SearchableSelect
                    value={form.projectName}
                    onChange={v=>setForm(f=>({...f,projectName:v}))}
                    options={masterProjects.map(p=>({value:p,label:p}))}
                    placeholder="案件名を選択..."
                  />
                );
              })()}
              {form.noProjectName&&(
                <div style={{...S.inp,color:"#94a3b8",display:"flex",alignItems:"center",fontSize:12,background:"#f8fafc"}}>案件名なしで登録します</div>
              )}
            </div>
            <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>案件詳細（案件名の隣に表示）</label><input className="ph-faint" value={form.projectDetail} onChange={e=>setForm(f=>({...f,projectDetail:e.target.value}))} style={S.inp} placeholder="例: 第1話 スタジオ収録"/></div>
            <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>ECサイト注文番号　<span style={{fontSize:10,fontWeight:400,color:"#94a3b8"}}>（ECサイト経由の場合のみ）</span></label><input value={form.ecOrderNo||""} onChange={e=>setForm(f=>({...f,ecOrderNo:e.target.value}))} style={S.inp} placeholder="例: 0000-0000"/></div>
            <div><label style={S.lbl}>ご発注者名（先方担当）</label><input value={form.ordererName} onChange={e=>setForm(f=>({...f,ordererName:e.target.value}))} style={S.inp}/></div>
            <div><label style={S.lbl}>弊社担当（自社）</label><input value={form.ourStaff} onChange={e=>setForm(f=>({...f,ourStaff:e.target.value}))} style={S.inp}/></div>
            <div><label style={S.lbl}>開始日</label><input type="date" value={form.startDate} onChange={e=>setForm(f=>({...f,startDate:e.target.value}))} style={S.inp}/></div>
            <div>
              <label style={S.lbl}>終了日</label>
              {form.billingType==="monthly"&&(
                <label style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,fontSize:12,cursor:"pointer",userSelect:"none",color:"#7c3aed"}}>
                  <input type="checkbox" checked={!!form.endDateOpen} onChange={e=>setForm(f=>({...f,endDateOpen:e.target.checked}))} style={{cursor:"pointer"}}/>
                  終了未定（毎月自動計上）
                </label>
              )}
              {!form.endDateOpen&&<input type="date" value={form.endDate} onChange={e=>setForm(f=>({...f,endDate:e.target.value}))} style={S.inp}/>}
              {form.endDateOpen&&<div style={{...S.inp,background:"#faf5ff",color:"#7c3aed",fontSize:12,display:"flex",alignItems:"center"}}>終了未定</div>}
            </div>
            <div><label style={S.lbl}>課金区分</label>
              <div style={{display:"flex",gap:2,background:"#e2e8f0",borderRadius:6,padding:2}}>{[{k:"daily",l:"日極"},{k:"monthly",l:"月極"}].map(t=>(<button key={t.k} type="button" onClick={()=>setForm(f=>({...f,billingType:t.k}))} style={{flex:1,background:form.billingType===t.k?"#fff":"transparent",border:"none",borderRadius:5,padding:"6px 0",fontSize:12,fontWeight:form.billingType===t.k?700:500,color:form.billingType===t.k?(t.k==="daily"?"#2563eb":"#9333ea"):"#94a3b8",cursor:"pointer",boxShadow:form.billingType===t.k?"0 1px 3px rgba(0,0,0,0.1)":"none"}}>{t.l}</button>))}</div></div>
            {form.billingType==="monthly"&&<div><label style={S.lbl}>月数</label><input type="number" min={1} value={form.months} onChange={e=>setForm(f=>({...f,months:e.target.value}))} style={S.inp}/></div>}
          </div>
          {/* 月別案件名（月極のみ） */}
          {form.billingType==="monthly"&&form.startDate&&(
            <div style={{marginTop:14,background:"#faf5ff",border:"1px solid #e9d5ff",borderRadius:9,padding:"12px 18px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <span style={{fontSize:12,fontWeight:700,color:"#7c3aed"}}>月別案件名（任意）</span>
                <span style={{fontSize:10,color:"#94a3b8"}}>空欄＝上の案件名をそのまま使用</span>
              </div>
              {(()=>{
                const months_ = Number(form.months)||1;
                const startD = new Date(form.startDate+'T00:00:00');
                const pad = n=>String(n).padStart(2,"0");
                const monthList = [];
                for(let n=0;n<months_&&n<=120;n++){
                  const d=new Date(startD);d.setMonth(d.getMonth()+n);
                  monthList.push(`${d.getFullYear()}-${pad(d.getMonth()+1)}`);
                }
                if(form.endDateOpen){
                  const today_=new Date();
                  const limitMonth=today_.getFullYear()*12+today_.getMonth()+2;
                  const startMonth=startD.getFullYear()*12+startD.getMonth();
                  monthList.length=0;
                  for(let m=startMonth;m<=limitMonth;m++){
                    const y=Math.floor(m/12);const mo=m%12;
                    monthList.push(`${y}-${pad(mo+1)}`);
                  }
                }
                const mpn=form.monthlyProjectNames||{};
                return monthList.map(m=>(
                  <div key={m} style={{display:"flex",gap:8,alignItems:"center",marginBottom:4}}>
                    <span style={{fontSize:11,color:"#7c3aed",fontWeight:600,minWidth:64}}>{m}</span>
                    <input value={mpn[m]||""} placeholder={form.projectName||"（既定）"}
                      onChange={e=>{const v=e.target.value;setForm(f=>{const next={...(f.monthlyProjectNames||{})};if(v)next[m]=v;else delete next[m];return{...f,monthlyProjectNames:next};});}}
                      style={{...S.inp,flex:1,fontSize:11,padding:"3px 8px"}}/>
                  </div>
                ));
              })()}
            </div>
          )}
          {/* 機材リスト */}
          <div style={{marginTop:18}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{fontSize:14,fontWeight:700}}>機材リスト（{form.lines?.length||0}品目）</div>
              <div style={{display:"flex",gap:6}}>
                <button type="button" onClick={addLine} style={S.btn("#0f172a",true)}><Ico d={I.plus} size={13}/>機材を追加</button>
                <button type="button" onClick={addManualLine} style={S.btn("#0f172a",true)}><Ico d={I.plus} size={13}/>手入力で追加</button>
              </div>
            </div>
            {(form.lines||[]).map((ln,li)=>{
              const lProd=products.find(p=>p.id===ln.productId);
              const lq=lineSearches[li]||"";
              const lfp=lq.length>=1?products.filter(p=>p.fullName.toLowerCase().includes(lq.toLowerCase())):[];
              const qty=Number(ln.quantity)||1;
              const isManual=!!ln.isManual;
              return(
                <div key={li} style={{background:isManual?"#f0f9ff":"#f8fafc",border:`1px solid ${isManual?"#bae6fd":"#e2e8f0"}`,borderRadius:9,padding:"12px 14px",marginBottom:8}}>
                  {/* ヘッダー */}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <span style={{fontSize:12,fontWeight:700,color:isManual?"#0369a1":"#475569"}}>
                      #{li+1}{isManual?" ✏️手入力":""}{ln.equipmentName?` — ${ln.equipmentName}`:""}
                    </span>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      {isManual&&(
                        <>
                          <label style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"#92400e",cursor:"pointer",userSelect:"none",background:"#fff7ed",borderRadius:4,padding:"2px 7px",border:"1px solid #fed7aa"}}>
                            <input type="checkbox" checked={!!ln.isFee} onChange={e=>setLine(li,{isFee:e.target.checked,noBillingDiscount:e.target.checked?false:ln.noBillingDiscount})} style={{cursor:"pointer"}}/>
                            手数料及び販売（日数なし）
                          </label>
                          {!ln.isFee&&(
                            <label style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"#475569",cursor:"pointer",userSelect:"none"}}>
                              <input type="checkbox" checked={!!ln.noBillingDiscount} onChange={e=>setLine(li,{noBillingDiscount:e.target.checked})} style={{cursor:"pointer"}}/>
                              日数値引きなし
                            </label>
                          )}
                        </>
                      )}
                      {!isManual&&qty>=2&&(
                        <label style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:"#475569",cursor:"pointer",userSelect:"none"}}>
                          <input type="checkbox" checked={!!ln.expandRows} onChange={e=>setLine(li,{expandRows:e.target.checked})} style={{cursor:"pointer"}}/>
                          行を増やす（各台個別入力）
                        </label>
                      )}
                      <div style={{display:"flex",gap:2}}>
                        <button type="button" onClick={()=>moveLine(li,-1)} disabled={li===0}
                          style={{background:"none",border:"1px solid #e2e8f0",borderRadius:4,padding:"1px 5px",cursor:li===0?"not-allowed":"pointer",opacity:li===0?0.3:1,fontSize:10}}>↑</button>
                        <button type="button" onClick={()=>moveLine(li,1)} disabled={li===(form.lines||[]).length-1}
                          style={{background:"none",border:"1px solid #e2e8f0",borderRadius:4,padding:"1px 5px",cursor:li===(form.lines||[]).length-1?"not-allowed":"pointer",opacity:li===(form.lines||[]).length-1?0.3:1,fontSize:10}}>↓</button>
                      </div>
                      {form.lines.length>1&&<button type="button" onClick={()=>removeLine(li)} style={{background:"none",border:"none",cursor:"pointer"}}><Ico d={I.trash} size={14} color="#ef4444"/></button>}
                    </div>
                  </div>

                  {/* 製品・単価・台数 */}
                  <div style={{display:"grid",gridTemplateColumns:"2fr 90px 60px",gap:6,alignItems:"end",marginBottom:6}}>
                    <div>
                      <label style={{fontSize:10,color:"#64748b",fontWeight:600}}>{isManual?"製品名（手入力） *":"製品 *"}</label>
                      {isManual
                        ? <input value={ln.equipmentName} onChange={e=>setLine(li,{equipmentName:e.target.value})} placeholder="例: Sony FX3（他社借り）" style={{...S.inp,fontSize:11,padding:"6px 8px"}}/>
                        : <>
                            <div style={{position:"relative"}}><div style={{position:"absolute",left:7,top:"50%",transform:"translateY(-50%)",opacity:.4}}><Ico d={I.search} size={11}/></div>
                              <input value={lq} onChange={e=>setLineProdQ(li,e.target.value)} placeholder="検索..." style={{...S.inp,paddingLeft:24,fontSize:11,padding:"6px 8px 6px 24px"}}/></div>
                            {lq.length>=1&&<select value={ln.productId} onChange={e=>{setLine(li,{productId:e.target.value});setLineProdQ(li,"");}} style={{...S.inp,fontSize:11,marginTop:2}} size={Math.min(4,lfp.length+1)}><option value="">{lfp.length}件</option>{lfp.map(p=><option key={p.id} value={p.id}>{p.fullName} {fmt(p.priceEx)}</option>)}</select>}
                            {ln.productId&&!lq&&<div style={{fontSize:10,color:"#16a34a",marginTop:2}}>{lProd?.fullName||ln.equipmentName}</div>}
                          </>
                      }
                    </div>
                    <div>
                      <label style={{fontSize:10,color:"#64748b",fontWeight:600}}>
                        単価{ln.isFee?"（固定）":form.billingType==="monthly"?"/月":"/日"}
                      </label>
                      <input type="number" value={ln.unitPrice} onChange={e=>setLine(li,{unitPrice:e.target.value})} style={{...S.inp,fontSize:11,padding:"6px 8px"}}/>
                    </div>
                    <div><label style={{fontSize:10,color:"#64748b",fontWeight:600}}>台数</label><input type="text" inputMode="numeric" pattern="[0-9]*" value={ln.quantity} onChange={e=>setLine(li,{quantity:e.target.value})} style={{...S.inp,fontSize:11,padding:"6px 8px"}}/></div>
                  </div>

                  {/* 機材No.と行備考 */}
                  {(!ln.expandRows||isManual)&&(
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                      <div><label style={{fontSize:10,color:"#64748b",fontWeight:600}}>機材No.</label><input value={ln.equipNo} onChange={e=>setLine(li,{equipNo:e.target.value})} style={{...S.inp,fontSize:11,padding:"6px 8px"}}/></div>
                      <div><label style={{fontSize:10,color:"#64748b",fontWeight:600}}>行備考</label><input value={ln.lineNote||""} onChange={e=>setLine(li,{lineNote:e.target.value.slice(0,16)})} maxLength={16} style={{...S.inp,fontSize:11,padding:"6px 8px"}} placeholder="バッテリー数など"/><div style={{fontSize:9,color:"#94a3b8",marginTop:2}}>※16文字以内</div></div>
                    </div>
                  )}

                  {/* 行を増やす場合（通常ラインのみ） */}
                  {!isManual&&ln.expandRows&&qty>=2&&(
                    <div style={{marginTop:4}}>
                      <div style={{fontSize:10,color:"#0369a1",fontWeight:600,marginBottom:4}}>各台の情報（{qty}台分）</div>
                      {(ln.subItems||[]).slice(0,qty).map((si,si2)=>(
                        <div key={si2} style={{display:"grid",gridTemplateColumns:"22px 1fr 1fr",gap:4,marginBottom:4,alignItems:"center",background:si2===0?"#eff6ff":"#fff",border:"1px solid #e2e8f0",borderRadius:6,padding:"5px 8px"}}>
                          <span style={{fontSize:10,fontWeight:700,color:si2===0?"#2563eb":"#94a3b8",textAlign:"center"}}>{si2===0?qty+"台":"―"}</span>
                          <input value={si.no} onChange={e=>{const v=e.target.value;const w=v.split("").reduce((s,c)=>s+(c.charCodeAt(0)>255?2:1),0);if(w<=4)setSub(li,si2,{no:v});}} style={{...S.inp,fontSize:11,padding:"4px 6px"}} placeholder={`機材No.（${si2+1}台目）`} maxLength={4}/>
                          <input value={si.note||""} onChange={e=>setSub(li,si2,{note:e.target.value})} style={{...S.inp,fontSize:11,padding:"4px 6px"}} placeholder="行備考（バッテリー数など）"/>
                        </div>
                      ))}
                    </div>
                  )}

                  {lineAmounts[li]>0&&<div style={{fontSize:11,color:"#16a34a",fontWeight:600,marginTop:6}}>小計: {fmt(lineAmounts[li])}{ln.isFee&&<span style={{color:"#92400e",marginLeft:6,fontSize:10}}>（日数掛けなし）</span>}{form.billingType==="daily"&&!ln.isFee&&(lProd?.noBillingDiscount||ln.noBillingDiscount)&&<span style={{color:"#dc2626",marginLeft:6,fontSize:10}}>（日数値引き非適用）</span>}</div>}
                </div>
              );
            })}
          </div>
          {/* 合計 */}
          <div style={{marginTop:14,background:form.billingType==="monthly"?"#faf5ff":"#eff6ff",borderRadius:9,padding:"12px 18px",display:"flex",gap:24,flexWrap:"wrap",fontSize:13,alignItems:"center"}}>
            {form.billingType==="monthly"
              ?<span><span style={{color:"#64748b"}}>月数: </span><strong style={{color:"#9333ea",fontSize:17}}>{(form.months||1)}ヶ月</strong></span>
              :<span style={{display:"flex",alignItems:"baseline",gap:6,flexWrap:"wrap"}}>
                {allNoDisc
                  ?<><span style={{color:"#64748b"}}>実日数:</span><strong style={{color:"#2563eb",fontSize:17}}>{days}日</strong><span style={{fontSize:11,color:"#dc2626",marginLeft:2}}>日数値引き非適用</span></>
                  :<><span style={{color:"#64748b"}}>実日数:</span>
                    <strong style={{color:"#94a3b8",fontSize:15}}>{days}日</strong>
                    <span style={{color:"#94a3b8",fontSize:12}}>→</span>
                    <span style={{color:"#64748b"}}>請求日数:</span>
                    <strong style={{color:"#2563eb",fontSize:17}}>{adjustedBillingDays}日</strong>
                    {days!==billingDays&&<span style={{fontSize:10,color:"#f59e0b",background:"#fffbeb",border:"1px solid #fde68a",borderRadius:4,padding:"1px 6px"}}>割引適用</span>}
                    {someNoDisc&&<span style={{fontSize:10,color:"#dc2626",marginLeft:2}}>※一部製品は日数値引き非適用</span>}
                  </>
                }
              </span>
            }
            <span><span style={{color:"#64748b"}}>機材合計(税抜): </span><strong style={{color:"#16a34a",fontSize:17}}>{fmt(totalAmount)}</strong></span>
            {form.includeInsurance&&<span style={{fontSize:12,color:"#b45309"}}>補償料: <strong>{fmt(insuranceAmount)}</strong></span>}
            <span><span style={{color:"#64748b"}}>合計(税込): </span><strong style={{color:"#9333ea",fontSize:17}}>{fmt(taxIn(grandTotal))}</strong></span>
            <span style={{fontSize:11,color:"#94a3b8"}}>{form.lines?.length||0}品目</span>
          </div>
          {form.billingType==="daily"&&(
            <div style={{marginBottom:10,background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:8,padding:"8px 14px"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:form.adjustDays!==""&&form.adjustDays!==undefined?10:0}}>
                <span style={{fontSize:12,fontWeight:700,color:"#0369a1"}}>📅 日数調整</span>
                <span style={{fontSize:11,color:"#64748b"}}>自動計算：{billingDays}日</span>
                {chainContext && (
                  <div style={{marginTop:4,fontSize:11,color:"#0369a1",background:"#e0f2fe",borderRadius:4,padding:"4px 8px",lineHeight:1.6}}>
                    🔗 元案件含む累計 <strong>{chainContext.cumThrough}</strong>日 → 合計 <strong>{chainContext.totalBillingDays}</strong>日請求（元案件 {chainContext.prevBillingDays}日請求済 → 今回 <strong>{chainContext.thisBillingDays}</strong>日）
                  </div>
                )}
                {(form.adjustDays===""||form.adjustDays===undefined)&&(
                  <button type="button" onClick={()=>setForm(f=>({...f,adjustDays:String(billingDays),adjustReason:""}))}
                    style={{...S.btn("#0369a1",true),fontSize:11,padding:"3px 10px",marginLeft:"auto"}}>日数を調整する</button>
                )}
                {form.adjustDays!==""&&form.adjustDays!==undefined&&(
                  <button type="button" onClick={()=>setForm(f=>({...f,adjustDays:"",adjustReason:""}))}
                    style={{...S.btn("#94a3b8",true),fontSize:11,padding:"3px 10px",marginLeft:"auto"}}>調整をキャンセル</button>
                )}
              </div>
              {form.adjustDays!==""&&form.adjustDays!==undefined&&(
                <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:"10px 16px"}}>
                  <div>
                    <label style={S.lbl}>調整後の日数 *</label>
                    <input type="number" min={0.5} max={billingDays} step={0.5} value={form.adjustDays}
                      onChange={e=>{const v=Number(e.target.value);if(v>billingDays||v<0.5)return;setForm(f=>({...f,adjustDays:e.target.value}));}}
                      style={S.inp} placeholder={`0.5〜${billingDays}日`}/>
                    <div style={{fontSize:10,color:"#64748b",marginTop:2}}>{billingDays}日以下・0.5刻みで入力</div>
                  </div>
                  <div>
                    <label style={S.lbl}>調整理由 *（納品書控に表示）</label>
                    <input type="text" value={form.adjustReason} onChange={e=>setForm(f=>({...f,adjustReason:e.target.value}))}
                      style={S.inp} placeholder="例：撮影短縮のため1日減"/>
                  </div>
                </div>
              )}
            </div>
          )}
          {/* 補償料チェック */}
          <div style={{marginTop:10,display:"flex",alignItems:"center",gap:10,background:"#fff7ed",border:"1px solid #fed7aa",borderRadius:8,padding:"10px 14px"}}>
            <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:12,fontWeight:700,color:"#92400e",userSelect:"none"}}>
              <input type="checkbox" checked={!!form.includeInsurance} onChange={e=>setForm(f=>({...f,includeInsurance:e.target.checked}))} style={{cursor:"pointer"}}/>
              補償料を計上する（機材合計の10%）
            </label>
            {form.includeInsurance&&<span style={{fontSize:12,color:"#92400e"}}>= {fmt(insuranceAmount)}（税抜）</span>}
          </div>
          {/* 領収証発行（補償料の下） */}
          <div style={{marginTop:10,background:"#fefce8",border:"1px solid #fde047",borderRadius:8,padding:"10px 14px"}}>
            <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:12,fontWeight:700,color:"#713f12",userSelect:"none"}}>
              <input type="checkbox" checked={!!form.issueReceipt} onChange={e=>setForm(f=>({...f,issueReceipt:e.target.checked}))} style={{cursor:"pointer"}}/>
              領収証を発行する（納品書と同時に出力）
            </label>
            {form.issueReceipt&&(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 16px",marginTop:10}}>
                <div>
                  <label style={S.lbl}>領収日</label>
                  <input type="date" value={form.receiptDate} onChange={e=>setForm(f=>({...f,receiptDate:e.target.value}))} style={S.inp}/>
                </div>
                <div>
                  <label style={S.lbl}>支払方法</label>
                  <div style={{display:"flex",gap:2,background:"#e2e8f0",borderRadius:6,padding:2}}>
                    {[{k:"ec",l:"💳 ECクレジット"},{k:"square",l:"🟦 スクエア"},{k:"cash",l:"💴 現金"}].map(t=>(
                      <button key={t.k} type="button" onClick={()=>setForm(f=>({...f,paymentMethod:t.k,receiptNote:t.k==="ec"?"機材レンタル代として　[ECクレジット]":t.k==="square"?"機材レンタル代として　[スクエア クレジット]":"機材レンタル代として　[現金]"}))} style={{flex:1,background:form.paymentMethod===t.k?"#fff":"transparent",border:"none",borderRadius:5,padding:"6px 0",fontSize:12,fontWeight:form.paymentMethod===t.k?700:500,color:form.paymentMethod===t.k?"#713f12":"#94a3b8",cursor:"pointer",boxShadow:form.paymentMethod===t.k?"0 1px 3px rgba(0,0,0,0.1)":"none"}}>{t.l}</button>
                    ))}
                  </div>
                </div>
                <div style={{gridColumn:"1/-1"}}>
                  <label style={S.lbl}>但し書き</label>
                  <input type="text" value={form.receiptNote} onChange={e=>setForm(f=>({...f,receiptNote:e.target.value}))} style={S.inp} placeholder="例：機材レンタル代として　[クレジット スクエア]"/>
                </div>
                <div style={{gridColumn:"1/-1"}}>
                  <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:12,userSelect:"none"}}>
                    <input type="checkbox" checked={!!form.receiptNameCustom} onChange={e=>setForm(f=>({...f,receiptNameCustom:e.target.checked}))} style={{cursor:"pointer"}}/>
                    宛名を変更する
                  </label>
                  {form.receiptNameCustom&&(
                    <div style={{display:"flex",gap:8,alignItems:"center",marginTop:6}}>
                      <input type="text" value={form.receiptNameOverride} onChange={e=>setForm(f=>({...f,receiptNameOverride:e.target.value}))} style={{...S.inp,flex:1}} placeholder="宛名"/>
                      <div style={{display:"flex",gap:2,background:"#e2e8f0",borderRadius:6,padding:2,flexShrink:0}}>
                        {["御中","様"].map(h=>(
                          <button key={h} type="button" onClick={()=>setForm(f=>({...f,receiptHonorific:h}))} style={{background:form.receiptHonorific===h?"#fff":"transparent",border:"none",borderRadius:5,padding:"5px 12px",fontSize:12,fontWeight:form.receiptHonorific===h?700:500,color:form.receiptHonorific===h?"#713f12":"#94a3b8",cursor:"pointer"}}>{h}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <div style={{marginTop:14}}>
            <label style={S.lbl}>備考（全体）</label>
            <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} style={{...S.inp,resize:"vertical"}} rows={5} placeholder="案件全体に関する備考（改行可）"/>
          </div>
          <div style={{display:"flex",gap:10,marginTop:16}}>
            <button onClick={submit} disabled={recSaving} style={{...S.btn("#0f172a"),opacity:recSaving?0.5:1}}>{recSaving?"保存中…":(editId?"更新":"登録")}</button>
            <button onClick={()=>{setOpen(false);setEditId(null);setForm(E);setLineSearches([""]);}} disabled={recSaving} style={S.btn("#94a3b8")}>キャンセル</button>
          </div>
        </div>
      )}
      {/* パスワード確認モーダル */}
      {pwModal&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.5)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center"}}
          onClick={()=>{pwModal.resolve&&pwModal.resolve(false);setPwModal(null);}}>
          <div style={{background:"#fff",borderRadius:12,padding:24,width:320,boxShadow:"0 8px 32px rgba(0,0,0,0.25)"}}
            onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:15,fontWeight:700,marginBottom:8}}>🔒 締め済み月の操作</div>
            <div style={{fontSize:12,color:"#64748b",marginBottom:16}}>
              {pwModal.month} は締め済みです。<br/>{pwModal.action}するにはパスワードを入力してください。
            </div>
            <PwInput onOk={async pw=>{
              const ok = await verifyPw(pw);
              if(ok){pwModal.resolve&&pwModal.resolve(true);setPwModal(null);}
              else{showToast("パスワードが違います",false);}
            }} onCancel={()=>{pwModal.resolve&&pwModal.resolve(false);setPwModal(null);}}/>
          </div>
        </div>
      )}
      {deleteModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#fff",borderRadius:12,padding:"28px 32px",minWidth:320,boxShadow:"0 8px 32px rgba(0,0,0,0.2)"}}>
            <div style={{fontSize:15,fontWeight:700,marginBottom:8,color:"#991b1b"}}>⚠️ 案件を削除しますか？システム全体に影響するので、実行する場合は管理者に確認してください。</div>
            <div style={{fontSize:13,color:"#374151",marginBottom:6}}>顧客：{deleteModal.custName}</div>
            <div style={{fontSize:13,color:"#374151",marginBottom:20}}>案件名：{deleteModal.record.projectName||"（案件名なし）"}</div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={async()=>{const r=deleteModal.record;try{await onDeleteRec(r.id,{action:"削除",name:r.projectName||deleteModal.custName});setDeleteModal(null);showToast("削除しました");}catch(e){console.error("delete error",e);setSaveErrorModal("削除に失敗しました。通信とログイン状態を確認してください。");}}} style={{flex:1,background:"#dc2626",color:"#fff",border:"none",borderRadius:7,padding:"9px 0",fontSize:13,fontWeight:700,cursor:"pointer"}}>削除する</button>
              <button onClick={()=>setDeleteModal(null)} style={{flex:1,background:"#f1f5f9",color:"#374151",border:"none",borderRadius:7,padding:"9px 0",fontSize:13,cursor:"pointer"}}>キャンセル</button>
            </div>
          </div>
        </div>
      )}
      {saveErrorModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#fff",borderRadius:12,padding:"28px 32px",minWidth:340,maxWidth:420,boxShadow:"0 8px 32px rgba(0,0,0,0.25)"}}>
            <div style={{fontSize:15,fontWeight:700,marginBottom:12,color:"#991b1b",display:"flex",alignItems:"center",gap:8}}>
              <Ico d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" size={18} color="#991b1b"/>保存エラー
            </div>
            <div style={{fontSize:13,color:"#374151",lineHeight:1.7,whiteSpace:"pre-wrap",marginBottom:20}}>{saveErrorModal}</div>
            <button onClick={()=>setSaveErrorModal(null)} style={{width:"100%",background:"#0f172a",color:"#fff",border:"none",borderRadius:7,padding:"10px 0",fontSize:13,fontWeight:600,cursor:"pointer"}}>閉じる</button>
          </div>
        </div>
      )}
      {/* 月別案件名ミニモーダル */}
      {monthlyNameModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#fff",borderRadius:12,padding:"24px 28px",minWidth:360,maxWidth:480,boxShadow:"0 8px 32px rgba(0,0,0,0.2)",maxHeight:"80vh",display:"flex",flexDirection:"column"}}>
            <div style={{fontSize:15,fontWeight:700,marginBottom:4,color:"#7c3aed"}}>月別案件名の変更</div>
            <div style={{fontSize:12,color:"#64748b",marginBottom:14}}>{monthlyNameModal.record.deliveryNo||""}</div>
            <div style={{overflowY:"auto",flex:1,marginBottom:12}}>
              {(()=>{
                const r=monthlyNameModal.record;
                const pad=n=>String(n).padStart(2,"0");
                const startD=new Date(r.startDate+'T00:00:00');
                const monthList=[];
                const hasExtension=r.endDate&&records.some(x=>x.extendedFrom===r.id);
                if(r.endDateOpen){
                  const today_=new Date();
                  const limitMonth=today_.getFullYear()*12+today_.getMonth()+2;
                  const startMonth=startD.getFullYear()*12+startD.getMonth();
                  for(let m=startMonth;m<=limitMonth;m++){
                    const y=Math.floor(m/12);const mo=m%12;
                    monthList.push(`${y}-${pad(mo+1)}`);
                  }
                }else if(hasExtension&&r.endDate){
                  const endD=new Date(r.endDate+'T00:00:00');
                  const startMonth=startD.getFullYear()*12+startD.getMonth();
                  const endMonth=endD.getFullYear()*12+endD.getMonth();
                  for(let m=startMonth;m<=endMonth;m++){
                    const y=Math.floor(m/12);const mo=m%12;
                    monthList.push(`${y}-${pad(mo+1)}`);
                  }
                }else{
                  const months_=Number(r.months)||1;
                  for(let n=0;n<months_&&n<=120;n++){
                    const d=new Date(startD);d.setMonth(d.getMonth()+n);
                    monthList.push(`${d.getFullYear()}-${pad(d.getMonth()+1)}`);
                  }
                }
                const c=customers.find(x=>x.id===r.customerId);
                const split=c?.splitInvoice!==false;
                const masterProjects=c?.projects||[];
                const recordProjects=records.filter(x=>x.customerId===r.customerId&&x.projectName).map(x=>x.projectName);
                const baseProjSet=new Set([...masterProjects,...recordProjects].filter(Boolean));
                let hasLockedMonth=false;
                const rows=monthList.map(m=>{
                  const currentMonthName=r.monthlyProjectNames?.[m]??r.projectName??"";
                  const checkKey=split?currentMonthName:"";
                  const isLocked=lockedKeys.has(`${r.customerId}||${checkKey}||${m}`);
                  if(isLocked) hasLockedMonth=true;
                  const currentVal=monthlyNameModal.names[m]||r.projectName||"";
                  const monthOpts=[...new Set([...baseProjSet,...(currentVal?[currentVal]:[])])].filter(Boolean).sort((a,b)=>a.localeCompare(b,"ja"));
                  return(
                    <div key={m} style={{display:"flex",gap:8,alignItems:"center",marginBottom:5}}>
                      <span style={{fontSize:11,color:"#7c3aed",fontWeight:600,minWidth:64}}>{m}</span>
                      <select
                        value={currentVal}
                        disabled={isLocked}
                        onChange={e=>{const v=e.target.value;setMonthlyNameModal(prev=>({...prev,names:{...prev.names,[m]:v}}));}}
                        style={{...S.inp,flex:1,fontSize:11,padding:"3px 8px",...(isLocked?{background:"#f1f5f9",color:"#94a3b8",cursor:"not-allowed"}:{})}}
                      >{monthOpts.map(p=><option key={p} value={p}>{p}</option>)}</select>
                      {isLocked&&<span style={{fontSize:10,color:"#94a3b8"}}>🔒</span>}
                    </div>
                  );
                });
                return(<>
                  {rows}
                  {hasLockedMonth&&<div style={{fontSize:10,color:"#94a3b8",marginTop:8,lineHeight:1.4}}>締め済みの月を変えるには、請求書タブで「✅ 締め済み」を解除してください</div>}
                </>);
              })()}
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>{
                const r=monthlyNameModal.record;
                const newNames={...monthlyNameModal.names};
                Object.keys(newNames).forEach(k=>{if(!newNames[k]||newNames[k]===r.projectName)delete newNames[k];});
                const updated={...r,monthlyProjectNames:newNames};
                if(Object.keys(updated.monthlyProjectNames).length===0) delete updated.monthlyProjectNames;
                onSave(records.map(x=>x.id===r.id?updated:x),{action:"月別名変更",name:r.projectName||r.deliveryNo},[updated]);
                setMonthlyNameModal(null);
                showToast("月別案件名を保存しました");
              }} style={{flex:1,background:"#7c3aed",color:"#fff",border:"none",borderRadius:7,padding:"9px 0",fontSize:13,fontWeight:700,cursor:"pointer"}}>保存</button>
              <button onClick={()=>setMonthlyNameModal(null)} style={{flex:1,background:"#f1f5f9",color:"#374151",border:"none",borderRadius:7,padding:"9px 0",fontSize:13,cursor:"pointer"}}>キャンセル</button>
            </div>
          </div>
        </div>
      )}
      {/* 戻り[終了]モーダル */}
      {returnModal&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.4)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#fff",borderRadius:12,padding:24,width:360,boxShadow:"0 8px 32px rgba(0,0,0,0.2)",maxHeight:"90vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <div style={{fontSize:15,fontWeight:700,marginBottom:16}}>📦 戻り[終了]の設定</div>
            <div style={{overflowY:"auto",flex:1,marginBottom:8}}>
            {returnModal&&(()=>{
              const targetRec=records.find(x=>x.id===returnModal.id);
              const rLns=targetRec?getLines(targetRec):[];
              const isExtRec=targetRec?.isExtension;
              const hasMultiLine=rLns.length>1;
              const hasPartialQty=isExtRec&&rLns.some(ln=>(Number(ln.quantity)||1)>1&&!getLineReturnDate(ln,targetRec));
              const hasSubItems=isExtRec&&rLns.some(ln=>ln.subItems&&ln.subItems.length>0&&!getLineReturnDate(ln,targetRec));
              return (hasMultiLine||hasPartialQty||hasSubItems)&&(
                <div style={{marginBottom:12}}>
                  <label style={{...S.lbl,marginBottom:6}}>返却する機材を選択</label>
                  {rLns.map((ln,i)=>{
                    const lineReturned=!!getLineReturnDate(ln,targetRec);
                    const hasSI=ln.subItems&&ln.subItems.length>0;
                    const showSubItemsList=isExtRec&&hasSI&&!lineReturned&&!!returnModal.selectedLines?.[i];
                    return (
                      <div key={i} style={{marginBottom:6,border:"1px solid #e2e8f0",borderRadius:6,background:returnModal.selectedLines?.[i]?"#eff6ff":"#fff",overflow:"hidden"}}>
                        <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",padding:"6px 10px"}}>
                          <input type="checkbox" checked={!!returnModal.selectedLines?.[i]}
                            disabled={lineReturned}
                            onChange={e=>setReturnModal(p=>{
                              const checked=e.target.checked;
                              const newSelectedLines={...p.selectedLines,[i]:checked};
                              const newSelectedSubItems={...(p.selectedSubItems||{})};
                              if(isExtRec&&hasSI){
                                if(checked){
                                  newSelectedSubItems[i]=Object.fromEntries(ln.subItems.map((_,si)=>[si,true]));
                                } else {
                                  delete newSelectedSubItems[i];
                                }
                              }
                              return {...p,selectedLines:newSelectedLines,selectedSubItems:newSelectedSubItems};
                            })}/>
                          <span style={{fontSize:12}}>{ln.equipmentName||`機材${i+1}`}</span>
                          {isExtRec&&(Number(ln.quantity)||1)>1&&!lineReturned&&!hasSI&&(
                            <span style={{display:"flex",alignItems:"center",gap:4,marginLeft:"auto"}}>
                              <span style={{fontSize:11,color:"#64748b"}}>返却数</span>
                              <input type="text" inputMode="numeric" value={returnModal.returnQtys?.[i]??(Number(ln.quantity)||1)}
                                onClick={e=>e.stopPropagation()}
                                onChange={e=>{const raw=e.target.value.replace(/[^0-9]/g,"");const v=raw===""?"":(Math.min(Math.max(1,Number(raw)),Number(ln.quantity)||1));setReturnModal(p=>({...p,returnQtys:{...p.returnQtys,[i]:v}}));}}
                                style={{width:48,padding:"2px 4px",border:"1px solid #e2e8f0",borderRadius:4,fontSize:12,textAlign:"center"}}/>
                              <span style={{fontSize:11,color:"#64748b"}}>/{Number(ln.quantity)||1}台</span>
                            </span>
                          )}
                          {hasSI&&!lineReturned&&isExtRec&&(
                            <span style={{fontSize:11,color:"#64748b",marginLeft:"auto"}}>
                              {(()=>{const ss=returnModal.selectedSubItems?.[i]||{};const cnt=Object.values(ss).filter(Boolean).length;return `${cnt}/${ln.subItems.length}台`;})()}
                            </span>
                          )}
                          {lineReturned&&<span style={{fontSize:10,color:"#16a34a",marginLeft:"auto"}}>✓ 返却済</span>}
                        </label>
                        {showSubItemsList&&(
                          <div style={{padding:"8px 10px 10px 32px",borderTop:"1px solid #e2e8f0",background:"#f8fafc"}}>
                            <div style={{display:"flex",gap:6,marginBottom:6}}>
                              <button type="button" onClick={e=>{e.stopPropagation();setReturnModal(p=>({...p,selectedSubItems:{...(p.selectedSubItems||{}),[i]:Object.fromEntries(ln.subItems.map((_,si)=>[si,true]))}}));}}
                                style={{padding:"3px 10px",fontSize:11,border:"1px solid #cbd5e1",borderRadius:4,background:"#fff",color:"#475569",cursor:"pointer"}}>全選択</button>
                              <button type="button" onClick={e=>{e.stopPropagation();setReturnModal(p=>({...p,selectedSubItems:{...(p.selectedSubItems||{}),[i]:Object.fromEntries(ln.subItems.map((_,si)=>[si,false]))}}));}}
                                style={{padding:"3px 10px",fontSize:11,border:"1px solid #cbd5e1",borderRadius:4,background:"#fff",color:"#475569",cursor:"pointer"}}>全解除</button>
                            </div>
                            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:4}}>
                              {ln.subItems.map((si,siIdx)=>{
                                const siChecked=!!returnModal.selectedSubItems?.[i]?.[siIdx];
                                return (
                                  <label key={siIdx} style={{display:"flex",alignItems:"center",gap:4,padding:"3px 6px",border:"1px solid #e2e8f0",borderRadius:4,background:siChecked?"#dbeafe":"#fff",cursor:"pointer",fontSize:11}}>
                                    <input type="checkbox" checked={siChecked}
                                      onClick={e=>e.stopPropagation()}
                                      onChange={e=>{const checked=e.target.checked;setReturnModal(p=>({...p,selectedSubItems:{...(p.selectedSubItems||{}),[i]:{...(p.selectedSubItems?.[i]||{}),[siIdx]:checked}}}));}}/>
                                    <span style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>No.{si.no}{si.note?` (${si.note})`:""}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
            </div>
            <div style={{marginBottom:12}}>
              <label style={S.lbl}>返却日（機材が戻った日）</label>
              <input type="date" value={returnModal.returnDate}
                onChange={e=>setReturnModal(p=>({...p,returnDate:e.target.value}))}
                style={S.inp}/>
            </div>
            <div style={{marginBottom:16}}>
              <label style={S.lbl}>計上終了日（請求に含める最終日）</label>
              <input type="date" value={returnModal.billingEndDate}
                onChange={e=>setReturnModal(p=>({...p,billingEndDate:e.target.value}))}
                style={S.inp}/>
              <div style={{fontSize:11,color:"#94a3b8",marginTop:4}}>※返却日と異なる場合があります（例：前日まで計上など）</div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={async()=>{
                if(!returnModal.billingEndDate){showToast("計上終了日を入力してください",false);return;}
                const targetRec=records.find(x=>x.id===returnModal.id);
                if(!targetRec){setReturnModal(null);return;}
                const rLns=getLines(targetRec);
                const selectedIdxs=Object.entries(returnModal.selectedLines||{}).filter(([,v])=>v).map(([k])=>Number(k));
                if(selectedIdxs.length===0){showToast("返却する機材を1つ以上選択してください",false);return;}
                const processed=[];
                rLns.forEach((ln,i)=>{
                  const alreadyReturned=!!getLineReturnDate(ln,targetRec);
                  if(alreadyReturned){processed.push({ln,isReturned:true});return;}
                  if(!selectedIdxs.includes(i)){processed.push({ln,isReturned:false});return;}
                  const lineQty=Number(ln.quantity)||1;
                  const hasSI=ln.subItems&&ln.subItems.length>0;
                  if(hasSI&&targetRec.isExtension){
                    const siSel=returnModal.selectedSubItems?.[i]||{};
                    const returnedSubItems=ln.subItems.filter((_,siIdx)=>!!siSel[siIdx]);
                    const continuingSubItems=ln.subItems.filter((_,siIdx)=>!siSel[siIdx]);
                    if(returnedSubItems.length===0){
                      processed.push({ln,isReturned:false});
                      return;
                    }
                    if(continuingSubItems.length===0){
                      processed.push({ln:{...ln,returnDate:returnModal.billingEndDate,actualReturnDate:returnModal.returnDate},isReturned:true});
                      return;
                    }
                    processed.push({ln:{...ln,subItems:returnedSubItems,quantity:returnedSubItems.length,returnDate:returnModal.billingEndDate,actualReturnDate:returnModal.returnDate},isReturned:true});
                    processed.push({ln:{...ln,subItems:continuingSubItems,quantity:continuingSubItems.length,returnDate:undefined,actualReturnDate:undefined},isReturned:false});
                    return;
                  }
                  const retQty=Math.min(Math.max(1,Number(returnModal.returnQtys?.[i]??lineQty)),lineQty);
                  if(retQty>=lineQty){
                    processed.push({ln:{...ln,returnDate:returnModal.billingEndDate,actualReturnDate:returnModal.returnDate},isReturned:true});
                  } else {
                    processed.push({ln:{...ln,quantity:retQty,returnDate:returnModal.billingEndDate,actualReturnDate:returnModal.returnDate},isReturned:true});
                    processed.push({ln:{...ln,quantity:lineQty-retQty,returnDate:undefined,actualReturnDate:undefined},isReturned:false});
                  }
                });
                const returnedLines=processed.filter(p=>p.isReturned).map(p=>p.ln);
                const continuingLines=processed.filter(p=>!p.isReturned).map(p=>p.ln);
                const allLinesInOrder=processed.map(p=>p.ln);
                const shouldSplit=continuingLines.length>0&&!!targetRec.isExtension;
                if(shouldSplit){
                  const origDays=calcDays(targetRec.startDate,returnModal.billingEndDate);
                  const origBillingDays=chainBillingDays(targetRec, records, returnModal.billingEndDate);
                  const origAmount=returnedLines.reduce((s,ln)=>{
                    const noDisc=ln.noBillingDiscount;
                    const qty=noDisc?origDays:origBillingDays;
                    return s+(Number(ln.unitPrice)||0)*(Number(ln.quantity)||1)*qty;
                  },0);
                  const updatedOriginal={
                    ...targetRec,
                    lines:returnedLines,
                    returnDate:returnModal.billingEndDate,
                    actualReturnDate:returnModal.returnDate,
                    endDate:returnModal.billingEndDate,
                    endDateOpen:false,
                    days:origDays,
                    billingDays:origBillingDays,
                    amount:origAmount,
                    insuranceAmount:targetRec.includeInsurance?Math.round(origAmount*0.1):0,
                  };
                  const baseNo=(targetRec.deliveryNo||"").replace(/E\d+$/,"");
                  let maxE=0;
                  if(baseNo){
                    records.forEach(x=>{
                      const dn=x.deliveryNo||"";
                      if(!dn.startsWith(baseNo+"E"))return;
                      const suffix=dn.slice(baseNo.length+1);
                      if(/^\d+$/.test(suffix)){const n=parseInt(suffix);if(n>maxE)maxE=n;}
                    });
                  }
                  const newDeliveryNo=baseNo?(baseNo+"E"+(maxE+1)):(await nextDeliveryNo());
                  const _now=new Date();
                  const _pad=n=>String(n).padStart(2,"0");
                  const createdAtStr=_now.getFullYear()+"-"+_pad(_now.getMonth()+1)+"-"+_pad(_now.getDate())+"T"+_pad(_now.getHours())+":"+_pad(_now.getMinutes())+":"+_pad(_now.getSeconds());
                  const continuingRec={
                    ...targetRec,
                    id:uid(),
                    deliveryNo:newDeliveryNo,
                    lines:continuingLines.map(ln=>({...ln})),
                    returnDate:undefined,
                    actualReturnDate:undefined,
                    endDate:targetRec.startDate,
                    endDateOpen:true,
                    isExtension:true,
                    extendedFrom:targetRec.extendedFrom||targetRec.id,
                    extendedFromNo:targetRec.extendedFromNo||targetRec.deliveryNo||"",
                    amount:0,
                    insuranceAmount:0,
                    days:undefined,
                    billingDays:undefined,
                    createdAt:createdAtStr,
                  };
                  try {
                    await onSave([...records.map(x=>x.id===targetRec.id?updatedOriginal:x),continuingRec],null,[updatedOriginal,continuingRec]);
                  } catch(e) { console.error("return+continue save error",e); setSaveErrorModal("返却確定の保存に失敗しました。通信とログイン状態を確認して、もう一度お試しください。"); return; }
                  showToast("返却確定・継続分("+newDeliveryNo+")を作成しました");
                } else {
                  const updatedLines=allLinesInOrder;
                  const allClosed=updatedLines.every(ln=>ln.returnDate);
                  const newAmount=updatedLines.reduce((s,ln)=>{
                    if(!ln.returnDate) return s;
                    const d=calcDays(targetRec.startDate,ln.returnDate);
                    const noDisc=ln.noBillingDiscount;
                    const qty=noDisc?d:chainBillingDays(targetRec, records, ln.returnDate);
                    return s+(Number(ln.unitPrice)||0)*(Number(ln.quantity)||1)*qty;
                  },0);
                  const newInsurance=targetRec.includeInsurance?Math.round(newAmount*0.1):0;
                  const updatedRec={...records.find(x=>x.id===returnModal.id),lines:updatedLines,returnDate:allClosed?returnModal.billingEndDate:records.find(x=>x.id===returnModal.id)?.returnDate,actualReturnDate:allClosed?returnModal.returnDate:records.find(x=>x.id===returnModal.id)?.actualReturnDate,endDate:allClosed?returnModal.billingEndDate:records.find(x=>x.id===returnModal.id)?.endDate,endDateOpen:!allClosed,days:allClosed?calcDays(records.find(x=>x.id===returnModal.id)?.startDate,returnModal.billingEndDate):records.find(x=>x.id===returnModal.id)?.days,billingDays:allClosed?calcBillingDays(calcDays(records.find(x=>x.id===returnModal.id)?.startDate,returnModal.billingEndDate)):records.find(x=>x.id===returnModal.id)?.billingDays,amount:newAmount,insuranceAmount:newInsurance};
                  try {
                    await onSave(records.map(x=>x.id===returnModal.id?updatedRec:x),null,[updatedRec]);
                  } catch(e) { console.error("return save error",e); setSaveErrorModal("計上終了日の保存に失敗しました。通信とログイン状態を確認して、もう一度お試しください。"); return; }
                  showToast("計上終了日を設定しました");
                }
                setReturnModal(null);
              }} style={S.btn("#7c3aed",true)}>設定する</button>
              <button onClick={()=>setReturnModal(null)} style={S.btn("#94a3b8")}>キャンセル</button>
            </div>
          </div>
        </div>
      )}
      {/* 延長モーダル */}
      {extModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#fff",borderRadius:12,padding:28,width:480,maxHeight:"80vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <h3 style={{margin:"0 0 16px",fontSize:15,fontWeight:700}}>🔄 延長する製品を選択</h3>
            <div style={{marginBottom:16,fontSize:12,color:"#64748b"}}>延長する製品にチェックを入れてください。</div>
            <div style={{overflowY:"auto",flex:1,marginBottom:16}}>
            {(extModal.units||[]).map((u,i)=>(
              <label key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,cursor:"pointer",padding:"8px 12px",border:"1px solid #e2e8f0",borderRadius:8,background:extModal.selected[i]?"#eff6ff":"#fff"}}>
                <input type="checkbox" checked={!!extModal.selected[i]} onChange={e=>setExtModal(m=>({...m,selected:{...m.selected,[i]:e.target.checked}}))}/>
                <div>
                  <div style={{fontWeight:600,fontSize:13}}>{u.equipmentName}</div>
                  <div style={{fontSize:11,color:"#94a3b8"}}>No.{u.no}　¥{Number(u.unitPrice).toLocaleString()}/日　{u.note}</div>
                </div>
              </label>
            ))}
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={async()=>{
                const r=extModal.record;
                const selectedUnits=extModal.units.filter((_,i)=>extModal.selected[i]);
                if(selectedUnits.length===0){alert("製品を1つ以上選択してください");return;}
                const lineMap={};
                selectedUnits.forEach(u=>{
                  if(!lineMap[u.lineIdx]) lineMap[u.lineIdx]={...u.originalLine,subItems:[],quantity:0};
                  lineMap[u.lineIdx].subItems.push({no:u.no,note:u.note});
                  lineMap[u.lineIdx].quantity=lineMap[u.lineIdx].subItems.length;
                });
                const selectedLines=Object.values(lineMap);
                const nextDay=r.endDate?new Date(new Date(r.endDate).getTime()+86400000).toISOString().slice(0,10):today();
                const baseNo=r.deliveryNo||"";
                const eMatch=baseNo.match(/E(\d+)$/);
                const delivNo=baseNo?(baseNo.replace(/E\d+$/,"")+"E"+(eMatch?parseInt(eMatch[1])+1:1)):await nextDeliveryNo();
                const newRec={
                  ...E,
                  id:uid(),
                  customerId:r.customerId,
                  projectName:r.projectName||"",
                  projectDetail:r.projectDetail||"",
                  ordererName:r.ordererName||"",
                  ecOrderNo:r.ecOrderNo||"",
                  ourStaff:r.ourStaff||"",
                  billingType:"daily",
                  startDate:nextDay,
                  endDate:nextDay,
                  endDateOpen:true,
                  isExtension:true,
                  extendedFrom:r.id,
                  extendedFromNo:r.deliveryNo||"",
                  deliveryNo:delivNo,
                  lines:selectedLines.map(ln=>({...ln})),
                  receiptNote:r.receiptNote||"機材レンタル代として　[クレジット スクエア]",
                  paymentMethod:r.paymentMethod||"credit",
                  includeInsurance:false,
                  issueReceipt:false,
                  createdAt:new Date().toISOString(),
                };
                try {
                  await onSave([...records,newRec],null,[newRec]);
                  setExtModal(null);
                  showToast("延長案件を作成しました");
                } catch(e) {
                  console.error("extModal save error",e);
                  setSaveErrorModal("延長案件の保存に失敗しました。通信とログイン状態を確認して、もう一度お試しください。");
                }
              }} style={{background:"#2563eb",color:"#fff",border:"none",borderRadius:8,padding:"10px 24px",fontSize:13,fontWeight:700,cursor:"pointer"}}>延長案件を作成</button>
              <button onClick={()=>setExtModal(null)} style={{background:"none",border:"1.5px solid #e2e8f0",borderRadius:8,padding:"10px 20px",fontSize:13,color:"#64748b",cursor:"pointer"}}>キャンセル</button>
            </div>
          </div>
        </div>
      )}
      <div style={S.card}>
        <div style={{padding:"12px 16px",borderBottom:"1px solid #f1f5f9"}}>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center",marginBottom:8}}>
            <div style={{flex:1,minWidth:200,position:"relative"}}>
              <div style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",opacity:.4}}><Ico d={I.search} size={13}/></div>
              <input value={fil.q} onChange={e=>setFil(f=>({...f,q:e.target.value}))} placeholder="顧客名・製品名・案件名で検索..." style={{...S.inp,paddingLeft:28}}/>
            </div>
            <select value={fil.cid} onChange={e=>setFil(f=>({...f,cid:e.target.value}))} style={{...S.inp,width:160}}><option value="">全顧客</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <select value={fil.month} onChange={e=>setFil(f=>({...f,month:e.target.value}))} style={{...S.inp,width:120}}><option value="">全期間</option>{mnths.map(m=><option key={m}>{m}</option>)}</select>
            <select value={fil.locked||""} onChange={e=>setFil(f=>({...f,locked:e.target.value}))} style={{...S.inp,width:110}}>
              <option value="">全ステータス</option>
              <option value="locked">🔒 締め済み</option>
              <option value="open">🔓 未締め</option>
            </select>
            <button onClick={()=>{setForm(E);setEditId(null);setLineSearches([""]);setOpen(true);}} style={S.btn("#0f172a")}><Ico d={I.plus} size={15}/>新規登録</button>
          </div>
          <div style={{fontSize:11,color:"#64748b"}}>
            {filtered.length}件表示
            {fil.q&&<span style={{marginLeft:8,background:"#eff6ff",color:"#2563eb",borderRadius:4,padding:"1px 6px"}}>「{fil.q}」</span>}
            {(fil.q||fil.cid||fil.month||fil.locked)&&<button onClick={()=>setFil({q:"",cid:"",month:"",locked:""})} style={{marginLeft:8,background:"none",border:"none",color:"#94a3b8",cursor:"pointer",fontSize:11}}>✕ クリア</button>}
          </div>
        </div>
        <div style={{overflowX:"auto"}}>
          {filtered.length===0
            ?<div style={{padding:48,textAlign:"center",color:"#94a3b8"}}>案件がありません。「新規登録」から追加してください。</div>
            :(()=>{
              const filteredExtension = filtered.filter(r=>r.isExtension===true&&!r.returnDate);
              const filteredMonthly = filtered.filter(r=>r.billingType==="monthly"&&!r.isExtension);
              const filteredDaily   = filtered.filter(r=>r.billingType!=="monthly"&&(!r.isExtension||r.returnDate));
              const renderGroup = (recs, sectionLabel, sectionColor) => {
                if(recs.length===0) return null;
                const custGroups={};
                recs.forEach(r=>{
                const cid=r.customerId||"__none__";
                if(!custGroups[cid]) custGroups[cid]={c:customers.find(x=>x.id===cid),recs:[]};
                custGroups[cid].recs.push(r);
              });
              return Object.entries(custGroups).map(([cid,{c,recs}])=>{
                const custOpen=!!expandedCust[cid]; // default open
                const custTotal=recs.reduce((s,r)=>s+(r.amount||0)+(r.insuranceAmount||0),0);
                const hasLocked=recs.some(r=>isRecordLocked(r));
                // 案件名ごとにグループ化
                const projGroups={};
                recs.forEach(r=>{
                  const pk=(r.projectName||"―");
                  if(!projGroups[pk]) projGroups[pk]=[];
                  projGroups[pk].push(r);
                });
                return(
                  <div key={cid} style={{borderBottom:"1px solid #e2e8f0"}}>
                    {/* 顧客ヘッダー行 */}
                    <div onClick={()=>setExpandedCust(p=>({...p,[cid]:!custOpen}))}
                      style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",background:"#f1f5f9",cursor:"pointer",userSelect:"none"}}>
                      <span style={{fontSize:13,color:"#64748b",minWidth:14}}>{custOpen?"▼":"▶"}</span>
                      <span style={{fontWeight:700,fontSize:13,flex:1}}>{c?.name||"顧客不明"}</span>
                      {hasLocked&&<span style={{fontSize:10,color:"#15803d",background:"#dcfce7",borderRadius:4,padding:"1px 6px"}}>🔒 締め含む</span>}
                      <span style={{fontSize:11,color:"#64748b"}}>{recs.length}件</span>
                      <span style={{fontSize:12,fontWeight:700,color:"#16a34a"}}>{fmt(custTotal)}</span>
                    </div>
                    {custOpen&&Object.entries(projGroups).map(([projName,pRecs])=>{
                      const pk=cid+"__"+projName;
                      const projOpen=!!expandedProj[pk]; // default open
                      const projTotal=pRecs.reduce((s,r)=>s+(r.amount||0)+(r.insuranceAmount||0),0);
                      return(
                        <div key={pk}>
                          {/* 案件名ヘッダー行 */}
                          <div onClick={()=>setExpandedProj(p=>({...p,[pk]:!projOpen}))}
                            style={{display:"flex",alignItems:"center",gap:10,padding:"8px 16px 8px 36px",background:"#f8fafc",cursor:"pointer",userSelect:"none",borderTop:"1px solid #e2e8f0"}}>
                            <span style={{fontSize:12,color:"#94a3b8",minWidth:12}}>{projOpen?"▼":"▶"}</span>
                            <span style={{fontSize:12,fontWeight:600,color:"#475569",flex:1}}>{projName}</span>
                            <span style={{fontSize:11,color:"#94a3b8"}}>{pRecs.length}件</span>
                            <span style={{fontSize:11,fontWeight:600,color:"#16a34a"}}>{fmt(projTotal)}</span>
                          </div>
                          {/* 明細行 */}
                          {projOpen&&(
                            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                              <tbody>
                                {[...pRecs].sort((a,b)=>{
                                  const aBase=(a.isExtension?a.extendedFromNo:a.deliveryNo)||"";
                                  const bBase=(b.isExtension?b.extendedFromNo:b.deliveryNo)||"";
                                  if(aBase!==bBase) return aBase.localeCompare(bBase,"ja");
                                  const aIsExt=a.isExtension?1:0;
                                  const bIsExt=b.isExtension?1:0;
                                  if(aIsExt!==bIsExt) return aIsExt-bIsExt;
                                  return (a.deliveryNo||"").localeCompare(b.deliveryNo||"","ja");
                                }).map(r=>{
                                  const isM=r.billingType==="monthly";
                                  const rL=getLines(r);
                                  const locked=isRecordLocked(r);
                                  return(
                                    <tr key={r.id} style={{borderTop:"1px solid #f1f5f9",background:locked?"#f0fdf4":"#fff"}}>
                                      <td style={{padding:"8px 16px 8px 56px",color:"#64748b",fontSize:11,whiteSpace:"nowrap"}}>{fmtD(r.startDate)}〜{fmtD(r.endDate)}{r.deliveryNo&&<span style={{marginLeft:6,fontSize:10,color:"#94a3b8",background:"#f1f5f9",borderRadius:4,padding:"1px 5px"}}>No.{r.deliveryNo}</span>}{r.isExtension&&(r.returnDate
  ?<span style={{fontSize:10,background:"#dcfce7",color:"#15803d",borderRadius:4,padding:"1px 6px",marginLeft:4,fontWeight:700}}>✓ 延長処理済</span>
  :<span style={{fontSize:10,background:"#dbeafe",color:"#1d4ed8",borderRadius:4,padding:"1px 6px",marginLeft:4,fontWeight:700}}>🔄 延長中</span>)}{r.isExtension&&r.extendedFromNo&&<span style={{fontSize:10,color:"#94a3b8",marginLeft:4}}>元No.{r.extendedFromNo}</span>}</td>
                                      <td style={{padding:"8px 12px"}}>
                                        {rL.length===1
                                          ?<span>{rL[0].equipmentName||r.equipmentName} <span style={{color:"#94a3b8"}}>×{rL[0].quantity||r.quantity}</span></span>
                                          :<div>{rL.map((ln,j)=><div key={j} style={{fontSize:11}}>{ln.equipmentName} <span style={{color:"#94a3b8"}}>×{ln.quantity}</span></div>)}</div>}
                                        {r.projectDetail&&<div style={{fontSize:10,color:"#94a3b8",marginTop:1}}>{r.projectDetail}</div>}
                                      </td>
                                      <td style={{padding:"8px 12px",textAlign:"center",whiteSpace:"nowrap"}}>
                                        {isM?<span style={{background:"#faf5ff",color:"#7c3aed",borderRadius:4,padding:"1px 5px",fontSize:10,fontWeight:700}}>月極</span>
                                            :<span style={{background:"#eff6ff",color:"#2563eb",borderRadius:4,padding:"1px 5px",fontSize:10,fontWeight:700}}>日極</span>}
                                      </td>
                                      <td style={{padding:"8px 8px",textAlign:"center",fontWeight:600,color:isM?"#7c3aed":"#2563eb",whiteSpace:"nowrap"}}>{isM?(r.months||1)+"ヶ月":r.endDateOpen?"継続中":(()=>{const hasNoDisc=getLines(r).some(ln=>ln.noBillingDiscount||(products||[]).find(p=>p.id===ln.productId)?.noBillingDiscount);return (hasNoDisc?(r.days||0):(r.billingDays||r.days||0))+"日";})()}</td>
                                      <td style={{padding:"8px 12px",textAlign:"right",fontWeight:700,color:"#16a34a",whiteSpace:"nowrap"}}>{fmt((r.amount||0)+(r.insuranceAmount||0))}</td>
                                      <td style={{padding:"8px 12px",whiteSpace:"nowrap",textAlign:"right"}}>
                                        {locked&&<span style={{fontSize:10,marginRight:4,color:"#15803d"}}>🔒</span>}
                                        {!r.isExtension&&!(records||[]).some(x=>x.extendedFromNo===r.deliveryNo&&r.deliveryNo)&&(
                                        <button onClick={e=>{
                                          e.stopPropagation();
                                          const rLns=getLines(r);
                                          const units=[];
                                          rLns.forEach((ln,lineIdx)=>{
                                            const qty=Number(ln.quantity)||1;
                                            if(ln.subItems&&ln.subItems.length>0){
                                              ln.subItems.forEach((si,siIdx)=>units.push({lineIdx,siIdx,equipmentName:ln.equipmentName,unitPrice:ln.unitPrice,no:si.no,note:si.note||"",originalLine:ln}));
                                            } else {
                                              for(let i=0;i<qty;i++) units.push({lineIdx,siIdx:i,equipmentName:ln.equipmentName,unitPrice:ln.unitPrice,no:i+1,note:"",originalLine:ln});
                                            }
                                          });
                                          setExtModal({record:r,units,selected:Object.fromEntries(units.map((_,i)=>[i,true]))});
                                        }} style={{...S.ib("#0369a1"),marginRight:4,fontSize:10}}>🔄 延長</button>
                                        )}
                                        {(r.endDateOpen||(!r.endDate&&r.billingType==="monthly"))&&!r.returnDate&&(
                                          <button onClick={e=>{e.stopPropagation();setReturnModal({id:r.id,returnDate:today(),billingEndDate:today(),selectedLines:Object.fromEntries(getLines(r).map((ln,i)=>[i,!getLineReturnDate(ln,r)])),returnQtys:Object.fromEntries(getLines(r).map((ln,i)=>[i,Number(ln.quantity)||1]))});}}
                                            style={{...S.ib("#7c3aed"),marginRight:4,fontSize:10}}>📦 戻り[終了]</button>
                                        )}
                                        {r.isProvisionalClose&&!isRecordLocked(r)&&(
                                          <button onClick={async e=>{
                                            e.stopPropagation();
                                            const continuingRec=(records||[]).find(x=>
                                              x.extendedFromNo===(r.extendedFromNo||r.deliveryNo)
                                              && x.endDateOpen===true
                                              && !x.isProvisionalClose
                                              && x.startDate
                                              && r.returnDate
                                              && x.startDate>r.returnDate
                                            );
                                            if(continuingRec){
                                              const isModified=(continuingRec.amount&&continuingRec.amount>0)
                                                ||continuingRec.returnDate
                                                ||(continuingRec.lines&&continuingRec.lines.some(ln=>ln.returnDate));
                                              if(isModified){
                                                showToast("継続レコードが既に編集されているため取り消しできません",false);
                                                return;
                                              }
                                            }
                                            const restoredOriginal={
                                              ...r,
                                              endDate:r.startDate,
                                              endDateOpen:true,
                                              returnDate:undefined,
                                              actualReturnDate:undefined,
                                              isProvisionalClose:false,
                                              days:undefined,
                                              billingDays:undefined,
                                              amount:0,
                                              insuranceAmount:0,
                                            };
                                            try {
                                              if(continuingRec) await onDeleteRec(continuingRec.id);
                                              const newRecords=(records||[]).map(x=>x.id===r.id?restoredOriginal:x);
                                              await onSave(newRecords,{
                                                action:"暫定締め取消",
                                                name:r.deliveryNo||"",
                                                detail:continuingRec?`継続レコード ${continuingRec.deliveryNo||""} を削除`:"継続レコードなし"
                                              },[restoredOriginal]);
                                              showToast("暫定締めを取り消しました");
                                            } catch(e) { console.error("暫定締め取消 error",e); setSaveErrorModal("暫定締め取消の保存に失敗しました。通信とログイン状態を確認してください。"); }
                                          }} style={{...S.ib("#0891b2"),marginRight:4,fontSize:10}}>⏪ 暫定締め取消</button>
                                        )}
                                        {r.returnDate&&<span style={{fontSize:10,color:"#7c3aed",marginRight:4,whiteSpace:"nowrap"}}>{r.isProvisionalClose?"⚠️ 暫定締め:":"計上終了:"}{r.returnDate}</span>}
                                        {r.billingType==="monthly"&&<button onClick={e=>{e.stopPropagation();setMonthlyNameModal({record:r,names:{...(r.monthlyProjectNames||{})}});}} style={{...S.ib("#7c3aed"),marginRight:4,fontSize:10}}>月別名</button>}
                                        <button onClick={async e=>{e.stopPropagation();if(!await checkLockAsync(r,"編集"))return;const rLns=getLines(r);setForm({customerId:r.customerId,projectName:r.projectName||"",noProjectName:!!r.noProjectName,projectDetail:r.projectDetail||"",ecOrderNo:r.ecOrderNo||"",ordererName:r.ordererName||"",ourStaff:r.ourStaff||"",billingType:r.billingType||"daily",months:String(r.months||1),startDate:r.startDate,endDate:r.endDate||today(),endDateOpen:!!r.endDateOpen,notes:r.notes||"",issueReceipt:!!r.issueReceipt,receiptDate:r.receiptDate||today(),paymentMethod:r.paymentMethod||"credit",adjustDays:r.adjustDays||"",adjustReason:r.adjustReason||"",monthlyProjectNames:r.monthlyProjectNames||{},includeInsurance:!!(r.includeInsurance||(r.insuranceAmount||0)>0),lines:rLns.map(ln=>({productId:ln.productId||"",equipNo:ln.equipNo||"",unitPrice:String(ln.unitPrice||""),quantity:String(ln.quantity||1),lineNote:ln.lineNote||"",subItems:ln.subItems||[],equipmentName:ln.equipmentName||"",expandRows:!!ln.expandRows,isManual:!!ln.isManual,isFee:!!ln.isFee,noBillingDiscount:!!ln.noBillingDiscount}))});setLineSearches(rLns.map(()=>""));setEditId(r.id);setOpen(true);}} style={{...S.ib(locked?"#64748b":"#92400e"),marginRight:4}}><Ico d={I.edit} size={12}/></button>
                                        <button onClick={async e=>{e.stopPropagation();if(!await checkLockAsync(r,"削除"))return;setDeleteModal({record:r,custName:customers.find(x=>x.id===r.customerId)?.name||""});}} style={S.ib(locked?"#64748b":"#991b1b")}><Ico d={I.trash} size={12}/></button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              });
              };
              return(<>
                {filteredExtension.length>0&&(
                  <div>
                    <div style={{padding:"8px 16px",background:"#dbeafe",borderBottom:"2px solid #93c5fd",display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:12,fontWeight:700,color:"#1d4ed8"}}>🔄 延長中案件</span>
                      <span style={{fontSize:11,color:"#3b82f6"}}>{filteredExtension.length}件</span>
                    </div>
                    {renderGroup(filteredExtension,"延長中","#dbeafe")}
                  </div>
                )}
                {filteredMonthly.length>0&&(
                  <div>
                    <div style={{padding:"8px 16px",background:"#f5f3ff",borderBottom:"2px solid #ede9fe",display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:12,fontWeight:700,color:"#7c3aed"}}>📅 月極案件</span>
                      <span style={{fontSize:11,color:"#a78bfa"}}>{filteredMonthly.length}件</span>
                    </div>
                    {renderGroup(filteredMonthly,"月極","#f5f3ff")}
                  </div>
                )}
                {filteredDaily.length>0&&(
                  <div>
                    <div style={{padding:"8px 16px",background:"#eff6ff",borderBottom:"2px solid #dbeafe",display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:12,fontWeight:700,color:"#2563eb"}}>📋 日極案件</span>
                      <span style={{fontSize:11,color:"#60a5fa"}}>{filteredDaily.length}件</span>
                    </div>
                    {renderGroup(filteredDaily,"日極","#eff6ff")}
                  </div>
                )}
              </>);
            })()}
          {filtered.length>0&&(
            <div style={{background:"#eff6ff",padding:"9px 16px",display:"flex",justifyContent:"flex-end",gap:16,fontSize:12,fontWeight:700,borderTop:"2px solid #e2e8f0"}}>
              <span style={{color:"#64748b"}}>合計（税抜）</span>
              <span style={{color:"#16a34a",fontSize:14}}>{fmt(filtered.reduce((s,r)=>s+(r.amount||0)+(r.insuranceAmount||0),0))}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

async function nextInvoiceNo(month) {
  const { data, error } = await supabase.rpc('next_invoice_no');
  if (error) { console.error('nextInvoiceNo error', error); return `${month}-ERR`; }
  return `${month}-${String(data).padStart(3,'0')}`;
}

async function nextDeliveryNo() {
  const yy = String(new Date().getFullYear()).slice(-2);
  const { data, error } = await supabase.rpc('next_delivery_no');
  if (error) { console.error('nextDeliveryNo error', error); return 'ERR'; }
  return `${yy}-${String(data).padStart(5,'0')}`;
}

// =========================================================
// DeliveryTab（納品書タブ）
// =========================================================
function DeliveryTab({records, customers, groups, showToast, globalQ, onSave, autoOpenRecord, onClearAutoOpen}){
  const [fil, setFil] = useState({q:"", cid:"", month:new Date().toISOString().slice(0,7)});
  const [extModal, setExtModal] = useState(null);
  const [expandedDates, setExpandedDates] = useState({});
  const prevDay = dateStr => {
    if (!dateStr) return "";
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  useEffect(()=>{
    if(autoOpenRecord){
      const r=records.find(x=>x.id===autoOpenRecord);
      if(r){ const g=makeGroup(r); downloadPrintHTML(r.issueReceipt?"delivery-receipt":"delivery", g); }
      onClearAutoOpen&&onClearAutoOpen();
    }
  },[autoOpenRecord]);

  const mnths=[...new Set(records.map(r=>r.startDate?.slice(0,7)))].filter(Boolean).sort().reverse();

  // 案件ごとに単独グループを作成してdownloadに渡す
  const makeGroup = (r) => {
    const c = customers.find(x=>x.id===r.customerId);
    const lns = (r.lines&&r.lines.length)?r.lines:[{equipmentName:r.equipmentName||"",unitPrice:r.unitPrice,quantity:r.quantity,subItems:r.subItems||[]}];
    const equipName = lns.map(ln=>ln.equipmentName).filter(Boolean).join("、");
    const rWithEquip = {...r, equipmentName: r.equipmentName||equipName};
    return {
      customerId: r.customerId,
      customer: c||null,
      customerName: c?.name||"不明",
      projectName: r.projectName||"",
      month: r.startDate?.slice(0,7)||"",
      items: [rWithEquip],
      split: true,
      consolidate: false,
    };
  };

  const filtered = records.filter(r=>{
    const q=fil.q.toLowerCase(), c=customers.find(x=>x.id===r.customerId);
    const gq=(globalQ||"").toLowerCase();
    const rLns=(r.lines&&r.lines.length)?r.lines:[{equipmentName:r.equipmentName||""}];
    const matchQ=!q||c?.name?.toLowerCase().includes(q)||r.projectName?.toLowerCase().includes(q)||rLns.some(ln=>(ln.equipmentName||"").toLowerCase().includes(q))||(r.deliveryNo||"").toLowerCase().includes(q);
    const matchGQ=!gq||c?.name?.toLowerCase().includes(gq)||r.projectName?.toLowerCase().includes(gq)||rLns.some(ln=>(ln.equipmentName||"").toLowerCase().includes(gq));
    return matchQ&&matchGQ&&(!fil.cid||r.customerId===fil.cid)&&(!fil.month||r.startDate?.startsWith(fil.month));
  });


  return(
    <div style={{display:"flex",gap:16,alignItems:"flex-start"}}>
      <div style={{flex:1,minWidth:0}}>
        <h2 style={{fontSize:16,fontWeight:700,marginBottom:14}}>納品書</h2>
        <div style={S.card}>
          <div style={{padding:"12px 16px",borderBottom:"1px solid #f1f5f9",display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
            <div style={{flex:1,minWidth:180,position:"relative"}}>
              <div style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",opacity:.4}}><Ico d={I.search} size={13}/></div>
              <input value={fil.q} onChange={e=>setFil(f=>({...f,q:e.target.value}))} placeholder="会社・製品・案件名・納品書No.で検索..." style={{...S.inp,paddingLeft:28}}/>
            </div>
            <select value={fil.cid} onChange={e=>setFil(f=>({...f,cid:e.target.value}))} style={{...S.inp,width:170}}>
              <option value="">全顧客</option>
              {customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={fil.month} onChange={e=>setFil(f=>({...f,month:e.target.value}))} style={{...S.inp,width:125}}>
              <option value="">全期間</option>
              {mnths.map(m=><option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            {filtered.length===0
              ?<div style={{padding:48,textAlign:"center",color:"#94a3b8"}}>案件がありません</div>
              :(()=>{
                const dateGroups={};
                filtered.forEach(r=>{const key=prevDay(r.startDate);if(!dateGroups[key])dateGroups[key]=[];dateGroups[key].push(r);});
                const sortedDates=Object.keys(dateGroups).sort().reverse();
                return sortedDates.map(dateKey=>{
                  const recs=dateGroups[dateKey];
                  const isOpen=!!expandedDates[dateKey];
                  const dayTotal=recs.reduce((s,r)=>s+(r.amount||0),0);
                  const [,dm,dd]=dateKey.split("-");
                  const dateLabel=`${Number(dm)}/${Number(dd)}`;
                  return(
                    <div key={dateKey} style={{borderBottom:"1px solid #e2e8f0"}}>
                      <div onClick={()=>setExpandedDates(p=>({...p,[dateKey]:!p[dateKey]}))}
                        style={{display:"flex",alignItems:"center",gap:12,padding:"10px 16px",cursor:"pointer",background:isOpen?"#f0fdf4":"#f8fafc",userSelect:"none"}}>
                        <span style={{fontSize:13,fontWeight:700,color:"#0f172a",minWidth:48}}>{isOpen?"▼":"▶"} {dateLabel}</span>
                        <span style={{fontSize:11,color:"#64748b"}}>{recs.length}件</span>
                        <span style={{fontSize:12,fontWeight:700,color:"#16a34a",marginLeft:"auto"}}>{fmt(dayTotal)}</span>
                      </div>
                      {isOpen&&(
                        <div style={{overflowX:"auto"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5}}>
                            <thead><tr style={{background:"#f8fafc",borderBottom:"2px solid #e2e8f0"}}>
                              {["No.","顧客","案件名","機材","利用期間","金額(税抜)",""].map(h=>(
                                <th key={h} style={{padding:"9px 12px",textAlign:"left",fontWeight:700,color:"#475569",whiteSpace:"nowrap"}}>{h}</th>
                              ))}
                            </tr></thead>
                            <tbody>
                              {recs.map((r,i)=>{
                                const c=customers.find(x=>x.id===r.customerId);
                                const g=makeGroup(r);
                                return(
                                  <tr key={r.id} style={{borderBottom:"1px solid #f1f5f9",background:i%2?"#fcfcfc":"#fff",cursor:"pointer"}}
                                    onClick={()=>downloadPrintHTML(r.issueReceipt?"delivery-receipt":"delivery", g)}>
                                    <td style={{padding:"8px 12px",fontSize:11,color:"#94a3b8",whiteSpace:"nowrap"}}>{r.deliveryNo||"―"}</td>
                                    <td style={{padding:"8px 12px",fontWeight:600}}>{c?.name||"―"}</td>
                                    <td style={{padding:"8px 12px",fontSize:11,color:"#64748b"}}>
                                      {r.projectName||"―"}
                                      {r.ecOrderNo&&<span style={{marginLeft:6,fontSize:10,color:"#0369a1"}}>EC:{r.ecOrderNo}</span>}
                                    </td>
                                    <td style={{padding:"8px 12px",fontSize:11}}>{r.equipmentName}</td>
                                    <td style={{padding:"8px 12px",fontSize:11,color:"#64748b",whiteSpace:"nowrap"}}>{fmtD(r.startDate)}〜{fmtD(r.endDate)}</td>
                                    <td style={{padding:"8px 12px",fontWeight:700,color:"#16a34a"}}>{fmt(r.amount)}</td>
                                    <td style={{padding:"8px 12px",whiteSpace:"nowrap"}} onClick={e=>e.stopPropagation()}>
                                      {!r.isExtension&&!(records||[]).some(x=>x.extendedFromNo===r.deliveryNo&&r.deliveryNo)&&(
                                      <button onClick={()=>{
                                        const rLns=(r.lines&&r.lines.length)?r.lines:[{productId:r.productId||"",equipNo:r.equipNo||"",unitPrice:r.unitPrice,quantity:r.quantity,lineNote:r.lineNote||"",subItems:r.subItems||[],equipmentName:r.equipmentName||""}];
                                        const units=[];
                                        rLns.forEach((ln,lineIdx)=>{
                                          const qty=Number(ln.quantity)||1;
                                          if(ln.subItems&&ln.subItems.length>0){
                                            ln.subItems.forEach((si,siIdx)=>units.push({lineIdx,siIdx,equipmentName:ln.equipmentName,unitPrice:ln.unitPrice,no:si.no,note:si.note||"",originalLine:ln}));
                                          } else {
                                            for(let i=0;i<qty;i++) units.push({lineIdx,siIdx:i,equipmentName:ln.equipmentName,unitPrice:ln.unitPrice,no:i+1,note:"",originalLine:ln});
                                          }
                                        });
                                        setExtModal({record:r,units,selected:Object.fromEntries(units.map((_,i)=>[i,true]))});
                                      }} style={{...S.ib("#0369a1"),fontSize:11,marginRight:4}}>🔄 延長</button>
                                      )}
                                      <button onClick={()=>downloadPrintHTML(r.issueReceipt?"delivery-receipt":"delivery", g)} style={{...S.ib("#16a34a"),fontSize:11}}>
                                        <Ico d={I.file} size={11}/>{r.issueReceipt?"納品書・領収証":"納品書"}
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                });
              })()
            }
          </div>
        </div>
      </div>

      {/* 延長モーダル */}
      {extModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#fff",borderRadius:12,padding:28,width:480,maxHeight:"80vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <h3 style={{margin:"0 0 16px",fontSize:15,fontWeight:700}}>🔄 延長する製品を選択</h3>
            <div style={{marginBottom:16,fontSize:12,color:"#64748b"}}>延長する製品にチェックを入れてください。</div>
            <div style={{overflowY:"auto",flex:1,marginBottom:16}}>
            {(extModal.units||[]).map((u,i)=>(
              <label key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,cursor:"pointer",padding:"8px 12px",border:"1px solid #e2e8f0",borderRadius:8,background:extModal.selected[i]?"#eff6ff":"#fff"}}>
                <input type="checkbox" checked={!!extModal.selected[i]} onChange={e=>setExtModal(m=>({...m,selected:{...m.selected,[i]:e.target.checked}}))}/>
                <div>
                  <div style={{fontWeight:600,fontSize:13}}>{u.equipmentName}</div>
                  <div style={{fontSize:11,color:"#94a3b8"}}>No.{u.no}　¥{Number(u.unitPrice).toLocaleString()}/日　{u.note}</div>
                </div>
              </label>
            ))}
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={async()=>{
                const r=extModal.record;
                const selectedUnits=extModal.units.filter((_,i)=>extModal.selected[i]);
                if(selectedUnits.length===0){alert("製品を1つ以上選択してください");return;}
                const lineMap={};
                selectedUnits.forEach(u=>{
                  if(!lineMap[u.lineIdx]) lineMap[u.lineIdx]={...u.originalLine,subItems:[],quantity:0};
                  lineMap[u.lineIdx].subItems.push({no:u.no,note:u.note});
                  lineMap[u.lineIdx].quantity=lineMap[u.lineIdx].subItems.length;
                });
                const selectedLines=Object.values(lineMap);
                const nextDay=r.endDate?new Date(new Date(r.endDate).getTime()+86400000).toISOString().slice(0,10):new Date().toISOString().slice(0,10);
                const baseNo=r.deliveryNo||"";
                const eMatch=baseNo.match(/E(\d+)$/);
                const delivNo=baseNo?(baseNo.replace(/E\d+$/,"")+"E"+(eMatch?parseInt(eMatch[1])+1:1)):await nextDeliveryNo();
                const newRec={
                  id:uid(),
                  customerId:r.customerId,
                  projectName:r.projectName||"",
                  projectDetail:r.projectDetail||"",
                  ordererName:r.ordererName||"",
                  ecOrderNo:r.ecOrderNo||"",
                  ourStaff:r.ourStaff||"",
                  billingType:"daily",
                  months:"1",
                  startDate:nextDay,
                  endDate:nextDay,
                  endDateOpen:true,
                  isExtension:true,
                  extendedFrom:r.id,
                  extendedFromNo:r.deliveryNo||"",
                  deliveryNo:delivNo,
                  lines:selectedLines.map(ln=>({...ln})),
                  receiptNote:r.receiptNote||"機材レンタル代として　[クレジット スクエア]",
                  paymentMethod:r.paymentMethod||"credit",
                  includeInsurance:false,
                  issueReceipt:false,
                  noProjectName:false,
                  notes:"",
                  createdAt:new Date().toISOString(),
                };
                try {
                  await onSave([...records,newRec],null,[newRec]);
                  setExtModal(null);
                  showToast("延長案件を作成しました");
                } catch(e) {
                  console.error("extModal2 save error",e);
                  showToast("延長案件の保存に失敗しました。通信を確認して再試行してください。",false);
                }
              }} style={{background:"#2563eb",color:"#fff",border:"none",borderRadius:8,padding:"10px 24px",fontSize:13,fontWeight:700,cursor:"pointer"}}>延長案件を作成</button>
              <button onClick={()=>setExtModal(null)} style={{background:"none",border:"1.5px solid #e2e8f0",borderRadius:8,padding:"10px 20px",fontSize:13,color:"#64748b",cursor:"pointer"}}>キャンセル</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================
// InvoiceTab（請求書タブ） — 月選択・ステータス管理・調整行
// =========================================================
function InvoiceTab({groups, customers, products, onSaveCust, invoiceData, onSaveInv, showToast, globalQ, records, onSaveRec, incidents}){
  const months = [...new Set(groups.map(g=>g.month).filter(Boolean))].sort().reverse();
  const currentMonth = today().slice(0,7);
  const [selMonth, setSelMonth] = useState(months.includes(currentMonth)?currentMonth:(months[0]||""));
  // groupsが変化したときにselMonthを補正
  React.useEffect(()=>{
    if(months.length>0 && !selMonth){
      setSelMonth(months.includes(currentMonth)?currentMonth:months[0]);
    }
  },[months.length]);
  const [expanded, setExpanded] = useState({}); // {key: bool}
  const [statusFilter, setStatusFilter] = useState("all"); // "all"|"open"|"locked"
  const [showPwSetting, setShowPwSetting] = useState(false);
  const [crossMonthSplits, setCrossMonthSplits] = useState(()=>{try{const s=localStorage.getItem('olqCrossMonthSplits');return s?JSON.parse(s):{};}catch{return {};}}); // {recordId: {type:'full'|'split', targetMonth?:string, splits?:[{startDate,endDate}]}}
  const [crossMonthSplitsReady, setCrossMonthSplitsReady] = useState(false);
  const [crossMonthSplitsLoaded, setCrossMonthSplitsLoaded] = useState(false);
  React.useEffect(()=>{if(!crossMonthSplitsReady)return;if(!crossMonthSplitsLoaded&&Object.keys(crossMonthSplits).length===0)return;try{localStorage.setItem('olqCrossMonthSplits',JSON.stringify(crossMonthSplits));}catch{} supabase.from('settings').upsert({key:'crossMonthSplits',value:JSON.stringify(crossMonthSplits)},{onConflict:'key'}).then(({error})=>{if(error)console.error('crossMonthSplits save error',error);});}, [crossMonthSplits,crossMonthSplitsReady,crossMonthSplitsLoaded]);
  React.useEffect(()=>{supabase.from('settings').select('value').eq('key','crossMonthSplits').maybeSingle().then(({data,error})=>{if(!error&&data&&data.value){try{const parsed=JSON.parse(data.value);setCrossMonthSplits(parsed);localStorage.setItem('olqCrossMonthSplits',data.value);}catch{}}setCrossMonthSplitsLoaded(true);setCrossMonthSplitsReady(true);}).catch(()=>{setCrossMonthSplitsReady(true);});},[]);
  const [newPw, setNewPw] = useState("");
  const [lockModal, setLockModal] = useState(null); // null | {mode:"confirm",key:string} | {mode:"unlock",key:string}
  const [changePwModal, setChangePwModal] = useState(false);
  const [printCountResetModal, setPrintCountResetModal] = useState(false);
  const [custQ, setCustQ] = useState("");

  const getInvData = (key, month) => {
    const d = invoiceData[key] || {};
    if(!d.issueDate && month) {
      // デフォルト: 月末日
      const [y,m] = (month||"").split("-").map(Number);
      const lastDay = y&&m ? new Date(y, m, 0).getDate() : null;
      d.issueDate = y&&m ? `${y}-${String(m).padStart(2,"0")}-${String(lastDay).padStart(2,"0")}` : "";
    }
    return {status:"open", adjustments:[], issueDate:"", ...d};
  };
  const updateInvData = async (key, patch) => {
    const next = {...invoiceData, [key]:{...getInvData(key),...patch}};
    await onSaveInv(next);
  };
  const addAdj = async (key) => {
    const d = getInvData(key);
    await updateInvData(key, {adjustments:[...d.adjustments, {id:uid(), label:"", amount:0}]});
  };
  const updateAdj = async (key, adjId, patch) => {
    const d = getInvData(key);
    await updateInvData(key, {adjustments:d.adjustments.map(a=>a.id===adjId?{...a,...patch}:a)});
  };
  const removeAdj = async (key, adjId) => {
    const d = getInvData(key);
    await updateInvData(key, {adjustments:d.adjustments.filter(a=>a.id!==adjId)});
  };
  const toggleLock = (key, e) => {
    e.stopPropagation();
    const d = getInvData(key);
    if(d.status==="locked"){
      setLockModal({mode:"unlock", key});
    } else {
      setLockModal({mode:"confirm", key});
    }
  };
  const doLockConfirm = async () => {
    const key = lockModal.key;
    setLockModal(null);
    // 締め時にスナップショットを焼く（案件名変更やライブ再計算による金額変動から保護）
    const g = groups.find(g => `${g.customerId}||${g.projectName}||${g.month}` === key);
    const d = getInvData(key, g?.month);
    const gInc = g ? (incidents||[]).filter(x=>!x.separate_invoice&&x.customer_id===g.customerId&&x.invoice_month===g.month&&(g.projectName===""||( x.related_project_name||"")===(g.projectName||""))).filter(x=>x.status!=="paid") : [];
    const incTot = gInc.reduce((s,x)=>s+(x.charge_amount||0),0);
    const baseTot = g ? g.items.reduce((s,r)=>s+(r.amount||0)+(r.insuranceAmount||0),0)+incTot : 0;
    const autoAdjTot = (g?._autoAdjustments||[]).reduce((s,a)=>s+(Number(a.amount)||0),0);
    const adjSum = d.adjustments.reduce((s,a)=>s+(Number(a.amount)||0),0);
    const snapshot = g ? {
      projectName: g.projectName,
      month: g.month,
      items: g.items.map(r => ({
        id:r.id, projectName:r.projectName, equipmentName:r.equipmentName,
        amount:r.amount, insuranceAmount:r.insuranceAmount,
        lines:r.lines, startDate:r.startDate, endDate:r.endDate,
        billingType:r.billingType, days:r.days, billingDays:r.billingDays,
        months:r.months, deliveryNo:r.deliveryNo, isExtension:r.isExtension,
        extendedFromNo:r.extendedFromNo, ecOrderNo:r.ecOrderNo,
        ordererName:r.ordererName, projectDetail:r.projectDetail,
        isMonthlyEntry:r.isMonthlyEntry, isReturnEntry:r.isReturnEntry,
        noBillingDiscount:r.noBillingDiscount, includeInsurance:r.includeInsurance,
        issueReceipt:r.issueReceipt, receiptDate:r.receiptDate, paymentMethod:r.paymentMethod,
      })),
      incidents: gInc.map(x=>({id:x.id, charge_amount:x.charge_amount, description:x.description})),
      adjustments: d.adjustments,
      grandTotal: baseTot + autoAdjTot + adjSum,
      frozenAt: new Date().toISOString(),
    } : null;
    await updateInvData(key, {status:"locked", ...(snapshot ? {snapshot} : {})});
    showToast("締め済みにしました 🔒");
  };
  const doUnlock = async (pw) => {
    const ok = await verifyPw(pw);
    if(!ok){showToast("パスワードが違います", false);return;}
    const key = lockModal.key;
    setLockModal(null);
    await updateInvData(key, {status:"open"});
    showToast("締めを解除しました");
  };
  const doChangePw = async (cur) => {
    const ok = await verifyPw(cur);
    if(!ok){showToast("現在のパスワードが違います", false);return;}
    await updateLockPw(newPw);
    setChangePwModal(false);
    setNewPw("");
    setShowPwSetting(false);
    showToast("パスワードを変更しました");
  };
  const triggerPrintCountReset = () => { setPrintCountResetModal(true); };
  const doPrintCountReset = async () => {
    setPrintCountResetModal(false);
    const next={...invoiceData};
    Object.keys(next).forEach(key=>{
      const [cid,,month]=key.split("||");
      const grpRecords=records.filter(r=>r.customerId===cid&&(r.startDate||"").startsWith(month));
      const hasReceipt=grpRecords.some(r=>r.issueReceipt);
      if(!hasReceipt) next[key]={...next[key],printCount:0,invNo:"",lastPrintDate:""};
    });
    await onSaveInv(next);
    showToast("リセット完了しました",true);
  };
  const toggleExpand = (key) => setExpanded(p=>({...p,[key]:!p[key]}));

  // 領収済案件の判定ヘルパー
  const isReceiptItem = r => !!r.issueReceipt;

  // 領収済案件と振込案件が混在するグループを2分割
  const splitGroups = [];
  groups.forEach(g => {
    const receiptItems = (g.items||[]).filter(isReceiptItem);
    const transferItems = (g.items||[]).filter(r => !isReceiptItem(r));
    if (receiptItems.length > 0 && transferItems.length > 0) {
      splitGroups.push({...g, items: transferItems, _isReceiptGroup: false});
      splitGroups.push({...g, items: receiptItems, _isReceiptGroup: true});
    } else if (receiptItems.length > 0) {
      splitGroups.push({...g, items: receiptItems, _isReceiptGroup: true});
    } else {
      splitGroups.push({...g, items: transferItems, _isReceiptGroup: false});
    }
  });

  const filtered = splitGroups
    .filter(g=>!selMonth||g.month===selMonth)
    .filter(g=>(!custQ||g.customerName.toLowerCase().includes(custQ.toLowerCase()))&&(!globalQ||g.customerName.toLowerCase().includes(globalQ.toLowerCase())||g.projectName?.toLowerCase().includes(globalQ.toLowerCase())))
    .filter(g=>{
      if(statusFilter==="receipt") return g._isReceiptGroup;
      if(statusFilter==="all") return true;
      if(g._isReceiptGroup) return false;
      const d=getInvData(`${g.customerId}||${g.projectName}||${g.month}`);
      return statusFilter==="locked"?d.status==="locked":d.status!=="locked";
    })
    .sort((a,b)=>a.customerName.localeCompare(b.customerName,"ja")||a.projectName.localeCompare(b.projectName,"ja"));

  // 月またぎ分割反映済みグループを生成
  const crossAdjustedFiltered = React.useMemo(()=>{
    if(!selMonth||Object.keys(crossMonthSplits).length===0) return filtered;
    const [sy,sm]=selMonth.split("-").map(Number);
    const lastDayNum=new Date(sy,sm,0).getDate();
    const monthEnd=`${sy}-${String(sm).padStart(2,'0')}-${String(lastDayNum).padStart(2,'0')}`;
    let result=filtered.map(g=>({...g,items:[...g.items]}));
    const crossRecs=(records||[]).filter(r=>{
      if(!r.startDate||!r.endDate||r.billingType==="monthly") return false;
      const rs=r.startDate.slice(0,7),re=r.endDate.slice(0,7);
      if(rs===re||!(rs===selMonth||re===selMonth||(rs<selMonth&&re>selMonth))) return false;
      if(statusFilter==="receipt"&&!r.issueReceipt) return false;
      if((statusFilter==="open"||statusFilter==="locked")&&r.issueReceipt) return false;
      return true;
    });
    crossRecs.forEach(r=>{
      const sp=crossMonthSplits[r.id];
      if(!sp) return;
      const c=customers.find(x=>x.id===r.customerId);
      const recIsReceipt=!!r.issueReceipt;
      if(sp.type==='full'){
        const monthAmt=sp.targetMonth===selMonth?(r.amount||0):0;
        if(monthAmt<=0) return;
        const existingGroup=result.find(g=>g.items.some(item=>item.id===r.id)&&!!g._isReceiptGroup===recIsReceipt);
        if(existingGroup){
          result=result.map(g=>(g===existingGroup?{...g,items:g.items.map(item=>item.id===r.id?{...item,amount:monthAmt}:item)}:g));
        } else {
          const custSplit=c?.splitInvoice!==false;
          const synthProjName=custSplit?(r.projectName||""):"";
          const existingSame=result.find(g=>g.customerId===r.customerId&&g.projectName===synthProjName&&g.month===selMonth&&!!g._isReceiptGroup===recIsReceipt);
          if(existingSame){
            result=result.map(g=>g===existingSame?{...g,items:[...g.items,{...r,amount:monthAmt}]}:g);
          } else {
            result.push({customerId:r.customerId,customer:c,customerName:c?.name||"",projectName:synthProjName,month:selMonth,items:[{...r,amount:monthAmt}],split:custSplit,consolidate:false,_synthetic:true,_isReceiptGroup:recIsReceipt});
          }
        }
        return;
      }
      if(sp.type==='split'&&sp.splits){
        const idx=sp.splits.findIndex(spItem=>spItem.startDate&&spItem.endDate&&spItem.startDate.slice(0,7)<=selMonth&&spItem.endDate.slice(0,7)>=selMonth);
        if(idx<0) return;
        const isLast=idx===sp.splits.length-1;
        const spItem=sp.splits[idx];
        const splitDays=calcDays(spItem.startDate,spItem.endDate);
        const rLines=(r.lines&&r.lines.length)?r.lines:[{unitPrice:r.unitPrice,quantity:r.quantity||1,productId:r.productId||"",equipmentName:r.equipmentName||"",lineNote:r.lineNote||"",noBillingDiscount:!!r.noBillingDiscount}];
        const rebuiltLines=rLines.map(ln=>{
          const noDisc=ln.noBillingDiscount||(products||[]).find(p=>p.id===ln.productId)?.noBillingDiscount;
          const lineBD=noDisc?splitDays:(chainBillingDays({...r,startDate:spItem.startDate},records,spItem.endDate)||calcBillingDays(splitDays));
          const lineAmt=Math.round((ln.unitPrice||0)*(ln.quantity||1)*lineBD);
          let clampedReturnDate=ln.returnDate;
          if(clampedReturnDate&&(clampedReturnDate<spItem.startDate||clampedReturnDate>spItem.endDate)){
            clampedReturnDate=undefined;
          }
          return {...ln,billingDays:lineBD,amount:lineAmt,returnDate:clampedReturnDate};
        });
        const firstLn=rLines[0]||{};
        const firstNoDisc=firstLn.noBillingDiscount||(products||[]).find(p=>p.id===firstLn.productId)?.noBillingDiscount;
        const splitBillingDays=firstNoDisc?splitDays:(chainBillingDays({...r,startDate:spItem.startDate},records,spItem.endDate)||calcBillingDays(splitDays));
        const monthAmt=rebuiltLines.reduce((s,ln)=>s+(ln.amount||0),0);
        if(monthAmt<=0) return;
        let autoAdj=null;
        if(isLast){
          const origTotal=r.amount||0;
          const allSplitsTotal=sp.splits.reduce((s,sp2)=>{
            if(!sp2.startDate||!sp2.endDate) return s;
            const d2=calcDays(sp2.startDate,sp2.endDate);
            return s+rLines.reduce((s2,ln)=>{
              const noDisc=ln.noBillingDiscount||(products||[]).find(p=>p.id===ln.productId)?.noBillingDiscount;
              const bd=noDisc?d2:(chainBillingDays({...r,startDate:sp2.startDate},records,sp2.endDate)||calcBillingDays(d2));
              return s2+Math.round((ln.unitPrice||0)*(ln.quantity||1)*bd);
            },0);
          },0);
          const diff=origTotal-allSplitsTotal;
          if(diff!==0) autoAdj={id:`auto_adj_${r.id}`,label:'日数値引き調整',amount:diff,_auto:true};
        }
        const splitItem={...r,startDate:spItem.startDate,endDate:spItem.endDate,days:splitDays,billingDays:splitBillingDays,amount:monthAmt,lines:rebuiltLines};
        const injectAutoAdj=g=>autoAdj?{...g,_autoAdjustments:[...(g._autoAdjustments||[]).filter(a=>a.id!==autoAdj.id),autoAdj]}:g;
        const existingGroup=result.find(g=>g.items.some(item=>item.id===r.id)&&!!g._isReceiptGroup===recIsReceipt);
        if(existingGroup){
          result=result.map(g=>{
            if(g!==existingGroup) return g;
            return injectAutoAdj({...g,items:g.items.map(item=>item.id===r.id?splitItem:item)});
          });
        } else {
          const custSplit=c?.splitInvoice!==false;
          const synthProjName=custSplit?(r.projectName||""):"";
          const existingSame=result.find(g=>g.customerId===r.customerId&&g.projectName===synthProjName&&g.month===selMonth&&!!g._isReceiptGroup===recIsReceipt);
          if(existingSame){
            result=result.map(g=>g!==existingSame?g:injectAutoAdj({...g,items:[...g.items,splitItem]}));
          } else {
            result.push(injectAutoAdj({customerId:r.customerId,customer:c,customerName:c?.name||"",projectName:synthProjName,month:selMonth,items:[splitItem],split:custSplit,consolidate:false,_synthetic:true,_isReceiptGroup:recIsReceipt}));
          }
        }
      }
    });
    // 最終保険：itemsの中身に応じて _isReceiptGroup を強制再分割
    const finalResult=[];
    result.forEach(g=>{
      const receiptItems=(g.items||[]).filter(isReceiptItem);
      const transferItems=(g.items||[]).filter(r=>!isReceiptItem(r));
      if(receiptItems.length>0&&transferItems.length>0){
        finalResult.push({...g,items:transferItems,_isReceiptGroup:false});
        finalResult.push({...g,items:receiptItems,_isReceiptGroup:true});
      } else if(receiptItems.length>0){
        finalResult.push({...g,_isReceiptGroup:true});
      } else {
        finalResult.push({...g,_isReceiptGroup:false});
      }
    });
    // 後段防御：statusFilter を再適用
    const reFiltered=finalResult.filter(g=>{
      if(statusFilter==="receipt") return g._isReceiptGroup;
      if(statusFilter==="all") return true;
      if(g._isReceiptGroup) return false;
      const d=getInvData(`${g.customerId}||${g.projectName}||${g.month}`);
      return statusFilter==="locked"?d.status==="locked":d.status!=="locked";
    });
    return reFiltered;
  },[filtered,crossMonthSplits,selMonth,records,customers,products,statusFilter]);

  const monthTotal = crossAdjustedFiltered.reduce((s,g)=>{
    const key=`${g.customerId}||${g.projectName}||${g.month}`;
    const d=getInvData(key,g.month);
    const base=g.items.reduce((s,r)=>s+(r.amount||0)+(r.insuranceAmount||0),0);
    const adj=d.adjustments.reduce((s,a)=>s+(Number(a.amount)||0),0);
    const autoAdj=(g._autoAdjustments||[]).reduce((s,a)=>s+(Number(a.amount)||0),0);
    const inc=(incidents||[]).filter(x=>!x.separate_invoice&&x.status!=="paid"&&x.customer_id===g.customerId&&x.invoice_month===g.month&&(g.projectName===""||( x.related_project_name||"")===(g.projectName||""))).reduce((t,x)=>t+(x.charge_amount||0),0);
    return s+base+adj+autoAdj+inc;
  },0);
  // 各案件の税込を積み上げた正確な合計（顧客への請求総額）
  const monthTotalInc = crossAdjustedFiltered.reduce((s,g)=>{
    const key=`${g.customerId}||${g.projectName}||${g.month}`;
    const d=getInvData(key,g.month);
    const base=g.items.reduce((s2,r)=>s2+(r.amount||0)+(r.insuranceAmount||0),0);
    const adj=d.adjustments.reduce((s2,a)=>s2+(Number(a.amount)||0),0);
    const autoAdj=(g._autoAdjustments||[]).reduce((s2,a)=>s2+(Number(a.amount)||0),0);
    const inc=(incidents||[]).filter(x=>!x.separate_invoice&&x.status!=="paid"&&x.customer_id===g.customerId&&x.invoice_month===g.month&&(g.projectName===""||( x.related_project_name||"")===(g.projectName||""))).reduce((t,x)=>t+(x.charge_amount||0),0);
    const gt=base+adj+autoAdj+inc;
    return s+gt+Math.round(gt*0.1);
  },0);
  const simpleInc = monthTotal+Math.round(monthTotal*0.1);
  const incDiff = monthTotalInc - simpleInc;

  return(
    <div style={{display:"flex",gap:16,alignItems:"flex-start"}}>
      <div style={{flex:1,minWidth:0}}>

        {/* ヘッダー */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
          <h2 style={{fontSize:16,fontWeight:700,margin:0}}>請求書</h2>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            {/* 月選択 */}
            <select value={selMonth} onChange={e=>{setSelMonth(e.target.value);setExpanded({});}}
              style={{...S.inp,width:125,fontWeight:700,fontSize:13}}>
              <option value="">全期間</option>
              {months.map(m=><option key={m} value={m}>{m}</option>)}
            </select>
            {/* 顧客検索 */}
            <div style={{position:"relative"}}>
              <div style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",opacity:.4}}><Ico d={I.search} size={13}/></div>
              <input value={custQ} onChange={e=>setCustQ(e.target.value)} placeholder="顧客名で絞り込み"
                style={{...S.inp,paddingLeft:26,width:150}}/>
            </div>
            {/* ステータスフィルター */}
            <div style={{display:"flex",gap:2,background:"#e2e8f0",borderRadius:6,padding:2}}>
              {[{k:"all",l:"全て"},{k:"open",l:"未締め"},{k:"locked",l:"締め済み"},{k:"receipt",l:"領収済"}].map(t=>(
                <button key={t.k} onClick={()=>setStatusFilter(t.k)} style={{
                  background:statusFilter===t.k?"#fff":"transparent",border:"none",borderRadius:5,
                  padding:"4px 10px",fontSize:11,fontWeight:statusFilter===t.k?700:500,
                  color:statusFilter===t.k?"#0f172a":"#94a3b8",cursor:"pointer",
                  boxShadow:statusFilter===t.k?"0 1px 3px rgba(0,0,0,.1)":"none"
                }}>{t.l}</button>
              ))}
            </div>
          </div>
        </div>

        {/* 月末暫定締めの警告バー */}
        {selMonth && (() => {
          const pendingProvisional = (records||[]).filter(r =>
            r.endDateOpen === true
            && r.isExtension === true
            && !r.returnDate
            && r.startDate
            && r.startDate.slice(0,7) < selMonth
          );
          if (pendingProvisional.length === 0) return null;
          const [sy, sm] = selMonth.split("-").map(Number);
          const prevMonthEnd = new Date(sy, sm - 1, 0);
          const prevMonthEndStr = `${prevMonthEnd.getFullYear()}-${String(prevMonthEnd.getMonth()+1).padStart(2,'0')}-${String(prevMonthEnd.getDate()).padStart(2,'0')}`;
          return (
            <div style={{padding:"12px 16px",marginBottom:14,background:"#fef3c7",border:"1px solid #fbbf24",borderRadius:8}}>
              <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                <span style={{fontSize:14}}>⚠️</span>
                <div style={{flex:1,minWidth:200}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#78350f",marginBottom:2}}>
                    {selMonth.replace("-","年")+"月"}に未処理の延長中案件があります（{pendingProvisional.length}件）
                  </div>
                  <div style={{fontSize:11,color:"#92400e"}}>
                    前月末（{prevMonthEndStr}）で暫定的に締めて、当月分の請求書を発行できます。
                  </div>
                </div>
                <button onClick={async () => {
                  const currentMonthFirstStr = `${sy}-${String(sm).padStart(2,'0')}-01`;
                  const _now = new Date();
                  const _pad = n => String(n).padStart(2, "0");
                  const createdAtStr = _now.getFullYear()+"-"+_pad(_now.getMonth()+1)+"-"+_pad(_now.getDate())+"T"+_pad(_now.getHours())+":"+_pad(_now.getMinutes())+":"+_pad(_now.getSeconds());
                  let allRecords = [...(records||[])];
                  const updatesById = {};
                  const newRecords = [];
                  pendingProvisional.forEach(r => {
                    const newDays = calcDays(r.startDate, prevMonthEndStr);
                    const newBillingDays = chainBillingDays(r, allRecords, prevMonthEndStr);
                    const rLines = getLines(r);
                    const newAmount = rLines.reduce((s, ln) => {
                      const noDisc = ln.noBillingDiscount;
                      const qty = noDisc ? newDays : newBillingDays;
                      return s + (Number(ln.unitPrice)||0) * (Number(ln.quantity)||1) * qty;
                    }, 0);
                    updatesById[r.id] = {
                      ...r,
                      endDate: prevMonthEndStr,
                      endDateOpen: false,
                      returnDate: prevMonthEndStr,
                      isProvisionalClose: true,
                      days: newDays,
                      billingDays: newBillingDays,
                      amount: newAmount,
                      insuranceAmount: r.includeInsurance ? Math.round(newAmount * 0.1) : 0,
                    };
                    const baseNo = (r.deliveryNo || "").replace(/E\d+$/, "");
                    let maxE = 0;
                    allRecords.forEach(x => {
                      const dn = x.deliveryNo || "";
                      if (!baseNo || !dn.startsWith(baseNo + "E")) return;
                      const suffix = dn.slice(baseNo.length + 1);
                      if (/^\d+$/.test(suffix)) { const n = parseInt(suffix); if (n > maxE) maxE = n; }
                    });
                    const newDeliveryNo = baseNo ? (baseNo + "E" + (maxE + 1)) : r.deliveryNo;
                    const continuingRec = {
                      ...r,
                      id: uid(),
                      deliveryNo: newDeliveryNo,
                      startDate: currentMonthFirstStr,
                      endDate: currentMonthFirstStr,
                      endDateOpen: true,
                      isExtension: true,
                      isProvisionalClose: false,
                      extendedFrom: r.extendedFrom || r.id,
                      extendedFromNo: r.extendedFromNo || r.deliveryNo || "",
                      returnDate: undefined,
                      actualReturnDate: undefined,
                      amount: 0,
                      insuranceAmount: 0,
                      days: undefined,
                      billingDays: undefined,
                      lines: rLines.map(ln => ({...ln, returnDate: undefined, actualReturnDate: undefined})),
                      createdAt: createdAtStr,
                    };
                    newRecords.push(continuingRec);
                    allRecords.push(continuingRec);
                  });
                  const finalRecords = [
                    ...(records||[]).map(x => updatesById[x.id] || x),
                    ...newRecords
                  ];
                  await onSaveRec(finalRecords,null,[...Object.values(updatesById),...newRecords]);
                  showToast(`${pendingProvisional.length}件を前月末で暫定締めしました`);
                }} style={{...S.btn("#d97706",true),fontSize:11,whiteSpace:"nowrap"}}>
                  📅 前月末で暫定締め
                </button>
              </div>
              <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid #fcd34d",fontSize:11,color:"#78350f"}}>
                {pendingProvisional.slice(0,5).map(r => {
                  const c = customers.find(x=>x.id===r.customerId);
                  return (
                    <div key={r.id} style={{padding:"2px 0"}}>
                      ・{r.deliveryNo||""} {c?.name||""} {r.projectName||""}（{r.startDate}〜継続中）
                    </div>
                  );
                })}
                {pendingProvisional.length > 5 && (
                  <div style={{padding:"2px 0",fontStyle:"italic"}}>
                    ・他 {pendingProvisional.length - 5} 件
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* 月合計バー */}
        {/* 統計カード */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:18}}>
          {[
            {l:"今月の案件数",v:(records||[]).filter(r=>r.startDate?.startsWith(today().slice(0,7))).length+"件",c:"#2563eb"},
            {l:"今月売上(税抜)",v:fmt((records||[]).filter(r=>r.startDate?.startsWith(today().slice(0,7))).reduce((s,r)=>s+(r.amount||0),0)),c:"#16a34a"},
            {l:"顧客数",v:new Set((records||[]).map(r=>r.customerId)).size+"社",c:"#9333ea"}
          ].map(s=>(
            <div key={s.l} style={{...S.card,padding:"16px 20px"}}><div style={{fontSize:11,color:"#64748b",marginBottom:4}}>{s.l}</div><div style={{fontSize:22,fontWeight:800,color:s.c}}>{s.v}</div></div>
          ))}
        </div>
        {/* パスワード設定 */}
        {showPwSetting&&(
          <div style={{...S.card,padding:"12px 16px",marginBottom:10,background:"#fefce8",border:"1px solid #fde047"}}>
            <div style={{fontSize:12,fontWeight:700,marginBottom:8}}>🔑 締め解除パスワードの変更</div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <input type="password" value={newPw} onChange={e=>setNewPw(e.target.value)} placeholder="新しいパスワード" style={{...S.inp,width:180}}/>
              <button onClick={()=>{if(!newPw){showToast("パスワードを入力してください",false);return;}setChangePwModal(true);}} style={S.btn("#0f172a",true)}>変更</button>
              <button onClick={()=>{setShowPwSetting(false);setNewPw("");}} style={S.btn("#94a3b8")}>キャンセル</button>
            </div>
          </div>
        )}
        {selMonth&&filtered.length>0&&(
          <div style={{background:"#eff6ff",borderRadius:8,padding:"8px 16px",marginBottom:10,display:"flex",gap:20,fontSize:12,alignItems:"center"}}>
            <span style={{color:"#64748b"}}>{selMonth}　{filtered.length}件</span>
            <span><span style={{color:"#64748b"}}>税抜合計: </span><strong style={{color:"#16a34a",fontSize:15}}>{fmt(monthTotal)}</strong></span>
            <span><strong style={{color:"#9333ea",fontSize:15}}>{fmt(monthTotalInc)}</strong><span style={{color:"#64748b"}}>（税込・請求総額）</span></span>
            {incDiff===0
              ? <span style={{fontSize:11,color:"#16a34a",fontWeight:700}}>✅ 端数整合</span>
              : <span style={{fontSize:11,color:"#dc2626",fontWeight:700}}>⚠️ 端数差異 {incDiff>0?"+":""}{incDiff.toLocaleString()}円</span>}
            <button onClick={()=>setShowPwSetting(p=>!p)} style={{...S.btn("#f59e0b",true),fontSize:11}}>🔑 PW設定</button>
            <button onClick={()=>{
              // freee 取引インポートCSV出力
              const [y,m] = selMonth.split("-").map(Number);
              const lastDay = new Date(y, m, 0).getDate();
              const dateStr = `${y}/${String(m).padStart(2,"0")}/${String(lastDay).padStart(2,"0")}`;
              const parsePaymentDue = (cycle, sm) => {
                const [cy, cm] = sm.split("-").map(Number);
                if (/翌々月末日/.test(cycle)) {
                  const nm = cm >= 11 ? cm - 10 : cm + 2;
                  const ny = cm >= 11 ? cy + 1 : cy;
                  return `${ny}年${nm}月${new Date(ny, nm, 0).getDate()}日`;
                }
                if (/翌月末日/.test(cycle)) {
                  const nm = cm === 12 ? 1 : cm + 1;
                  const ny = cm === 12 ? cy + 1 : cy;
                  return `${ny}年${nm}月${new Date(ny, nm, 0).getDate()}日`;
                }
                const m2 = cycle.match(/翌々月(\d+)日/);
                if (m2) {
                  const nm = cm >= 11 ? cm - 10 : cm + 2;
                  const ny = cm >= 11 ? cy + 1 : cy;
                  return `${ny}年${nm}月${m2[1]}日`;
                }
                const m1 = cycle.match(/翌月(\d+)日/);
                if (m1) {
                  const nm = cm === 12 ? 1 : cm + 1;
                  const ny = cm === 12 ? cy + 1 : cy;
                  return `${ny}年${nm}月${m1[1]}日`;
                }
                return "";
              };
              const bom = "\uFEFF";
              const csvCell = v => `"${String(v??'').replace(/"/g,'""')}"`;
              const header = bom+[csvCell("発生日"),csvCell("金額"),csvCell("取引先"),csvCell("案件名"),csvCell("支払情報"),csvCell("摘要")].join(",");
              const transferRows = [];
              const receiptRows = [];
              crossAdjustedFiltered.forEach(g=>{
                const base = g.items.reduce((s,r)=>s+(Number(r.amount)||0)+(Number(r.insuranceAmount)||0),0);
                const autoAdj=(g._autoAdjustments||[]).reduce((s,a)=>s+(Number(a.amount)||0),0);
                const key=`${g.customerId}||${g.projectName}||${g.month}`;
                const manualAdj=getInvData(key,g.month).adjustments.reduce((s,a)=>s+(Number(a.amount)||0),0);
                const incTotCsv=(incidents||[]).filter(x=>!x.separate_invoice&&x.status!=="paid"&&x.customer_id===g.customerId&&x.invoice_month===g.month&&(g.projectName===""||( x.related_project_name||"")===(g.projectName||""))).reduce((t,x)=>t+(x.charge_amount||0),0);
                const grandBase = base + autoAdj + manualAdj + incTotCsv;
                const total = grandBase + Math.round(grandBase*0.1);
                const projectName = g.projectName || "";
                if (g._isReceiptGroup) {
                  const ri = g.items.find(r=>r.issueReceipt&&r.receiptDate);
                  const rd = ri ? new Date(ri.receiptDate+"T00:00:00") : null;
                  const pm = ri?.paymentMethod==="cash"?"現金":ri?.paymentMethod==="square"?"スクエア クレジット":"ECクレジット";
                  const paymentInfo = rd ? `${rd.getFullYear()}年${rd.getMonth()+1}月${rd.getDate()}日 ${pm}領収済` : "";
                  receiptRows.push([csvCell(dateStr),csvCell(total),csvCell(g.customerName),csvCell(projectName),csvCell(paymentInfo),csvCell(pm)].join(","));
                } else {
                  const cycle = g.customer?.paymentCycle || customers.find(c=>c.id===g.customerId)?.paymentCycle || "";
                  const paymentInfo = parsePaymentDue(cycle, selMonth);
                  transferRows.push([csvCell(dateStr),csvCell(total),csvCell(g.customerName),csvCell(projectName),csvCell(paymentInfo),csvCell(cycle)].join(","));
                }
              });
              const allRows = [header, ...transferRows];
              if (receiptRows.length > 0) { allRows.push(""); allRows.push(...receiptRows); }
              const blob = new Blob([allRows.join("\r\n")], {type:"text/csv;charset=utf-8"});
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob); a.download = `freee_取引_${selMonth}.csv`;
              a.click();
            }} style={{...S.btn("#0ea5e9",true),fontSize:11,marginLeft:"auto"}}>📤 freee CSV</button>
            <button onClick={triggerPrintCountReset} style={{...S.btn("#dc2626",true),fontSize:11}}>🗑 発行履歴リセット</button>
          </div>
        )}

        {/* 月またぎ案件セクション */}
        {(()=>{
          if(!selMonth) return null;
          const [sy,sm]=selMonth.split("-").map(Number);
          const lastDayNum=new Date(sy,sm,0).getDate();
          const monthEnd=`${sy}-${String(sm).padStart(2,'0')}-${String(lastDayNum).padStart(2,'0')}`;
          const crossRecords=(records||[]).filter(r=>{
            if(!r.startDate||!r.endDate||r.billingType==="monthly") return false;
            const rs=r.startDate.slice(0,7),re=r.endDate.slice(0,7);
            return rs!==re&&(rs===selMonth||re===selMonth||(rs<selMonth&&re>selMonth));
          });
          if(crossRecords.length===0) return null;
          const getStatus=r=>{const sp=crossMonthSplits[r.id];if(!sp)return'pending';if(sp.type==='full')return'done';return'splitting';};
          const getMonths=r=>{const ms=[];let m=r.startDate.slice(0,7);const end=r.endDate.slice(0,7);while(m<=end){ms.push(m);const [y,mo]=m.split('-').map(Number);m=mo===12?`${y+1}-01`:`${y}-${String(mo+1).padStart(2,'0')}`;}return ms;};
          const computeSplitAmt=(r,spItem)=>{if(!spItem.startDate||!spItem.endDate)return 0;const d=calcDays(spItem.startDate,spItem.endDate);const rLines=(r.lines&&r.lines.length)?r.lines:[{unitPrice:r.unitPrice,quantity:r.quantity||1,productId:r.productId}];return rLines.reduce((s,ln)=>{const prod=(products||[]).find(p=>p.id===ln.productId);const billDays=prod?.noBillingDiscount?d:calcBillingDays(d);return s+Math.round((ln.unitPrice||0)*(ln.quantity||1)*billDays);},0);};
          const addDay=dateStr=>{const d=new Date(dateStr);d.setDate(d.getDate()+1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
          const pendingCount=crossRecords.filter(r=>getStatus(r)==='pending').length;
          const doneCount=crossRecords.filter(r=>getStatus(r)!=='pending').length;
          return(
            <div style={{background:"#fff",border:"1.5px solid #f59e0b",borderRadius:10,padding:"12px 16px",marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",marginBottom:10}}>
                <span style={{fontSize:13,fontWeight:700,color:"#92400e"}}>⚠ 月またぎ案件（{crossRecords.length}件）</span>
                <span style={{fontSize:11,color:"#92400e",marginLeft:"auto"}}>未処理 {pendingCount}件　処理済 {doneCount}件</span>
              </div>
              {crossRecords.map(r=>{
                const c=customers.find(x=>x.id===r.customerId);
                const status=getStatus(r);
                const sp=crossMonthSplits[r.id];
                const totalAmt=r.amount||0;
                const months=getMonths(r);
                const cardStyle=status==='done'?{background:"#dcfce7",border:"1px solid #86efac"}:status==='splitting'?{background:"#dbeafe",border:"1px solid #93c5fd"}:{background:"#fffbeb",border:"1px solid #fde68a"};
                const badge=status==='done'?{label:"処理済",bg:"#16a34a"}:status==='splitting'?{label:"分割中",bg:"#2563eb"}:{label:"未処理",bg:"#f59e0b"};
                const splits=sp?.splits||[{startDate:r.startDate,endDate:monthEnd}];
                const usedAmt=splits.slice(0,-1).reduce((s,spItem)=>s+computeSplitAmt(r,spItem),0);
                const lastAmt=totalAmt-usedAmt;
                return(
                  <div key={r.id} style={{borderRadius:8,padding:"10px 12px",marginBottom:8,...cardStyle}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                      <span style={{fontSize:10,padding:"2px 6px",borderRadius:3,background:badge.bg,color:"#fff"}}>{badge.label}</span>
                      <span style={{fontWeight:600,fontSize:12}}>{c?.name||"不明"}</span>
                      <span style={{fontSize:11,color:"#64748b"}}>{r.projectName||""}</span>
                      <span style={{fontSize:11,color:"#64748b"}}>{r.startDate}〜{r.endDate}</span>
                      <span style={{fontSize:12,fontWeight:700,marginLeft:"auto"}}>合計 {fmt(totalAmt)}</span>
                    </div>
                    {(()=>{
                      const rLines=(r.lines&&r.lines.length)?r.lines:(r.equipmentName?[{equipmentName:r.equipmentName,quantity:r.quantity||1,amount:r.amount}]:[]);
                      return rLines.length>0&&(
                        <div style={{background:"rgba(255,255,255,0.7)",borderRadius:4,padding:"6px 8px",marginBottom:8,fontSize:11}}>
                          {rLines.map((ln,i)=>(
                            <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"2px 0",borderBottom:i<rLines.length-1?"1px solid rgba(0,0,0,0.06)":"none"}}>
                              <span>{ln.equipmentName||"―"}{(ln.quantity||1)>1?` ×${ln.quantity}`:""}</span>
                              <span style={{color:"#64748b"}}>{ln.amount?fmt(ln.amount):""}</span>
                            </div>
                          ))}
                          <div style={{marginTop:6,paddingTop:4,borderTop:"1px solid rgba(0,0,0,0.06)"}}>
                            <button onClick={()=>{const g={customerId:r.customerId,customer:c,customerName:c?.name||"",projectName:r.projectName||"",month:r.startDate?.slice(0,7)||"",items:[r],split:true,consolidate:false};downloadPrintHTML(r.issueReceipt?"delivery-receipt":"delivery",g);}} style={{background:"none",border:"none",color:"#2563eb",fontSize:11,cursor:"pointer",padding:0,textDecoration:"underline"}}>→ 納品書を開く</button>
                          </div>
                        </div>
                      );
                    })()}
                    {status==='done'&&<div style={{fontSize:11,color:"#15803d",fontWeight:500,marginBottom:6}}>✓ {sp.targetMonth?.slice(5)}月に全額計上</div>}
                    {status==='splitting'&&(
                      <div style={{marginBottom:6}}>
                        {splits.map((spItem,si)=>{
                          const isLast=si===splits.length-1;
                          const d=spItem.startDate&&spItem.endDate?calcDays(spItem.startDate,spItem.endDate):0;
                          const spAmt=isLast?lastAmt:computeSplitAmt(r,spItem);
                          const isSet=!!(spItem.startDate&&spItem.endDate);
                          return(
                            <div key={si} style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,fontSize:11}}>
                              <span style={{minWidth:44,fontWeight:500,color:"#475569"}}>{spItem.startDate?spItem.startDate.slice(0,7).slice(5)+"月":""}</span>
                              <input type="date" value={spItem.startDate||""} disabled={si===0} onChange={e=>setCrossMonthSplits(prev=>{const ns={...prev[r.id],splits:[...prev[r.id].splits]};ns.splits[si]={...ns.splits[si],startDate:e.target.value};return {...prev,[r.id]:ns};})} style={{border:"1px solid #e2e8f0",borderRadius:4,padding:"2px 4px",fontSize:11,width:110}}/>
                              <span>〜</span>
                              <input type="date" value={spItem.endDate||""} disabled={isLast} onChange={e=>{const nd=addDay(e.target.value);setCrossMonthSplits(prev=>{const ns={...prev[r.id],splits:[...prev[r.id].splits]};ns.splits[si]={...ns.splits[si],endDate:e.target.value};if(ns.splits[si+1])ns.splits[si+1]={...ns.splits[si+1],startDate:nd};const newUsed=ns.splits.slice(0,-1).reduce((s,sp2)=>s+computeSplitAmt(r,{...sp2,endDate:sp2.endDate||""}),0);if(newUsed>=(r.amount||0)){alert('非最終月の合計が案件登録金額を超えています。期間を短くしてください。');return prev;}return {...prev,[r.id]:ns};});}} style={{border:"1px solid #e2e8f0",borderRadius:4,padding:"2px 4px",fontSize:11,width:110}}/>
                              <span style={{minWidth:64,textAlign:"right"}}>{fmt(spAmt)}</span>
                              <span style={{fontSize:10,padding:"1px 5px",borderRadius:3,background:isSet?"#dcfce7":"#fee2e2",color:isSet?"#15803d":"#dc2626"}}>{(()=>{if(!isSet)return"未設定";const rLines=(r.lines&&r.lines.length)?r.lines:[{productId:r.productId}];const hasNoBilling=rLines.some(ln=>(products||[]).find(p=>p.id===ln.productId)?.noBillingDiscount);return hasNoBilling?`${d}日間請求`:`${d}日→${calcBillingDays(d)}請求日`;})()}</span>
                              {isLast&&<span style={{fontSize:10,color:"#94a3b8"}}>（帳尻）</span>}
                              {!isLast&&si>0&&<button onClick={()=>setCrossMonthSplits(prev=>{const ns={...prev[r.id],splits:[...prev[r.id].splits]};ns.splits.splice(si,1);return {...prev,[r.id]:ns};})} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:12}}>✕</button>}
                            </div>
                          );
                        })}
                        <div style={{fontSize:11,marginTop:4,color:Math.abs(usedAmt+lastAmt-totalAmt)<1?"#15803d":"#dc2626"}}>
                          合計チェック：{fmt(totalAmt)} {Math.abs(usedAmt+lastAmt-totalAmt)<1?"✓ 納品書と一致":"✗ 不一致"}
                        </div>
                      </div>
                    )}
                    <div style={{display:"flex",gap:8,alignItems:"center",marginTop:6,flexWrap:"wrap"}}>
                      {status==='pending'&&<>
                        {months.map(m=>(
                          <button key={m} onClick={()=>setCrossMonthSplits(prev=>({...prev,[r.id]:{type:'full',targetMonth:m}}))}
                            style={{fontSize:11,background:m===selMonth?"#16a34a":"#4f46e5",color:"#fff",border:"none",borderRadius:4,padding:"3px 10px",cursor:"pointer"}}>
                            ✓ {m.slice(5)}月に全額計上
                          </button>
                        ))}
                        <button onClick={()=>setCrossMonthSplits(prev=>({...prev,[r.id]:{type:'split',splits:[{startDate:r.startDate,endDate:monthEnd},{startDate:addDay(monthEnd),endDate:r.endDate}]}}))}
                          style={{fontSize:11,background:"#e0f2fe",color:"#0369a1",border:"1px solid #7dd3fc",borderRadius:4,padding:"3px 10px",cursor:"pointer"}}>
                          期間を分割して計上
                        </button>
                      </>}
                      {status==='splitting'&&<button onClick={()=>{const s=[...splits];const prev2=s[s.length-2];const nextStart=prev2?.endDate?addDay(prev2.endDate):"";s.splice(s.length-1,0,{startDate:nextStart,endDate:""});setCrossMonthSplits(prev=>({...prev,[r.id]:{...prev[r.id],splits:s}}));}} style={{fontSize:11,color:"#0369a1",background:"none",border:"none",cursor:"pointer",padding:"2px 0"}}>+ 分割を追加</button>}
                      {status!=='pending'&&<button onClick={()=>setCrossMonthSplits(prev=>{const p={...prev};delete p[r.id];return p;})} style={{fontSize:11,color:"#64748b",background:"none",border:"none",cursor:"pointer",textDecoration:"underline"}}>リセット</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* テーブル */}
        <div style={S.card}>
          {filtered.length===0
            ?<div style={{padding:48,textAlign:"center",color:"#94a3b8"}}>
              {selMonth?"この月の請求データがありません":"案件を登録すると表示されます"}
            </div>
            :<table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5}}>
              <thead>
                <tr style={{background:"#f8fafc",borderBottom:"2px solid #e2e8f0"}}>
                  <th style={{padding:"8px 12px",textAlign:"left",fontWeight:700,color:"#475569",width:20}}></th>
                  <th style={{padding:"8px 12px",textAlign:"left",fontWeight:700,color:"#475569"}}>顧客</th>
                  <th style={{padding:"8px 12px",textAlign:"left",fontWeight:700,color:"#475569"}}>案件名</th>
                  <th style={{padding:"8px 12px",textAlign:"center",fontWeight:700,color:"#475569",width:40}}>件数</th>
                  <th style={{padding:"8px 12px",textAlign:"right",fontWeight:700,color:"#475569"}}>税抜</th>
                  <th style={{padding:"8px 12px",textAlign:"right",fontWeight:700,color:"#475569"}}>税込</th>
                  <th style={{padding:"8px 12px",textAlign:"center",fontWeight:700,color:"#475569",width:90}}>状態</th>
                  <th style={{padding:"8px 12px",width:80}}></th>
                </tr>
              </thead>
              <tbody>
                {(()=>{
                  const custGroups={};
                  crossAdjustedFiltered.forEach(g=>{
                    if(!custGroups[g.customerId]) custGroups[g.customerId]={customerName:g.customerName,customerId:g.customerId,groups:[]};
                    custGroups[g.customerId].groups.push(g);
                  });
                  const custList=Object.values(custGroups).sort((a,b)=>a.customerName.localeCompare(b.customerName,"ja"));
                  return custList.map(cust=>{
                    const custKey=`cust_${cust.customerId}`;
                    const custOpen=!!expanded[custKey];
                    const custTotEx=cust.groups.reduce((s,g)=>{
                      const d=getInvData(`${g.customerId}||${g.projectName}||${g.month}`,g.month);
                      const base=g.items.reduce((t,r)=>t+(r.amount||0)+(r.insuranceAmount||0),0);
                      const adj=d.adjustments.reduce((t,a)=>t+(Number(a.amount)||0),0);
                      const inc=(incidents||[]).filter(x=>!x.separate_invoice&&x.status!=="paid"&&x.customer_id===g.customerId&&x.invoice_month===g.month&&(g.projectName===""||( x.related_project_name||"")===(g.projectName||""))).reduce((t,x)=>t+(x.charge_amount||0),0);
                      return s+base+adj+inc;
                    },0);
                    const custTotInc=cust.groups.reduce((s,g)=>{
                      const d=getInvData(`${g.customerId}||${g.projectName}||${g.month}`,g.month);
                      const base=g.items.reduce((t,r)=>t+(r.amount||0)+(r.insuranceAmount||0),0);
                      const adj=d.adjustments.reduce((t,a)=>t+(Number(a.amount)||0),0);
                      const inc=(incidents||[]).filter(x=>!x.separate_invoice&&x.status!=="paid"&&x.customer_id===g.customerId&&x.invoice_month===g.month&&(g.projectName===""||( x.related_project_name||"")===(g.projectName||""))).reduce((t,x)=>t+(x.charge_amount||0),0);
                      const gt=base+adj+inc;
                      return s+gt+Math.round(gt*0.1);
                    },0);
                    const custTax=Math.round(custTotEx*0.1);
                    return(
                      <React.Fragment key={cust.customerId}>
                        {/* 層1: 顧客行 */}
                        <tr onClick={()=>toggleExpand(custKey)} style={{background:"#f1f5f9",cursor:"pointer",borderBottom:"1px solid #e2e8f0"}}>
                          <td style={{padding:"8px 12px",textAlign:"center",color:"#94a3b8",fontSize:11}}>{custOpen?"▼":"▶"}</td>
                          <td colSpan={2} style={{padding:"8px 12px",fontWeight:700,fontSize:13}}>{cust.customerName}</td>
                          <td style={{padding:"8px 12px",textAlign:"center",color:"#64748b"}}>{cust.groups.length}</td>
                          <td style={{padding:"8px 12px",textAlign:"right",fontWeight:700,color:"#16a34a"}}>{fmt(custTotEx)}</td>
                          <td style={{padding:"8px 12px",textAlign:"right",color:"#9333ea"}}>{fmt(custTotInc)}</td>
                          <td colSpan={2} style={{padding:"8px 8px",textAlign:"center"}} onClick={e=>e.stopPropagation()}>
                            {(()=>{
                              const total=cust.groups.length;
                              const issued=cust.groups.filter(g=>{const d=getInvData(`${g.customerId}||${g.projectName}||${g.month}`,g.month);return (d.printCount||0)>0||g.items.some(r=>r.issueReceipt);}).length;
                              if(issued===0) return null;
                              if(issued===total) return <span style={{fontSize:10,color:"#16a34a",fontWeight:700,whiteSpace:"nowrap"}}>✅ 全件発行済</span>;
                              return <span style={{fontSize:10,color:"#0369a1",fontWeight:700,whiteSpace:"nowrap"}}>{total}件中{issued}件発行済 残{total-issued}件</span>;
                            })()}
                            {cust.groups.length>1&&custOpen&&(
                              <div style={{display:"flex",gap:4,justifyContent:"center",marginTop:4}}>
                                <button onClick={async()=>{
                                  let allBody="";let lastCss="";
                                  for(let gi=0;gi<cust.groups.length;gi++){
                                    const grp=cust.groups[gi];
                                    const gkey=grp.customerId+"||"+grp.projectName+"||"+grp.month;
                                    const cur=getInvData(gkey);
                                    const invNo=cur.invNo||(grp.month?(grp.month+"-???"):"");
                                    const grpSnap = cur.status==="locked" && cur.snapshot && cur.snapshot.items;
                                    const printGrp = grpSnap ? {...grp, items:cur.snapshot.items, projectName:cur.snapshot.projectName??grp.projectName, adjustments:cur.snapshot.adjustments||cur.adjustments} : {...grp, adjustments:cur.adjustments};
                                    const r=downloadPrintHTML("invoice",Object.assign({},printGrp,{invNo:invNo,issueDate:cur.issueDate||""}),products,0,incidents,records,true);
                                    if(r&&r.body){
                                      let b=gi<cust.groups.length-1?r.body.replace(/class="pb-last"/g,'class="pb"'):r.body;
                                      b=b.replace('padding:0px 34px 28px 34px','padding:52px 34px 28px 34px');
                                      allBody+=b;lastCss=r.css;
                                    }
                                  }
                                  if(!allBody) return;
                                  const mtitle="ご請求書一括_"+cust.customerName+"御中_"+((cust.groups[0]&&cust.groups[0].month)||"");
                                  const bCss1=lastCss.replace('@page{margin:0mm;size:A4}','@page{margin:52px 0 0 0;size:A4}');
                                  const nt=window.open("","_blank");
                                  nt.document.write("<!DOCTYPE html><html lang='ja'><head><meta charset='utf-8'><title>"+mtitle+"</title><style>"+bCss1+"\n@media print{.no-print{display:none!important}body{margin:0}}</style></head><body>");
                                  nt.document.write("<div class='no-print' style='position:fixed;top:0;left:0;right:0;background:#1e293b;color:#fff;padding:10px 20px;display:flex;align-items:center;gap:12px;z-index:9999;font-family:sans-serif;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,.3)'><span style='font-weight:700;flex:1'>"+mtitle+"</span><button onclick='window.print()' style='background:#2563eb;color:#fff;border:none;border-radius:6px;padding:7px 20px;font-size:14px;font-weight:700;cursor:pointer'>🖨 印刷 / PDF保存</button><button onclick='window.close()' style='background:none;border:1px solid rgba(255,255,255,0.3);color:#fff;border-radius:6px;padding:7px 14px;font-size:13px;cursor:pointer'>✕ 閉じる</button></div>");
                                  nt.document.write("<div>"+allBody+"</div></body></html>");
                                  nt.document.close();
                                }} style={{...S.ib("#94a3b8"),fontSize:10,padding:"2px 6px"}}>
                                  <Ico d={I.print} size={10}/>一括確認
                                </button>
                                <button onClick={async()=>{
                                  let allBody="";let lastCss="";
                                  for(let gi=0;gi<cust.groups.length;gi++){
                                    const grp=cust.groups[gi];
                                    const gkey=grp.customerId+"||"+grp.projectName+"||"+grp.month;
                                    const cur=getInvData(gkey);
                                    let baseNo=cur.invNo;let count;
                                    if(!baseNo){baseNo=await nextInvoiceNo(grp.month);count=1;}
                                    else{count=(cur.printCount||1)+1;}
                                    await updateInvData(gkey,{invNo:baseNo,printCount:count,lastPrintDate:new Date().toISOString()});
                                    const invNo=count<=1?baseNo:(baseNo+"-"+count);
                                    const grpSnap2 = cur.status==="locked" && cur.snapshot && cur.snapshot.items;
                                    const printGrp2 = grpSnap2 ? {...grp, items:cur.snapshot.items, projectName:cur.snapshot.projectName??grp.projectName, adjustments:cur.snapshot.adjustments||cur.adjustments} : {...grp, adjustments:cur.adjustments};
                                    const r=downloadPrintHTML("invoice",Object.assign({},printGrp2,{invNo:invNo,issueDate:cur.issueDate||""}),products,0,incidents,records,true);
                                    if(r&&r.body){
                                      let b=gi<cust.groups.length-1?r.body.replace(/class="pb-last"/g,'class="pb"'):r.body;
                                      b=b.replace('padding:0px 34px 28px 34px','padding:52px 34px 28px 34px');
                                      allBody+=b;lastCss=r.css;
                                    }
                                  }
                                  if(!allBody) return;
                                  const mtitle="ご請求書一括_"+cust.customerName+"御中_"+((cust.groups[0]&&cust.groups[0].month)||"");
                                  const bCss2=lastCss.replace('@page{margin:0mm;size:A4}','@page{margin:52px 0 0 0;size:A4}');
                                  const nt=window.open("","_blank");
                                  nt.document.write("<!DOCTYPE html><html lang='ja'><head><meta charset='utf-8'><title>"+mtitle+"</title><style>"+bCss2+"\n@media print{.no-print{display:none!important}body{margin:0}}</style></head><body>");
                                  nt.document.write("<div class='no-print' style='position:fixed;top:0;left:0;right:0;background:#1e293b;color:#fff;padding:10px 20px;display:flex;align-items:center;gap:12px;z-index:9999;font-family:sans-serif;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,.3)'><span style='font-weight:700;flex:1'>"+mtitle+"</span><button onclick='window.print()' style='background:#2563eb;color:#fff;border:none;border-radius:6px;padding:7px 20px;font-size:14px;font-weight:700;cursor:pointer'>🖨 印刷 / PDF保存</button><button onclick='window.close()' style='background:none;border:1px solid rgba(255,255,255,0.3);color:#fff;border-radius:6px;padding:7px 14px;font-size:13px;cursor:pointer'>✕ 閉じる</button></div>");
                                  nt.document.write("<div>"+allBody+"</div></body></html>");
                                  nt.document.close();
                                }} style={{...S.ib("#1d4ed8"),fontSize:10,padding:"2px 6px"}}>
                                  🖨一括印刷
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                        {/* 層2: 案件行 */}
                        {custOpen&&cust.groups.map(g=>{
                          const key=`${g.customerId}||${g.projectName}||${g.month}`;
                          const d=getInvData(key,g.month);
                          const locked=d.status==="locked";
                          // 締め済みならsnapshotの明細・金額を使う（案件名変更や再計算からの保護）
                          const useSnapshot = locked && d.snapshot && d.snapshot.items;
                          const displayItems = useSnapshot ? d.snapshot.items : g.items;
                          const displayProjectName = useSnapshot ? (d.snapshot.projectName ?? g.projectName) : g.projectName;
                          const gInc = useSnapshot
                            ? (d.snapshot.incidents||[])
                            : (incidents||[]).filter(x=>!x.separate_invoice&&x.customer_id===g.customerId&&x.invoice_month===g.month&&(g.projectName===""||( x.related_project_name||"")===(g.projectName||"")));
                          const incTot = useSnapshot
                            ? gInc.reduce((s,x)=>s+(x.charge_amount||0),0)
                            : gInc.filter(x=>x.status!=="paid").reduce((s,x)=>s+(x.charge_amount||0),0);
                          const baseTot=displayItems.reduce((s,r)=>s+(r.amount||0)+(r.insuranceAmount||0),0)+incTot;
                          const autoAdjTot = useSnapshot ? 0 : (g._autoAdjustments||[]).reduce((s,a)=>s+(Number(a.amount)||0),0);
                          const adjSum = useSnapshot ? (d.snapshot.adjustments||[]).reduce((s,a)=>s+(Number(a.amount)||0),0) : d.adjustments.reduce((s,a)=>s+(Number(a.amount)||0),0);
                          const grandTot=baseTot+autoAdjTot+adjSum;
                          const tax=Math.round(grandTot*0.1);
                          const isOpen=!!expanded[key];
                          const checkIssues = g.items.filter(r => {
                            if (!r.lines || !r.lines.length) return false;
                            const expected = calcExpectedAmount(r, records);
                            if (expected === null) return false;
                            return Math.abs(expected - (r.amount||0)) > 10;
                          });
                          return(
                            <React.Fragment key={key}>
                              <tr onClick={()=>toggleExpand(key)} style={{
                                borderBottom:isOpen?"none":"1px solid #f1f5f9",
                                background:locked?"#f0fdf4":"#f8fafc",
                                cursor:"pointer",transition:"background .15s"
                              }}
                                onMouseEnter={e=>e.currentTarget.style.background=locked?"#dcfce7":"#e8f4ff"}
                                onMouseLeave={e=>e.currentTarget.style.background=locked?"#f0fdf4":"#f8fafc"}
                              >
                                <td style={{padding:"8px 12px",textAlign:"center",color:"#94a3b8",fontSize:11,paddingLeft:28}}>{isOpen?"▼":"▶"}</td>
                                <td style={{padding:"8px 12px",paddingLeft:28,color:"#64748b",fontSize:11}}>
                                  {displayProjectName
                                    ?<span style={{background:"#eff6ff",color:"#1d4ed8",borderRadius:4,padding:"1px 6px",fontSize:11,fontWeight:600}}>{displayProjectName}</span>
                                    :<span style={{color:"#cbd5e1"}}>案件名なし</span>
                                  }
                                  {useSnapshot&&<span style={{marginLeft:6,fontSize:10,color:"#15803d",background:"#dcfce7",borderRadius:3,padding:"1px 5px"}}>凍結</span>}
                                  {d.adjustments.length>0&&<span style={{marginLeft:6,fontSize:10,color:"#92400e"}}>調整あり</span>}
                                  {checkIssues.length > 0 && (
                                    <span style={{marginLeft:6,fontSize:10,background:"#fef2f2",color:"#dc2626",border:"1px solid #fca5a5",borderRadius:3,padding:"1px 5px",fontWeight:700}}>⚠️ {checkIssues.length}件要確認</span>
                                  )}
                                </td>
                                <td></td>
                                <td style={{padding:"8px 12px",textAlign:"center",color:"#64748b"}}>{displayItems.length}</td>
                                <td style={{padding:"8px 12px",textAlign:"right",fontWeight:700,color:"#16a34a"}}>{fmt(grandTot)}</td>
                                <td style={{padding:"8px 12px",textAlign:"right",color:"#9333ea"}}>{fmt(grandTot+tax)}</td>
                                <td style={{padding:"8px 12px",textAlign:"center"}} onClick={e=>toggleLock(key,e)}>
                                  <span style={{
                                    background:locked?"#dcfce7":"#f1f5f9",
                                    color:locked?"#15803d":"#64748b",
                                    border:`1px solid ${locked?"#86efac":"#e2e8f0"}`,
                                    borderRadius:5,padding:"2px 8px",fontSize:10,fontWeight:700,
                                    cursor:"pointer",whiteSpace:"nowrap"
                                  }}>{locked?"✅ 締め済み":"未締め"}</span>
                                {(()=>{const ri=displayItems.find(r=>r.issueReceipt&&r.receiptDate);if(!ri)return null;const rd=new Date(ri.receiptDate+"T00:00:00");return <span style={{display:"block",fontSize:10,color:"#0369a1",fontWeight:700,marginTop:2,whiteSpace:"nowrap"}}>{(rd.getMonth()+1)}月{rd.getDate()}日 領収済　{ri.paymentMethod==="cash"?"現金":ri.paymentMethod==="square"?"スクエア クレジット":"ECクレジット"}</span>;})()}
                                {(()=>{
                                  const pc=getInvData(key)?.printCount||0;
                                  const pi=getInvData(key)?.lastPrintDate||"";
                                  if(!pc||!pi) return null;
                                  const d=new Date(pi);
                                  const ds=`${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
                                  return <span style={{fontSize:9,color:"#16a34a",marginLeft:4,whiteSpace:"nowrap"}}>{ds} {pc}回目発行済</span>;
                                })()}
                              </td>
                                <td style={{padding:"8px 8px",whiteSpace:"nowrap"}} onClick={e=>e.stopPropagation()}>
                                  <button onClick={async()=>{
                                    const cur=getInvData(key);
                                    const invNo=cur.invNo||(g.month?`${g.month}-???`:"");
                                    const printG = useSnapshot ? {...g, items:displayItems, projectName:displayProjectName, adjustments:cur.snapshot?.adjustments||cur.adjustments} : {...g, adjustments:cur.adjustments};
                                    downloadPrintHTML("invoice",{...printG,invNo,issueDate:cur.issueDate||""},products,0,incidents,records);
                                  }} style={{...S.ib("#94a3b8"),fontSize:10,padding:"2px 6px",marginRight:3}}>
                                    <Ico d={I.print} size={10}/>確認
                                  </button>
                                  <button onClick={async()=>{
                                    const cur=getInvData(key);
                                    let baseNo=cur.invNo;
                                    let count;
                                    if(!baseNo){
                                      baseNo=await nextInvoiceNo(g.month);
                                      count=1;
                                    } else {
                                      count=(cur.printCount||1)+1;
                                    }
                                    await updateInvData(key,{invNo:baseNo,printCount:count,lastPrintDate:new Date().toISOString()});
                                    const invNo=count<=1?baseNo:`${baseNo}-${count}`;
                                    const printG = useSnapshot ? {...g, items:displayItems, projectName:displayProjectName, adjustments:cur.snapshot?.adjustments||cur.adjustments} : {...g, adjustments:cur.adjustments};
                                    downloadPrintHTML("invoice",{...printG,invNo,issueDate:cur.issueDate||""},products,0,incidents,records);
                                  }} style={{...S.ib("#1d4ed8"),fontSize:10,padding:"2px 6px"}}>
                                    🖨
                                  </button>
                                </td>
                              </tr>
                              {/* 層3: 詳細行 */}
                              {isOpen&&(
                                <tr>
                                  <td colSpan={8} style={{padding:0,borderBottom:"1px solid #e2e8f0"}}>
                                    <div style={{background:"#f8fafc",padding:"12px 16px 12px 48px"}}>
                                      {/* 発行日 */}
                                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                                        <span style={{fontSize:11,color:"#64748b",whiteSpace:"nowrap"}}>発行日：</span>
                                        <input type="date" value={d.issueDate||""} onChange={e=>updateInvData(key,{issueDate:e.target.value})}
                                          style={{...S.inp,width:140,fontSize:11,padding:"3px 8px"}} disabled={locked}/>
                                        <span style={{fontSize:10,color:"#94a3b8"}}>（デフォルト: 月末日）</span>
                                      </div>
                                      {/* 案件リスト */}
                                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,marginBottom:8}}>
                                        <thead>
                                          <tr style={{color:"#94a3b8",borderBottom:"1px solid #e2e8f0"}}>
                                            <th style={{padding:"3px 8px",textAlign:"left",fontWeight:600,width:90}}>伝票No.</th>
                                            <th style={{padding:"3px 8px",textAlign:"left",fontWeight:600}}>機材</th>
                                            <th style={{padding:"3px 8px",textAlign:"left",fontWeight:600}}>利用期間</th>
                                            <th style={{padding:"3px 8px",textAlign:"center",fontWeight:600,width:50}}>日数</th>
                                            <th style={{padding:"3px 8px",textAlign:"right",fontWeight:600,width:80}}>金額（税抜）</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {(()=>{const _bNo=dn=>(dn||"").replace(/E\d+.*$/,"");const chainEndMap={};displayItems.forEach(r=>{const bk=_bNo(r.deliveryNo);if(!bk)return;const re=r.returnDate||r.endDate||"";if(!chainEndMap[bk]||re>chainEndMap[bk])chainEndMap[bk]=re;});const gKey=r=>{const bk=_bNo(r.deliveryNo);return(bk&&chainEndMap[bk])||(r.returnDate||r.endDate||"");};const sorted=[...displayItems].sort((a,b)=>{const aM=a.billingType==="monthly"?0:1;const bM=b.billingType==="monthly"?0:1;if(aM!==bM)return aM-bM;const kc=gKey(a).localeCompare(gKey(b));if(kc!==0)return kc;return(a.isExtension?1:0)-(b.isExtension?1:0);});const lastMIdx=sorted.reduce((acc,r,i)=>r.billingType==="monthly"?i:acc,-1);const hasBoth=lastMIdx>=0&&sorted.some(r=>r.billingType!=="monthly");return buildChainBlocks(sorted).map((block, bi) => {
                                            if (block.type === "chain") {
                                              const { header: h, segments } = block;
                                              return (
                                                <React.Fragment key={"chain-"+bi}>
                                                  <tr style={{borderBottom:"1px solid #e2e8f0",background:"#f0f7ff"}}>
                                                    <td style={{padding:"4px 8px",color:"#94a3b8",fontSize:10,whiteSpace:"nowrap"}}>{(segments[0].deliveryNo||"").replace(/E\d+.*$/,"")}</td>
                                                    <td style={{padding:"4px 8px",color:"#1e40af",fontWeight:600}}>{h.equipNames.join("、")}</td>
                                                    <td style={{padding:"4px 8px",color:"#64748b",whiteSpace:"nowrap"}}>
                                                      {fmtD(h.chainStart)}〜{fmtD(h.chainEnd)}<span style={{color:"#94a3b8",fontSize:10,marginLeft:4}}>（暦{h.chainCalDays}日 → 請求{h.chainBillDays}日）</span>
                                                    </td>
                                                    <td style={{padding:"4px 8px",textAlign:"center",color:"#94a3b8",fontSize:10}}>―</td>
                                                    <td style={{padding:"4px 8px",textAlign:"right",fontWeight:600,color:"#16a34a"}}>{fmt(h.chainAmount)}</td>
                                                  </tr>
                                                  {segments.map(r => (
                                                    <tr key={r.id} style={{borderBottom:"1px solid #f1f5f9"}}>
                                                      <td style={{padding:"4px 8px",color:"#94a3b8",fontSize:10,whiteSpace:"nowrap"}}>{r.deliveryNo||"―"}</td>
                                                      <td style={{padding:"2px 8px 2px 20px",color:"#475569"}}>
                                                        <span style={{color:"#94a3b8",marginRight:4,fontSize:10}}>└</span>
                                                        <span style={{color:r.isExtension?"#2563eb":"#475569"}}>{r.isExtension?"延長分":"初回分"}</span>
                                                        {r.projectDetail&&<span style={{color:"#94a3b8",marginLeft:4}}>({r.projectDetail})</span>}
                                                        {r.ecOrderNo&&<span style={{color:"#0369a1",marginLeft:4,fontSize:10}}>EC:{r.ecOrderNo}</span>}
                                                      </td>
                                                      <td style={{padding:"2px 8px 2px 16px",color:"#64748b",whiteSpace:"nowrap"}}>
                                                        {fmtD(r.startDate)}〜{fmtD(r.endDate)}<span style={{color:"#94a3b8",fontSize:10,marginLeft:4}}>（{r.days||0}日）</span>
                                                      </td>
                                                      <td style={{padding:"4px 8px",textAlign:"center",color:"#64748b",fontSize:10}}>{r.days||0}</td>
                                                      <td style={{padding:"4px 8px",textAlign:"right",color:"#64748b"}}>{fmt((r.amount||0)+(r.insuranceAmount||0))}</td>
                                                    </tr>
                                                  ))}
                                                </React.Fragment>
                                              );
                                            }
                                            const r = block.record;
                                            const idx = sorted.indexOf(r);
                                            return (
                                              <React.Fragment key={r.id}>
                                                <tr style={{borderBottom:"1px solid #f1f5f9"}}>
                                                  <td style={{padding:"4px 8px",color:"#94a3b8",fontSize:10,whiteSpace:"nowrap"}}>{r.deliveryNo||"―"}</td>
                                                  <td style={{padding:"4px 8px",color:"#475569"}}>
                                                    {r.isExtension
                                                      ?<span style={{color:"#2563eb"}}>
                                                          {r.equipmentName||(r.lines||[]).map(l=>l.equipmentName).filter(Boolean).join("、")||""}
                                                          {<span style={{fontSize:10,marginLeft:2}}>（延長分）</span>}
                                                          {r.extendedFromNo&&<span style={{fontSize:10,color:"#94a3b8",marginLeft:4}}>（元No.{r.extendedFromNo}）</span>}
                                                        </span>
                                                      :r.equipmentName}
                                                    {r.projectDetail&&<span style={{color:"#94a3b8",marginLeft:4}}>({r.projectDetail})</span>}
                                                    {r.ecOrderNo&&<span style={{color:"#0369a1",marginLeft:4,fontSize:10}}>EC:{r.ecOrderNo}</span>}
                                                  </td>
                                                  <td style={{padding:"4px 8px",color:"#64748b",whiteSpace:"nowrap"}}>{fmtD(r.startDate)}〜{fmtD(r.endDate)}</td>
                                                  <td style={{padding:"4px 8px",textAlign:"center",color:"#64748b"}}>
                                                    {r.billingType==="monthly"?(r.months||1)+"ヶ月":(r.days||0)}
                                                  </td>
                                                  <td style={{padding:"4px 8px",textAlign:"right",fontWeight:600,color:"#16a34a"}}>{fmt((r.amount||0)+(r.insuranceAmount||0))}</td>
                                                </tr>
                                                {hasBoth&&idx===lastMIdx&&<tr key="spacer"><td colSpan={5} style={{padding:"6px 0",borderBottom:"2px solid #e2e8f0",background:"#f8fafc"}}></td></tr>}
                                              </React.Fragment>
                                            );
                                          });})()}
                                        </tbody>
                                      </table>
                                      {/* 修理/紛失行 */}
                                      {gInc.length>0&&(
                                        <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:6,padding:"8px 12px",marginBottom:8}}>
                                          <div style={{fontSize:11,fontWeight:700,color:"#dc2626",marginBottom:6}}>修理/紛失</div>
                                          {gInc.map(inc=>(
                                            <div key={inc.id} style={{display:"flex",gap:8,marginBottom:4,alignItems:"center",fontSize:11}}>
                                              <span style={{background:inc.type==="loss"?"#fef2f2":"#fffbeb",color:inc.type==="loss"?"#dc2626":"#d97706",padding:"1px 6px",borderRadius:4,fontWeight:600,minWidth:60,textAlign:"center"}}>{inc.type==="loss"?"紛失":"修理/破損"}</span>
                                              <span style={{flex:1,color:"#374151"}}>{inc.item_name}</span>
                                              <span style={{fontWeight:600,color:"#16a34a"}}>{fmt(inc.charge_amount)}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      {/* 調整行 */}
                                      <div style={{background:"#fefce8",border:"1px solid #fde68a",borderRadius:6,padding:"8px 12px"}}>
                                        <div style={{fontSize:11,fontWeight:700,color:"#92400e",marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                                          <span>調整行</span>
                                          {!locked&&<button onClick={()=>addAdj(key)} style={{...S.ib("#92400e"),fontSize:10,padding:"2px 8px"}}>
                                            <Ico d={I.plus} size={11}/>追加
                                          </button>}
                                        </div>
                                        {d.adjustments.length===0&&(g._autoAdjustments||[]).length===0&&<div style={{fontSize:11,color:"#94a3b8"}}>調整行なし</div>}
                                        {(g._autoAdjustments||[]).map(a=>(
                                          <div key={a.id} style={{display:"flex",gap:6,marginBottom:4,alignItems:"center"}}>
                                            <span style={{flex:1,fontSize:11,padding:"4px 8px",color:"#64748b",background:"#f1f5f9",borderRadius:4}}>🔒 {a.label}</span>
                                            <span style={{width:110,fontSize:11,padding:"4px 8px",textAlign:"right",color:Number(a.amount)<0?"#dc2626":"#16a34a",fontWeight:600}}>{fmt(Number(a.amount)||0)}</span>
                                            <span style={{width:64}}/>
                                          </div>
                                        ))}
                                        {d.adjustments.map(a=>(
                                          <div key={a.id} style={{display:"flex",gap:6,marginBottom:4,alignItems:"center"}}>
                                            <input value={a.label} onChange={e=>updateAdj(key,a.id,{label:e.target.value})}
                                              placeholder="内容（例: 値引き）" style={{...S.inp,flex:1,fontSize:11,padding:"4px 8px"}} disabled={locked}/>
                                            <AdjAmountInput
                                              value={a.amount}
                                              onChange={num=>updateAdj(key,a.id,{amount:num})}
                                              disabled={locked}
                                              style={{...S.inp,width:110,fontSize:11,padding:"4px 8px",textAlign:"right"}}
                                            />
                                            <span style={{fontSize:11,color:"#374151",minWidth:64,textAlign:"right"}}>{fmt(Number(a.amount)||0)}</span>
                                            {!locked&&<button onClick={()=>removeAdj(key,a.id)} style={{background:"none",border:"none",cursor:"pointer"}}><Ico d={I.x} size={12} color="#ef4444"/></button>}
                                          </div>
                                        ))}
                                      </div>
                                      {/* 合計 */}
                                      <div style={{display:"flex",justifyContent:"flex-end",gap:16,fontSize:12,marginTop:8,paddingTop:8,borderTop:"1px solid #e2e8f0"}}>
                                        <span><span style={{color:"#64748b"}}>機材: </span>{fmt(baseTot)}</span>
                                        {adjSum!==0&&<span style={{color:adjSum<0?"#dc2626":"#16a34a"}}><span style={{color:"#64748b"}}>調整: </span>{fmt(adjSum)}</span>}
                                        <span><span style={{color:"#64748b"}}>税抜: </span><strong>{fmt(grandTot)}</strong></span>
                                        <span><span style={{color:"#64748b"}}>消費税: </span>{fmt(tax)}</span>
                                        <strong style={{color:"#9333ea"}}>税込: {fmt(grandTot+tax)}</strong>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </React.Fragment>
                    );
                  });
                })()}
              </tbody>
            </table>
          }
        </div>
      </div>

      {lockModal&&lockModal.mode==="confirm"&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#fff",borderRadius:12,padding:"28px 32px",minWidth:320,boxShadow:"0 8px 32px rgba(0,0,0,0.2)"}}>
            <div style={{fontSize:15,fontWeight:700,marginBottom:12,color:"#1e293b"}}>🔒 締め済みにしますか？</div>
            <div style={{fontSize:13,color:"#374151",marginBottom:20}}>解除にはパスワードが必要になります。</div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={doLockConfirm} style={{flex:1,background:"#0f172a",color:"#fff",border:"none",borderRadius:7,padding:"9px 0",fontSize:13,fontWeight:700,cursor:"pointer"}}>締め済みにする</button>
              <button onClick={()=>setLockModal(null)} style={{flex:1,background:"#f1f5f9",color:"#374151",border:"none",borderRadius:7,padding:"9px 0",fontSize:13,cursor:"pointer"}}>キャンセル</button>
            </div>
          </div>
        </div>
      )}
      {lockModal&&lockModal.mode==="unlock"&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#fff",borderRadius:12,padding:24,width:320,boxShadow:"0 8px 32px rgba(0,0,0,0.25)"}}>
            <div style={{fontSize:15,fontWeight:700,marginBottom:8}}>🔓 締めを解除しますか？</div>
            <div style={{fontSize:12,color:"#64748b",marginBottom:16}}>解除するにはパスワードを入力してください。</div>
            <PwInput onOk={doUnlock} onCancel={()=>setLockModal(null)}/>
          </div>
        </div>
      )}
      {changePwModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#fff",borderRadius:12,padding:24,width:320,boxShadow:"0 8px 32px rgba(0,0,0,0.25)"}}>
            <div style={{fontSize:15,fontWeight:700,marginBottom:8}}>🔑 パスワードの変更</div>
            <div style={{fontSize:12,color:"#64748b",marginBottom:16}}>現在のパスワードを入力してください。</div>
            <PwInput onOk={doChangePw} onCancel={()=>setChangePwModal(false)}/>
          </div>
        </div>
      )}
      {printCountResetModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#fff",borderRadius:12,padding:"28px 32px",minWidth:320,boxShadow:"0 8px 32px rgba(0,0,0,0.2)"}}>
            <div style={{fontSize:15,fontWeight:700,marginBottom:12,color:"#991b1b"}}>⚠️ 発行履歴をリセット</div>
            <div style={{fontSize:13,color:"#374151",marginBottom:20}}>領収済以外の請求書発行履歴（printCount）をリセットします。</div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={doPrintCountReset} style={{flex:1,background:"#dc2626",color:"#fff",border:"none",borderRadius:7,padding:"9px 0",fontSize:13,fontWeight:700,cursor:"pointer"}}>リセットする</button>
              <button onClick={()=>setPrintCountResetModal(false)} style={{flex:1,background:"#f1f5f9",color:"#374151",border:"none",borderRadius:7,padding:"9px 0",fontSize:13,cursor:"pointer"}}>キャンセル</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function CustomerAnalysis({c, custRecords, products, allRecords=[]}){
  const [detailOpen, setDetailOpen] = useState({tree:false,equip:false,suggest:false,memo:false});
  const [salesNote, setSalesNote] = useState(()=>{ try{return localStorage.getItem(`olq_snote_${c.id}`)||"";}catch{return "";} });
  const [noteSaved, setNoteSaved] = useState(false);
  const [treeOpen, setTreeOpen] = useState({});
  const [yearOpen, setYearOpen] = useState({});
  const [monthOpen, setMonthOpen] = useState({});
  const [histExpanded, setHistExpanded] = useState(false);
  const currentYear = String(new Date().getFullYear());
  const yIsOpen = y => yearOpen[y]!==undefined ? yearOpen[y] : y===currentYear;
  const ymIsOpen = ym => monthOpen[ym]!==undefined ? monthOpen[ym] : ym.startsWith(currentYear);
  const fmtD2 = d => d ? new Date(d).toLocaleDateString("ja-JP",{month:"2-digit",day:"2-digit"}) : "―";
  const toggleDetail = key => setDetailOpen(d=>({...d,[key]:!d[key]}));
  const saveNote = () => { try{localStorage.setItem(`olq_snote_${c.id}`,salesNote);}catch{} setNoteSaved(true); setTimeout(()=>setNoteSaved(false),2000); };

  const totalSales = custRecords.reduce((s,r)=>s+(r.amount||0),0);
  const sortedRecs = [...custRecords].sort((a,b)=>(b.startDate||"").localeCompare(a.startDate||""));
  const lastDate = sortedRecs[0]?.startDate;
  const daysSince = lastDate ? Math.floor((Date.now()-new Date(lastDate).getTime())/(1000*60*60*24)) : 999;
  const health = daysSince<90
    ? {label:"今が熱い",sub:"積極的にアプローチ",color:"#16a34a",bg:"#dcfce7",icon:"🟢"}
    : daysSince<180
    ? {label:"そろそろ連絡を",sub:`${daysSince}日連絡なし`,color:"#d97706",bg:"#fef3c7",icon:"🟡"}
    : {label:"しばらく来ていない",sub:`${daysSince}日連絡なし`,color:"#dc2626",bg:"#fee2e2",icon:"🔴"};

  const now = new Date(); const cy=now.getFullYear(),cm=now.getMonth()+1;
  const salesByYM={};
  custRecords.forEach(r=>{ if(!r.startDate)return; const d=new Date(r.startDate); const k=`${d.getFullYear()}-${d.getMonth()+1}`; salesByYM[k]=(salesByYM[k]||0)+(r.amount||0); });
  const curYearTotal=Object.entries(salesByYM).filter(([k])=>k.startsWith(`${cy}-`)).reduce((s,[,v])=>s+v,0);
  const prevYearTotal=Object.entries(salesByYM).filter(([k])=>k.startsWith(`${cy-1}-`)).reduce((s,[,v])=>s+v,0);
  const yearGrowth=prevYearTotal>0?Math.round((curYearTotal-prevYearTotal)/prevYearTotal*100):null;
  const curMonthSales=salesByYM[`${cy}-${cm}`]||0;
  const prevMonthSales=salesByYM[`${cy-1}-${cm}`]||0;
  const monthGrowth=prevMonthSales>0?Math.round((curMonthSales-prevMonthSales)/prevMonthSales*100):null;

  const last3Avg=sortedRecs.slice(0,3).length?Math.round(sortedRecs.slice(0,3).reduce((s,r)=>s+(r.amount||0),0)/Math.min(3,sortedRecs.length)):0;
  const allAvg=custRecords.length?Math.round(totalSales/custRecords.length):0;
  const priceTrend=last3Avg>allAvg*1.1
    ? {label:"↑上がっています",sub:`直近3件の平均が+${Math.round((last3Avg/allAvg-1)*100)}%`,color:"#16a34a"}
    : last3Avg<allAvg*0.9
    ? {label:"↓下がっています",sub:`直近3件の平均が-${Math.round((1-last3Avg/allAvg)*100)}%`,color:"#dc2626"}
    : {label:"横ばいです",sub:"大きな変化なし",color:"#64748b"};

  const monthFreq=Array(12).fill(0);
  custRecords.forEach(r=>{ if(r.startDate) monthFreq[new Date(r.startDate).getMonth()]++; });
  const monthNames=["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
  const topMonths=monthFreq.map((cnt,i)=>({m:i,cnt})).sort((a,b)=>b.cnt-a.cnt).filter(x=>x.cnt>0).slice(0,3);

  let nextAction="";
  if(custRecords.length===0){ nextAction="まだ利用履歴がありません。初回アプローチをしましょう。"; }
  else if(daysSince>180){ nextAction="長期間連絡がありません。今すぐ連絡してください。"; }
  else if(topMonths.length>0){
    const busyMonths=topMonths.map(x=>x.m+1);
    const nextBusy=busyMonths.find(m=>m>cm)||busyMonths[0];
    const monthsUntil=nextBusy>cm?nextBusy-cm:12-cm+nextBusy;
    const contactMonth=nextBusy>1?nextBusy-1:12;
    if(monthsUntil<=2){ nextAction=`今すぐ連絡してください。${nextBusy}月の案件に向けて${contactMonth}月中がベストです。`; }
    else{ nextAction=`${contactMonth}月中に連絡してください。毎年${busyMonths.slice(0,2).join("・")}月に利用が集中しています。`; }
  } else if(sortedRecs.length>=2){
    const intervals=sortedRecs.slice(0,-1).map((r,i)=>(new Date(r.startDate)-new Date(sortedRecs[i+1].startDate))/(1000*60*60*24));
    const avgInterval=Math.round(intervals.reduce((s,v)=>s+v,0)/intervals.length);
    const nextDate=new Date(new Date(lastDate).getTime()+avgInterval*1000*60*60*24);
    nextAction=`${nextDate.getMonth()+1}月頃に連絡してください。平均して${avgInterval}日ごとに利用があります。`;
  } else { nextAction=daysSince<30?"先日ご利用いただいたばかりです。次回の提案を準備しましょう。":`${Math.round(daysSince/30)}ヶ月経過しています。フォローの連絡をしましょう。`; }

  const prodCount={},prodAmount={};
  custRecords.forEach(r=>{ const lines=(r.lines&&r.lines.length)?r.lines:[{equipmentName:r.equipmentName}]; lines.forEach(ln=>{ const name=ln.equipmentName||r.equipmentName||""; if(name){prodCount[name]=(prodCount[name]||0)+1;prodAmount[name]=(prodAmount[name]||0)+(r.amount||0);} }); });
  const topProds=Object.entries(prodCount).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const usedNames=new Set(Object.keys(prodCount));

  const allProdCount={};
  allRecords.forEach(r=>{ if(r.customerId===c.id)return; const lines=(r.lines&&r.lines.length)?r.lines:[{equipmentName:r.equipmentName}]; lines.forEach(ln=>{ const name=ln.equipmentName||r.equipmentName||""; if(name) allProdCount[name]=(allProdCount[name]||0)+1; }); });
  const suggestions=Object.entries(allProdCount).filter(([n])=>!usedNames.has(n)&&n).sort((a,b)=>b[1]-a[1]).slice(0,5);

  const tree={};
  custRecords.forEach(r=>{ if(!r.startDate)return; const y=r.startDate.slice(0,4),m=r.startDate.slice(0,7); if(!tree[y])tree[y]={}; if(!tree[y][m])tree[y][m]=[]; tree[y][m].push(r); });
  const treeYears=Object.keys(tree).sort().reverse();

  return(
    <div style={{background:"#f8fafc",borderTop:"1px solid #e2e8f0",padding:"16px 20px 20px 62px",display:"flex",flexDirection:"column"}}>

      {/* LAYER1: ステータス＋アクション */}
      <div style={{display:"grid",gridTemplateColumns:"160px 1fr",gap:10,marginBottom:10,order:1}}>
        <div style={{background:health.bg,borderRadius:10,padding:"12px 14px",display:"flex",flexDirection:"column",justifyContent:"space-between",border:`1px solid ${health.color}33`}}>
          <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:8}}>
            <span style={{fontSize:15}}>{health.icon}</span>
            <span style={{fontSize:12,fontWeight:800,color:health.color}}>{health.label}</span>
          </div>
          <div>
            <div style={{fontSize:8,color:health.color,opacity:0.8,marginBottom:2,fontWeight:600}}>累計売上 LTV</div>
            <div style={{fontSize:17,fontWeight:800,color:health.color,lineHeight:1}}>{fmt(totalSales)}</div>
            <div style={{fontSize:8,color:health.color,opacity:0.7,marginTop:3}}>{custRecords.length}件　平均{fmt(allAvg)}/件</div>
          </div>
        </div>
        <div style={{background:"#fff",borderRadius:10,border:"1px solid #e2e8f0",padding:"12px 14px"}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
            <span style={{fontSize:11}}>⚡</span>
            <span style={{fontSize:10,fontWeight:700,color:"#475569",letterSpacing:0.5}}>ネクストアクション</span>
            <span style={{marginLeft:"auto",fontSize:9,color:"#94a3b8",background:"#f1f5f9",padding:"1px 6px",borderRadius:3}}>{daysSince<999?`最終利用 ${daysSince}日前`:"利用履歴なし"}</span>
          </div>
          <div style={{fontSize:13,fontWeight:700,color:"#0f172a",lineHeight:1.7,marginBottom:8}}>{nextAction}</div>
          <button onClick={()=>toggleDetail("memo")} style={{background:detailOpen.memo?"#f1f5f9":"#0f172a",color:detailOpen.memo?"#475569":"#fff",border:"1px solid #e2e8f0",borderRadius:6,padding:"5px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}>
            📝 {detailOpen.memo?"メモを閉じる":"営業メモを書く"}
          </button>
          {detailOpen.memo&&(
            <div style={{marginTop:8}}>
              <textarea value={salesNote} onChange={e=>setSalesNote(e.target.value)} placeholder="次回コンタクト予定、提案内容、担当者メモなど..."
                style={{width:"100%",height:72,padding:"8px 10px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:12,resize:"vertical",boxSizing:"border-box",fontFamily:"inherit",outline:"none"}}/>
              <button onClick={saveNote} style={{background:noteSaved?"#16a34a":"#2563eb",color:"#fff",border:"none",borderRadius:6,padding:"4px 12px",fontSize:11,fontWeight:700,cursor:"pointer",marginTop:4}}>
                {noteSaved?"✅ 保存済み":"保存する"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* LAYER2: 4KPIカード */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:10,order:2}}>
        <div style={{background:"#fff",borderRadius:10,border:"1px solid #e2e8f0",padding:"10px 12px"}}>
          <div style={{fontSize:9,color:"#94a3b8",fontWeight:700,marginBottom:6,letterSpacing:0.5}}>前年比売上</div>
          <div style={{marginBottom:4}}>
            <div style={{fontSize:8,color:"#64748b",marginBottom:1}}>今年累計</div>
            <div style={{fontSize:17,fontWeight:800,color:yearGrowth===null?"#94a3b8":yearGrowth>=0?"#16a34a":"#dc2626",lineHeight:1}}>
              {yearGrowth===null?"―":yearGrowth>=0?`+${yearGrowth}%`:`${yearGrowth}%`}
            </div>
          </div>
          <div>
            <div style={{fontSize:8,color:"#64748b",marginBottom:1}}>今月</div>
            <div style={{fontSize:13,fontWeight:700,color:monthGrowth===null?"#94a3b8":monthGrowth>=0?"#16a34a":"#dc2626"}}>
              {monthGrowth===null?"―":monthGrowth>=0?`+${monthGrowth}%`:`${monthGrowth}%`}
            </div>
          </div>
          <div style={{fontSize:8,color:"#cbd5e1",marginTop:5}}>対前年同期比</div>
        </div>
        <div style={{background:"#fff",borderRadius:10,border:"1px solid #e2e8f0",padding:"10px 12px"}}>
          <div style={{fontSize:9,color:"#94a3b8",fontWeight:700,marginBottom:6,letterSpacing:0.5}}>受注単価トレンド</div>
          <div style={{fontSize:13,fontWeight:800,color:priceTrend.color,marginBottom:4}}>{priceTrend.label}</div>
          <div style={{fontSize:8,color:"#94a3b8",marginBottom:6}}>{priceTrend.sub}</div>
          <div style={{display:"flex",justifyContent:"space-between"}}>
            <div><div style={{fontSize:8,color:"#94a3b8"}}>直近3件</div><div style={{fontSize:11,fontWeight:700,color:"#334155"}}>{fmt(last3Avg)}</div></div>
            <div style={{textAlign:"right"}}><div style={{fontSize:8,color:"#94a3b8"}}>全体平均</div><div style={{fontSize:11,fontWeight:700,color:"#334155"}}>{fmt(allAvg)}</div></div>
          </div>
        </div>
        <div style={{background:"#fff",borderRadius:10,border:"1px solid #e2e8f0",padding:"10px 12px"}}>
          <div style={{fontSize:9,color:"#94a3b8",fontWeight:700,marginBottom:6,letterSpacing:0.5}}>来店ペース</div>
          {sortedRecs.length>=2?(()=>{
            const intervals=sortedRecs.slice(0,-1).map((r,i)=>(new Date(r.startDate)-new Date(sortedRecs[i+1].startDate))/(1000*60*60*24));
            const avgInt=Math.round(intervals.reduce((s,v)=>s+v,0)/intervals.length);
            return(<>
              <div style={{fontSize:17,fontWeight:800,color:"#2563eb",lineHeight:1,marginBottom:2}}>{avgInt}<span style={{fontSize:10,fontWeight:400,color:"#64748b"}}>日周期</span></div>
              <div style={{fontSize:8,color:"#94a3b8",marginBottom:4}}>平均利用間隔</div>
              <div style={{fontSize:9,color:"#64748b"}}>最終：{fmtD2(lastDate)}</div>
            </>);
          })():(<>
            <div style={{fontSize:17,fontWeight:800,color:"#94a3b8",marginBottom:2}}>―</div>
            <div style={{fontSize:9,color:"#94a3b8"}}>{custRecords.length===0?"履歴なし":"データ不足"}</div>
          </>)}
        </div>
        <div style={{background:"#fff",borderRadius:10,border:"1px solid #e2e8f0",padding:"10px 12px"}}>
          <div style={{fontSize:9,color:"#94a3b8",fontWeight:700,marginBottom:6,letterSpacing:0.5}}>繁忙月</div>
          {topMonths.length===0
            ?<div style={{fontSize:11,color:"#94a3b8"}}>データなし</div>
            :<>
              <div style={{fontSize:17,fontWeight:800,color:"#7c3aed",lineHeight:1,marginBottom:2}}>{monthNames[topMonths[0].m]}</div>
              <div style={{fontSize:8,color:"#94a3b8",marginBottom:4}}>{topMonths[0].cnt}件（最多）</div>
              {topMonths.slice(1,3).map(x=>(
                <div key={x.m} style={{fontSize:10,color:"#64748b"}}>{monthNames[x.m]} <span style={{color:"#94a3b8",fontSize:9}}>{x.cnt}件</span></div>
              ))}
            </>
          }
        </div>
      </div>

      {/* LAYER3: 常時表示 */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8,order:3}}>

        {/* 提案できる機材 */}
        <div style={{background:"#fff",borderRadius:10,border:"1px solid #e2e8f0",padding:"12px 14px"}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
            <span style={{fontSize:13}}>💡</span>
            <span style={{fontSize:11,fontWeight:700,color:"#475569"}}>提案できる機材</span>
            <span style={{marginLeft:"auto",fontSize:9,background:"#f1f5f9",color:"#64748b",borderRadius:4,padding:"1px 6px"}}>{suggestions.length}件</span>
          </div>
          {suggestions.length===0
            ?<div style={{fontSize:11,color:"#94a3b8",textAlign:"center",padding:"16px 0"}}>データなし</div>
            :suggestions.map(([name,cnt])=>(
              <div key={name} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5,padding:"7px 10px",background:"#f0fdf4",borderRadius:6,border:"1px solid #bbf7d0"}}>
                <span style={{fontSize:12}}>📦</span>
                <div style={{flex:1,overflow:"hidden"}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#166534",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</div>
                  <div style={{fontSize:9,color:"#16a34a"}}>{cnt}社が使用中</div>
                </div>
              </div>
            ))
          }
        </div>

        {/* よく使う機材 */}
        <div style={{background:"#fff",borderRadius:10,border:"1px solid #e2e8f0",padding:"12px 14px"}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
            <span style={{fontSize:13}}>🏆</span>
            <span style={{fontSize:11,fontWeight:700,color:"#475569"}}>よく使う機材</span>
            <span style={{marginLeft:"auto",fontSize:9,background:"#f1f5f9",color:"#64748b",borderRadius:4,padding:"1px 6px"}}>{topProds.length}件</span>
          </div>
          {topProds.length===0
            ?<div style={{fontSize:11,color:"#94a3b8",textAlign:"center",padding:"16px 0"}}>データなし</div>
            :topProds.map(([name,cnt],idx)=>{
              const bar=Math.round((cnt/topProds[0][1])*100);
              const barColor=idx===0?"#f59e0b":idx===1?"#94a3b8":idx===2?"#b45309":"#2563eb";
              return(
                <div key={name} style={{marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3}}>
                    <span style={{color:"#475569",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      <span style={{color:barColor,fontWeight:800,marginRight:4}}>#{idx+1}</span>{name}
                    </span>
                    <span style={{color:"#64748b",marginLeft:8,whiteSpace:"nowrap",fontWeight:600}}>{cnt}回</span>
                  </div>
                  <div style={{height:5,background:"#f1f5f9",borderRadius:3}}>
                    <div style={{height:5,width:`${bar}%`,background:barColor,borderRadius:3}}/>
                  </div>
                </div>
              );
            })
          }
        </div>
      </div>

      {/* 案件履歴 */}
      <div style={{background:"#fff",borderRadius:10,border:"1px solid #e2e8f0",padding:"12px 14px",marginBottom:8,order:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
          <span style={{fontSize:13}}>📋</span>
          <span style={{fontSize:11,fontWeight:700,color:"#475569"}}>案件履歴</span>
          <span style={{marginLeft:"auto",fontSize:9,background:"#f1f5f9",color:"#64748b",borderRadius:4,padding:"1px 6px"}}>{custRecords.length}件</span>
          <button onClick={()=>setHistExpanded(e=>!e)} style={{marginLeft:6,fontSize:9,background:histExpanded?"#1e293b":"#f1f5f9",color:histExpanded?"#fff":"#64748b",border:"none",borderRadius:4,padding:"2px 8px",cursor:"pointer",fontWeight:600}}>
            {histExpanded?"折りたたむ":"すべて表示"}
          </button>
        </div>
        {treeYears.length===0
          ?<div style={{fontSize:11,color:"#94a3b8",textAlign:"center",padding:"12px 0"}}>データなし</div>
          :<div style={histExpanded?{}:{maxHeight:700,overflowY:"auto"}}>
            {treeYears.map(y=>(
              <div key={y} style={{marginBottom:6}}>
                <div onClick={()=>setYearOpen(o=>({...o,[y]:!yIsOpen(y)}))}
                  style={{display:"flex",alignItems:"center",gap:6,padding:"4px 8px",borderRadius:4,cursor:"pointer",background:"#f1f5f9",marginBottom:4,userSelect:"none"}}>
                  <span style={{fontSize:11,fontWeight:700,color:"#475569"}}>{yIsOpen(y)?"▾":"▶"} {y}年</span>
                  <span style={{fontSize:9,color:"#94a3b8",marginLeft:"auto"}}>{Object.values(tree[y]).flat().length}件</span>
                </div>
                {yIsOpen(y)&&Object.keys(tree[y]).sort().reverse().map(ym=>(
                  <div key={ym} style={{marginBottom:4,paddingLeft:8}}>
                    <div onClick={()=>setMonthOpen(o=>({...o,[ym]:!ymIsOpen(ym)}))}
                      style={{display:"flex",alignItems:"center",gap:4,padding:"3px 6px",cursor:"pointer",marginBottom:3,userSelect:"none"}}>
                      <span style={{fontSize:10,color:"#64748b",fontWeight:600}}>{ymIsOpen(ym)?"▾":"▶"} {ym.slice(5)}月</span>
                      <span style={{fontSize:9,color:"#94a3b8",marginLeft:4}}>（{tree[y][ym].length}件）</span>
                    </div>
                    {ymIsOpen(ym)&&tree[y][ym].map(r=>{
                      const isExp = treeOpen[r.id];
                      const rawLines = (r.lines&&r.lines.length)?r.lines:(r.equipmentName?[{equipmentName:r.equipmentName,quantity:r.quantity||1}]:[]);
                      const rLines = rawLines.filter(ln=>(ln.equipmentName||"").trim()!==""||ln.isManual);
                      const shown = rLines.slice(0,3).map(ln=>{const n=ln.equipmentName||"";return n.length>10?n.slice(0,10)+"…":n;}).filter(Boolean);
                      const summary = shown.length>0?(shown.join("・")+(rLines.length>3?` ほか${rLines.length-3}点`:"")):"";
                      const bTag = r.billingType==="monthly"?{label:"月極",bg:"#dbeafe",col:"#1d4ed8"}:{label:"日極",bg:"#dcfce7",col:"#166534"};
                      return(
                        <div key={r.id} style={{background:"#fff",borderRadius:6,marginBottom:4,border:"1px solid #e2e8f0",overflow:"hidden"}}>
                          <div style={{display:"flex",alignItems:"flex-start",gap:8,padding:"7px 10px",cursor:"pointer",textAlign:"left"}} onClick={()=>setTreeOpen(o=>({...o,[r.id]:!o[r.id]}))}>
                            <div style={{flex:1,minWidth:0,textAlign:"left"}}>
                              <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:3,flexWrap:"nowrap"}}>
                                <span style={{fontSize:9,background:bTag.bg,color:bTag.col,borderRadius:3,padding:"1px 5px",fontWeight:700,whiteSpace:"nowrap",flexShrink:0}}>{bTag.label}</span>
                                <span style={{fontSize:11,color:"#1e293b",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.projectName||"（案件名なし）"}</span>
                              </div>
                              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:summary&&!isExp?3:0}}>
                                <span style={{fontSize:10,color:"#94a3b8",whiteSpace:"nowrap"}}>{fmtD2(r.startDate)}</span>
                                {r.deliveryNo&&<span style={{fontSize:10,background:"#f1f5f9",color:"#64748b",borderRadius:3,padding:"1px 6px",fontFamily:"monospace",whiteSpace:"nowrap"}}>No.{r.deliveryNo}</span>}
                              </div>
                              {!isExp&&summary&&<div style={{fontSize:10,color:"#475569",textAlign:"left",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{summary}</div>}
                            </div>
                            <div style={{textAlign:"right",flexShrink:0,minWidth:60}}>
                              <div style={{fontSize:11,fontWeight:700,color:"#334155",whiteSpace:"nowrap"}}>{fmt(r.amount||0)}</div>
                              <div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>{isExp?"▴ 閉じる":"▾ 詳細"}</div>
                            </div>
                          </div>
                          {isExp&&(
                            <div style={{borderTop:"1px solid #f1f5f9",padding:"6px 10px",background:"#f8fafc"}}>
                              {rLines.length===0
                                ?<div style={{fontSize:10,color:"#94a3b8",textAlign:"left"}}>機材情報なし</div>
                                :rLines.map((ln,i)=>(
                                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:11,color:"#334155",padding:"3px 0",borderBottom:i<rLines.length-1?"1px solid #e2e8f0":"none",textAlign:"left"}}>
                                    <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{ln.equipmentName||"―"}{(ln.quantity||1)>1?` ×${ln.quantity}`:""}</span>
                                    <span style={{color:"#94a3b8",marginLeft:8,whiteSpace:"nowrap",flexShrink:0,fontSize:10}}>{ln.amount?fmt(ln.amount):""}</span>
                                  </div>
                                ))
                              }
                              <div style={{marginTop:8,paddingTop:6,borderTop:"1px solid #e2e8f0",textAlign:"left"}}>
                                <button onClick={()=>{
                                  const g={customerId:r.customerId,customer:c,customerName:c.name,projectName:r.projectName||"",month:r.startDate?r.startDate.slice(0,7):"",items:[r],split:true,consolidate:false};
                                  downloadPrintHTML(r.issueReceipt?"delivery-receipt":"delivery",g);
                                }} style={{background:"none",border:"none",color:"#2563eb",fontSize:11,cursor:"pointer",padding:0,textDecoration:"underline"}}>
                                  → 納品書を開く
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        }
      </div>

      {/* 特別価格 */}
      <div style={{order:4}}>
      {syncSPs(c.specialPrices,products).length>0&&(
        <div style={{background:"#fff",borderRadius:10,border:"1px solid #e2e8f0",padding:"12px 14px",order:1}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
            <span style={{fontSize:13}}>⭐</span>
            <span style={{fontSize:11,fontWeight:700,color:"#f59e0b"}}>特別価格</span>
            <span style={{marginLeft:"auto",fontSize:9,background:"#fef9c3",color:"#92400e",borderRadius:4,padding:"1px 6px"}}>{syncSPs(c.specialPrices,products).length}件</span>
          </div>
          {c.specialPrices.map((sp,j)=>(
            <div key={j} style={{display:"flex",alignItems:"center",gap:10,fontSize:12,marginBottom:3,padding:"4px 6px",background:"#fefce8",borderRadius:4}}>
              <span style={{flex:1,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{spName(sp,products)}</span>
              <span style={{color:"#16a34a",fontWeight:700,whiteSpace:"nowrap"}}>{fmt(sp.price)}/日（税抜）</span>
            </div>
          ))}
        </div>
      )}
      </div>

    </div>
  );
}

function CustomersTab({customers,products,records,onSave,onDeleteCust,onLogActivity,showToast,presetCustomers,openCustomerId,onOpenHandled}){
  const E={name:"",invoiceName:"",zipCode:"",address:"",contact:"",email:"",phone:"",discountRate:"0",paymentCycle:"月末締め 翌々月末日",splitInvoice:true,consolidateMonth:false,notes:"",staff:"",specialPrices:[],projects:[],showDeliveryPrice:false,showDiscountLine:false};
  const [form,setForm]=useState(E);
  const [editId,setEditId]=useState(null);
  const [open,setOpen]=useState(false);
  const [detailId,setDetailId]=useState(null); // 詳細ページ表示中の顧客ID
  const [exp,setExp]=useState(null);
  const [spProd,setSpProd]=useState("");
  const [spPrice,setSpPrice]=useState("");
  const [spQ,setSpQ]=useState("");
  const [custQ,setCustQ]=useState("");
  const [sortKey,setSortKey]=useState("name"); // "name" | "sales"
  const [projInput,setProjInput]=useState("");
  const [editProjModal,setEditProjModal]=useState(null); // {index, name, useCount}
  const [editProjName,setEditProjName]=useState("");
  const [resetPresetModal,setResetPresetModal]=useState(false);
  const xlsxInputRef=useRef(null);
  const importFromXlsx=async(file)=>{
    try{
      if(!window.XLSX){
        await new Promise((resolve,reject)=>{
          const s=document.createElement("script");
          s.src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
          s.onload=resolve; s.onerror=reject;
          document.head.appendChild(s);
        });
      }
      const XLSX=window.XLSX;
      const ab=await file.arrayBuffer();
      const wb=XLSX.read(ab,{type:"array"});
      const ws=wb.Sheets["M_顧客"];
      if(!ws){showToast("M_顧客シートが見つかりません",false);return;}
      const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:null});
      const header=rows[0];
      const idx=(key)=>header.findIndex(h=>h===key);
      const iName=idx("請求会社名"),iAddr=idx("住所"),iDiv=idx("部署/宛名補足"),iMail=idx("請求先メール"),
            iMode=idx("価格モード"),iRate=idx("掛け率"),iMemo=idx("メモ"),iPost=idx("郵送要否");
      const parsed=rows.slice(1).filter(r=>r[iName]).map(r=>{
        const addrFull=String(r[iAddr]||"");
        const zipM=addrFull.match(/〒?(\d{3}-?\d{4})/);
        const zip=zipM?zipM[1].replace("-",""):"";
        const addr=addrFull.replace(/^〒?\d{3}-?\d{4}\s*/,"");
        const mode=r[iMode]||"STANDARD";
        const kake=mode==="RATE"?Math.round((r[iRate]||1)*10):0;
        const notes=[r[iMemo]||"",r[iPost]?"郵送あり":""].filter(Boolean).join(" / ");
        return{id:uid(),name:String(r[iName]),invoiceName:String(r[iName]),zipCode:zip,address:addr,
          contact:String(r[iDiv]||""),email:String(r[iMail]||""),phone:"",
          discountRate:kake,paymentCycle:"月末締め 翌々月末日",splitInvoice:true,
          consolidateMonth:false,notes,specialPrices:[],projects:[],updatedAt:Date.now(),createdAt:Date.now()};
      });
      if(!parsed.length){showToast("読み込めるデータがありませんでした",false);return;}
      const existing=new Set(customers.map(c=>c.name));
      const added=parsed.filter(p=>!existing.has(p.name));
      const next=[...customers,...added];
      await onSave(next);
      showToast(`${added.length}社を追加しました（重複${parsed.length-added.length}社スキップ）`);
    }catch(e){
      showToast("読み込みに失敗しました: "+e.message,false);
    }
  };

  // 外部からIDが指定された場合、その顧客の編集フォームを自動で開く
  useEffect(()=>{
    if(!openCustomerId) return;
    const c = customers.find(x=>x.id===openCustomerId);
    if(!c) return;
    setForm({name:c.name,invoiceName:c.invoiceName||"",zipCode:c.zipCode||"",address:c.address||"",contact:c.contact||"",email:c.email||"",phone:c.phone||"",discountRate:String(c.discountRate||0),paymentCycle:c.paymentCycle||"月末締め 翌々月末日",splitInvoice:c.splitInvoice!==false,consolidateMonth:!!c.consolidateMonth,notes:c.notes||"",staff:c.staff||"",specialPrices:c.specialPrices||[],projects:c.projects||[],showDeliveryPrice:!!c.showDeliveryPrice,showDiscountLine:!!c.showDiscountLine});
    setEditId(c.id);
    setDetailId(c.id);
    setOpen(true);
    onOpenHandled&&onOpenHandled();
    // 該当顧客が見えるようにスクロール
    setTimeout(()=>document.getElementById(`cust-${c.id}`)?.scrollIntoView({behavior:"smooth",block:"center"}),100);
  },[openCustomerId]);

  // 顧客ごと売上集計
  const salesMap = {};
  (records||[]).forEach(r=>{
    salesMap[r.customerId] = (salesMap[r.customerId]||0) + (r.amount||0);
  });
  const getSales = id => salesMap[id]||0;

  const resetToPreset=()=>{
    setResetPresetModal(true);
  };
  const doResetToPreset=async()=>{
    setResetPresetModal(false);
    await onSave(presetCustomers);
    showToast(`${presetCustomers.length}社にリセットしました`);
  };

  // フォームデータを直接受け取って保存（setFormの非同期を回避）
  const saveCustomer=async(updatedForm)=>{
    if(!updatedForm.name){showToast("顧客名は必須",false);return;}
    const synced=syncSPs(updatedForm.specialPrices,products);
    const c={...updatedForm,specialPrices:synced,id:editId||uid(),discountRate:Number(updatedForm.discountRate)||0,staff:updatedForm.staff||"",updatedAt:Date.now(),createdAt:editId?customers.find(x=>x.id===editId)?.createdAt:Date.now()};
    try {
      await onSave(editId?customers.map(x=>x.id===editId?c:x):[...customers,c],{action:editId?"更新":"作成",name:c.name});
      showToast("更新しました");
    } catch(e) {
      showToast("保存に失敗しました。もう一度お試しください。",false);
      console.error("saveCustomer error",e);
    }
  };

  const addProj=async()=>{
    const v=projInput.trim();
    if(!v)return;
    if((form.projects||[]).includes(v)){setProjInput("");return;}
    const updatedProjects=[...(form.projects||[]),v];
    const updatedForm={...form,projects:updatedProjects};
    setForm(updatedForm);
    setProjInput("");
    const synced=syncSPs(updatedForm.specialPrices,products);
    const c={...updatedForm,specialPrices:synced,id:editId||uid(),discountRate:Number(updatedForm.discountRate)||0,staff:updatedForm.staff||"",updatedAt:Date.now(),createdAt:editId?customers.find(x=>x.id===editId)?.createdAt:Date.now()};
    await onSave(editId?customers.map(x=>x.id===editId?c:x):[...customers,c]);
    await onLogActivity("案件名追加","customer",form.name,`「${v}」を追加`);
  };
  const removeProj=(i)=>setForm(f=>({...f,projects:(f.projects||[]).filter((_,j)=>j!==i)}));

  const addSP=async()=>{
    if(!spProd||!spPrice) return;
    const p=products.find(x=>x.id===spProd);
    const updated={...form,specialPrices:[...(form.specialPrices||[]).filter(s=>s.productId!==spProd),{productId:spProd,productName:p?.fullName||"",price:Number(spPrice)}]};
    setForm(updated);
    setSpProd("");setSpPrice("");setSpQ("");
    await saveCustomer(updated);
    await onLogActivity("特別価格追加","customer",form.name,`${p?.fullName||""}：¥${spPrice}/日`);
  };

  const submit=async()=>{
    if(!form.name){showToast("顧客名は必須",false);return;}
    await saveCustomer(form);
    setForm(E); setEditId(null); setOpen(false);
  };

  const filteredSpProds = spQ.length>=1
    ? products.filter(p=>p.fullName.toLowerCase().includes(spQ.toLowerCase()))
    : [];
  if(open && !detailId){
    return(
      <div>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
          <button onClick={()=>{setOpen(false);setForm(E);}} style={{...S.ib("#64748b"),fontSize:12}}>← 一覧に戻る</button>
          <div style={{flex:1,fontSize:16,fontWeight:800}}>新規顧客を追加</div>
        </div>
        <div style={{...S.card,padding:24,marginBottom:16}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px 20px"}}>
            <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>顧客名 * （社内管理用）</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={S.inp} placeholder="株式会社〇〇"/></div>
            <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>請求書宛名（空欄の場合は顧客名を使用）</label><input value={form.invoiceName} onChange={e=>setForm(f=>({...f,invoiceName:e.target.value}))} style={S.inp} placeholder="例: 株式会社〇〇 制作部 ご担当者様"/></div>
            <div><label style={S.lbl}>郵便番号</label><input value={form.zipCode} onChange={e=>setForm(f=>({...f,zipCode:e.target.value}))} style={S.inp} placeholder="000-0000"/></div>
            <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>住所</label><textarea value={form.address||""} onChange={e=>setForm(f=>({...f,address:e.target.value}))} style={{...S.inp,height:66,resize:"vertical",lineHeight:1.6}} placeholder={"東京都港区新橋6-10-2\n第二新洋ビル 1F"}/></div>
            <div><label style={S.lbl}>担当者名</label><input value={form.contact} onChange={e=>setForm(f=>({...f,contact:e.target.value}))} style={S.inp}/></div>
            <div><label style={S.lbl}>電話</label><input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} style={S.inp}/></div>
            <div><label style={S.lbl}>メール</label><input value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} style={S.inp}/></div>
            <div><label style={S.lbl}>支払サイクル</label><input value={form.paymentCycle} onChange={e=>setForm(f=>({...f,paymentCycle:e.target.value}))} style={S.inp}/></div>
            <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>備考</label><input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} style={S.inp}/></div>
          </div>
          <div style={{display:"flex",gap:10,marginTop:16}}>
            <button onClick={submit} style={S.btn("#0f172a")}>登録</button>
            <button onClick={()=>{setOpen(false);setForm(E);}} style={S.btn("#94a3b8")}>キャンセル</button>
          </div>
        </div>
      </div>
    );
  }
  if(detailId){
    const c=customers.find(x=>x.id===detailId);
    if(c){
      const custRecords=(records||[]).filter(r=>r.customerId===c.id);
      const openEdit=()=>{
        setForm({name:c.name,invoiceName:c.invoiceName||"",zipCode:c.zipCode||"",address:c.address||"",contact:c.contact||"",email:c.email||"",phone:c.phone||"",discountRate:String(c.discountRate||0),paymentCycle:c.paymentCycle||"月末締め 翌々月末日",splitInvoice:c.splitInvoice!==false,consolidateMonth:!!c.consolidateMonth,notes:c.notes||"",staff:c.staff||"",specialPrices:c.specialPrices||[],projects:c.projects||[],showDeliveryPrice:!!c.showDeliveryPrice,showDiscountLine:!!c.showDiscountLine});
        setEditId(c.id); setOpen(true);
      };
      return(
        <div>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
            <button onClick={()=>{setDetailId(null);setOpen(false);setEditId(null);setForm(E);}} style={{...S.ib("#64748b"),fontSize:12}}>← 一覧に戻る</button>
            <div style={{flex:1,fontSize:16,fontWeight:800}}>{c.name}</div>
            <button onClick={openEdit} style={{...S.btn("#92400e",true),fontSize:12}}><Ico d={I.edit} size={13}/>内容を編集</button>
            <button onClick={()=>setEditProjModal({type:"deleteCust",id:c.id,name:c.name})} style={{...S.ib("#991b1b"),fontSize:12}}><Ico d={I.trash} size={13}/>削除</button>
          </div>
          {open&&editId===c.id&&(
            <div style={{...S.card,padding:24,marginBottom:16}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
                <h3 style={{margin:0,fontSize:16,fontWeight:700}}>顧客を編集</h3>
                <button onClick={()=>{setOpen(false);setEditId(null);setForm(E);}} style={{background:"none",border:"none",cursor:"pointer"}}><Ico d={I.x} size={18} color="#94a3b8"/></button>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px 20px"}}>
                <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>顧客名 * （社内管理用）</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={S.inp} placeholder="株式会社〇〇"/></div>
                <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>請求書宛名（空欄の場合は顧客名を使用）</label><input value={form.invoiceName} onChange={e=>setForm(f=>({...f,invoiceName:e.target.value}))} style={S.inp} placeholder="例: 株式会社〇〇 制作部 ご担当者様"/></div>
                <div><label style={S.lbl}>郵便番号</label><input value={form.zipCode} onChange={e=>setForm(f=>({...f,zipCode:e.target.value}))} style={S.inp} placeholder="000-0000"/></div>
                <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>住所（最大3行、改行で区切り）</label><textarea value={form.address||""} onChange={e=>setForm(f=>({...f,address:e.target.value}))} style={{...S.inp,height:66,resize:"vertical",lineHeight:1.6}} placeholder={"東京都港区新橋6-10-2\n第二新洋ビル 1F"}/></div>
                <div><label style={S.lbl}>担当者名</label><input value={form.contact} onChange={e=>setForm(f=>({...f,contact:e.target.value}))} style={S.inp}/></div>
                <div><label style={S.lbl}>電話</label><input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} style={S.inp}/></div>
                <div><label style={S.lbl}>メール</label><input value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} style={S.inp}/></div>
                <div>
                  <label style={S.lbl}>掛け率 — 空欄 or 0=掛けなし（10掛）</label>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <input type="number" min={0} max={9} step={0.5} value={form.discountRate} onChange={e=>setForm(f=>({...f,discountRate:e.target.value}))} style={{...S.inp,width:100}} placeholder="例: 8"/>
                    <span style={{fontSize:12,color:"#64748b"}}>
                      {(()=>{const k=Number(form.discountRate)||0;return k>0&&k<10?`${k}掛 → ${Math.round((1-k/10)*100)}%OFF`:"掛けなし（定価）"})()}
                    </span>
                  </div>
                </div>
                <div>
                  <label style={S.lbl}>締め支払いサイクル</label>
                  <select value={form.paymentCycle} onChange={e=>setForm(f=>({...f,paymentCycle:e.target.value}))} style={S.inp}>
                    <option value="月末締め 翌月末日">月末締め 翌月末日</option>
                    <option value="月末締め 翌々月末日">月末締め 翌々月末日</option>
                    <option value="月末締め 翌々月5日">月末締め 翌々月5日</option>
                    <option value="月末締め 翌々月10日">月末締め 翌々月10日</option>
                    <option value="月末締め 翌々月25日">月末締め 翌々月25日</option>
                    <option value="月末締め 翌々月15日">月末締め 翌々月15日</option>
                    <option value="スクエア">スクエア（都度払い）</option>
                    <option value="その他">その他</option>
                  </select>
                </div>
                <div style={{gridColumn:"1/-1",display:"flex",alignItems:"center",gap:12,background:"#f8fafc",borderRadius:8,padding:"10px 14px"}}>
                  <label style={{fontSize:12,fontWeight:700,color:"#475569",whiteSpace:"nowrap"}}>請求書の分割</label>
                  <div style={{display:"flex",gap:2,background:"#e2e8f0",borderRadius:6,padding:2}}>
                    <button type="button" onClick={()=>setForm(f=>({...f,splitInvoice:true}))} style={{background:form.splitInvoice?"#fff":"transparent",border:"none",borderRadius:5,padding:"5px 12px",fontSize:11.5,fontWeight:form.splitInvoice?700:500,color:form.splitInvoice?"#1d4ed8":"#94a3b8",cursor:"pointer",boxShadow:form.splitInvoice?"0 1px 3px rgba(0,0,0,0.1)":"none"}}>案件名ごとに分ける</button>
                    <button type="button" onClick={()=>setForm(f=>({...f,splitInvoice:false}))} style={{background:!form.splitInvoice?"#fff":"transparent",border:"none",borderRadius:5,padding:"5px 12px",fontSize:11.5,fontWeight:!form.splitInvoice?700:500,color:!form.splitInvoice?"#9333ea":"#94a3b8",cursor:"pointer",boxShadow:!form.splitInvoice?"0 1px 3px rgba(0,0,0,0.1)":"none"}}>まとめて1枚</button>
                  </div>
                  <span style={{fontSize:10,color:"#94a3b8"}}>{form.splitInvoice?"案件名ごとに別々の請求書を発行":"全案件を1枚の請求書にまとめます（案件名は記録されます）"}</span>
                </div>
                <div style={{gridColumn:"1/-1",display:"flex",alignItems:"center",gap:12,background:"#fff7ed",borderRadius:8,padding:"10px 14px",border:"1px solid #fed7aa"}}>
                  <label style={{fontSize:12,fontWeight:700,color:"#9a3412",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
                    <input type="checkbox" checked={!!form.consolidateMonth} onChange={e=>setForm(f=>({...f,consolidateMonth:e.target.checked}))} style={{cursor:"pointer"}}/>
                    日数値引き：日数が多い月に計上
                  </label>
                  <span style={{fontSize:10,color:"#64748b"}}>{form.consolidateMonth?"月またぎ案件は実日数が多い月にまとめて請求":"月末で切り分けて各月に請求（デフォルト）"}</span>
                </div>
                <div style={{gridColumn:"1/-1",display:"flex",alignItems:"center",gap:12,background:"#f0fdf4",borderRadius:8,padding:"10px 14px",border:"1px solid #bbf7d0"}}>
                  <label style={{fontSize:12,fontWeight:700,color:"#15803d",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
                    <input type="checkbox" checked={!!form.showDeliveryPrice} onChange={e=>setForm(f=>({...f,showDeliveryPrice:e.target.checked}))} style={{cursor:"pointer"}}/>
                    納品書に金額（単価）を記載する
                  </label>
                  <span style={{fontSize:10,color:"#64748b"}}>{form.showDeliveryPrice?"納品書（お客様用）に単価・機材Noを表示します":"デフォルト：納品書には金額を記載しません"}</span>
                  <label style={{fontSize:12,fontWeight:700,color:"#0369a1",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:6,cursor:"pointer",marginTop:8}}>
                    <input type="checkbox" checked={!!form.showDiscountLine} onChange={e=>setForm(f=>({...f,showDiscountLine:e.target.checked}))} style={{cursor:"pointer"}}/>
                    請求書を定価＋お値引き行で表示する
                  </label>
                  <span style={{fontSize:10,color:"#64748b"}}>{form.showDiscountLine?"機材は定価表示・合計にお値引き行を追加":"デフォルト：値引き後の金額を各機材に反映"}</span>
                </div>
                <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>請求書 担当者名</label><input value={form.staff||""} onChange={e=>setForm(f=>({...f,staff:e.target.value}))} style={S.inp} placeholder="例: 井上 雄太（請求書PDFに表示）"/></div>
                <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>備考</label><input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} style={S.inp}/></div>
              </div>
              {/* 案件名リスト */}
              <div style={{marginTop:16,background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:9,padding:16}}>
                <div style={{fontSize:13,fontWeight:700,marginBottom:10,color:"#0369a1",display:"flex",alignItems:"center",gap:6}}>
                  📋 案件名（複数登録可）
                  <span style={{fontSize:11,fontWeight:400,color:"#64748b"}}>— 新規案件登録時のサジェストに使用</span>
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10,minHeight:32}}>
                  {(form.projects||[]).length===0
                    ?<span style={{fontSize:12,color:"#94a3b8"}}>案件名がありません</span>
                    :(form.projects||[]).map((p,i)=>{
                      const useCount=(records||[]).filter(r=>r.customerId===editId&&r.projectName===p).length;
                      return(
                        <span key={i} style={{display:"inline-flex",alignItems:"center",gap:4,background:"#dbeafe",color:"#1d4ed8",borderRadius:20,padding:"3px 10px",fontSize:12,fontWeight:600}}>
                          {p}
                          {useCount>0&&<span style={{fontSize:10,color:"#dc2626",fontWeight:700,marginLeft:2}}>🔒{useCount}件</span>}
                          <button type="button" onClick={e=>{e.stopPropagation();setEditProjModal({index:i,name:p,useCount});setEditProjName(p);}} style={{background:"none",border:"none",cursor:"pointer",padding:"0 2px",display:"flex",alignItems:"center",color:"#64748b"}}><Ico d={I.edit} size={11}/></button>
                        </span>
                      );
                    })
                  }
                </div>
                <div style={{display:"flex",gap:8}}>
                  <input value={projInput} onChange={e=>setProjInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();}}} placeholder="例: CM撮影、バラエティー、ドキュメンタリー..." style={{...S.inp,flex:1}}/>
                  <button onClick={addProj} style={S.btn("#0369a1",true)}><Ico d={I.plus} size={13}/>追加</button>
                </div>
              </div>
              {/* 特別価格 */}
              <div style={{marginTop:16,background:"#fffbeb",border:"1px solid #fde68a",borderRadius:9,padding:16}}>
                <div style={{fontSize:13,fontWeight:700,marginBottom:10,color:"#92400e",display:"flex",alignItems:"center",gap:6}}>
                  <Ico d={I.star} size={14} color="#f59e0b"/>特別価格（この顧客専用）
                </div>
                {(form.specialPrices||[]).map((sp,i)=>{
                  const exists=products.some(x=>x.id===sp.productId);
                  return(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:6,fontSize:12,opacity:exists?1:0.5}}>
                      <span style={{flex:1,fontWeight:600}}>{spName(sp,products)}</span>
                      <span style={{color:"#16a34a",fontWeight:700}}>{fmt(sp.price)}/日（税抜）</span>
                      {!exists&&<span style={{fontSize:9,color:"#ef4444",fontWeight:700}}>製品削除済</span>}
                      <button onClick={()=>{
                        const spn=spName(sp,products);
                        onLogActivity("特別価格削除","customer",form.name,`${spn}を削除`);
                        setForm(f=>({...f,specialPrices:f.specialPrices.filter((_,j)=>j!==i)}));
                      }} style={{background:"none",border:"none",cursor:"pointer"}}><Ico d={I.x} size={14} color="#ef4444"/></button>
                    </div>
                  );
                })}
                <div style={{marginBottom:6}}>
                  <input value={spQ} onChange={e=>setSpQ(e.target.value)} placeholder="製品名・ブランドで検索（1文字以上入力）..." style={{...S.inp,marginBottom:4}}/>
                  {spQ.length>=1?(
                    <select value={spProd} onChange={e=>setSpProd(e.target.value)} style={{...S.inp,marginBottom:6}} size={Math.min(6,filteredSpProds.length+1)}>
                      <option value="">検索結果: {filteredSpProds.length}件（全{products.length}件中）</option>
                      {filteredSpProds.map(p=><option key={p.id} value={p.id}>{p.fullName}（通常{fmt(p.priceEx)}）</option>)}
                    </select>
                  ):(
                    <div style={{fontSize:11,color:"#94a3b8",padding:"8px 0"}}>🔍 製品名を入力すると全{products.length}件から検索できます</div>
                  )}
                </div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  <input type="number" value={spPrice} onChange={e=>setSpPrice(e.target.value)} placeholder="特別単価（税抜）" style={{...S.inp,width:160}}/>
                  <button onClick={addSP} style={S.btn("#f59e0b",true)}><Ico d={I.plus} size={13}/>追加</button>
                </div>
              </div>
              <div style={{display:"flex",gap:10,marginTop:16}}>
                <button onClick={submit} style={S.btn("#0f172a")}>更新</button>
                <button onClick={()=>{setOpen(false);setEditId(null);setForm(E);}} style={S.btn("#94a3b8")}>キャンセル</button>
              </div>
            </div>
          )}
          {!open&&(
            <div style={{...S.card,padding:"14px 18px",marginBottom:16}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px 24px",fontSize:12}}>
                {[
                  ["請求書宛名", c.invoiceName||c.name],
                  ["担当者", c.contact||"―"],
                  ["住所", [c.zipCode?`〒${c.zipCode}`:null,c.address].filter(Boolean).join(" ")||"―"],
                  ["メール", c.email||"―"],
                  ["電話", c.phone||"―"],
                  ["支払サイクル", c.paymentCycle||"―"],
                  ["掛け率", Number(c.discountRate)>0&&Number(c.discountRate)<10?`${c.discountRate}掛`:"定価"],
                  ["請求まとめ", c.splitInvoice===false?"まとめ請求":"案件別"],
                  ["請求書値引き表示", c.showDiscountLine?"定価＋お値引き行":"値引き後単価"],
                ].map(([l,v])=>(
                  <div key={l} style={{display:"flex",gap:8,borderBottom:"1px solid #f1f5f9",paddingBottom:4}}>
                    <span style={{color:"#94a3b8",minWidth:80,flexShrink:0}}>{l}</span>
                    <span style={{color:"#1e293b",fontWeight:500}}>{v||"―"}</span>
                  </div>
                ))}
              </div>
              {c.notes&&<div style={{marginTop:8,fontSize:11,color:"#64748b",background:"#f8fafc",borderRadius:4,padding:"6px 10px"}}>{c.notes}</div>}
            </div>
          )}
          {!open&&<CustomerAnalysis c={c} custRecords={custRecords} products={products} allRecords={records}/>}
          {editProjModal&&(
            <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.45)",zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center"}}
              onClick={()=>setEditProjModal(null)}>
              <div style={{background:"#fff",borderRadius:12,padding:28,width:360,boxShadow:"0 8px 32px rgba(0,0,0,0.25)"}} onClick={e=>e.stopPropagation()}>
                {editProjModal.type==="deleteCust"
                  ?<>
                    <div style={{fontSize:14,fontWeight:700,marginBottom:16,color:"#1e293b"}}>顧客を削除</div>
                    <div style={{marginBottom:20,fontSize:13,color:"#374151"}}>「{editProjModal.name}」を削除しますか？この操作は取り消せません。</div>
                    {(()=>{const custCaseCount=(records||[]).filter(r=>r.customerId===editProjModal.id).length;return custCaseCount>0
                      ?<div style={{color:"#dc2626",fontSize:12,marginBottom:16}}>この顧客には{custCaseCount}件の案件があります。先に案件を削除してから顧客を削除してください。</div>
                      :null;})()}
                    <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                      <button type="button" onClick={()=>setEditProjModal(null)} style={{background:"none",border:"1.5px solid #64748b",color:"#64748b",borderRadius:6,padding:"6px 14px",cursor:"pointer"}}>キャンセル</button>
                      {(records||[]).filter(r=>r.customerId===editProjModal.id).length===0&&(
                        <button type="button" onClick={async()=>{
                          await onDeleteCust(editProjModal.id,editProjModal.name);
                          if(detailId===editProjModal.id)setDetailId(null);
                          setEditProjModal(null);
                          showToast("削除しました");
                        }} style={{background:"#dc2626",color:"#fff",border:"none",borderRadius:6,padding:"6px 14px",cursor:"pointer",fontWeight:700}}>削除する</button>
                      )}
                    </div>
                  </>
                  :<>
                    <div style={{fontSize:14,fontWeight:700,marginBottom:16,color:"#1e293b"}}>案件名を編集</div>
                    {editProjModal.useCount>0&&(
                      <div style={{background:"#fefce8",border:"1px solid #fde047",borderRadius:8,padding:"8px 12px",marginBottom:12,fontSize:12,color:"#713f12"}}>
                        ⚠️ {editProjModal.useCount}件の案件で使用中です
                      </div>
                    )}
                    <input value={editProjName} onChange={e=>setEditProjName(e.target.value)} style={{width:"100%",boxSizing:"border-box",border:"1.5px solid #cbd5e1",borderRadius:6,padding:"8px 10px",fontSize:13,marginBottom:16,outline:"none"}}/>
                    <div style={{display:"flex",gap:8,justifyContent:"space-between"}}>
                      <button type="button" onClick={async()=>{
                        if(editProjModal.useCount>0){showToast("使用中の案件名は削除できません",false);return;}
                        const deletedName=editProjModal.name;
                        const updatedProjects=(form.projects||[]).filter((_,j)=>j!==editProjModal.index);
                        const updatedForm={...form,projects:updatedProjects};
                        setForm(updatedForm);
                        await saveCustomer(updatedForm);
                        await onLogActivity("案件名削除","customer",form.name,`「${deletedName}」を削除`);
                        setEditProjModal(null);
                      }} style={{background:"none",border:"1.5px solid #dc2626",color:"#dc2626",borderRadius:6,padding:"6px 14px",cursor:"pointer",fontSize:12}}>削除</button>
                      <div style={{display:"flex",gap:8}}>
                        <button type="button" onClick={()=>setEditProjModal(null)} style={{background:"none",border:"1.5px solid #64748b",color:"#64748b",borderRadius:6,padding:"6px 14px",cursor:"pointer"}}>キャンセル</button>
                        <button type="button" onClick={async()=>{
                          const trimmed=editProjName.trim();
                          if(!trimmed)return;
                          const oldName=editProjModal.name;
                          const useCount=editProjModal.useCount;
                          const updatedProjects=(form.projects||[]).map((p,j)=>j===editProjModal.index?trimmed:p);
                          const updatedForm={...form,projects:updatedProjects};
                          setForm(updatedForm);
                          await saveCustomer(updatedForm);
                          await onLogActivity("案件名変更","customer",form.name,`「${oldName}」→「${trimmed}」${useCount>0?`（${useCount}件の案件を更新）`:""}`);
                          setEditProjModal(null);
                        }} style={{background:"#2563eb",color:"#fff",border:"none",borderRadius:6,padding:"6px 14px",cursor:"pointer",fontWeight:700}}>変更する</button>
                      </div>
                    </div>
                  </>
                }
              </div>
            </div>
          )}
        </div>
      );
    }
  }

  return(
    <div>

      {open&&(
        <div style={{...S.card,padding:24,marginBottom:18}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
            <h3 style={{margin:0,fontSize:16,fontWeight:700}}>{editId?"顧客を編集":"顧客を追加"}</h3>
            <button onClick={()=>{setOpen(false);setEditId(null);setForm(E);}} style={{background:"none",border:"none",cursor:"pointer"}}><Ico d={I.x} size={18} color="#94a3b8"/></button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px 20px"}}>
            <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>顧客名 * （社内管理用）</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={S.inp} placeholder="株式会社〇〇"/></div>
            <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>請求書宛名（空欄の場合は顧客名を使用）</label><input value={form.invoiceName} onChange={e=>setForm(f=>({...f,invoiceName:e.target.value}))} style={S.inp} placeholder="例: 株式会社〇〇 制作部 ご担当者様"/></div>
            <div><label style={S.lbl}>郵便番号</label><input value={form.zipCode} onChange={e=>setForm(f=>({...f,zipCode:e.target.value}))} style={S.inp} placeholder="000-0000"/></div>
            <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>住所（最大3行、改行で区切り）</label><textarea value={form.address||""} onChange={e=>setForm(f=>({...f,address:e.target.value}))} style={{...S.inp,height:66,resize:"vertical",lineHeight:1.6}} placeholder={"東京都港区新橋6-10-2\n第二新洋ビル 1F"}/></div>
            <div><label style={S.lbl}>担当者名</label><input value={form.contact} onChange={e=>setForm(f=>({...f,contact:e.target.value}))} style={S.inp}/></div>
            <div><label style={S.lbl}>電話</label><input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} style={S.inp}/></div>
            <div><label style={S.lbl}>メール</label><input value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} style={S.inp}/></div>
            <div>
              <label style={S.lbl}>掛け率 — 空欄 or 0=掛けなし（10掛）</label>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <input type="number" min={0} max={9} step={0.5} value={form.discountRate} onChange={e=>setForm(f=>({...f,discountRate:e.target.value}))} style={{...S.inp,width:100}} placeholder="例: 8"/>
                <span style={{fontSize:12,color:"#64748b"}}>
                  {(()=>{const k=Number(form.discountRate)||0;return k>0&&k<10?`${k}掛 → ${Math.round((1-k/10)*100)}%OFF`:"掛けなし（定価）"})()}
                </span>
              </div>
            </div>
            <div>
              <label style={S.lbl}>締め支払いサイクル</label>
              <select value={form.paymentCycle} onChange={e=>setForm(f=>({...f,paymentCycle:e.target.value}))} style={S.inp}>
                <option value="月末締め 翌月末日">月末締め 翌月末日</option>
                <option value="月末締め 翌々月末日">月末締め 翌々月末日</option>
                <option value="月末締め 翌々月5日">月末締め 翌々月5日</option>
                <option value="月末締め 翌々月10日">月末締め 翌々月10日</option>
                <option value="月末締め 翌々月25日">月末締め 翌々月25日</option>
                <option value="月末締め 翌々月15日">月末締め 翌々月15日</option>
                <option value="スクエア">スクエア（都度払い）</option>
                <option value="その他">その他</option>
              </select>
            </div>
            <div style={{gridColumn:"1/-1",display:"flex",alignItems:"center",gap:12,background:"#f8fafc",borderRadius:8,padding:"10px 14px"}}>
              <label style={{fontSize:12,fontWeight:700,color:"#475569",whiteSpace:"nowrap"}}>請求書の分割</label>
              <div style={{display:"flex",gap:2,background:"#e2e8f0",borderRadius:6,padding:2}}>
                <button type="button" onClick={()=>setForm(f=>({...f,splitInvoice:true}))} style={{background:form.splitInvoice?"#fff":"transparent",border:"none",borderRadius:5,padding:"5px 12px",fontSize:11.5,fontWeight:form.splitInvoice?700:500,color:form.splitInvoice?"#1d4ed8":"#94a3b8",cursor:"pointer",boxShadow:form.splitInvoice?"0 1px 3px rgba(0,0,0,0.1)":"none"}}>案件名ごとに分ける</button>
                <button type="button" onClick={()=>setForm(f=>({...f,splitInvoice:false}))} style={{background:!form.splitInvoice?"#fff":"transparent",border:"none",borderRadius:5,padding:"5px 12px",fontSize:11.5,fontWeight:!form.splitInvoice?700:500,color:!form.splitInvoice?"#9333ea":"#94a3b8",cursor:"pointer",boxShadow:!form.splitInvoice?"0 1px 3px rgba(0,0,0,0.1)":"none"}}>まとめて1枚</button>
              </div>
              <span style={{fontSize:10,color:"#94a3b8"}}>{form.splitInvoice?"案件名ごとに別々の請求書を発行":"全案件を1枚の請求書にまとめます（案件名は記録されます）"}</span>
            </div>
            <div style={{gridColumn:"1/-1",display:"flex",alignItems:"center",gap:12,background:"#fff7ed",borderRadius:8,padding:"10px 14px",border:"1px solid #fed7aa"}}>
              <label style={{fontSize:12,fontWeight:700,color:"#9a3412",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
                <input type="checkbox" checked={!!form.consolidateMonth} onChange={e=>setForm(f=>({...f,consolidateMonth:e.target.checked}))} style={{cursor:"pointer"}}/>
                日数値引き：日数が多い月に計上
              </label>
              <span style={{fontSize:10,color:"#64748b"}}>{form.consolidateMonth?"月またぎ案件は実日数が多い月にまとめて請求":"月末で切り分けて各月に請求（デフォルト）"}</span>
            </div>
            <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>請求書 担当者名</label><input value={form.staff||""} onChange={e=>setForm(f=>({...f,staff:e.target.value}))} style={S.inp} placeholder="例: 井上 雄太（請求書PDFに表示）"/></div>
            <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>業種タグ（複数選択可）</label><IndustryTagSelector value={form.industryTags||[]} onChange={v=>setForm(f=>({...f,industryTags:v}))}/></div>
            <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>備考</label><input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} style={S.inp}/></div>
          </div>
          {/* 案件名リスト */}
          <div style={{marginTop:16,background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:9,padding:16}}>
            <div style={{fontSize:13,fontWeight:700,marginBottom:10,color:"#0369a1",display:"flex",alignItems:"center",gap:6}}>
              📋 案件名（複数登録可）
              <span style={{fontSize:11,fontWeight:400,color:"#64748b"}}>— 新規案件登録時のサジェストに使用</span>
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10,minHeight:32}}>
              {(form.projects||[]).length===0
                ?<span style={{fontSize:12,color:"#94a3b8"}}>案件名がありません</span>
                :(form.projects||[]).map((p,i)=>{
                  const useCount=(records||[]).filter(r=>r.customerId===editId&&r.projectName===p).length;
                  return(
                    <span key={i} style={{display:"inline-flex",alignItems:"center",gap:4,background:"#dbeafe",color:"#1d4ed8",borderRadius:20,padding:"3px 10px",fontSize:12,fontWeight:600}}>
                      {p}
                      {useCount>0&&<span style={{fontSize:10,color:"#dc2626",fontWeight:700,marginLeft:2}}>🔒{useCount}件</span>}
                      <button type="button" onClick={e=>{e.stopPropagation();setEditProjModal({index:i,name:p,useCount});setEditProjName(p);}} style={{background:"none",border:"none",cursor:"pointer",padding:"0 2px",display:"flex",alignItems:"center",color:"#64748b"}}><Ico d={I.edit} size={11}/></button>
                    </span>
                  );
                })
              }
            </div>
            <div style={{display:"flex",gap:8}}>
              <input
                value={projInput}
                onChange={e=>setProjInput(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();}}}
                placeholder="例: CM撮影、バラエティー、ドキュメンタリー..."
                style={{...S.inp,flex:1}}
              />
              <button onClick={addProj} style={S.btn("#0369a1",true)}><Ico d={I.plus} size={13}/>追加</button>
            </div>
          </div>
          <div style={{marginTop:16,background:"#fffbeb",border:"1px solid #fde68a",borderRadius:9,padding:16}}>
            <div style={{fontSize:13,fontWeight:700,marginBottom:10,color:"#92400e",display:"flex",alignItems:"center",gap:6}}>
              <Ico d={I.star} size={14} color="#f59e0b"/>特別価格（この顧客専用）
            </div>
            {(form.specialPrices||[]).map((sp,i)=>{
              const exists = products.some(x=>x.id===sp.productId);
              return(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:6,fontSize:12,opacity:exists?1:0.5}}>
                <span style={{flex:1,fontWeight:600}}>{spName(sp,products)}</span>
                <span style={{color:"#16a34a",fontWeight:700}}>{fmt(sp.price)}/日（税抜）</span>
                {!exists&&<span style={{fontSize:9,color:"#ef4444",fontWeight:700}}>製品削除済</span>}
                <button onClick={()=>setForm(f=>({...f,specialPrices:f.specialPrices.filter((_,j)=>j!==i)}))} style={{background:"none",border:"none",cursor:"pointer"}}><Ico d={I.x} size={14} color="#ef4444"/></button>
              </div>
            );})}
            <div style={{marginBottom:6}}>
              <input value={spQ} onChange={e=>setSpQ(e.target.value)} placeholder="製品名・ブランドで検索（1文字以上入力）..." style={{...S.inp,marginBottom:4}}/>
              {spQ.length>=1?(
                <select value={spProd} onChange={e=>setSpProd(e.target.value)} style={{...S.inp,marginBottom:6}} size={Math.min(6,filteredSpProds.length+1)}>
                  <option value="">検索結果: {filteredSpProds.length}件（全{products.length}件中）</option>
                  {filteredSpProds.map(p=><option key={p.id} value={p.id}>{p.fullName}（通常{fmt(p.priceEx)}）</option>)}
                </select>
              ):(
                <div style={{fontSize:11,color:"#94a3b8",padding:"8px 0"}}>🔍 製品名を入力すると全{products.length}件から検索できます</div>
              )}
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <input type="number" value={spPrice} onChange={e=>setSpPrice(e.target.value)} placeholder="特別単価（税抜）" style={{...S.inp,width:160}}/>
              <button onClick={addSP} style={S.btn("#f59e0b",true)}><Ico d={I.plus} size={13}/>追加</button>
            </div>
          </div>
          <div style={{display:"flex",gap:10,marginTop:16}}>
            <button onClick={submit} style={S.btn("#0f172a")}>{editId?"更新":"登録"}</button>
            <button onClick={()=>{setOpen(false);setEditId(null);setForm(E);}} style={S.btn("#94a3b8")}>キャンセル</button>
          </div>
        </div>
      )}
      <div style={S.card}>
        <div style={{padding:"12px 16px",borderBottom:"1px solid #f1f5f9",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
          <h3 style={{margin:0,fontSize:15,fontWeight:700}}>顧客一覧（{customers.length}社）</h3>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <div style={{display:"flex",gap:2,background:"#f1f5f9",borderRadius:6,padding:2}}>
              {[{k:"name",l:"あいうえお順"},{k:"sales",l:"売上高順"}].map(s=>(
                <button key={s.k} onClick={()=>setSortKey(s.k)} style={{background:sortKey===s.k?"#fff":"transparent",border:"none",borderRadius:5,padding:"4px 10px",fontSize:11,fontWeight:sortKey===s.k?700:500,color:sortKey===s.k?"#1e293b":"#94a3b8",cursor:"pointer",boxShadow:sortKey===s.k?"0 1px 3px rgba(0,0,0,0.1)":"none"}}>{s.l}</button>
              ))}
            </div>
            <div style={{position:"relative"}}>
              <div style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",opacity:.4}}><Ico d={I.search} size={13}/></div>
              <input value={custQ} onChange={e=>setCustQ(e.target.value)} placeholder="顧客名で検索..." style={{...S.inp,paddingLeft:28,width:180}}/>
            </div>
            <button onClick={()=>{setForm(E);setEditId(null);setDetailId(null);setOpen(true);}} style={S.btn("#0f172a")}><Ico d={I.plus} size={15}/>顧客を追加</button>
            <button onClick={()=>xlsxInputRef.current?.click()} style={S.btn("#0369a1",true)}>📥 Excelから読み込み</button>
            <input ref={xlsxInputRef} type="file" accept=".xlsx" style={{display:"none"}} onChange={e=>{if(e.target.files[0]){importFromXlsx(e.target.files[0]);e.target.value="";}}}/>
            <button onClick={resetToPreset} style={S.btn("#64748b",true)}>↺ リセット</button>
          </div>
        </div>
        {(()=>{
          const fc=customers.filter(c=>!custQ||c.name.toLowerCase().includes(custQ.toLowerCase()));
          const sorted = [...fc].sort((a,b)=>{
            if(sortKey==="sales") return getSales(b.id)-getSales(a.id);
            return a.name.localeCompare(b.name,"ja");
          });
          return sorted.length===0
          ?<div style={{padding:48,textAlign:"center",color:"#94a3b8"}}>「顧客を追加」から登録してください</div>
          :sorted.map((c,i)=>{
            const sales=getSales(c.id);
            const custRecords=(records||[]).filter(r=>r.customerId===c.id);

            const isSpOpen=exp===c.id;
            return(
            <div key={c.id} id={`cust-${c.id}`} style={{borderBottom:"1px solid #f1f5f9",background:i%2?"#fcfcfc":"#fff",cursor:"pointer"}} onClick={()=>setDetailId(c.id)}>
              <div style={{padding:"12px 16px",display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:34,height:34,borderRadius:"50%",background:"#e0e7ff",display:"flex",alignItems:"center",justifyContent:"center",color:"#4338ca",fontWeight:800,fontSize:14,flexShrink:0}}>{c.name.slice(0,1)}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:14}}>{c.name}</div>
                  <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>
                    {c.paymentCycle&&<span style={{background:"#f0fdf4",color:"#166534",borderRadius:4,padding:"1px 5px",marginRight:6,fontSize:10,fontWeight:600}}>{c.paymentCycle}</span>}
                    {c.splitInvoice===false
                      ?<span style={{background:"#faf5ff",color:"#7c3aed",borderRadius:4,padding:"1px 5px",marginRight:6,fontSize:10,fontWeight:600}}>請求書まとめ</span>
                      :<span style={{background:"#eff6ff",color:"#2563eb",borderRadius:4,padding:"1px 5px",marginRight:6,fontSize:10,fontWeight:600}}>案件別請求</span>
                    }
                    {c.consolidateMonth&&<span style={{background:"#fff7ed",color:"#9a3412",borderRadius:4,padding:"1px 5px",marginRight:6,fontSize:10,fontWeight:600}}>多い月計上</span>}
                    {c.contact&&`担当: ${c.contact}　`}
                    {(()=>{const k=Number(c.discountRate)||0;return k>0&&k<10?<span style={{color:"#16a34a",fontWeight:700}}>{k}掛　</span>:null;})()}
                    {(()=>{const valid=syncSPs(c.specialPrices,products);return valid.length>0?<span style={{color:"#f59e0b",fontWeight:700}}>★特別価格{valid.length}件</span>:null;})()}
                  </div>
                  {c.address&&<div style={{fontSize:10,color:"#b0b8c4",marginTop:1}}>{c.zipCode?`〒${c.zipCode} `:""}{c.address}</div>}
                </div>
                <div style={{textAlign:"right",marginRight:8,minWidth:80}}>
                  <div style={{fontSize:15,fontWeight:800,color:sales>0?"#16a34a":"#cbd5e1"}}>{sales>0?fmt(sales):"―"}</div>
                  {sales>0&&<div style={{fontSize:9,color:"#94a3b8"}}>売上(税抜)</div>}
                </div>

                <div style={{display:"flex",gap:6}} onClick={e=>e.stopPropagation()}>
                  {syncSPs(c.specialPrices,products).length>0&&<button onClick={()=>setExp(isSpOpen?null:c.id)} style={S.ib("#64748b")}><Ico d={I.star} size={12}/></button>}
                  <button onClick={()=>{setDetailId(c.id);setTimeout(()=>{setForm({name:c.name,invoiceName:c.invoiceName||"",zipCode:c.zipCode||"",address:c.address||"",contact:c.contact||"",email:c.email||"",phone:c.phone||"",discountRate:String(c.discountRate||0),paymentCycle:c.paymentCycle||"月末締め 翌々月末日",splitInvoice:c.splitInvoice!==false,consolidateMonth:!!c.consolidateMonth,notes:c.notes||"",staff:c.staff||"",specialPrices:c.specialPrices||[],projects:c.projects||[],showDeliveryPrice:!!c.showDeliveryPrice,showDiscountLine:!!c.showDiscountLine});setEditId(c.id);setOpen(true);},0);}} style={S.ib("#92400e")}><Ico d={I.edit} size={12}/>編集</button>
                  <button onClick={()=>setEditProjModal({type:"deleteCust",id:c.id,name:c.name})} style={S.ib("#991b1b")}><Ico d={I.trash} size={12}/></button>
                </div>
              </div>

              {/* 特別価格展開 */}
              {isSpOpen&&(c.specialPrices||[]).length>0&&(
                <div style={{padding:"0 16px 12px 62px"}}>
                  {c.specialPrices.map((sp,j)=>(
                    <div key={j} style={{display:"flex",alignItems:"center",gap:10,fontSize:12,marginBottom:3}}>
                      <span style={{flex:1,fontWeight:600}}>{spName(sp,products)}</span>
                      <span style={{color:"#16a34a",fontWeight:700}}>{fmt(sp.price)}/日（税抜）</span>
                    </div>
                  ))}
                </div>
              )}

              {/* 分析パネル展開 */}

            </div>
          )})

        })()}
      </div>
      {editProjModal&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.45)",zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center"}}
          onClick={()=>setEditProjModal(null)}>
          <div style={{background:"#fff",borderRadius:12,padding:28,width:360,boxShadow:"0 8px 32px rgba(0,0,0,0.25)"}} onClick={e=>e.stopPropagation()}>
            {editProjModal.type==="deleteCust"
              ?<>
                <div style={{fontSize:14,fontWeight:700,marginBottom:16,color:"#1e293b"}}>顧客を削除</div>
                <div style={{marginBottom:20,fontSize:13,color:"#374151"}}>「{editProjModal.name}」を削除しますか？この操作は取り消せません。</div>
                {(()=>{const custCaseCount=(records||[]).filter(r=>r.customerId===editProjModal.id).length;return custCaseCount>0
                  ?<div style={{color:"#dc2626",fontSize:12,marginBottom:16}}>この顧客には{custCaseCount}件の案件があります。先に案件を削除してから顧客を削除してください。</div>
                  :null;})()}
                <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                  <button type="button" onClick={()=>setEditProjModal(null)} style={{background:"none",border:"1.5px solid #64748b",color:"#64748b",borderRadius:6,padding:"6px 14px",cursor:"pointer"}}>キャンセル</button>
                  {(records||[]).filter(r=>r.customerId===editProjModal.id).length===0&&(
                    <button type="button" onClick={async()=>{
                      await onSave(customers.filter(x=>x.id!==editProjModal.id));
                      if(detailId===editProjModal.id)setDetailId(null);
                      await onLogActivity("削除","customer",editProjModal.name,"顧客を削除しました");
                      setEditProjModal(null);
                      showToast("削除しました");
                    }} style={{background:"#dc2626",color:"#fff",border:"none",borderRadius:6,padding:"6px 14px",cursor:"pointer",fontWeight:700}}>削除する</button>
                  )}
                </div>
              </>
              :<>
                <div style={{fontSize:14,fontWeight:700,marginBottom:16,color:"#1e293b"}}>案件名を編集</div>
                {editProjModal.useCount>0&&(
                  <div style={{background:"#fefce8",border:"1px solid #fde047",borderRadius:8,padding:"8px 12px",marginBottom:12,fontSize:12,color:"#713f12"}}>
                    ⚠️ {editProjModal.useCount}件の案件で使用中です
                  </div>
                )}
                <input value={editProjName} onChange={e=>setEditProjName(e.target.value)} style={{width:"100%",boxSizing:"border-box",border:"1.5px solid #cbd5e1",borderRadius:6,padding:"8px 10px",fontSize:13,marginBottom:16,outline:"none"}}/>
                <div style={{display:"flex",gap:8,justifyContent:"space-between"}}>
                  <button type="button" onClick={async()=>{
                    if(editProjModal.useCount>0){showToast("使用中の案件名は削除できません",false);return;}
                    const deletedName=editProjModal.name;
                    const updatedProjects=(form.projects||[]).filter((_,j)=>j!==editProjModal.index);
                    const updatedForm={...form,projects:updatedProjects};
                    setForm(updatedForm);
                    await saveCustomer(updatedForm);
                    await onLogActivity("案件名削除","customer",form.name,`「${deletedName}」を削除`);
                    setEditProjModal(null);
                  }} style={{background:"none",border:"1.5px solid #dc2626",color:"#dc2626",borderRadius:6,padding:"6px 14px",cursor:"pointer",fontSize:12}}>削除</button>
                  <div style={{display:"flex",gap:8}}>
                    <button type="button" onClick={()=>setEditProjModal(null)} style={{background:"none",border:"1.5px solid #64748b",color:"#64748b",borderRadius:6,padding:"6px 14px",cursor:"pointer"}}>キャンセル</button>
                    <button type="button" onClick={async()=>{
                      const trimmed=editProjName.trim();
                      if(!trimmed)return;
                      const oldName=editProjModal.name;
                      const useCount=editProjModal.useCount;
                      const updatedProjects=(form.projects||[]).map((p,j)=>j===editProjModal.index?trimmed:p);
                      const updatedForm={...form,projects:updatedProjects};
                      setForm(updatedForm);
                      await saveCustomer(updatedForm);
                      await onLogActivity("案件名変更","customer",form.name,`「${oldName}」→「${trimmed}」${useCount>0?`（${useCount}件の案件を更新）`:""}`);
                      setEditProjModal(null);
                    }} style={{background:"#2563eb",color:"#fff",border:"none",borderRadius:6,padding:"6px 14px",cursor:"pointer",fontWeight:700}}>変更する</button>
                  </div>
                </div>
              </>
            }
          </div>
        </div>
      )}
      {resetPresetModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#fff",borderRadius:12,padding:"28px 32px",minWidth:320,boxShadow:"0 8px 32px rgba(0,0,0,0.2)"}}>
            <div style={{fontSize:15,fontWeight:700,marginBottom:12,color:"#991b1b"}}>⚠️ 顧客データをリセットしますか？</div>
            <div style={{fontSize:13,color:"#374151",marginBottom:20}}>プリセット（{presetCustomers.length}社）に戻します。<br/>手動で追加した顧客は失われます。</div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={doResetToPreset} style={{flex:1,background:"#dc2626",color:"#fff",border:"none",borderRadius:7,padding:"9px 0",fontSize:13,fontWeight:700,cursor:"pointer"}}>リセットする</button>
              <button onClick={()=>setResetPresetModal(false)} style={{flex:1,background:"#f1f5f9",color:"#374151",border:"none",borderRadius:7,padding:"9px 0",fontSize:13,cursor:"pointer"}}>キャンセル</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductsTab({products,customers,onSave,saveCust,showToast,allProducts}){
  const E={brand:"",name:"",priceIn:"",memo:"",noBillingDiscount:false,usageMemo:"",cautions:"",combinations:[],faqs:[],photos:[],batteryLife:"",ec_url:""};
  const [form,setForm]=useState(E);
  const [profileTab,setProfileTab]=useState("basic");
  const [comboSearch,setComboSearch]=useState("");
  const [faqForm,setFaqForm]=useState({question:"",answer:""});

  const resizeImage=(file)=>new Promise(resolve=>{
    const reader=new FileReader();
    reader.onload=e=>{
      const img=new Image();
      img.onload=()=>{
        const maxW=1200;
        const scale=Math.min(1,maxW/img.width);
        const canvas=document.createElement('canvas');
        canvas.width=img.width*scale;canvas.height=img.height*scale;
        canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
        resolve(canvas.toDataURL('image/jpeg',0.8));
      };
      img.src=e.target.result;
    };
    reader.readAsDataURL(file);
  });

  const [editId,setEditId]=useState(null);
  const [open,setOpen]=useState(false);
  const formRef=useRef(null);
  const [spList,setSpList]=useState([]);
  const [spCid,setSpCid]=useState("");
  const [spPrice,setSpPrice]=useState("");
  const [prodSpQ,setProdSpQ]=useState("");
  const filteredProdCusts=prodSpQ.length>=1?customers.filter(c=>c.name.includes(prodSpQ)):[];
  const [q,setQ]=useState("");
  const [syncing,setSyncing]=useState(false);
  const [prodKnowledge, setProdKnowledge] = useState([]);
  const [prodKnowledgeLoading, setProdKnowledgeLoading] = useState(false);
  const [knowledgeInputMode, setKnowledgeInputMode] = useState(null);
  const [inlineQ, setInlineQ] = useState("");
  const [inlineA, setInlineA] = useState("");
  const [inlineSaving, setInlineSaving] = useState(false);
  const [syncLog,setSyncLog]=useState(null);
  const [logOpen,setLogOpen]=useState(false);
  const [resetDefaultModal,setResetDefaultModal]=useState(false);
  const [deleteProdModal,setDeleteProdModal]=useState(null); // null | {id:string,name:string}

  const fetchSyncLog=async()=>{
    const {data}=await supabase.from('settings').select('value').eq('key','sync_log').maybeSingle();
    try{setSyncLog(JSON.parse(data?.value||'[]'));}catch{setSyncLog([]);}
  };

  const manualSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const { data: _sd2 } = await supabase.auth.getSession();
      const _token2 = _sd2?.session?.access_token;
      const res = await fetch("https://olq-sync-worker.y-inoue-567.workers.dev/", {
        headers: { 'Authorization': `Bearer ${_token2}` }
      });
      const msg = await res.text();
      alert(msg);
    } catch(e) {
      alert("同期に失敗しました: " + (e.message || "不明なエラー"));
    } finally {
      setSyncing(false);
    }
  };

  const filtered=products.filter(p=>!q||p.fullName.toLowerCase().includes(q.toLowerCase()));
  const getSPs=id=>customers.flatMap(c=>(c.specialPrices||[]).filter(s=>s.productId===id).map(s=>({...s,cname:c.name})));

  const submit=async()=>{
    if(!form.brand||!form.name||!form.priceIn){showToast("ブランド・製品名・定価(税込)は必須",false);return;}
    const priceIn=Number(form.priceIn);
    const priceEx=taxEx(priceIn);
    const pid=editId||uid();
    const p={brand:form.brand,name:form.name,priceIn,priceEx,id:pid,memo:form.memo||"",noBillingDiscount:!!form.noBillingDiscount,usageMemo:form.usageMemo||"",cautions:form.cautions||"",combinations:form.combinations||[],faqs:form.faqs||[],photos:form.photos||[],batteryLife:form.batteryLife||"",ec_url:form.ec_url||""};
    p.fullName=`${p.brand} ${p.name}`;
    try {
      await onSave(editId?products.map(x=>x.id===editId?p:x):[p,...products]);
      if(spList.length>0&&saveCust){
        const updatedCustomers=customers.map(c=>{
          const sp=spList.find(s=>s.cid===c.id);
          if(!sp)return c;
          const existing=(c.specialPrices||[]).filter(s=>s.productId!==pid);
          return {...c,specialPrices:[...existing,{productId:pid,price:sp.price}]};
        });
        await saveCust(updatedCustomers);
      }
      showToast(editId?"更新しました":"追加しました"); setProfileTab("knowledge");setComboSearch("");setFaqForm({question:"",answer:""});setForm(E); setEditId(null); setOpen(false); setProdKnowledge([]);setKnowledgeInputMode(null);setInlineQ("");setInlineA(""); setSpList([]); setSpCid(""); setSpPrice(""); setProdSpQ("");
    } catch(e) {
      showToast("保存に失敗しました。もう一度お試しください。",false);
      console.error("saveProd error",e);
    }
  };

  const fetchProdKnowledge = async (pid) => {
    if(!pid) return;
    setProdKnowledgeLoading(true);
    const {data,error} = await supabase
      .from('knowledge')
      .select('*')
      .contains('related_product_ids', [String(pid)])
      .eq('status','approved')
      .is('deleted_at', null)
      .order('created_at', {ascending: false});
    setProdKnowledgeLoading(false);
    if(error){console.error('fetchProdKnowledge error',error);return;}
    setProdKnowledge(data||[]);
  };

  const saveInlineKnowledge = async (pid, productName) => {
    if(!inlineQ.trim()) return;
    setInlineSaving(true);
    const isQOnly = knowledgeInputMode === 'q_only';
    const row = {
      question_text: inlineQ.trim(),
      answer_text: isQOnly ? null : (inlineA.trim() || null),
      status: 'pending',
      related_product_ids: [String(pid)],
      scenario_tags: [],
      public_status: 'internal_only',
      created_by: (await supabase.auth.getUser()).data?.user?.email || "",
    };
    const {error} = await supabase.from('knowledge').insert([row]);
    setInlineSaving(false);
    if(error){alert('保存に失敗しました: '+error.message);return;}
    setInlineQ("");
    setInlineA("");
    setKnowledgeInputMode(null);
    fetchProdKnowledge(pid);
  };

  const resetToDefault=()=>{
    setResetDefaultModal(true);
  };
  const doResetToDefault=async()=>{
    setResetDefaultModal(false);
    await onSave(allProducts);
    showToast(`${allProducts.length}件にリセットしました`);
  };

  return(
    <div>
      {open&&(
        <div ref={formRef} style={{...S.card,padding:24,marginBottom:18}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
            <h3 style={{margin:0,fontSize:16,fontWeight:700}}>{editId?"製品を編集":"製品を追加"}</h3>
            <button onClick={()=>{setOpen(false);setEditId(null);setForm(E);setProdKnowledge([]);setKnowledgeInputMode(null);setInlineQ("");setInlineA("");}} style={{background:"none",border:"none",cursor:"pointer"}}><Ico d={I.x} size={18} color="#94a3b8"/></button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"12px 20px"}}>
            <div><label style={S.lbl}>ブランド *</label><input value={form.brand} onChange={e=>setForm(f=>({...f,brand:e.target.value}))} style={S.inp} placeholder="Sony"/></div>
            <div><label style={S.lbl}>製品名 *</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={S.inp} placeholder="FX3"/></div>
            <div>
              <label style={S.lbl}>定価（税込）/日 *</label>
              <input type="number" value={form.priceIn} onChange={e=>setForm(f=>({...f,priceIn:e.target.value}))} style={S.inp} placeholder="例: 11000"/>
              {form.priceIn&&<div style={{fontSize:11,color:"#16a34a",marginTop:3}}>税抜: {fmt(taxEx(Number(form.priceIn)))}/日</div>}
            </div>
            <div style={{gridColumn:"1/-1"}}>
              <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13}}>
                <input
                  type="checkbox"
                  checked={!!form.noBillingDiscount}
                  onChange={e=>setForm(f=>({...f,noBillingDiscount:e.target.checked}))}
                />
                日数値引き非適用（チェックを入れると日数値引きが適用されなくなります）
              </label>
            </div>
            <div style={{gridColumn:"1/-1",borderTop:"1px solid #e2e8f0",marginTop:8,paddingTop:16}}>
  <div style={{display:"flex",gap:4,marginBottom:16,flexWrap:"wrap"}}>
    {[{k:"knowledge",l:"📚 ナレッジ"},{k:"photos",l:"📷 写真"},{k:"basic",l:"基本情報"}].map(t=>(
      <button key={t.k} type="button" onClick={()=>setProfileTab(t.k)}
        style={{padding:"5px 12px",borderRadius:6,border:"none",cursor:"pointer",fontSize:12,fontWeight:profileTab===t.k?700:400,background:profileTab===t.k?"#0f172a":"#f1f5f9",color:profileTab===t.k?"#fff":"#64748b"}}>
        {t.l}
      </button>
    ))}
  </div>

  {profileTab==="knowledge"&&(
    <div>
      {/* 未回答バッジ */}
      {prodKnowledge.filter(k=>k.status==='unanswered').length>0&&(
        <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:6,padding:"6px 12px",marginBottom:12,fontSize:12,color:"#dc2626",fontWeight:600}}>
          ⚠️ 未回答の質問 {prodKnowledge.filter(k=>k.status==='unanswered').length}件
        </div>
      )}

      {prodKnowledgeLoading&&<div style={{color:"#94a3b8",fontSize:13}}>読み込み中...</div>}

      {/* ナレッジ一覧 */}
      {!prodKnowledgeLoading&&(
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16,maxHeight:320,overflowY:"auto"}}>
          {/* 未回答を先頭に */}
          {[...prodKnowledge.filter(k=>k.status==='unanswered'), ...prodKnowledge.filter(k=>k.status!=='unanswered')].map(k=>(
            <div key={k.id} style={{background:k.status==='unanswered'?"#fef9f0":"#f8fafc",border:`1px solid ${k.status==='unanswered'?"#fde68a":"#e2e8f0"}`,borderRadius:8,padding:12}}>
              <div style={{fontSize:12,fontWeight:600,color:"#0f172a",marginBottom:4}}>
                {k.status==='unanswered'&&<span style={{color:"#d97706",marginRight:6}}>⚠️ 未回答</span>}
                ❓ {k.question_text||"（質問なし）"}
              </div>
              {k.answer_text&&(
                <div style={{fontSize:12,color:"#334155",whiteSpace:"pre-wrap",lineHeight:1.6}}>
                  {k.answer_text}
                </div>
              )}
              {k.status==='unanswered'&&(
                <button
                  onClick={()=>{setInlineQ(k.question_text||"");setKnowledgeInputMode('qa');}}
                  style={{marginTop:6,fontSize:11,padding:"3px 8px",borderRadius:4,border:"1px solid #d97706",background:"#fffbeb",color:"#d97706",cursor:"pointer"}}>
                  ✏️ 答えを書く
                </button>
              )}
              <div style={{fontSize:10,color:"#94a3b8",marginTop:4}}>
                {k.created_by} · {new Date(k.created_at).toLocaleDateString('ja-JP')}
              </div>
            </div>
          ))}
          {prodKnowledge.length===0&&(
            <div style={{color:"#94a3b8",fontSize:12,textAlign:"center",padding:24}}>
              まだナレッジがありません。下から追加してください。
            </div>
          )}
        </div>
      )}

      {/* 投稿UI */}
      {knowledgeInputMode===null&&(
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setKnowledgeInputMode('q_only')}
            style={{flex:1,padding:"8px",borderRadius:6,border:"1px solid #fde68a",background:"#fffbeb",fontSize:12,cursor:"pointer",color:"#d97706",fontWeight:600}}>
            ❓ 質問を登録
          </button>
        </div>
      )}

      {knowledgeInputMode!==null&&(
        <div style={{border:"1px solid #e2e8f0",borderRadius:8,padding:12,background:"#fff"}}>
          <div style={{fontSize:12,color:"#64748b",marginBottom:8,fontWeight:600}}>
            ❓ 質問を登録
          </div>
          <input
            type="text"
            value={inlineQ}
            onChange={e=>setInlineQ(e.target.value)}
            placeholder="質問を入力..."
            style={{width:"100%",padding:"7px 10px",borderRadius:6,border:"1px solid #e2e8f0",fontSize:12,marginBottom:8,boxSizing:"border-box"}}
          />
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>saveInlineKnowledge(editId, form.name)}
              disabled={!inlineQ.trim()||inlineSaving}
              style={{flex:1,padding:"7px",borderRadius:6,border:"none",background:inlineQ.trim()?"#0f172a":"#e2e8f0",color:inlineQ.trim()?"#fff":"#94a3b8",fontSize:12,fontWeight:600,cursor:inlineQ.trim()?"pointer":"not-allowed"}}>
              {inlineSaving?"保存中...":"💾 保存"}
            </button>
            <button onClick={()=>{setKnowledgeInputMode(null);setInlineQ("");setInlineA("");}}
              style={{padding:"7px 12px",borderRadius:6,border:"1px solid #e2e8f0",background:"#fff",fontSize:12,cursor:"pointer",color:"#64748b"}}>
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  )}

  {profileTab==="photos"&&(
    <div>
      <label style={S.lbl}>写真を追加（最大1200px・JPEG圧縮して保存）</label>
      <input type="file" accept="image/*" multiple onChange={async e=>{
        const files=Array.from(e.target.files||[]);
        const results=await Promise.all(files.map(f=>resizeImage(f)));
        setForm(fm=>({...fm,photos:[...(fm.photos||[]),...results.map(dataUrl=>({id:uid(),dataUrl,caption:""}))]}));
        e.target.value="";
      }} style={{...S.inp,padding:8}}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:10,marginTop:12}}>
        {(form.photos||[]).map((ph,i)=>(
          <div key={ph.id} style={{position:"relative",borderRadius:8,overflow:"hidden",border:"1px solid #e2e8f0"}}>
            <img src={ph.dataUrl} alt="" style={{width:"100%",height:120,objectFit:"cover",display:"block"}}/>
            <div style={{padding:6}}>
              <input value={ph.caption} onChange={e=>setForm(f=>({...f,photos:f.photos.map((x,j)=>j===i?{...x,caption:e.target.value}:x)}))} placeholder="キャプション" style={{...S.inp,fontSize:11,padding:"3px 6px"}}/>
            </div>
            <button type="button" onClick={()=>setForm(f=>({...f,photos:f.photos.filter((_,j)=>j!==i)}))} style={{position:"absolute",top:4,right:4,background:"rgba(0,0,0,0.6)",border:"none",borderRadius:4,cursor:"pointer",padding:"2px 6px"}}><Ico d={I.x} size={12} color="#fff"/></button>
          </div>
        ))}
      </div>
    </div>
  )}

  {profileTab==="basic"&&(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {(()=>{
        const prod=products.find(p=>p.id===editId);
        if(!prod||(!prod.ecDescription&&!prod.ecRecordingTime&&!prod.ecOlqNotes&&!prod.ecHasImageData))return null;
        return(
          <div style={{background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:8,padding:12}}>
            <div style={{fontSize:12,fontWeight:700,color:"#0369a1",marginBottom:8}}>🌐 ECサイトデータ（読み取り専用）</div>
            {prod.ecHasImageData&&(
              <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:6,padding:"6px 10px",marginBottom:8,fontSize:12,color:"#dc2626"}}>
                ⚠️ 収録時間データに画像が含まれています。ECサイトを直接確認してください。
              </div>
            )}
            {prod.ecDescription&&(
              <div style={{marginBottom:8}}>
                <div style={{fontSize:11,color:"#0369a1",fontWeight:600,marginBottom:2}}>詳細</div>
                <div style={{fontSize:12,color:"#334155",whiteSpace:"pre-wrap",background:"#fff",border:"1px solid #e2e8f0",borderRadius:6,padding:8,maxHeight:200,overflowY:"auto"}}>{prod.ecDescription}</div>
              </div>
            )}
            {prod.ecRecordingTime&&(
              <div style={{marginBottom:8}}>
                <div style={{fontSize:11,color:"#0369a1",fontWeight:600,marginBottom:2}}>収録時間</div>
                <div style={{fontSize:12,color:"#334155",whiteSpace:"pre-wrap",background:"#fff",border:"1px solid #e2e8f0",borderRadius:6,padding:8}}>{prod.ecRecordingTime}</div>
              </div>
            )}
            {prod.ecOlqNotes&&(
              <div>
                <div style={{fontSize:11,color:"#0369a1",fontWeight:600,marginBottom:2}}>OLQノート</div>
                <div style={{fontSize:12,color:"#334155",whiteSpace:"pre-wrap",background:"#fff",border:"1px solid #e2e8f0",borderRadius:6,padding:8,maxHeight:150,overflowY:"auto"}}>{prod.ecOlqNotes}</div>
              </div>
            )}
          </div>
        );
      })()}
      <div>
        <label style={S.lbl}>ECサイトURL</label>
        <input value={form.ec_url||""} onChange={e=>setForm(f=>({...f,ec_url:e.target.value}))} placeholder="例: https://rental.olq.co.jp/products/xxx" style={S.inp}/>
      </div>
      <div>
        <label style={S.lbl}>バッテリー持続時間（手動入力）</label>
        <input value={form.batteryLife||""} onChange={e=>setForm(f=>({...f,batteryLife:e.target.value}))} placeholder="例: 約90分（4K記録時）" style={S.inp}/>
      </div>
      <div>
        <label style={S.lbl}>備考</label>
        <textarea value={form.memo||""} onChange={e=>setForm(f=>({...f,memo:e.target.value}))} rows={6} style={{...S.inp,height:"auto",resize:"vertical"}} placeholder="製品に関するメモ（納品書等には反映されません）"/>
      </div>
      <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:9,padding:16}}>
        <div style={{fontSize:13,fontWeight:700,marginBottom:10,color:"#92400e",display:"flex",alignItems:"center",gap:6}}>
          <Ico d={I.star} size={14} color="#f59e0b"/>特別価格顧客（この製品専用）
        </div>
        {spList.map((s,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:6,fontSize:12}}>
            <span style={{flex:1,fontWeight:600}}>{s.cname}</span>
            <span style={{color:"#16a34a",fontWeight:700}}>{fmt(s.price)}/日（税込）</span>
            <button type="button" onClick={()=>setSpList(l=>l.filter((_,j)=>j!==i))} style={{background:"none",border:"none",cursor:"pointer"}}><Ico d={I.x} size={14} color="#ef4444"/></button>
          </div>
        ))}
        <div style={{marginBottom:6}}>
          <input value={prodSpQ} onChange={e=>setProdSpQ(e.target.value)} placeholder="顧客名で検索（1文字以上入力）..." style={{...S.inp,marginBottom:4}}/>
          {prodSpQ.length>=1?(
            <select value={spCid} onChange={e=>setSpCid(e.target.value)} style={{...S.inp,marginBottom:6}} size={Math.min(6,filteredProdCusts.length+1)}>
              <option value="">検索結果: {filteredProdCusts.length}件（全{customers.length}件中）</option>
              {filteredProdCusts.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ):(
            <div style={{fontSize:11,color:"#94a3b8",padding:"8px 0"}}>🔍 顧客名を入力すると全{customers.length}社から検索できます</div>
          )}
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <input type="number" value={spPrice} onChange={e=>setSpPrice(e.target.value)} placeholder="特別単価（税込）" style={{...S.inp,width:160}}/>
          <button type="button" onClick={()=>{
            if(!spCid||!spPrice){return;}
            setSpList(l=>{
              const cust=customers.find(c=>c.id===spCid);
              const filtered=l.filter(s=>s.cid!==spCid);
              return [...filtered,{cid:spCid,cname:cust?.name||"",price:Number(spPrice)}];
            });
            setSpCid(""); setSpPrice(""); setProdSpQ("");
          }} style={S.btn("#f59e0b",true)}><Ico d={I.plus} size={13}/>追加</button>
        </div>
      </div>
    </div>
  )}
</div>
          </div>
          <div style={{display:"flex",gap:10,marginTop:16}}>
            <button onClick={submit} style={S.btn("#0f172a")}>{editId?"更新":"追加"}</button>
            <button onClick={()=>{setOpen(false);setEditId(null);setForm(E);setSpList([]);setSpCid("");setSpPrice("");setProdSpQ("");setProdKnowledge([]);setKnowledgeInputMode(null);setInlineQ("");setInlineA("");}} style={S.btn("#94a3b8")}>キャンセル</button>
          </div>
        </div>
      )}
      <div style={{...S.card,padding:"12px 16px",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
        <div style={{fontSize:13,color:"#64748b"}}>
          <strong style={{color:"#0f172a"}}>{products.length}件</strong>の製品
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <div style={{position:"relative"}}>
            <div style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",opacity:.4}}><Ico d={I.search} size={13}/></div>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="絞込..." style={{...S.inp,paddingLeft:28,width:200}}/>
          </div>
          <button onClick={()=>{setForm(E);setEditId(null);setOpen(true);}} style={S.btn("#0f172a",true)}><Ico d={I.plus} size={13}/>製品を追加</button>
          <button onClick={manualSync} disabled={syncing} style={S.btn("#0369a1",true)}>{syncing?"同期中...":"🔄 手動同期"}</button>
          <button onClick={()=>{setLogOpen(true);fetchSyncLog();}} style={S.btn("#7c3aed",true)}>📋 同期ログ</button>
          <button onClick={resetToDefault} style={S.btn("#64748b",true)}>↺ リセット</button>
        </div>
      </div>
      <div style={S.card}>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5}}>
            <thead><tr style={{background:"#f8fafc",borderBottom:"2px solid #e2e8f0"}}>
              {["ブランド","製品名","定価(税込)/日","定価(税抜)/日","日数値引き","特別価格顧客",""].map(h=>(
                <th key={h} style={{padding:"9px 14px",textAlign:"left",fontWeight:700,color:"#475569",whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.length===0
                ?<tr><td colSpan={7} style={{padding:48,textAlign:"center",color:"#94a3b8"}}>製品がありません</td></tr>
                :filtered.map((p,i)=>{
                  const sps=getSPs(p.id);
                  return(
                    <tr key={p.id} style={{borderBottom:"1px solid #f1f5f9",background:i%2?"#fcfcfc":"#fff"}}>
                      <td style={{padding:"9px 14px",color:"#64748b",fontSize:11}}>{p.brand}</td>
                      <td style={{padding:"9px 14px",fontWeight:600}}>
                        {p.name}
                        {(p.usageMemo||p.combinations?.length||p.faqs?.length||p.photos?.length||p.cautions)&&<span style={{marginLeft:6,fontSize:9,background:"#dbeafe",color:"#1e40af",borderRadius:4,padding:"1px 5px"}}>📋</span>}
                      </td>
                      <td style={{padding:"9px 14px",textAlign:"right"}}>{fmt(p.priceIn)}</td>
                      <td style={{padding:"9px 14px",textAlign:"right",fontWeight:700,color:"#16a34a"}}>{fmt(p.priceEx)}</td>
                      <td style={{padding:"9px 14px",textAlign:"center"}}>
                        <label style={{display:"flex",alignItems:"center",justifyContent:"center",gap:4,fontSize:11,cursor:"pointer",userSelect:"none"}} title="チェックを入れると日数値引きが非適用になります">
                          <input
                            type="checkbox"
                            checked={!!p.noBillingDiscount}
                            onChange={async e=>{
                              const updated=products.map(x=>x.id===p.id?{...x,noBillingDiscount:e.target.checked}:x);
                              await onSave(updated);
                              showToast(e.target.checked?"日数値引き非適用に設定しました":"日数値引き適用に戻しました");
                            }}
                          />
                          <span style={{color:p.noBillingDiscount?"#ef4444":"#94a3b8",fontWeight:p.noBillingDiscount?700:400}}>
                            {p.noBillingDiscount?"非適用":"―"}
                          </span>
                        </label>
                      </td>
                      <td style={{padding:"9px 14px"}}>
                        {sps.length===0
                          ?<span style={{fontSize:11,color:"#cbd5e1"}}>なし</span>
                          :sps.map((s,j)=><span key={j} style={{fontSize:11,background:"#fef3c7",color:"#92400e",borderRadius:4,padding:"2px 6px",marginRight:4}}>{s.cname}: {fmt(s.price)}</span>)
                        }
                      </td>
                      <td style={{padding:"9px 14px",whiteSpace:"nowrap"}}>
                        <button onClick={()=>{setForm({brand:p.brand,name:p.name,priceIn:String(p.priceIn),memo:p.memo||"",noBillingDiscount:p.noBillingDiscount||false,usageMemo:p.usageMemo||"",cautions:p.cautions||"",combinations:p.combinations||[],faqs:p.faqs||[],photos:p.photos||[],batteryLife:p.batteryLife||"",ec_url:p.ec_url||""});setProfileTab("knowledge");setComboSearch("");setFaqForm({question:"",answer:""});setSpList(customers.flatMap(c=>(c.specialPrices||[]).filter(s=>s.productId===p.id).map(s=>({cid:c.id,cname:c.name,price:s.price}))));setSpCid("");setSpPrice("");setProdSpQ("");setEditId(p.id);setOpen(true);fetchProdKnowledge(p.id);setTimeout(()=>formRef.current?.scrollIntoView({behavior:"smooth"}),50);}} style={{...S.ib("#92400e"),marginRight:4}}><Ico d={I.edit} size={12}/>編集</button>
                        <button onClick={()=>setDeleteProdModal({id:p.id,name:p.name})} style={S.ib("#991b1b")}><Ico d={I.trash} size={12}/></button>
                      </td>
                    </tr>
                  );
                })
              }
            </tbody>
          </table>
        </div>
      </div>
      <div style={{marginTop:10,fontSize:12,color:"#94a3b8"}}>💡 特別価格は「顧客管理」タブの各顧客編集から設定できます</div>
      {logOpen&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setLogOpen(false)}>
          <div style={{background:"#fff",borderRadius:12,padding:28,width:"90%",maxWidth:700,maxHeight:"80vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <h3 style={{margin:0,fontSize:16,fontWeight:700}}>📋 同期ログ（直近20件）</h3>
              <button onClick={()=>setLogOpen(false)} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:"#94a3b8"}}>×</button>
            </div>
            {syncLog===null
              ?<div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>読み込み中...</div>
              :syncLog.length===0
                ?<div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>ログがありません</div>
                :syncLog.map((log,i)=>(
                  <div key={i} style={{borderBottom:"1px solid #f1f5f9",padding:"12px 0"}}>
                    <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:6}}>
                      <span style={{fontSize:12,color:"#64748b"}}>{log.at}</span>
                      <span style={{fontSize:11,background:log.mode==="auto"?"#eff6ff":"#f0fdf4",color:log.mode==="auto"?"#2563eb":"#16a34a",borderRadius:4,padding:"2px 7px",fontWeight:700}}>{log.mode==="auto"?"自動":"手動"}</span>
                      <span style={{fontSize:11,background:log.status==="success"?"#f0fdf4":"#fef2f2",color:log.status==="success"?"#16a34a":"#dc2626",borderRadius:4,padding:"2px 7px",fontWeight:700}}>{log.status==="success"?"✅ 成功":"❌ 失敗"}</span>
                      <span style={{fontSize:12,fontWeight:700}}>計{log.total}件</span>
                    </div>
                    <div style={{display:"flex",gap:16,fontSize:12}}>
                      <span style={{color:"#16a34a"}}>＋追加 {log.added?.count||0}件{log.added?.names?.length>0?`（${log.added.names.join("、")}）`:""}</span>
                      <span style={{color:"#f59e0b"}}>～修正 {log.modified?.count||0}件{log.modified?.names?.length>0?`（${log.modified.names.join("、")}）`:""}</span>
                      <span style={{color:"#ef4444"}}>－削除 {log.deleted?.count||0}件{log.deleted?.names?.length>0?`（${log.deleted.names.join("、")}）`:""}</span>
                    </div>
                  </div>
                ))
            }
          </div>
        </div>
      )}
      {resetDefaultModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#fff",borderRadius:12,padding:"28px 32px",minWidth:320,boxShadow:"0 8px 32px rgba(0,0,0,0.2)"}}>
            <div style={{fontSize:15,fontWeight:700,marginBottom:12,color:"#991b1b"}}>⚠️ 製品マスタをリセットしますか？</div>
            <div style={{fontSize:13,color:"#374151",marginBottom:20}}>サイトのデータ（{allProducts.length}件）に戻します。<br/>カスタム変更は失われます。</div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={doResetToDefault} style={{flex:1,background:"#dc2626",color:"#fff",border:"none",borderRadius:7,padding:"9px 0",fontSize:13,fontWeight:700,cursor:"pointer"}}>リセットする</button>
              <button onClick={()=>setResetDefaultModal(false)} style={{flex:1,background:"#f1f5f9",color:"#374151",border:"none",borderRadius:7,padding:"9px 0",fontSize:13,cursor:"pointer"}}>キャンセル</button>
            </div>
          </div>
        </div>
      )}
      {deleteProdModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#fff",borderRadius:12,padding:"28px 32px",minWidth:320,boxShadow:"0 8px 32px rgba(0,0,0,0.2)"}}>
            <div style={{fontSize:15,fontWeight:700,marginBottom:12,color:"#991b1b"}}>⚠️ 製品を削除しますか？</div>
            <div style={{fontSize:13,color:"#374151",marginBottom:20}}>{deleteProdModal.name}</div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={async()=>{const id=deleteProdModal.id;setDeleteProdModal(null);await onSave(products.filter(x=>x.id!==id));showToast("削除しました");}} style={{flex:1,background:"#dc2626",color:"#fff",border:"none",borderRadius:7,padding:"9px 0",fontSize:13,fontWeight:700,cursor:"pointer"}}>削除する</button>
              <button onClick={()=>setDeleteProdModal(null)} style={{flex:1,background:"#f1f5f9",color:"#374151",border:"none",borderRadius:7,padding:"9px 0",fontSize:13,cursor:"pointer"}}>キャンセル</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================
// LoginScreen
// =========================================================
function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError('メールアドレスまたはパスワードが正しくありません');
    setLoading(false);
  };

  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'#f1f5f9',fontFamily:"'Noto Sans JP','Hiragino Sans',sans-serif"}}>
      <div style={{background:'#fff',borderRadius:16,boxShadow:'0 4px 32px rgba(0,0,0,0.10)',padding:'40px 36px',width:360}}>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',marginBottom:28}}>
          <div style={{background:"#fff",borderRadius:"50%",width:56,height:56,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",padding:6,marginBottom:14,boxShadow:"0 2px 12px rgba(0,0,0,0.10)"}}>
            <img src="/olq-logo.png" alt="olq" style={{width:"100%",height:"100%",objectFit:"contain"}}/>
          </div>
          <span style={{fontWeight:800,fontSize:17,letterSpacing:2,color:'#0f172a'}}>オルク レンタル伝票管理</span>
        </div>
        <form onSubmit={handleLogin}>
          <div style={{marginBottom:14}}>
            <label style={{display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:4}}>メールアドレス</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required
              style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:7,fontSize:13,outline:'none',boxSizing:'border-box'}}/>
          </div>
          <div style={{marginBottom:20}}>
            <label style={{display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:4}}>パスワード</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required
              style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:7,fontSize:13,outline:'none',boxSizing:'border-box'}}/>
          </div>
          {error && <div style={{color:'#dc2626',fontSize:12,marginBottom:12,padding:'8px 12px',background:'#fef2f2',borderRadius:6}}>{error}</div>}
          <button type="submit" disabled={loading}
            style={{width:'100%',padding:'10px',background:'#0f172a',color:'#fff',border:'none',borderRadius:8,fontSize:14,fontWeight:700,cursor:loading?'not-allowed':'pointer',opacity:loading?0.7:1}}>
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  );
}

// =========================================================
// SnapshotScreen
// =========================================================
function SnapshotScreen({onDone, showToast, setCustomers, setRecords, setInvoiceData, setProducts}) {
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);
  const [confirmSnap, setConfirmSnap] = useState(null);

  useEffect(()=>{
    (async()=>{
      const {data} = await supabase.from('snapshots').select('id,at,data,created_at').order('created_at',{ascending:false}).limit(36);
      if(data) setSnapshots(data.map(row => ({ ...row.data, _id: row.id, _created_at: row.created_at })));
      setLoading(false);
    })();
  },[]);

  const doRestore = async(snap) => {
    setRestoring(true);
    try {
      if(snap.olqP7?.length){
        const rows=snap.olqP7.map(p=>({id:String(p.id),data:p,updated_at:new Date().toISOString()}));
        await supabase.from('products').upsert(rows,{onConflict:'id'});
        setProducts(snap.olqP7);
      }
      if(snap.olqC7?.length){
        const rows=snap.olqC7.map(c=>({id:String(c.id),data:c,updated_at:new Date().toISOString()}));
        await supabase.from('customers').upsert(rows,{onConflict:'id'});
        setCustomers(snap.olqC7);
      }
      if(snap.olqR7?.length){
        const rows=snap.olqR7.map(r=>({id:String(r.id),data:r,updated_at:new Date().toISOString()}));
        await supabase.from('cases').upsert(rows,{onConflict:'id'});
        setRecords(snap.olqR7);
      }
      if(snap.olqInv7&&Object.keys(snap.olqInv7).length){
        const rows=Object.entries(snap.olqInv7).map(([id,v])=>({id,data:v,is_locked:v?.status==='locked',updated_at:new Date().toISOString()}));
        await supabase.from('invoices').upsert(rows,{onConflict:'id'});
        setInvoiceData(snap.olqInv7);
      }
      showToast(snap.at+'に復元しました');
      setConfirmSnap(null);
      onDone();
    } catch(e) {
      showToast('復元失敗: '+e.message, false);
    }
    setRestoring(false);
  };

  return(
    <div style={{maxWidth:700,margin:'0 auto',padding:'40px 20px'}}>
      <div style={{background:'#fff',borderRadius:14,boxShadow:'0 2px 16px rgba(0,0,0,0.07)',padding:32}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <h2 style={{margin:0,fontSize:18,fontWeight:800}}>🕐 スナップショット一覧</h2>
          <button onClick={onDone} style={{background:'none',border:'1.5px solid #e2e8f0',borderRadius:6,padding:'6px 14px',cursor:'pointer',fontSize:12,color:'#64748b'}}>閉じる</button>
        </div>
        <p style={{fontSize:12,color:'#64748b',marginBottom:16}}>毎時自動保存（11〜22時）。3日分を保持。選択した時点のデータに復元できます。</p>
        {loading
          ? <div style={{textAlign:'center',padding:40,color:'#94a3b8'}}>読み込み中...</div>
          : snapshots.length===0
            ? <div style={{textAlign:'center',padding:40,color:'#94a3b8'}}>スナップショットがありません</div>
            : snapshots.map((snap,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderRadius:8,background:i%2?'#f8fafc':'#fff',border:'1px solid #f1f5f9',marginBottom:6}}>
                <div>
                  <span style={{fontWeight:600,fontSize:13}}>{snap.at}</span>
                  <span style={{fontSize:11,color:'#94a3b8',marginLeft:12}}>製品{snap.olqP7?.length||0}件 / 顧客{snap.olqC7?.length||0}件 / 案件{snap.olqR7?.length||0}件 / 請求{snap.olqInv7?Object.keys(snap.olqInv7).length:0}件</span>
                </div>
                <button onClick={()=>setConfirmSnap(snap)} disabled={restoring}
                  style={{background:'#2563eb',color:'#fff',border:'none',borderRadius:6,padding:'5px 14px',cursor:restoring?'not-allowed':'pointer',fontSize:12,fontWeight:700,opacity:restoring?0.5:1}}>
                  この時点に復元
                </button>
              </div>
            ))
        }
      </div>
      {confirmSnap&&(
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.45)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center'}}
          onClick={()=>setConfirmSnap(null)}>
          <div style={{background:'#fff',borderRadius:12,padding:28,width:380,boxShadow:'0 8px 32px rgba(0,0,0,0.25)'}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:14,fontWeight:700,marginBottom:8,color:'#1e293b'}}>⚠️ 復元の確認</div>
            <div style={{fontSize:13,color:'#374151',marginBottom:8}}><strong>{confirmSnap.at}</strong> の状態に復元します。</div>
            <div style={{fontSize:12,color:'#dc2626',background:'#fef2f2',borderRadius:6,padding:'8px 12px',marginBottom:8}}>現在のデータは上書きされます。この操作は取り消せません。</div>
            <div style={{marginTop:8,marginBottom:20,padding:"8px 12px",background:"#fef9c3",borderRadius:6,fontSize:11,color:"#92400e"}}>
              ⚠️ スナップショット以降に追加されたデータは残ります。完全に元に戻したい場合は復元後に手動で確認してください。
            </div>
            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button onClick={()=>setConfirmSnap(null)} style={{background:'none',border:'1.5px solid #64748b',color:'#64748b',borderRadius:6,padding:'6px 18px',cursor:'pointer'}}>キャンセル</button>
              <button onClick={()=>doRestore(confirmSnap)} disabled={restoring}
                style={{background:'#dc2626',color:'#fff',border:'none',borderRadius:6,padding:'6px 18px',cursor:'pointer',fontWeight:700}}>
                {restoring?'復元中...':'復元する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ImportScreen（localStorageデータ → Supabase移行）
// =========================================================
function ImportScreen({ onDone, showToast, setCustomers, setRecords, setInvoiceData, setProducts }) {
  const [json, setJson] = useState('');
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState([]);

  const addLog = (msg) => setLog(l => [...l, msg]);

  const handleImport = async () => {
    setLoading(true);
    setLog([]);
    try {
      const data = JSON.parse(json);
      if (data['olqP7']?.length) {
        addLog(`製品マスタ: ${data['olqP7'].length}件 投入中...`);
        const rows = data['olqP7'].map(p => ({ id: String(p.id), data: p, updated_at: new Date().toISOString() }));
        const { error } = await supabase.from('products').upsert(rows, { onConflict: 'id' });
        if (error) throw new Error('products: ' + error.message);
        setProducts(data['olqP7']);
        addLog(`✅ 製品マスタ: ${rows.length}件 完了`);
      }
      if (data['olqC7']?.length) {
        addLog(`顧客: ${data['olqC7'].length}件 投入中...`);
        const rows = data['olqC7'].map(c => ({ id: String(c.id), data: c, updated_at: new Date().toISOString() }));
        const { error } = await supabase.from('customers').upsert(rows, { onConflict: 'id' });
        if (error) throw new Error('customers: ' + error.message);
        setCustomers(data['olqC7']);
        addLog(`✅ 顧客: ${rows.length}件 完了`);
      }
      if (data['olqR7']?.length) {
        addLog(`案件: ${data['olqR7'].length}件 投入中...`);
        const rows = data['olqR7'].map(r => ({ id: String(r.id), data: r, updated_at: new Date().toISOString() }));
        const { error } = await supabase.from('cases').upsert(rows, { onConflict: 'id' });
        if (error) throw new Error('cases: ' + error.message);
        setRecords(data['olqR7']);
        addLog(`✅ 案件: ${rows.length}件 完了`);
      }
      if (data['olqInv7'] && Object.keys(data['olqInv7']).length) {
        addLog(`請求書: ${Object.keys(data['olqInv7']).length}件 投入中...`);
        const rows = Object.entries(data['olqInv7']).map(([id, v]) => ({
          id, data: v, is_locked: v?.status === 'locked', updated_at: new Date().toISOString()
        }));
        const { error } = await supabase.from('invoices').upsert(rows, { onConflict: 'id' });
        if (error) throw new Error('invoices: ' + error.message);
        setInvoiceData(data['olqInv7']);
        addLog(`✅ 請求書: ${rows.length}件 完了`);
      }
      const dno = data['olqDNo7'];
      const ino = data['olqINo7'];
      if (dno !== undefined && dno !== null) {
        await supabase.from('settings').upsert({ key: 'olqDNo7', value: String(dno) }, { onConflict: 'key' });
        addLog(`✅ 納品書連番: ${dno}`);
      }
      if (ino !== undefined && ino !== null) {
        await supabase.from('settings').upsert({ key: 'olqINo7', value: String(ino) }, { onConflict: 'key' });
        addLog(`✅ 請求書連番: ${ino}`);
      }
      addLog('🎉 復元完了！');
      showToast('復元が完了しました');
    } catch(e) {
      addLog('❌ エラー: ' + e.message);
      showToast('移行に失敗しました: ' + e.message, false);
    }
    setLoading(false);
  };

  return (
    <div style={{maxWidth:760,margin:'0 auto',padding:'40px 20px',fontFamily:"'Noto Sans JP','Hiragino Sans',sans-serif"}}>
      <div style={{background:'#fff',borderRadius:14,boxShadow:'0 2px 16px rgba(0,0,0,0.07)',padding:32}}>
        <h2 style={{margin:'0 0 6px',fontSize:18,fontWeight:800}}>📥 バックアップから復元</h2>
        <p style={{fontSize:12,color:'#64748b',margin:'0 0 20px'}}>
          バックアップファイル（olq-backup-YYYY-MM-DD.json）を選択するか、JSONを貼り付けてください。
        </p>
        <div style={{marginBottom:14}}>
          <input type="file" accept=".json" onChange={e=>{
            const file=e.target.files[0];
            if(!file)return;
            const reader=new FileReader();
            reader.onload=ev=>setJson(ev.target.result);
            reader.readAsText(file);
          }}/>
        </div>
        <textarea
          value={json}
          onChange={e=>setJson(e.target.value)}
          placeholder='ここにJSONを貼り付けてください...'
          style={{width:'100%',height:140,padding:'10px 12px',border:'1.5px solid #e2e8f0',borderRadius:8,fontSize:12,fontFamily:'monospace',outline:'none',boxSizing:'border-box',resize:'vertical',marginBottom:14}}
        />
        <div style={{display:'flex',gap:10,marginBottom:20}}>
          <button onClick={handleImport} disabled={loading||!json.trim()}
            style={{background:'#2563eb',color:'#fff',border:'none',borderRadius:8,padding:'10px 24px',fontSize:13,fontWeight:700,cursor:loading||!json.trim()?'not-allowed':'pointer',opacity:loading||!json.trim()?0.5:1}}>
            {loading ? '復元中...' : '復元を実行'}
          </button>
          <button onClick={onDone}
            style={{background:'none',border:'1.5px solid #e2e8f0',borderRadius:8,padding:'10px 20px',fontSize:13,color:'#64748b',cursor:'pointer'}}>
            閉じる
          </button>
        </div>
        {log.length > 0 && (
          <div style={{background:'#f8fafc',borderRadius:8,padding:'12px 16px',maxHeight:200,overflowY:'auto'}}>
            {log.map((l,i)=>(
              <div key={i} style={{fontSize:12,color:l.startsWith('❌')?'#dc2626':l.startsWith('🎉')?'#16a34a':'#374151',lineHeight:1.8}}>{l}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function IncidentsTab({incidents,setIncidents,customers,records,showToast,onGoToDelivery}){
  const today=()=>{const d=new Date();return d.getFullYear()+"-"+(String(d.getMonth()+1).padStart(2,"0"))+"-"+(String(d.getDate()).padStart(2,"0"));};
  const fmt=n=>new Intl.NumberFormat("ja-JP",{style:"currency",currency:"JPY"}).format(n||0);
  const fmtD=s=>s?s.replace(/-/g,"/"):"";
  const [filterMonth,setFilterMonth]=useState(()=>{const d=new Date();return d.getFullYear()+"-"+(String(d.getMonth()+1).padStart(2,"0"));});
  const [filterCust,setFilterCust]=useState("");
  const [filterCustQ,setFilterCustQ]=useState("");
  const [modal,setModal]=useState(null);
  const [custQ,setCustQ]=useState("");
  const [selectedProjectName,setSelectedProjectName]=useState("");
  const [recQ,setRecQ]=useState("");
  const E={type:"loss",customerId:"",relatedRecordId:"",relatedProjectName:"",occurredDate:today(),itemName:"",unitPrice:"",quantity:"1",chargeAmount:"",description:"",separateInvoice:false,status:"pending",invoiceMonth:filterMonth};
  const [form,setForm]=useState(E);
  const [saving,setSaving]=useState(false);
  const [deleteIncModal,setDeleteIncModal]=useState(null); // null | {id:string}

  const filtered=incidents.filter(x=>{
    const monthOk=!filterMonth||x.occurred_date?.slice(0,7)===filterMonth;
    const custOk=!filterCust||x.customer_id===filterCust;
    return monthOk&&custOk;
  });

  const totalAmt=filtered.reduce((s,x)=>s+(x.charge_amount||0),0);
  const lossAmt=filtered.filter(x=>x.type==="loss").reduce((s,x)=>s+(x.charge_amount||0),0);
  const repairAmt=filtered.filter(x=>x.type==="repair").reduce((s,x)=>s+(x.charge_amount||0),0);

  const custRecords=records.filter(r=>r.customerId===form.customerId);

  const statusLabel=s=>s==="pending"?"未請求":s==="invoiced"?"請求済":s==="paid"?"回収済":"";
  const statusColor=s=>s==="pending"?"#dc2626":s==="invoiced"?"#2563eb":s==="paid"?"#16a34a":"#64748b";
  const typeLabel=t=>t==="loss"?"紛失":"修理/破損";
  const typeColor=t=>t==="loss"?"#dc2626":"#d97706";

  const openNew=()=>{setForm({...E,invoiceMonth:filterMonth});setModal("new");};
  const openEdit=inc=>{setForm({type:inc.type,customerId:inc.customer_id,relatedRecordId:inc.related_record_id,relatedProjectName:inc.related_project_name||"",occurredDate:inc.occurred_date,itemName:inc.item_name,unitPrice:String(inc.unit_price||""),quantity:String(inc.quantity||"1"),chargeAmount:String(inc.charge_amount||""),description:inc.description||"",separateInvoice:!!inc.separate_invoice,status:inc.status||"pending",invoiceMonth:inc.invoice_month||""});setCustQ(customers.find(c=>c.id===inc.customer_id)?.name||"");setSelectedProjectName(inc.related_project_name||"");setModal(inc.id);};

  const save=async()=>{
    if(!form.customerId){showToast("顧客を選択してください",false);return;}
    if(!form.itemName){showToast("品目を入力してください",false);return;}
    setSaving(true);
    const payload={type:form.type,customer_id:form.customerId,related_record_id:form.relatedRecordId,related_project_name:form.relatedProjectName,occurred_date:form.occurredDate,item_name:form.itemName,unit_price:Number(form.unitPrice)||0,quantity:Number(form.quantity)||1,charge_amount:(Number(form.unitPrice)||0)*(Number(form.quantity)||1),description:form.description,separate_invoice:form.separateInvoice,status:form.status,invoice_month:form.invoiceMonth};
    if(modal==="new"){
      const{data,error}=await supabase.from('incidents').insert([payload]).select().single();
      if(error){showToast("保存に失敗しました",false);}else{setIncidents(prev=>[data,...prev]);showToast("登録しました");}
    } else {
      const{data,error}=await supabase.from('incidents').update(payload).eq('id',modal).select().single();
      if(error){showToast("保存に失敗しました",false);}else{setIncidents(prev=>prev.map(x=>x.id===modal?data:x));showToast("更新しました");}
    }
    setSaving(false);setModal(null);
  };

  const del=async id=>{
    await supabase.from('incidents').delete().eq('id',id);
    setIncidents(prev=>prev.filter(x=>x.id!==id));
    showToast("削除しました");
  };

  const S2={td:{padding:"8px 10px",borderBottom:"1px solid #e2e8f0",fontSize:12},th:{padding:"8px 10px",background:"#f8fafc",fontSize:12,fontWeight:600,borderBottom:"1px solid #e2e8f0",textAlign:"left"}};

  return(
    <div style={{padding:"20px 24px",maxWidth:1100,margin:"0 auto"}}>
      {/* フィルター */}
      <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:16,flexWrap:"wrap"}}>
        <input type="month" value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} style={{padding:"6px 10px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:13}}/>
        <input type="text" value={filterCustQ} onChange={e=>setFilterCustQ(e.target.value)} placeholder="顧客名で検索..." style={{padding:"6px 10px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:13,minWidth:160}}/>
        <select value={filterCust} onChange={e=>setFilterCust(e.target.value)} style={{padding:"6px 10px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:13,minWidth:160}}>
          <option value="">全顧客</option>
          {customers.filter(c=>!filterCustQ||c.name.includes(filterCustQ)).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button onClick={openNew} style={{marginLeft:"auto",padding:"7px 18px",background:"#2563eb",color:"#fff",border:"none",borderRadius:6,fontSize:13,fontWeight:600,cursor:"pointer"}}>＋ 新規登録</button>
      </div>

      {/* 集計カード */}
      <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
        {[{label:"合計",val:totalAmt,color:"#1e293b"},{label:"紛失",val:lossAmt,color:"#dc2626"},{label:"修理/破損",val:repairAmt,color:"#d97706"}].map(c=>(
          <div key={c.label} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:8,padding:"12px 20px",minWidth:160}}>
            <div style={{fontSize:11,color:"#64748b",marginBottom:4}}>{c.label}（{filtered.filter(x=>c.label==="合計"||(c.label==="紛失"?x.type==="loss":x.type==="repair")).length}件）</div>
            <div style={{fontSize:20,fontWeight:700,color:c.color}}>{fmt(c.val)}</div>
          </div>
        ))}
      </div>

      {/* 一覧テーブル */}
      <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:8,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead>
            <tr>
              {["発生日","種別","顧客","品目","請求額","状態",""].map(h=><th key={h} style={S2.th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.length===0&&<tr><td colSpan={7} style={{...S2.td,textAlign:"center",color:"#94a3b8",padding:32}}>該当するレコードがありません</td></tr>}
            {filtered.map(inc=>{
              const cust=customers.find(c=>c.id===inc.customer_id);
              const rec=records.find(r=>r.id===inc.related_record_id);
              return(
                <tr key={inc.id} style={{cursor:"pointer"}} onClick={()=>openEdit(inc)}>
                  <td style={S2.td}>{fmtD(inc.occurred_date)}</td>
                  <td style={S2.td}><span style={{background:inc.type==="loss"?"#fef2f2":"#fffbeb",color:typeColor(inc.type),padding:"2px 8px",borderRadius:4,fontSize:11,fontWeight:600}}>{typeLabel(inc.type)}</span></td>
                  <td style={S2.td}>{cust?.name||"-"}</td>
                  <td style={S2.td}>{inc.item_name}</td>
                  <td style={{...S2.td,fontWeight:600}}>{fmt(inc.charge_amount)}</td>
                  <td style={S2.td}><span style={{color:statusColor(inc.status),fontWeight:600,fontSize:11}}>{statusLabel(inc.status)}</span></td>
                  <td style={{...S2.td,textAlign:"right",whiteSpace:"nowrap"}}>
                    {inc.related_record_id&&inc.related_record_id!=="none"&&(
                      <button onClick={e=>{e.stopPropagation();onGoToDelivery(inc.related_record_id);}} style={{padding:"3px 10px",background:"none",border:"1px solid #93c5fd",color:"#2563eb",borderRadius:4,cursor:"pointer",fontSize:11,marginRight:6}}>→ 納品書</button>
                    )}
                    <button onClick={e=>{e.stopPropagation();setDeleteIncModal({id:inc.id});}} style={{padding:"3px 10px",background:"none",border:"1px solid #fca5a5",color:"#dc2626",borderRadius:4,cursor:"pointer",fontSize:11}}>削除</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 登録/編集モーダル */}
      {modal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setModal(null)}>
          <div style={{background:"#fff",borderRadius:12,padding:28,width:520,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 8px 32px rgba(0,0,0,0.2)"}} onClick={e=>e.stopPropagation()}>
            <h3 style={{margin:"0 0 20px",fontSize:16,fontWeight:700}}>{modal==="new"?"新規登録":"編集"}</h3>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div>
                <div style={{fontSize:12,color:"#64748b",marginBottom:4}}>種別 *</div>
                <div style={{display:"flex",gap:8}}>
                  {[{v:"loss",l:"紛失"},{v:"repair",l:"修理/破損"}].map(o=>(
                    <button key={o.v} onClick={()=>setForm(f=>({...f,type:o.v}))} style={{flex:1,padding:"8px",border:`2px solid ${form.type===o.v?"#2563eb":"#e2e8f0"}`,borderRadius:6,background:form.type===o.v?"#eff6ff":"#fff",color:form.type===o.v?"#2563eb":"#64748b",fontWeight:600,cursor:"pointer",fontSize:13}}>{o.l}</button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{fontSize:12,color:"#64748b",marginBottom:4}}>顧客 *</div>
                <input type="text" value={custQ} onChange={e=>{setCustQ(e.target.value);setForm(f=>({...f,customerId:"",relatedRecordId:""}));setRecQ("");}} placeholder="顧客名で検索..." style={{width:"100%",padding:"8px 10px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:13,boxSizing:"border-box",marginBottom:6}}/>
                {custQ&&!form.customerId&&(
                  <div style={{border:"1px solid #e2e8f0",borderRadius:6,maxHeight:160,overflowY:"auto"}}>
                    {customers.filter(c=>c.name.includes(custQ)).map(c=>(
                      <div key={c.id} onClick={()=>{setForm(f=>({...f,customerId:c.id,relatedRecordId:""}));setCustQ(c.name);setRecQ("");}} style={{padding:"8px 10px",cursor:"pointer",fontSize:13,borderBottom:"1px solid #f1f5f9"}} onMouseEnter={e=>e.currentTarget.style.background="#f8fafc"} onMouseLeave={e=>e.currentTarget.style.background="#fff"}>{c.name}</div>
                    ))}
                    {customers.filter(c=>c.name.includes(custQ)).length===0&&<div style={{padding:"8px 10px",fontSize:12,color:"#94a3b8"}}>該当なし</div>}
                  </div>
                )}
                {form.customerId&&<div style={{fontSize:11,color:"#2563eb",marginTop:2}}>✓ {customers.find(c=>c.id===form.customerId)?.name}</div>}
              </div>
              <div>
                <div style={{fontSize:12,color:"#64748b",marginBottom:4}}>元案件</div>
                {!form.customerId?<div style={{fontSize:12,color:"#94a3b8",padding:"8px 0"}}>先に顧客を選択してください</div>:(()=>{
                  const projectNames=[...new Set(custRecords.map(r=>r.projectName||"（案件名なし）"))].sort();
                  const slipsForProject=custRecords.filter(r=>(r.projectName||"（案件名なし）")===selectedProjectName).sort((a,b)=>(b.startDate||"").localeCompare(a.startDate||""));
                  return(
                    <>
                      {/* Step2: 案件名選択 */}
                      {!selectedProjectName?(
                        <>
                          <div style={{fontSize:11,color:"#64748b",marginBottom:6}}>案件名を選択してください</div>
                          <div style={{border:"1px solid #e2e8f0",borderRadius:6,maxHeight:220,overflowY:"auto"}}>
                            {projectNames.map(pn=>(
                              <div key={pn} onClick={()=>{setSelectedProjectName(pn);setForm(f=>({...f,relatedProjectName:pn==="（案件名なし）"?"":pn,relatedRecordId:""}));}} style={{padding:"8px 10px",cursor:"pointer",fontSize:13,borderBottom:"1px solid #f1f5f9",background:"#fff"}} onMouseEnter={e=>e.currentTarget.style.background="#f8fafc"} onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
                                {pn}
                                <span style={{fontSize:11,color:"#94a3b8",marginLeft:8}}>{custRecords.filter(r=>(r.projectName||"（案件名なし）")===pn).length}件</span>
                              </div>
                            ))}
                          </div>
                        </>
                      ):(
                        <>
                          {/* Step3: 伝票選択 */}
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                            <div style={{fontSize:12,fontWeight:600,color:"#2563eb"}}>{selectedProjectName}</div>
                            <button onClick={()=>{setSelectedProjectName("");setForm(f=>({...f,relatedProjectName:"",relatedRecordId:""}));}} style={{fontSize:11,color:"#64748b",background:"none",border:"1px solid #e2e8f0",borderRadius:4,padding:"2px 8px",cursor:"pointer"}}>変更</button>
                          </div>
                          <div style={{border:"1px solid #e2e8f0",borderRadius:6,maxHeight:220,overflowY:"auto"}}>
                            <div onClick={()=>setForm(f=>({...f,relatedRecordId:"none"}))} style={{padding:"8px 10px",cursor:"pointer",fontSize:13,borderBottom:"1px solid #f1f5f9",background:form.relatedRecordId==="none"?"#eff6ff":"#fff",color:form.relatedRecordId==="none"?"#2563eb":"#64748b",fontWeight:form.relatedRecordId==="none"?600:400}} onMouseEnter={e=>e.currentTarget.style.background=form.relatedRecordId==="none"?"#eff6ff":"#f8fafc"} onMouseLeave={e=>e.currentTarget.style.background=form.relatedRecordId==="none"?"#eff6ff":"#fff"}>選択しないで作成</div>
                            {slipsForProject.map(r=>(
                              <div key={r.id} onClick={()=>setForm(f=>({...f,relatedRecordId:r.id}))} style={{padding:"8px 10px",cursor:"pointer",fontSize:12,borderBottom:"1px solid #f1f5f9",background:form.relatedRecordId===r.id?"#eff6ff":"#fff",color:form.relatedRecordId===r.id?"#2563eb":"#1e293b"}} onMouseEnter={e=>e.currentTarget.style.background=form.relatedRecordId===r.id?"#eff6ff":"#f8fafc"} onMouseLeave={e=>e.currentTarget.style.background=form.relatedRecordId===r.id?"#eff6ff":"#fff"}>
                                <div style={{fontWeight:600}}>{r.deliveryNo||r.id}</div>
                                <div style={{fontSize:11,color:"#64748b",marginTop:2}}>{r.startDate}〜{r.endDate||"継続中"}</div>
                              </div>
                            ))}
                          </div>
                          {form.relatedRecordId&&<div style={{fontSize:11,color:"#2563eb",marginTop:4}}>✓ {form.relatedRecordId==="none"?"選択なし（案件名のみ紐付け）":records.find(r=>r.id===form.relatedRecordId)?.deliveryNo||"選択済"}</div>}
                        </>
                      )}
                    </>
                  );
                })()}
              </div>
              <div>
                <div style={{fontSize:12,color:"#64748b",marginBottom:4}}>発生日 *</div>
                <input type="date" value={form.occurredDate} onChange={e=>setForm(f=>({...f,occurredDate:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:13,boxSizing:"border-box"}}/>
              </div>
              <div>
                <div style={{fontSize:12,color:"#64748b",marginBottom:4}}>品目 *</div>
                <input type="text" value={form.itemName} onChange={e=>setForm(f=>({...f,itemName:e.target.value}))} placeholder="例：XLRケーブル 5m" style={{width:"100%",padding:"8px 10px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:13,boxSizing:"border-box"}}/>
              </div>
              <div>
                <div style={{fontSize:12,color:"#64748b",marginBottom:4}}>単価</div>
                <input type="text" inputMode="numeric" value={form.unitPrice} onChange={e=>{const v=e.target.value.replace(/[^0-9]/g,"");setForm(f=>({...f,unitPrice:v}));}} placeholder="0" style={{width:"100%",padding:"8px 10px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:13,boxSizing:"border-box"}}/>
              </div>
              <div>
                <div style={{fontSize:12,color:"#64748b",marginBottom:4}}>数量</div>
                <input type="text" inputMode="numeric" value={form.quantity} onChange={e=>{const v=e.target.value.replace(/[^0-9]/g,"");setForm(f=>({...f,quantity:v}));}} placeholder="1" style={{width:"100%",padding:"8px 10px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:13,boxSizing:"border-box"}}/>
              </div>
              <div>
                <div style={{fontSize:12,color:"#64748b",marginBottom:4}}>請求額（自動計算）</div>
                <div style={{padding:"8px 10px",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:6,fontSize:13,fontWeight:600,color:"#16a34a"}}>
                  {new Intl.NumberFormat("ja-JP",{style:"currency",currency:"JPY"}).format((Number(form.unitPrice)||0)*(Number(form.quantity)||1))}
                </div>
              </div>
              <div>
                <div style={{fontSize:12,color:"#64748b",marginBottom:4}}>請求月</div>
                <input type="month" value={form.invoiceMonth} onChange={e=>setForm(f=>({...f,invoiceMonth:e.target.value}))} style={{padding:"8px 10px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:13}}/>
              </div>
              <div>
                <div style={{fontSize:12,color:"#64748b",marginBottom:4}}>状態</div>
                <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:13}}>
                  <option value="pending">未請求</option>
                  <option value="invoiced">請求済</option>
                  <option value="paid">回収済</option>
                </select>
              </div>
              <div>
                <div style={{fontSize:12,color:"#64748b",marginBottom:4}}>状況メモ</div>
                <textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} rows={3} style={{width:"100%",padding:"8px 10px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:13,resize:"vertical",boxSizing:"border-box"}}/>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <input type="checkbox" id="sep" checked={form.separateInvoice} onChange={e=>setForm(f=>({...f,separateInvoice:e.target.checked}))} style={{cursor:"pointer"}}/>
                <label htmlFor="sep" style={{fontSize:13,cursor:"pointer"}}>別請求書で発行する</label>
              </div>
            </div>
            <div style={{display:"flex",gap:10,marginTop:24,justifyContent:"flex-end"}}>
              <button onClick={()=>setModal(null)} style={{padding:"8px 20px",border:"1px solid #e2e8f0",borderRadius:6,background:"#fff",cursor:"pointer",fontSize:13}}>キャンセル</button>
              <button onClick={save} disabled={saving} style={{padding:"8px 24px",background:"#2563eb",color:"#fff",border:"none",borderRadius:6,fontWeight:600,cursor:"pointer",fontSize:13}}>{saving?"保存中...":"保存"}</button>
            </div>
          </div>
        </div>
      )}
      {deleteIncModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#fff",borderRadius:12,padding:"28px 32px",minWidth:320,boxShadow:"0 8px 32px rgba(0,0,0,0.2)"}}>
            <div style={{fontSize:15,fontWeight:700,marginBottom:12,color:"#991b1b"}}>⚠️ インシデントを削除しますか？</div>
            <div style={{fontSize:13,color:"#374151",marginBottom:20}}>この操作は取り消せません。</div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>{const id=deleteIncModal.id;setDeleteIncModal(null);del(id);}} style={{flex:1,background:"#dc2626",color:"#fff",border:"none",borderRadius:7,padding:"9px 0",fontSize:13,fontWeight:700,cursor:"pointer"}}>削除する</button>
              <button onClick={()=>setDeleteIncModal(null)} style={{flex:1,background:"#f1f5f9",color:"#374151",border:"none",borderRadius:7,padding:"9px 0",fontSize:13,cursor:"pointer"}}>キャンセル</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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

function BrunoChat({ session, isBruno }) {
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

function ActivityLogsTab({session}) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({type:"", user:""});

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      setLogs(data || []);
      setLoading(false);
    })();
  }, []);

  const typeLabel = {record:"案件", customer:"顧客"};
  const typeColor = {record:"#2563eb", customer:"#16a34a"};

  const users = [...new Set(logs.map(l => l.user_name).filter(Boolean))];

  const filtered = logs.filter(l => {
    if (filter.type && l.target_type !== filter.type) return false;
    if (filter.user && l.user_name !== filter.user) return false;
    return true;
  });

  const fd = iso => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = n => String(n).padStart(2,'0');
    const jst = new Date(d.getTime() + 9*60*60*1000);
    return `${jst.getUTCFullYear()}/${pad(jst.getUTCMonth()+1)}/${pad(jst.getUTCDate())} ${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}`;
  };

  return (
    <div style={{maxWidth:900,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <h2 style={{fontSize:16,fontWeight:700,color:"#1e293b",margin:0}}>作業履歴</h2>
        <div style={{display:"flex",gap:8}}>
          <select value={filter.type} onChange={e=>setFilter(f=>({...f,type:e.target.value}))}
            style={{border:"1.5px solid #e2e8f0",borderRadius:6,padding:"5px 10px",fontSize:12,color:"#374151",background:"#fff"}}>
            <option value="">全種別</option>
            <option value="record">案件</option>
            <option value="customer">顧客</option>
          </select>
          <select value={filter.user} onChange={e=>setFilter(f=>({...f,user:e.target.value}))}
            style={{border:"1.5px solid #e2e8f0",borderRadius:6,padding:"5px 10px",fontSize:12,color:"#374151",background:"#fff"}}>
            <option value="">全スタッフ</option>
            {users.map(u=><option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>
      {loading ? (
        <div style={{textAlign:"center",padding:40,color:"#94a3b8",fontSize:13}}>読み込み中...</div>
      ) : filtered.length === 0 ? (
        <div style={{textAlign:"center",padding:40,color:"#94a3b8",fontSize:13}}>履歴がありません</div>
      ) : (
        <div style={{background:"#fff",borderRadius:12,border:"1px solid #e2e8f0",overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead>
              <tr style={{background:"#f8fafc",borderBottom:"1px solid #e2e8f0"}}>
                <th style={{padding:"10px 14px",textAlign:"left",fontWeight:600,color:"#64748b",fontSize:12,width:140}}>日時</th>
                <th style={{padding:"10px 14px",textAlign:"left",fontWeight:600,color:"#64748b",fontSize:12,width:80}}>スタッフ</th>
                <th style={{padding:"10px 14px",textAlign:"left",fontWeight:600,color:"#64748b",fontSize:12,width:60}}>種別</th>
                <th style={{padding:"10px 14px",textAlign:"left",fontWeight:600,color:"#64748b",fontSize:12,width:100}}>操作</th>
                <th style={{padding:"10px 14px",textAlign:"left",fontWeight:600,color:"#64748b",fontSize:12}}>対象</th>
                <th style={{padding:"10px 14px",textAlign:"left",fontWeight:600,color:"#64748b",fontSize:12}}>詳細</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l,i) => (
                <tr key={l.id||i} style={{borderBottom:"1px solid #f1f5f9",background:i%2===0?"#fff":"#fafafa"}}>
                  <td style={{padding:"9px 14px",color:"#64748b",fontSize:12,whiteSpace:"nowrap"}}>{fd(l.created_at)}</td>
                  <td style={{padding:"9px 14px",fontWeight:500,color:"#1e293b"}}>{l.user_name||"-"}</td>
                  <td style={{padding:"9px 14px"}}>
                    <span style={{background:(typeColor[l.target_type]||"#64748b")+"18",color:typeColor[l.target_type]||"#64748b",borderRadius:4,padding:"2px 7px",fontSize:11,fontWeight:600}}>
                      {typeLabel[l.target_type]||l.target_type||"-"}
                    </span>
                  </td>
                  <td style={{padding:"9px 14px",color:"#374151"}}>{l.action||"-"}</td>
                  <td style={{padding:"9px 14px",color:"#1e293b",fontWeight:500}}>{l.target_name||"-"}</td>
                  <td style={{padding:"9px 14px",color:"#64748b",fontSize:12}}>{l.detail||""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
