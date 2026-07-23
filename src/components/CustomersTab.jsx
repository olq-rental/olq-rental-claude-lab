import React, { useState, useEffect, useRef } from "react";
import { fmt, uid } from '../lib/format';
import { syncSPs, spName } from '../lib/billing';
import { downloadPrintHTML } from '../lib/print';
import { Ico, I } from './Ico';
import { S } from '../lib/ui';

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

export function CustomersTab({customers,products,records,onSave,onDeleteCust,onLogActivity,showToast,presetCustomers,openCustomerId,onOpenHandled}){
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
