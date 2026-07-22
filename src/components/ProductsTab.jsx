import React, { useState, useRef } from "react";
import { supabase } from '../supabaseClient';
import { S } from '../lib/ui';
import { fmt, taxEx, uid } from '../lib/format';
import { Ico, I } from './Ico';

export function ProductsTab({products,customers,onSave,saveCust,showToast,allProducts}){
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
