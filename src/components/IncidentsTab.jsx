import React, { useState } from "react";
import { supabase } from '../supabaseClient';
import { fmt, fmtD, today } from '../lib/format';

export function IncidentsTab({incidents,setIncidents,customers,records,showToast,onGoToDelivery}){
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
