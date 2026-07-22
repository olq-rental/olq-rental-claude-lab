import React, { useState, useEffect } from "react";
import { supabase } from '../supabaseClient';

export function SnapshotScreen({onDone, showToast, setCustomers, setRecords, setInvoiceData, setProducts}) {
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
