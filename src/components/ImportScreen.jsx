import React, { useState } from "react";
import { supabase } from '../supabaseClient';

export function ImportScreen({ onDone, showToast, setCustomers, setRecords, setInvoiceData, setProducts }) {
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
