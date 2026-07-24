import React, { useState, useEffect } from "react";
import { supabase } from './supabaseClient';
import { ALL_PRODUCTS, PRESET_CUSTOMERS, K, calcDays } from './lib/constants';
import { aiSourceMeta, today } from './lib/format';
import { expandMonthlyOpenRecord, calcBillingDays, resolvePrice, syncSPs } from './lib/billing';
import { Ico, I } from './components/Ico';
import { Toast } from './components/Toast';
import { S } from './lib/ui';
import { ProductsTab } from './components/ProductsTab';
import { IncidentsTab } from './components/IncidentsTab';
import { BrunoChat } from './components/BrunoChat';
import { ActivityLogsTab } from './components/ActivityLogsTab';
import { LoginScreen } from './components/LoginScreen';
import { SnapshotScreen } from './components/SnapshotScreen';
import { ImportScreen } from './components/ImportScreen';
import { DeliveryTab } from './components/DeliveryTab';
import { CustomersTab } from './components/CustomersTab';
import { InvoiceTab } from './components/InvoiceTab';
import { RecordsTab } from './components/RecordsTab';
import { CouncilCard } from './components/CouncilCard';


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
    {id:"council",  label:"評議会"},
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
        {TABS.filter(t=> (t.id!=='bruno' || isBrunoTab) && (t.id!=='council' || isOwner)).map(t=>(
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
        {tab==='council' && isOwner && <CouncilCard showToast={showToast}/>}
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








