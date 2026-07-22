import React, { useState, useEffect } from "react";
import { supabase } from '../supabaseClient';

export function ActivityLogsTab({session}) {
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
