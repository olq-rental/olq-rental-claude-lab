import React, { useState, useEffect } from "react";
import { fmt, fmtD, uid } from '../lib/format';
import { downloadPrintHTML } from '../lib/print';
import { Ico, I } from './Ico';
import { S } from '../lib/ui';
import { nextDeliveryNo } from '../lib/db';

export function DeliveryTab({records, customers, groups, showToast, globalQ, onSave, autoOpenRecord, onClearAutoOpen}){
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
