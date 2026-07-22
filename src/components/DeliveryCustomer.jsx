import { fmt, fmtD } from '../lib/format';

// 納品書（お客様用）— 1ページ
export function DeliveryCustomer({r, g, no, forPrint, showPrice}){
  const fs = forPrint ? 1 : 0.78;
  const bdr = "1px solid #555";
  const ROWS = 20;
  return(
    <div style={{padding:`${28*fs}px ${32*fs}px`,color:"#111",fontFamily:"'Noto Sans JP','Hiragino Sans',sans-serif"}}>
      {/* ヘッダー */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4*fs}}>
        <div style={{fontSize:22*fs,fontWeight:800,letterSpacing:8}}>納 品 書</div>
        <div style={{textAlign:"right",fontSize:10.5*fs,lineHeight:2}}>
          <div>納品書No.　<strong>{no}</strong></div>
          <div>日付　{fmtD(r.createdAt||r.startDate)}</div>
        </div>
      </div>
      {/* 宛名 + 自社 */}
      <div style={{display:"flex",justifyContent:"space-between",marginTop:12*fs,marginBottom:6*fs,gap:16}}>
        <div style={{flex:1}}>
          <div style={{fontSize:15*fs,fontWeight:700,borderBottom:"2px solid #111",paddingBottom:3,display:"inline-block"}}>
            {g.customer?.invoiceName||g.customerName}　<span style={{fontWeight:400}}>{ (r.ordererName||g.customer?.contact) ? "御中" : "様"}</span>
          </div>
          {(r.projectName||g.projectName)&&<div style={{fontSize:12*fs,marginTop:4}}>『{r.projectName||g.projectName}{r.projectDetail&&<span style={{fontWeight:400,fontSize:11*fs}}>　{r.projectDetail}</span>}』</div>}
          {r.ecOrderNo&&<div style={{fontSize:10*fs,marginTop:2}}>EC注文番号：{r.ecOrderNo}</div>}
          {(r.ordererName||g.customer?.contact)&&<div style={{fontSize:12*fs,marginTop:3}}>{r.ordererName||g.customer?.contact}　様</div>}
        </div>
        <div style={{textAlign:"right",fontSize:9.5*fs,lineHeight:1.7,flexShrink:0}}>
          <div style={{fontWeight:700,fontSize:11*fs}}>オルク株式会社</div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8}}><span>担当</span><strong>{r.ourStaff||"―"}</strong></div>
          <div>〒105-0004</div>
          <div>東京都港区新橋6-10-2</div>
          <div>第二新洋ビル 1F</div>
          <div>TEL: 03-5777-1100</div>
          <div>MAIL: rental@olq.co.jp</div>
        </div>
      </div>
      <div style={{fontSize:10*fs,color:"#444",marginBottom:10*fs}}>毎度ありがとうございます。下記の通り納品致しましたのでご査収下さい。</div>
      {/* テーブル（showPriceで分岐） */}
      {(()=>{
        const lines=(r.lines&&r.lines.length)?r.lines:[{equipmentName:r.equipmentName,equipNo:r.equipNo,unitPrice:r.unitPrice,quantity:r.quantity,lineNote:r.lineNote||"",subItems:r.subItems||[]}];
        let rowIdx=0;
        const dataRows=[];
        lines.forEach((ln,li)=>{
          rowIdx++;
          if(showPrice){
            dataRows.push(<tr key={`m${li}`}><td style={{border:bdr,padding:`${3*fs}px`,textAlign:"center"}}>{rowIdx}</td><td style={{border:bdr,padding:`${3*fs}px ${5*fs}px`}}>{ln.equipmentName}</td><td style={{border:bdr,padding:`${3*fs}px`,textAlign:"right"}}>{fmt(ln.unitPrice)}</td><td style={{border:bdr,padding:`${3*fs}px`,textAlign:"center"}}>{ln.quantity}</td><td style={{border:bdr,padding:`${3*fs}px`,textAlign:"center",whiteSpace:"nowrap"}}>{fmtD(r.startDate)}</td><td style={{border:bdr,padding:`${3*fs}px`,textAlign:"center",whiteSpace:"nowrap"}}>{fmtD(r.endDate)}</td><td style={{border:bdr,padding:`${3*fs}px ${5*fs}px`,fontSize:9*fs}}>{r.billingType==="monthly"?"月極"+(ln.lineNote?" "+ln.lineNote:""):(ln.lineNote||"")}</td></tr>);
            (ln.expandRows?(ln.subItems||[]):[]).forEach((si,si2)=>{rowIdx++;dataRows.push(<tr key={`s${li}_${si2}`}><td style={{border:bdr,padding:`${2*fs}px`,color:"#aaa"}}/><td style={{border:bdr,padding:`${2*fs}px ${5*fs}px ${2*fs}px ${14*fs}px`,fontSize:9*fs,color:"#555"}}>└ No.{si.no}</td><td style={{border:bdr,padding:`${2*fs}px`}}/><td style={{border:bdr,padding:`${2*fs}px`}}/><td style={{border:bdr,padding:`${2*fs}px`}}/><td style={{border:bdr,padding:`${2*fs}px`}}/><td style={{border:bdr,padding:`${2*fs}px ${5*fs}px`,fontSize:9*fs,color:"#666"}}>{si.note||""}</td></tr>);});
          } else {
            dataRows.push(<tr key={`m${li}`}><td style={{border:bdr,padding:`${3*fs}px`,textAlign:"center"}}>{rowIdx}</td><td style={{border:bdr,padding:`${3*fs}px ${5*fs}px`}}>{ln.equipmentName}</td><td style={{border:bdr,padding:`${3*fs}px`,textAlign:"center"}}>{ln.quantity}</td><td style={{border:bdr,padding:`${3*fs}px`,textAlign:"center",whiteSpace:"nowrap"}}>{fmtD(r.startDate)}</td><td style={{border:bdr,padding:`${3*fs}px`,textAlign:"center",whiteSpace:"nowrap"}}>{fmtD(r.endDate)}</td><td style={{border:bdr,padding:`${3*fs}px ${5*fs}px`,fontSize:9*fs}}>{r.billingType==="monthly"?"月極"+(ln.lineNote?" "+ln.lineNote:""):(ln.lineNote||"")}</td></tr>);
            (ln.expandRows?(ln.subItems||[]):[]).forEach((si,si2)=>{rowIdx++;dataRows.push(<tr key={`s${li}_${si2}`}><td style={{border:bdr,padding:`${2*fs}px`,color:"#aaa"}}/><td style={{border:bdr,padding:`${2*fs}px ${5*fs}px ${2*fs}px ${16*fs}px`,fontSize:9*fs,color:"#555"}}>└ No.{si.no}</td><td style={{border:bdr,padding:`${2*fs}px`}}/><td style={{border:bdr,padding:`${2*fs}px`}}/><td style={{border:bdr,padding:`${2*fs}px`}}/><td style={{border:bdr,padding:`${2*fs}px ${5*fs}px`,fontSize:9*fs,color:"#666"}}>{si.note||""}</td></tr>);});
          }
        });
        if((r.insuranceAmount||0)>0){
          rowIdx++;
          if(showPrice){
            dataRows.push(<tr key="ins"><td style={{border:bdr,padding:`${3*fs}px`,textAlign:"center",color:"#aaa"}}></td><td colSpan={5} style={{border:bdr,padding:`${3*fs}px ${5*fs}px`,color:"#92400e"}}>補償料</td><td style={{border:bdr,padding:`${3*fs}px ${5*fs}px`,textAlign:"right",color:"#92400e",fontWeight:600}}>{fmt(r.insuranceAmount)}</td></tr>);
          } else {
            dataRows.push(<tr key="ins"><td style={{border:bdr,padding:`${3*fs}px`,textAlign:"center",color:"#aaa"}}></td><td colSpan={4} style={{border:bdr,padding:`${3*fs}px ${5*fs}px`,color:"#92400e"}}>補償料</td><td style={{border:bdr,padding:`${3*fs}px ${5*fs}px`,textAlign:"right",color:"#92400e",fontWeight:600}}>{fmt(r.insuranceAmount)}</td></tr>);
          }
        }
        const emptyCount=Math.max(0,ROWS-rowIdx);
        const cols = showPrice
          ? [{l:"No.",w:28},{l:"機材名"},{l:"単価",w:60},{l:"数量",w:40},{l:"開始日",w:72},{l:"終了日",w:72},{l:"備考"}]
          : [{l:"No.",w:28},{l:"機材名"},{l:"数量",w:40},{l:"開始日",w:72},{l:"終了日",w:72},{l:"備考"}];
        const emptyCols = showPrice ? [28,0,60,40,72,72,0] : [28,0,40,72,72,0];
        return(
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:10*fs}}>
          <thead><tr>{cols.map(h=><th key={h.l} style={{border:bdr,padding:`${3*fs}px ${4*fs}px`,textAlign:"center",fontWeight:700,background:"#f5f5f5",width:h.w?h.w*fs:undefined}}>{h.l}</th>)}</tr></thead>
          <tbody>
            {dataRows}
            {Array.from({length:emptyCount}).map((_,i)=><tr key={`e${i}`}>{emptyCols.map((w,j)=><td key={j} style={{border:bdr,padding:`${3*fs}px`,height:16*fs}}>{j===0?<span style={{color:"#ccc"}}>{rowIdx+i+1}</span>:""}</td>)}</tr>)}
          </tbody>
        </table>);
      })()}
      {/* 備考欄 */}
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:10*fs,marginTop:-1}}>
        <tbody><tr>
          <td style={{border:bdr,padding:`${4*fs}px ${6*fs}px`,width:48*fs,fontWeight:700,verticalAlign:"top",letterSpacing:4}}>備　考</td>
          <td style={{border:bdr,padding:`${4*fs}px ${6*fs}px`,minHeight:90*fs,whiteSpace:"pre-wrap"}}>{[r.notes,r.adjustReason].filter(Boolean).join("\n")||" "}</td>
        </tr></tbody>
      </table>
      {/* 注意事項 */}
      <div style={{marginTop:12*fs,fontSize:9*fs,color:"#666",lineHeight:1.7}}>
        <div><strong>※ご利用前に、必ず内容物確認と動作チェックを行なってください。</strong></div>
      </div>
    </div>
  );
}
