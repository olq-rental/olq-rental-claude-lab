import React, { useState } from "react";
import { calcDays } from '../lib/constants';
import { taxIn, fmt, fmtD, uid, today } from '../lib/format';
import { calcBillingDays, chainBillingDays, resolvePrice, getLines } from '../lib/billing';
import { downloadPrintHTML } from '../lib/print';
import { PwInput } from './PwInput';
import { SearchableSelect } from './SearchableSelect';
import { Ico, I } from './Ico';
import { S } from '../lib/ui';
import { verifyPw, nextDeliveryNo } from '../lib/db';

export function RecordsTab({records,customers,products,onSave,onDeleteRec,showToast,onGoToCustomer,onAfterSubmit,invoiceData,globalQ,session}){
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
