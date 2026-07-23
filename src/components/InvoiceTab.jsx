import React, { useState } from "react";
import { supabase } from '../supabaseClient';
import { calcDays } from '../lib/constants';
import { fmt, fmtD, uid, today } from '../lib/format';
import { calcBillingDays, chainBillingDays, buildChainBlocks, calcExpectedAmount, getLines } from '../lib/billing';
import { downloadPrintHTML } from '../lib/print';
import { PwInput } from './PwInput';
import { Ico, I } from './Ico';
import { AdjAmountInput } from './AdjAmountInput';
import { S } from '../lib/ui';
import { verifyPw } from '../lib/db';

async function updateLockPw(newPw) {
  await supabase.rpc('update_lock_password', { new_pw: newPw });
}

async function nextInvoiceNo(month) {
  const { data, error } = await supabase.rpc('next_invoice_no');
  if (error) { console.error('nextInvoiceNo error', error); return `${month}-ERR`; }
  return `${month}-${String(data).padStart(3,'0')}`;
}


// =========================================================
// InvoiceTab（請求書タブ） — 月選択・ステータス管理・調整行
// =========================================================
export function InvoiceTab({groups, customers, products, onSaveCust, invoiceData, onSaveInv, showToast, globalQ, records, onSaveRec, incidents}){
  const months = [...new Set(groups.map(g=>g.month).filter(Boolean))].sort().reverse();
  const currentMonth = today().slice(0,7);
  const [selMonth, setSelMonth] = useState(months.includes(currentMonth)?currentMonth:(months[0]||""));
  // groupsが変化したときにselMonthを補正
  React.useEffect(()=>{
    if(months.length>0 && !selMonth){
      setSelMonth(months.includes(currentMonth)?currentMonth:months[0]);
    }
  },[months.length]);
  const [expanded, setExpanded] = useState({}); // {key: bool}
  const [statusFilter, setStatusFilter] = useState("all"); // "all"|"open"|"locked"
  const [showPwSetting, setShowPwSetting] = useState(false);
  const [crossMonthSplits, setCrossMonthSplits] = useState(()=>{try{const s=localStorage.getItem('olqCrossMonthSplits');return s?JSON.parse(s):{};}catch{return {};}}); // {recordId: {type:'full'|'split', targetMonth?:string, splits?:[{startDate,endDate}]}}
  const [crossMonthSplitsReady, setCrossMonthSplitsReady] = useState(false);
  const [crossMonthSplitsLoaded, setCrossMonthSplitsLoaded] = useState(false);
  React.useEffect(()=>{if(!crossMonthSplitsReady)return;if(!crossMonthSplitsLoaded&&Object.keys(crossMonthSplits).length===0)return;try{localStorage.setItem('olqCrossMonthSplits',JSON.stringify(crossMonthSplits));}catch{} supabase.from('settings').upsert({key:'crossMonthSplits',value:JSON.stringify(crossMonthSplits)},{onConflict:'key'}).then(({error})=>{if(error)console.error('crossMonthSplits save error',error);});}, [crossMonthSplits,crossMonthSplitsReady,crossMonthSplitsLoaded]);
  React.useEffect(()=>{supabase.from('settings').select('value').eq('key','crossMonthSplits').maybeSingle().then(({data,error})=>{if(!error&&data&&data.value){try{const parsed=JSON.parse(data.value);setCrossMonthSplits(parsed);localStorage.setItem('olqCrossMonthSplits',data.value);}catch{}}setCrossMonthSplitsLoaded(true);setCrossMonthSplitsReady(true);}).catch(()=>{setCrossMonthSplitsReady(true);});},[]);
  const [newPw, setNewPw] = useState("");
  const [lockModal, setLockModal] = useState(null); // null | {mode:"confirm",key:string} | {mode:"unlock",key:string}
  const [changePwModal, setChangePwModal] = useState(false);
  const [printCountResetModal, setPrintCountResetModal] = useState(false);
  const [custQ, setCustQ] = useState("");

  const getInvData = (key, month) => {
    const d = invoiceData[key] || {};
    if(!d.issueDate && month) {
      // デフォルト: 月末日
      const [y,m] = (month||"").split("-").map(Number);
      const lastDay = y&&m ? new Date(y, m, 0).getDate() : null;
      d.issueDate = y&&m ? `${y}-${String(m).padStart(2,"0")}-${String(lastDay).padStart(2,"0")}` : "";
    }
    return {status:"open", adjustments:[], issueDate:"", ...d};
  };
  const updateInvData = async (key, patch) => {
    const next = {...invoiceData, [key]:{...getInvData(key),...patch}};
    await onSaveInv(next);
  };
  const addAdj = async (key) => {
    const d = getInvData(key);
    await updateInvData(key, {adjustments:[...d.adjustments, {id:uid(), label:"", amount:0}]});
  };
  const updateAdj = async (key, adjId, patch) => {
    const d = getInvData(key);
    await updateInvData(key, {adjustments:d.adjustments.map(a=>a.id===adjId?{...a,...patch}:a)});
  };
  const removeAdj = async (key, adjId) => {
    const d = getInvData(key);
    await updateInvData(key, {adjustments:d.adjustments.filter(a=>a.id!==adjId)});
  };
  const toggleLock = (key, e) => {
    e.stopPropagation();
    const d = getInvData(key);
    if(d.status==="locked"){
      setLockModal({mode:"unlock", key});
    } else {
      setLockModal({mode:"confirm", key});
    }
  };
  const doLockConfirm = async () => {
    const key = lockModal.key;
    setLockModal(null);
    // 締め時にスナップショットを焼く（案件名変更やライブ再計算による金額変動から保護）
    const g = groups.find(g => `${g.customerId}||${g.projectName}||${g.month}` === key);
    const d = getInvData(key, g?.month);
    const gInc = g ? (incidents||[]).filter(x=>!x.separate_invoice&&x.customer_id===g.customerId&&x.invoice_month===g.month&&(g.projectName===""||( x.related_project_name||"")===(g.projectName||""))).filter(x=>x.status!=="paid") : [];
    const incTot = gInc.reduce((s,x)=>s+(x.charge_amount||0),0);
    const baseTot = g ? g.items.reduce((s,r)=>s+(r.amount||0)+(r.insuranceAmount||0),0)+incTot : 0;
    const autoAdjTot = (g?._autoAdjustments||[]).reduce((s,a)=>s+(Number(a.amount)||0),0);
    const adjSum = d.adjustments.reduce((s,a)=>s+(Number(a.amount)||0),0);
    const snapshot = g ? {
      projectName: g.projectName,
      month: g.month,
      items: g.items.map(r => ({
        id:r.id, projectName:r.projectName, equipmentName:r.equipmentName,
        amount:r.amount, insuranceAmount:r.insuranceAmount,
        lines:r.lines, startDate:r.startDate, endDate:r.endDate,
        billingType:r.billingType, days:r.days, billingDays:r.billingDays,
        months:r.months, deliveryNo:r.deliveryNo, isExtension:r.isExtension,
        extendedFromNo:r.extendedFromNo, ecOrderNo:r.ecOrderNo,
        ordererName:r.ordererName, projectDetail:r.projectDetail,
        isMonthlyEntry:r.isMonthlyEntry, isReturnEntry:r.isReturnEntry,
        noBillingDiscount:r.noBillingDiscount, includeInsurance:r.includeInsurance,
        issueReceipt:r.issueReceipt, receiptDate:r.receiptDate, paymentMethod:r.paymentMethod,
      })),
      incidents: gInc.map(x=>({id:x.id, charge_amount:x.charge_amount, description:x.description})),
      adjustments: d.adjustments,
      grandTotal: baseTot + autoAdjTot + adjSum,
      frozenAt: new Date().toISOString(),
    } : null;
    await updateInvData(key, {status:"locked", ...(snapshot ? {snapshot} : {})});
    showToast("締め済みにしました 🔒");
  };
  const doUnlock = async (pw) => {
    const ok = await verifyPw(pw);
    if(!ok){showToast("パスワードが違います", false);return;}
    const key = lockModal.key;
    setLockModal(null);
    await updateInvData(key, {status:"open"});
    showToast("締めを解除しました");
  };
  const doChangePw = async (cur) => {
    const ok = await verifyPw(cur);
    if(!ok){showToast("現在のパスワードが違います", false);return;}
    await updateLockPw(newPw);
    setChangePwModal(false);
    setNewPw("");
    setShowPwSetting(false);
    showToast("パスワードを変更しました");
  };
  const triggerPrintCountReset = () => { setPrintCountResetModal(true); };
  const doPrintCountReset = async () => {
    setPrintCountResetModal(false);
    const next={...invoiceData};
    Object.keys(next).forEach(key=>{
      const [cid,,month]=key.split("||");
      const grpRecords=records.filter(r=>r.customerId===cid&&(r.startDate||"").startsWith(month));
      const hasReceipt=grpRecords.some(r=>r.issueReceipt);
      if(!hasReceipt) next[key]={...next[key],printCount:0,invNo:"",lastPrintDate:""};
    });
    await onSaveInv(next);
    showToast("リセット完了しました",true);
  };
  const toggleExpand = (key) => setExpanded(p=>({...p,[key]:!p[key]}));

  // 領収済案件の判定ヘルパー
  const isReceiptItem = r => !!r.issueReceipt;

  // 領収済案件と振込案件が混在するグループを2分割
  const splitGroups = [];
  groups.forEach(g => {
    const receiptItems = (g.items||[]).filter(isReceiptItem);
    const transferItems = (g.items||[]).filter(r => !isReceiptItem(r));
    if (receiptItems.length > 0 && transferItems.length > 0) {
      splitGroups.push({...g, items: transferItems, _isReceiptGroup: false});
      splitGroups.push({...g, items: receiptItems, _isReceiptGroup: true});
    } else if (receiptItems.length > 0) {
      splitGroups.push({...g, items: receiptItems, _isReceiptGroup: true});
    } else {
      splitGroups.push({...g, items: transferItems, _isReceiptGroup: false});
    }
  });

  const filtered = splitGroups
    .filter(g=>!selMonth||g.month===selMonth)
    .filter(g=>(!custQ||g.customerName.toLowerCase().includes(custQ.toLowerCase()))&&(!globalQ||g.customerName.toLowerCase().includes(globalQ.toLowerCase())||g.projectName?.toLowerCase().includes(globalQ.toLowerCase())))
    .filter(g=>{
      if(statusFilter==="receipt") return g._isReceiptGroup;
      if(statusFilter==="all") return true;
      if(g._isReceiptGroup) return false;
      const d=getInvData(`${g.customerId}||${g.projectName}||${g.month}`);
      return statusFilter==="locked"?d.status==="locked":d.status!=="locked";
    })
    .sort((a,b)=>a.customerName.localeCompare(b.customerName,"ja")||a.projectName.localeCompare(b.projectName,"ja"));

  // 月またぎ分割反映済みグループを生成
  const crossAdjustedFiltered = React.useMemo(()=>{
    if(!selMonth||Object.keys(crossMonthSplits).length===0) return filtered;
    const [sy,sm]=selMonth.split("-").map(Number);
    const lastDayNum=new Date(sy,sm,0).getDate();
    const monthEnd=`${sy}-${String(sm).padStart(2,'0')}-${String(lastDayNum).padStart(2,'0')}`;
    let result=filtered.map(g=>({...g,items:[...g.items]}));
    const crossRecs=(records||[]).filter(r=>{
      if(!r.startDate||!r.endDate||r.billingType==="monthly") return false;
      const rs=r.startDate.slice(0,7),re=r.endDate.slice(0,7);
      if(rs===re||!(rs===selMonth||re===selMonth||(rs<selMonth&&re>selMonth))) return false;
      if(statusFilter==="receipt"&&!r.issueReceipt) return false;
      if((statusFilter==="open"||statusFilter==="locked")&&r.issueReceipt) return false;
      return true;
    });
    crossRecs.forEach(r=>{
      const sp=crossMonthSplits[r.id];
      if(!sp) return;
      const c=customers.find(x=>x.id===r.customerId);
      const recIsReceipt=!!r.issueReceipt;
      if(sp.type==='full'){
        const monthAmt=sp.targetMonth===selMonth?(r.amount||0):0;
        if(monthAmt<=0) return;
        const existingGroup=result.find(g=>g.items.some(item=>item.id===r.id)&&!!g._isReceiptGroup===recIsReceipt);
        if(existingGroup){
          result=result.map(g=>(g===existingGroup?{...g,items:g.items.map(item=>item.id===r.id?{...item,amount:monthAmt}:item)}:g));
        } else {
          const custSplit=c?.splitInvoice!==false;
          const synthProjName=custSplit?(r.projectName||""):"";
          const existingSame=result.find(g=>g.customerId===r.customerId&&g.projectName===synthProjName&&g.month===selMonth&&!!g._isReceiptGroup===recIsReceipt);
          if(existingSame){
            result=result.map(g=>g===existingSame?{...g,items:[...g.items,{...r,amount:monthAmt}]}:g);
          } else {
            result.push({customerId:r.customerId,customer:c,customerName:c?.name||"",projectName:synthProjName,month:selMonth,items:[{...r,amount:monthAmt}],split:custSplit,consolidate:false,_synthetic:true,_isReceiptGroup:recIsReceipt});
          }
        }
        return;
      }
      if(sp.type==='split'&&sp.splits){
        const idx=sp.splits.findIndex(spItem=>spItem.startDate&&spItem.endDate&&spItem.startDate.slice(0,7)<=selMonth&&spItem.endDate.slice(0,7)>=selMonth);
        if(idx<0) return;
        const isLast=idx===sp.splits.length-1;
        const spItem=sp.splits[idx];
        const splitDays=calcDays(spItem.startDate,spItem.endDate);
        const rLines=(r.lines&&r.lines.length)?r.lines:[{unitPrice:r.unitPrice,quantity:r.quantity||1,productId:r.productId||"",equipmentName:r.equipmentName||"",lineNote:r.lineNote||"",noBillingDiscount:!!r.noBillingDiscount}];
        const rebuiltLines=rLines.map(ln=>{
          const noDisc=ln.noBillingDiscount||(products||[]).find(p=>p.id===ln.productId)?.noBillingDiscount;
          const lineBD=noDisc?splitDays:(chainBillingDays({...r,startDate:spItem.startDate},records,spItem.endDate)||calcBillingDays(splitDays));
          const lineAmt=Math.round((ln.unitPrice||0)*(ln.quantity||1)*lineBD);
          let clampedReturnDate=ln.returnDate;
          if(clampedReturnDate&&(clampedReturnDate<spItem.startDate||clampedReturnDate>spItem.endDate)){
            clampedReturnDate=undefined;
          }
          return {...ln,billingDays:lineBD,amount:lineAmt,returnDate:clampedReturnDate};
        });
        const firstLn=rLines[0]||{};
        const firstNoDisc=firstLn.noBillingDiscount||(products||[]).find(p=>p.id===firstLn.productId)?.noBillingDiscount;
        const splitBillingDays=firstNoDisc?splitDays:(chainBillingDays({...r,startDate:spItem.startDate},records,spItem.endDate)||calcBillingDays(splitDays));
        const monthAmt=rebuiltLines.reduce((s,ln)=>s+(ln.amount||0),0);
        if(monthAmt<=0) return;
        let autoAdj=null;
        if(isLast){
          const origTotal=r.amount||0;
          const allSplitsTotal=sp.splits.reduce((s,sp2)=>{
            if(!sp2.startDate||!sp2.endDate) return s;
            const d2=calcDays(sp2.startDate,sp2.endDate);
            return s+rLines.reduce((s2,ln)=>{
              const noDisc=ln.noBillingDiscount||(products||[]).find(p=>p.id===ln.productId)?.noBillingDiscount;
              const bd=noDisc?d2:(chainBillingDays({...r,startDate:sp2.startDate},records,sp2.endDate)||calcBillingDays(d2));
              return s2+Math.round((ln.unitPrice||0)*(ln.quantity||1)*bd);
            },0);
          },0);
          const diff=origTotal-allSplitsTotal;
          if(diff!==0) autoAdj={id:`auto_adj_${r.id}`,label:'日数値引き調整',amount:diff,_auto:true};
        }
        const splitItem={...r,startDate:spItem.startDate,endDate:spItem.endDate,days:splitDays,billingDays:splitBillingDays,amount:monthAmt,lines:rebuiltLines};
        const injectAutoAdj=g=>autoAdj?{...g,_autoAdjustments:[...(g._autoAdjustments||[]).filter(a=>a.id!==autoAdj.id),autoAdj]}:g;
        const existingGroup=result.find(g=>g.items.some(item=>item.id===r.id)&&!!g._isReceiptGroup===recIsReceipt);
        if(existingGroup){
          result=result.map(g=>{
            if(g!==existingGroup) return g;
            return injectAutoAdj({...g,items:g.items.map(item=>item.id===r.id?splitItem:item)});
          });
        } else {
          const custSplit=c?.splitInvoice!==false;
          const synthProjName=custSplit?(r.projectName||""):"";
          const existingSame=result.find(g=>g.customerId===r.customerId&&g.projectName===synthProjName&&g.month===selMonth&&!!g._isReceiptGroup===recIsReceipt);
          if(existingSame){
            result=result.map(g=>g!==existingSame?g:injectAutoAdj({...g,items:[...g.items,splitItem]}));
          } else {
            result.push(injectAutoAdj({customerId:r.customerId,customer:c,customerName:c?.name||"",projectName:synthProjName,month:selMonth,items:[splitItem],split:custSplit,consolidate:false,_synthetic:true,_isReceiptGroup:recIsReceipt}));
          }
        }
      }
    });
    // 最終保険：itemsの中身に応じて _isReceiptGroup を強制再分割
    const finalResult=[];
    result.forEach(g=>{
      const receiptItems=(g.items||[]).filter(isReceiptItem);
      const transferItems=(g.items||[]).filter(r=>!isReceiptItem(r));
      if(receiptItems.length>0&&transferItems.length>0){
        finalResult.push({...g,items:transferItems,_isReceiptGroup:false});
        finalResult.push({...g,items:receiptItems,_isReceiptGroup:true});
      } else if(receiptItems.length>0){
        finalResult.push({...g,_isReceiptGroup:true});
      } else {
        finalResult.push({...g,_isReceiptGroup:false});
      }
    });
    // 後段防御：statusFilter を再適用
    const reFiltered=finalResult.filter(g=>{
      if(statusFilter==="receipt") return g._isReceiptGroup;
      if(statusFilter==="all") return true;
      if(g._isReceiptGroup) return false;
      const d=getInvData(`${g.customerId}||${g.projectName}||${g.month}`);
      return statusFilter==="locked"?d.status==="locked":d.status!=="locked";
    });
    return reFiltered;
  },[filtered,crossMonthSplits,selMonth,records,customers,products,statusFilter]);

  const monthTotal = crossAdjustedFiltered.reduce((s,g)=>{
    const key=`${g.customerId}||${g.projectName}||${g.month}`;
    const d=getInvData(key,g.month);
    const base=g.items.reduce((s,r)=>s+(r.amount||0)+(r.insuranceAmount||0),0);
    const adj=d.adjustments.reduce((s,a)=>s+(Number(a.amount)||0),0);
    const autoAdj=(g._autoAdjustments||[]).reduce((s,a)=>s+(Number(a.amount)||0),0);
    const inc=(incidents||[]).filter(x=>!x.separate_invoice&&x.status!=="paid"&&x.customer_id===g.customerId&&x.invoice_month===g.month&&(g.projectName===""||( x.related_project_name||"")===(g.projectName||""))).reduce((t,x)=>t+(x.charge_amount||0),0);
    return s+base+adj+autoAdj+inc;
  },0);
  // 各案件の税込を積み上げた正確な合計（顧客への請求総額）
  const monthTotalInc = crossAdjustedFiltered.reduce((s,g)=>{
    const key=`${g.customerId}||${g.projectName}||${g.month}`;
    const d=getInvData(key,g.month);
    const base=g.items.reduce((s2,r)=>s2+(r.amount||0)+(r.insuranceAmount||0),0);
    const adj=d.adjustments.reduce((s2,a)=>s2+(Number(a.amount)||0),0);
    const autoAdj=(g._autoAdjustments||[]).reduce((s2,a)=>s2+(Number(a.amount)||0),0);
    const inc=(incidents||[]).filter(x=>!x.separate_invoice&&x.status!=="paid"&&x.customer_id===g.customerId&&x.invoice_month===g.month&&(g.projectName===""||( x.related_project_name||"")===(g.projectName||""))).reduce((t,x)=>t+(x.charge_amount||0),0);
    const gt=base+adj+autoAdj+inc;
    return s+gt+Math.round(gt*0.1);
  },0);
  const simpleInc = monthTotal+Math.round(monthTotal*0.1);
  const incDiff = monthTotalInc - simpleInc;

  return(
    <div style={{display:"flex",gap:16,alignItems:"flex-start"}}>
      <div style={{flex:1,minWidth:0}}>

        {/* ヘッダー */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
          <h2 style={{fontSize:16,fontWeight:700,margin:0}}>請求書</h2>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            {/* 月選択 */}
            <select value={selMonth} onChange={e=>{setSelMonth(e.target.value);setExpanded({});}}
              style={{...S.inp,width:125,fontWeight:700,fontSize:13}}>
              <option value="">全期間</option>
              {months.map(m=><option key={m} value={m}>{m}</option>)}
            </select>
            {/* 顧客検索 */}
            <div style={{position:"relative"}}>
              <div style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",opacity:.4}}><Ico d={I.search} size={13}/></div>
              <input value={custQ} onChange={e=>setCustQ(e.target.value)} placeholder="顧客名で絞り込み"
                style={{...S.inp,paddingLeft:26,width:150}}/>
            </div>
            {/* ステータスフィルター */}
            <div style={{display:"flex",gap:2,background:"#e2e8f0",borderRadius:6,padding:2}}>
              {[{k:"all",l:"全て"},{k:"open",l:"未締め"},{k:"locked",l:"締め済み"},{k:"receipt",l:"領収済"}].map(t=>(
                <button key={t.k} onClick={()=>setStatusFilter(t.k)} style={{
                  background:statusFilter===t.k?"#fff":"transparent",border:"none",borderRadius:5,
                  padding:"4px 10px",fontSize:11,fontWeight:statusFilter===t.k?700:500,
                  color:statusFilter===t.k?"#0f172a":"#94a3b8",cursor:"pointer",
                  boxShadow:statusFilter===t.k?"0 1px 3px rgba(0,0,0,.1)":"none"
                }}>{t.l}</button>
              ))}
            </div>
          </div>
        </div>

        {/* 月末暫定締めの警告バー */}
        {selMonth && (() => {
          const pendingProvisional = (records||[]).filter(r =>
            r.endDateOpen === true
            && r.isExtension === true
            && !r.returnDate
            && r.startDate
            && r.startDate.slice(0,7) < selMonth
          );
          if (pendingProvisional.length === 0) return null;
          const [sy, sm] = selMonth.split("-").map(Number);
          const prevMonthEnd = new Date(sy, sm - 1, 0);
          const prevMonthEndStr = `${prevMonthEnd.getFullYear()}-${String(prevMonthEnd.getMonth()+1).padStart(2,'0')}-${String(prevMonthEnd.getDate()).padStart(2,'0')}`;
          return (
            <div style={{padding:"12px 16px",marginBottom:14,background:"#fef3c7",border:"1px solid #fbbf24",borderRadius:8}}>
              <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                <span style={{fontSize:14}}>⚠️</span>
                <div style={{flex:1,minWidth:200}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#78350f",marginBottom:2}}>
                    {selMonth.replace("-","年")+"月"}に未処理の延長中案件があります（{pendingProvisional.length}件）
                  </div>
                  <div style={{fontSize:11,color:"#92400e"}}>
                    前月末（{prevMonthEndStr}）で暫定的に締めて、当月分の請求書を発行できます。
                  </div>
                </div>
                <button onClick={async () => {
                  const currentMonthFirstStr = `${sy}-${String(sm).padStart(2,'0')}-01`;
                  const _now = new Date();
                  const _pad = n => String(n).padStart(2, "0");
                  const createdAtStr = _now.getFullYear()+"-"+_pad(_now.getMonth()+1)+"-"+_pad(_now.getDate())+"T"+_pad(_now.getHours())+":"+_pad(_now.getMinutes())+":"+_pad(_now.getSeconds());
                  let allRecords = [...(records||[])];
                  const updatesById = {};
                  const newRecords = [];
                  pendingProvisional.forEach(r => {
                    const newDays = calcDays(r.startDate, prevMonthEndStr);
                    const newBillingDays = chainBillingDays(r, allRecords, prevMonthEndStr);
                    const rLines = getLines(r);
                    const newAmount = rLines.reduce((s, ln) => {
                      const noDisc = ln.noBillingDiscount;
                      const qty = noDisc ? newDays : newBillingDays;
                      return s + (Number(ln.unitPrice)||0) * (Number(ln.quantity)||1) * qty;
                    }, 0);
                    updatesById[r.id] = {
                      ...r,
                      endDate: prevMonthEndStr,
                      endDateOpen: false,
                      returnDate: prevMonthEndStr,
                      isProvisionalClose: true,
                      days: newDays,
                      billingDays: newBillingDays,
                      amount: newAmount,
                      insuranceAmount: r.includeInsurance ? Math.round(newAmount * 0.1) : 0,
                    };
                    const baseNo = (r.deliveryNo || "").replace(/E\d+$/, "");
                    let maxE = 0;
                    allRecords.forEach(x => {
                      const dn = x.deliveryNo || "";
                      if (!baseNo || !dn.startsWith(baseNo + "E")) return;
                      const suffix = dn.slice(baseNo.length + 1);
                      if (/^\d+$/.test(suffix)) { const n = parseInt(suffix); if (n > maxE) maxE = n; }
                    });
                    const newDeliveryNo = baseNo ? (baseNo + "E" + (maxE + 1)) : r.deliveryNo;
                    const continuingRec = {
                      ...r,
                      id: uid(),
                      deliveryNo: newDeliveryNo,
                      startDate: currentMonthFirstStr,
                      endDate: currentMonthFirstStr,
                      endDateOpen: true,
                      isExtension: true,
                      isProvisionalClose: false,
                      extendedFrom: r.extendedFrom || r.id,
                      extendedFromNo: r.extendedFromNo || r.deliveryNo || "",
                      returnDate: undefined,
                      actualReturnDate: undefined,
                      amount: 0,
                      insuranceAmount: 0,
                      days: undefined,
                      billingDays: undefined,
                      lines: rLines.map(ln => ({...ln, returnDate: undefined, actualReturnDate: undefined})),
                      createdAt: createdAtStr,
                    };
                    newRecords.push(continuingRec);
                    allRecords.push(continuingRec);
                  });
                  const finalRecords = [
                    ...(records||[]).map(x => updatesById[x.id] || x),
                    ...newRecords
                  ];
                  await onSaveRec(finalRecords,null,[...Object.values(updatesById),...newRecords]);
                  showToast(`${pendingProvisional.length}件を前月末で暫定締めしました`);
                }} style={{...S.btn("#d97706",true),fontSize:11,whiteSpace:"nowrap"}}>
                  📅 前月末で暫定締め
                </button>
              </div>
              <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid #fcd34d",fontSize:11,color:"#78350f"}}>
                {pendingProvisional.slice(0,5).map(r => {
                  const c = customers.find(x=>x.id===r.customerId);
                  return (
                    <div key={r.id} style={{padding:"2px 0"}}>
                      ・{r.deliveryNo||""} {c?.name||""} {r.projectName||""}（{r.startDate}〜継続中）
                    </div>
                  );
                })}
                {pendingProvisional.length > 5 && (
                  <div style={{padding:"2px 0",fontStyle:"italic"}}>
                    ・他 {pendingProvisional.length - 5} 件
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* 月合計バー */}
        {/* 統計カード */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:18}}>
          {[
            {l:"今月の案件数",v:(records||[]).filter(r=>r.startDate?.startsWith(today().slice(0,7))).length+"件",c:"#2563eb"},
            {l:"今月売上(税抜)",v:fmt((records||[]).filter(r=>r.startDate?.startsWith(today().slice(0,7))).reduce((s,r)=>s+(r.amount||0),0)),c:"#16a34a"},
            {l:"顧客数",v:new Set((records||[]).map(r=>r.customerId)).size+"社",c:"#9333ea"}
          ].map(s=>(
            <div key={s.l} style={{...S.card,padding:"16px 20px"}}><div style={{fontSize:11,color:"#64748b",marginBottom:4}}>{s.l}</div><div style={{fontSize:22,fontWeight:800,color:s.c}}>{s.v}</div></div>
          ))}
        </div>
        {/* パスワード設定 */}
        {showPwSetting&&(
          <div style={{...S.card,padding:"12px 16px",marginBottom:10,background:"#fefce8",border:"1px solid #fde047"}}>
            <div style={{fontSize:12,fontWeight:700,marginBottom:8}}>🔑 締め解除パスワードの変更</div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <input type="password" value={newPw} onChange={e=>setNewPw(e.target.value)} placeholder="新しいパスワード" style={{...S.inp,width:180}}/>
              <button onClick={()=>{if(!newPw){showToast("パスワードを入力してください",false);return;}setChangePwModal(true);}} style={S.btn("#0f172a",true)}>変更</button>
              <button onClick={()=>{setShowPwSetting(false);setNewPw("");}} style={S.btn("#94a3b8")}>キャンセル</button>
            </div>
          </div>
        )}
        {selMonth&&filtered.length>0&&(
          <div style={{background:"#eff6ff",borderRadius:8,padding:"8px 16px",marginBottom:10,display:"flex",gap:20,fontSize:12,alignItems:"center"}}>
            <span style={{color:"#64748b"}}>{selMonth}　{filtered.length}件</span>
            <span><span style={{color:"#64748b"}}>税抜合計: </span><strong style={{color:"#16a34a",fontSize:15}}>{fmt(monthTotal)}</strong></span>
            <span><strong style={{color:"#9333ea",fontSize:15}}>{fmt(monthTotalInc)}</strong><span style={{color:"#64748b"}}>（税込・請求総額）</span></span>
            {incDiff===0
              ? <span style={{fontSize:11,color:"#16a34a",fontWeight:700}}>✅ 端数整合</span>
              : <span style={{fontSize:11,color:"#dc2626",fontWeight:700}}>⚠️ 端数差異 {incDiff>0?"+":""}{incDiff.toLocaleString()}円</span>}
            <button onClick={()=>setShowPwSetting(p=>!p)} style={{...S.btn("#f59e0b",true),fontSize:11}}>🔑 PW設定</button>
            <button onClick={()=>{
              // freee 取引インポートCSV出力
              const [y,m] = selMonth.split("-").map(Number);
              const lastDay = new Date(y, m, 0).getDate();
              const dateStr = `${y}/${String(m).padStart(2,"0")}/${String(lastDay).padStart(2,"0")}`;
              const parsePaymentDue = (cycle, sm) => {
                const [cy, cm] = sm.split("-").map(Number);
                if (/翌々月末日/.test(cycle)) {
                  const nm = cm >= 11 ? cm - 10 : cm + 2;
                  const ny = cm >= 11 ? cy + 1 : cy;
                  return `${ny}年${nm}月${new Date(ny, nm, 0).getDate()}日`;
                }
                if (/翌月末日/.test(cycle)) {
                  const nm = cm === 12 ? 1 : cm + 1;
                  const ny = cm === 12 ? cy + 1 : cy;
                  return `${ny}年${nm}月${new Date(ny, nm, 0).getDate()}日`;
                }
                const m2 = cycle.match(/翌々月(\d+)日/);
                if (m2) {
                  const nm = cm >= 11 ? cm - 10 : cm + 2;
                  const ny = cm >= 11 ? cy + 1 : cy;
                  return `${ny}年${nm}月${m2[1]}日`;
                }
                const m1 = cycle.match(/翌月(\d+)日/);
                if (m1) {
                  const nm = cm === 12 ? 1 : cm + 1;
                  const ny = cm === 12 ? cy + 1 : cy;
                  return `${ny}年${nm}月${m1[1]}日`;
                }
                return "";
              };
              const bom = "\uFEFF";
              const csvCell = v => `"${String(v??'').replace(/"/g,'""')}"`;
              const header = bom+[csvCell("発生日"),csvCell("金額"),csvCell("取引先"),csvCell("案件名"),csvCell("支払情報"),csvCell("摘要")].join(",");
              const transferRows = [];
              const receiptRows = [];
              crossAdjustedFiltered.forEach(g=>{
                const base = g.items.reduce((s,r)=>s+(Number(r.amount)||0)+(Number(r.insuranceAmount)||0),0);
                const autoAdj=(g._autoAdjustments||[]).reduce((s,a)=>s+(Number(a.amount)||0),0);
                const key=`${g.customerId}||${g.projectName}||${g.month}`;
                const manualAdj=getInvData(key,g.month).adjustments.reduce((s,a)=>s+(Number(a.amount)||0),0);
                const incTotCsv=(incidents||[]).filter(x=>!x.separate_invoice&&x.status!=="paid"&&x.customer_id===g.customerId&&x.invoice_month===g.month&&(g.projectName===""||( x.related_project_name||"")===(g.projectName||""))).reduce((t,x)=>t+(x.charge_amount||0),0);
                const grandBase = base + autoAdj + manualAdj + incTotCsv;
                const total = grandBase + Math.round(grandBase*0.1);
                const projectName = g.projectName || "";
                if (g._isReceiptGroup) {
                  const ri = g.items.find(r=>r.issueReceipt&&r.receiptDate);
                  const rd = ri ? new Date(ri.receiptDate+"T00:00:00") : null;
                  const pm = ri?.paymentMethod==="cash"?"現金":ri?.paymentMethod==="square"?"スクエア クレジット":"ECクレジット";
                  const paymentInfo = rd ? `${rd.getFullYear()}年${rd.getMonth()+1}月${rd.getDate()}日 ${pm}領収済` : "";
                  receiptRows.push([csvCell(dateStr),csvCell(total),csvCell(g.customerName),csvCell(projectName),csvCell(paymentInfo),csvCell(pm)].join(","));
                } else {
                  const cycle = g.customer?.paymentCycle || customers.find(c=>c.id===g.customerId)?.paymentCycle || "";
                  const paymentInfo = parsePaymentDue(cycle, selMonth);
                  transferRows.push([csvCell(dateStr),csvCell(total),csvCell(g.customerName),csvCell(projectName),csvCell(paymentInfo),csvCell(cycle)].join(","));
                }
              });
              const allRows = [header, ...transferRows];
              if (receiptRows.length > 0) { allRows.push(""); allRows.push(...receiptRows); }
              const blob = new Blob([allRows.join("\r\n")], {type:"text/csv;charset=utf-8"});
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob); a.download = `freee_取引_${selMonth}.csv`;
              a.click();
            }} style={{...S.btn("#0ea5e9",true),fontSize:11,marginLeft:"auto"}}>📤 freee CSV</button>
            <button onClick={triggerPrintCountReset} style={{...S.btn("#dc2626",true),fontSize:11}}>🗑 発行履歴リセット</button>
          </div>
        )}

        {/* 月またぎ案件セクション */}
        {(()=>{
          if(!selMonth) return null;
          const [sy,sm]=selMonth.split("-").map(Number);
          const lastDayNum=new Date(sy,sm,0).getDate();
          const monthEnd=`${sy}-${String(sm).padStart(2,'0')}-${String(lastDayNum).padStart(2,'0')}`;
          const crossRecords=(records||[]).filter(r=>{
            if(!r.startDate||!r.endDate||r.billingType==="monthly") return false;
            const rs=r.startDate.slice(0,7),re=r.endDate.slice(0,7);
            return rs!==re&&(rs===selMonth||re===selMonth||(rs<selMonth&&re>selMonth));
          });
          if(crossRecords.length===0) return null;
          const getStatus=r=>{const sp=crossMonthSplits[r.id];if(!sp)return'pending';if(sp.type==='full')return'done';return'splitting';};
          const getMonths=r=>{const ms=[];let m=r.startDate.slice(0,7);const end=r.endDate.slice(0,7);while(m<=end){ms.push(m);const [y,mo]=m.split('-').map(Number);m=mo===12?`${y+1}-01`:`${y}-${String(mo+1).padStart(2,'0')}`;}return ms;};
          const computeSplitAmt=(r,spItem)=>{if(!spItem.startDate||!spItem.endDate)return 0;const d=calcDays(spItem.startDate,spItem.endDate);const rLines=(r.lines&&r.lines.length)?r.lines:[{unitPrice:r.unitPrice,quantity:r.quantity||1,productId:r.productId}];return rLines.reduce((s,ln)=>{const prod=(products||[]).find(p=>p.id===ln.productId);const billDays=prod?.noBillingDiscount?d:calcBillingDays(d);return s+Math.round((ln.unitPrice||0)*(ln.quantity||1)*billDays);},0);};
          const addDay=dateStr=>{const d=new Date(dateStr);d.setDate(d.getDate()+1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
          const pendingCount=crossRecords.filter(r=>getStatus(r)==='pending').length;
          const doneCount=crossRecords.filter(r=>getStatus(r)!=='pending').length;
          return(
            <div style={{background:"#fff",border:"1.5px solid #f59e0b",borderRadius:10,padding:"12px 16px",marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",marginBottom:10}}>
                <span style={{fontSize:13,fontWeight:700,color:"#92400e"}}>⚠ 月またぎ案件（{crossRecords.length}件）</span>
                <span style={{fontSize:11,color:"#92400e",marginLeft:"auto"}}>未処理 {pendingCount}件　処理済 {doneCount}件</span>
              </div>
              {crossRecords.map(r=>{
                const c=customers.find(x=>x.id===r.customerId);
                const status=getStatus(r);
                const sp=crossMonthSplits[r.id];
                const totalAmt=r.amount||0;
                const months=getMonths(r);
                const cardStyle=status==='done'?{background:"#dcfce7",border:"1px solid #86efac"}:status==='splitting'?{background:"#dbeafe",border:"1px solid #93c5fd"}:{background:"#fffbeb",border:"1px solid #fde68a"};
                const badge=status==='done'?{label:"処理済",bg:"#16a34a"}:status==='splitting'?{label:"分割中",bg:"#2563eb"}:{label:"未処理",bg:"#f59e0b"};
                const splits=sp?.splits||[{startDate:r.startDate,endDate:monthEnd}];
                const usedAmt=splits.slice(0,-1).reduce((s,spItem)=>s+computeSplitAmt(r,spItem),0);
                const lastAmt=totalAmt-usedAmt;
                return(
                  <div key={r.id} style={{borderRadius:8,padding:"10px 12px",marginBottom:8,...cardStyle}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                      <span style={{fontSize:10,padding:"2px 6px",borderRadius:3,background:badge.bg,color:"#fff"}}>{badge.label}</span>
                      <span style={{fontWeight:600,fontSize:12}}>{c?.name||"不明"}</span>
                      <span style={{fontSize:11,color:"#64748b"}}>{r.projectName||""}</span>
                      <span style={{fontSize:11,color:"#64748b"}}>{r.startDate}〜{r.endDate}</span>
                      <span style={{fontSize:12,fontWeight:700,marginLeft:"auto"}}>合計 {fmt(totalAmt)}</span>
                    </div>
                    {(()=>{
                      const rLines=(r.lines&&r.lines.length)?r.lines:(r.equipmentName?[{equipmentName:r.equipmentName,quantity:r.quantity||1,amount:r.amount}]:[]);
                      return rLines.length>0&&(
                        <div style={{background:"rgba(255,255,255,0.7)",borderRadius:4,padding:"6px 8px",marginBottom:8,fontSize:11}}>
                          {rLines.map((ln,i)=>(
                            <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"2px 0",borderBottom:i<rLines.length-1?"1px solid rgba(0,0,0,0.06)":"none"}}>
                              <span>{ln.equipmentName||"―"}{(ln.quantity||1)>1?` ×${ln.quantity}`:""}</span>
                              <span style={{color:"#64748b"}}>{ln.amount?fmt(ln.amount):""}</span>
                            </div>
                          ))}
                          <div style={{marginTop:6,paddingTop:4,borderTop:"1px solid rgba(0,0,0,0.06)"}}>
                            <button onClick={()=>{const g={customerId:r.customerId,customer:c,customerName:c?.name||"",projectName:r.projectName||"",month:r.startDate?.slice(0,7)||"",items:[r],split:true,consolidate:false};downloadPrintHTML(r.issueReceipt?"delivery-receipt":"delivery",g);}} style={{background:"none",border:"none",color:"#2563eb",fontSize:11,cursor:"pointer",padding:0,textDecoration:"underline"}}>→ 納品書を開く</button>
                          </div>
                        </div>
                      );
                    })()}
                    {status==='done'&&<div style={{fontSize:11,color:"#15803d",fontWeight:500,marginBottom:6}}>✓ {sp.targetMonth?.slice(5)}月に全額計上</div>}
                    {status==='splitting'&&(
                      <div style={{marginBottom:6}}>
                        {splits.map((spItem,si)=>{
                          const isLast=si===splits.length-1;
                          const d=spItem.startDate&&spItem.endDate?calcDays(spItem.startDate,spItem.endDate):0;
                          const spAmt=isLast?lastAmt:computeSplitAmt(r,spItem);
                          const isSet=!!(spItem.startDate&&spItem.endDate);
                          return(
                            <div key={si} style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,fontSize:11}}>
                              <span style={{minWidth:44,fontWeight:500,color:"#475569"}}>{spItem.startDate?spItem.startDate.slice(0,7).slice(5)+"月":""}</span>
                              <input type="date" value={spItem.startDate||""} disabled={si===0} onChange={e=>setCrossMonthSplits(prev=>{const ns={...prev[r.id],splits:[...prev[r.id].splits]};ns.splits[si]={...ns.splits[si],startDate:e.target.value};return {...prev,[r.id]:ns};})} style={{border:"1px solid #e2e8f0",borderRadius:4,padding:"2px 4px",fontSize:11,width:110}}/>
                              <span>〜</span>
                              <input type="date" value={spItem.endDate||""} disabled={isLast} onChange={e=>{const nd=addDay(e.target.value);setCrossMonthSplits(prev=>{const ns={...prev[r.id],splits:[...prev[r.id].splits]};ns.splits[si]={...ns.splits[si],endDate:e.target.value};if(ns.splits[si+1])ns.splits[si+1]={...ns.splits[si+1],startDate:nd};const newUsed=ns.splits.slice(0,-1).reduce((s,sp2)=>s+computeSplitAmt(r,{...sp2,endDate:sp2.endDate||""}),0);if(newUsed>=(r.amount||0)){alert('非最終月の合計が案件登録金額を超えています。期間を短くしてください。');return prev;}return {...prev,[r.id]:ns};});}} style={{border:"1px solid #e2e8f0",borderRadius:4,padding:"2px 4px",fontSize:11,width:110}}/>
                              <span style={{minWidth:64,textAlign:"right"}}>{fmt(spAmt)}</span>
                              <span style={{fontSize:10,padding:"1px 5px",borderRadius:3,background:isSet?"#dcfce7":"#fee2e2",color:isSet?"#15803d":"#dc2626"}}>{(()=>{if(!isSet)return"未設定";const rLines=(r.lines&&r.lines.length)?r.lines:[{productId:r.productId}];const hasNoBilling=rLines.some(ln=>(products||[]).find(p=>p.id===ln.productId)?.noBillingDiscount);return hasNoBilling?`${d}日間請求`:`${d}日→${calcBillingDays(d)}請求日`;})()}</span>
                              {isLast&&<span style={{fontSize:10,color:"#94a3b8"}}>（帳尻）</span>}
                              {!isLast&&si>0&&<button onClick={()=>setCrossMonthSplits(prev=>{const ns={...prev[r.id],splits:[...prev[r.id].splits]};ns.splits.splice(si,1);return {...prev,[r.id]:ns};})} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:12}}>✕</button>}
                            </div>
                          );
                        })}
                        <div style={{fontSize:11,marginTop:4,color:Math.abs(usedAmt+lastAmt-totalAmt)<1?"#15803d":"#dc2626"}}>
                          合計チェック：{fmt(totalAmt)} {Math.abs(usedAmt+lastAmt-totalAmt)<1?"✓ 納品書と一致":"✗ 不一致"}
                        </div>
                      </div>
                    )}
                    <div style={{display:"flex",gap:8,alignItems:"center",marginTop:6,flexWrap:"wrap"}}>
                      {status==='pending'&&<>
                        {months.map(m=>(
                          <button key={m} onClick={()=>setCrossMonthSplits(prev=>({...prev,[r.id]:{type:'full',targetMonth:m}}))}
                            style={{fontSize:11,background:m===selMonth?"#16a34a":"#4f46e5",color:"#fff",border:"none",borderRadius:4,padding:"3px 10px",cursor:"pointer"}}>
                            ✓ {m.slice(5)}月に全額計上
                          </button>
                        ))}
                        <button onClick={()=>setCrossMonthSplits(prev=>({...prev,[r.id]:{type:'split',splits:[{startDate:r.startDate,endDate:monthEnd},{startDate:addDay(monthEnd),endDate:r.endDate}]}}))}
                          style={{fontSize:11,background:"#e0f2fe",color:"#0369a1",border:"1px solid #7dd3fc",borderRadius:4,padding:"3px 10px",cursor:"pointer"}}>
                          期間を分割して計上
                        </button>
                      </>}
                      {status==='splitting'&&<button onClick={()=>{const s=[...splits];const prev2=s[s.length-2];const nextStart=prev2?.endDate?addDay(prev2.endDate):"";s.splice(s.length-1,0,{startDate:nextStart,endDate:""});setCrossMonthSplits(prev=>({...prev,[r.id]:{...prev[r.id],splits:s}}));}} style={{fontSize:11,color:"#0369a1",background:"none",border:"none",cursor:"pointer",padding:"2px 0"}}>+ 分割を追加</button>}
                      {status!=='pending'&&<button onClick={()=>setCrossMonthSplits(prev=>{const p={...prev};delete p[r.id];return p;})} style={{fontSize:11,color:"#64748b",background:"none",border:"none",cursor:"pointer",textDecoration:"underline"}}>リセット</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* テーブル */}
        <div style={S.card}>
          {filtered.length===0
            ?<div style={{padding:48,textAlign:"center",color:"#94a3b8"}}>
              {selMonth?"この月の請求データがありません":"案件を登録すると表示されます"}
            </div>
            :<table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5}}>
              <thead>
                <tr style={{background:"#f8fafc",borderBottom:"2px solid #e2e8f0"}}>
                  <th style={{padding:"8px 12px",textAlign:"left",fontWeight:700,color:"#475569",width:20}}></th>
                  <th style={{padding:"8px 12px",textAlign:"left",fontWeight:700,color:"#475569"}}>顧客</th>
                  <th style={{padding:"8px 12px",textAlign:"left",fontWeight:700,color:"#475569"}}>案件名</th>
                  <th style={{padding:"8px 12px",textAlign:"center",fontWeight:700,color:"#475569",width:40}}>件数</th>
                  <th style={{padding:"8px 12px",textAlign:"right",fontWeight:700,color:"#475569"}}>税抜</th>
                  <th style={{padding:"8px 12px",textAlign:"right",fontWeight:700,color:"#475569"}}>税込</th>
                  <th style={{padding:"8px 12px",textAlign:"center",fontWeight:700,color:"#475569",width:90}}>状態</th>
                  <th style={{padding:"8px 12px",width:80}}></th>
                </tr>
              </thead>
              <tbody>
                {(()=>{
                  const custGroups={};
                  crossAdjustedFiltered.forEach(g=>{
                    if(!custGroups[g.customerId]) custGroups[g.customerId]={customerName:g.customerName,customerId:g.customerId,groups:[]};
                    custGroups[g.customerId].groups.push(g);
                  });
                  const custList=Object.values(custGroups).sort((a,b)=>a.customerName.localeCompare(b.customerName,"ja"));
                  return custList.map(cust=>{
                    const custKey=`cust_${cust.customerId}`;
                    const custOpen=!!expanded[custKey];
                    const custTotEx=cust.groups.reduce((s,g)=>{
                      const d=getInvData(`${g.customerId}||${g.projectName}||${g.month}`,g.month);
                      const base=g.items.reduce((t,r)=>t+(r.amount||0)+(r.insuranceAmount||0),0);
                      const adj=d.adjustments.reduce((t,a)=>t+(Number(a.amount)||0),0);
                      const inc=(incidents||[]).filter(x=>!x.separate_invoice&&x.status!=="paid"&&x.customer_id===g.customerId&&x.invoice_month===g.month&&(g.projectName===""||( x.related_project_name||"")===(g.projectName||""))).reduce((t,x)=>t+(x.charge_amount||0),0);
                      return s+base+adj+inc;
                    },0);
                    const custTotInc=cust.groups.reduce((s,g)=>{
                      const d=getInvData(`${g.customerId}||${g.projectName}||${g.month}`,g.month);
                      const base=g.items.reduce((t,r)=>t+(r.amount||0)+(r.insuranceAmount||0),0);
                      const adj=d.adjustments.reduce((t,a)=>t+(Number(a.amount)||0),0);
                      const inc=(incidents||[]).filter(x=>!x.separate_invoice&&x.status!=="paid"&&x.customer_id===g.customerId&&x.invoice_month===g.month&&(g.projectName===""||( x.related_project_name||"")===(g.projectName||""))).reduce((t,x)=>t+(x.charge_amount||0),0);
                      const gt=base+adj+inc;
                      return s+gt+Math.round(gt*0.1);
                    },0);
                    const custTax=Math.round(custTotEx*0.1);
                    return(
                      <React.Fragment key={cust.customerId}>
                        {/* 層1: 顧客行 */}
                        <tr onClick={()=>toggleExpand(custKey)} style={{background:"#f1f5f9",cursor:"pointer",borderBottom:"1px solid #e2e8f0"}}>
                          <td style={{padding:"8px 12px",textAlign:"center",color:"#94a3b8",fontSize:11}}>{custOpen?"▼":"▶"}</td>
                          <td colSpan={2} style={{padding:"8px 12px",fontWeight:700,fontSize:13}}>{cust.customerName}</td>
                          <td style={{padding:"8px 12px",textAlign:"center",color:"#64748b"}}>{cust.groups.length}</td>
                          <td style={{padding:"8px 12px",textAlign:"right",fontWeight:700,color:"#16a34a"}}>{fmt(custTotEx)}</td>
                          <td style={{padding:"8px 12px",textAlign:"right",color:"#9333ea"}}>{fmt(custTotInc)}</td>
                          <td colSpan={2} style={{padding:"8px 8px",textAlign:"center"}} onClick={e=>e.stopPropagation()}>
                            {(()=>{
                              const total=cust.groups.length;
                              const issued=cust.groups.filter(g=>{const d=getInvData(`${g.customerId}||${g.projectName}||${g.month}`,g.month);return (d.printCount||0)>0||g.items.some(r=>r.issueReceipt);}).length;
                              if(issued===0) return null;
                              if(issued===total) return <span style={{fontSize:10,color:"#16a34a",fontWeight:700,whiteSpace:"nowrap"}}>✅ 全件発行済</span>;
                              return <span style={{fontSize:10,color:"#0369a1",fontWeight:700,whiteSpace:"nowrap"}}>{total}件中{issued}件発行済 残{total-issued}件</span>;
                            })()}
                            {cust.groups.length>1&&custOpen&&(
                              <div style={{display:"flex",gap:4,justifyContent:"center",marginTop:4}}>
                                <button onClick={async()=>{
                                  let allBody="";let lastCss="";
                                  for(let gi=0;gi<cust.groups.length;gi++){
                                    const grp=cust.groups[gi];
                                    const gkey=grp.customerId+"||"+grp.projectName+"||"+grp.month;
                                    const cur=getInvData(gkey);
                                    const invNo=cur.invNo||(grp.month?(grp.month+"-???"):"");
                                    const grpSnap = cur.status==="locked" && cur.snapshot && cur.snapshot.items;
                                    const printGrp = grpSnap ? {...grp, items:cur.snapshot.items, projectName:cur.snapshot.projectName??grp.projectName, adjustments:cur.snapshot.adjustments||cur.adjustments} : {...grp, adjustments:cur.adjustments};
                                    const r=downloadPrintHTML("invoice",Object.assign({},printGrp,{invNo:invNo,issueDate:cur.issueDate||""}),products,0,incidents,records,true);
                                    if(r&&r.body){
                                      let b=gi<cust.groups.length-1?r.body.replace(/class="pb-last"/g,'class="pb"'):r.body;
                                      b=b.replace('padding:0px 34px 28px 34px','padding:52px 34px 28px 34px');
                                      allBody+=b;lastCss=r.css;
                                    }
                                  }
                                  if(!allBody) return;
                                  const mtitle="ご請求書一括_"+cust.customerName+"御中_"+((cust.groups[0]&&cust.groups[0].month)||"");
                                  const bCss1=lastCss.replace('@page{margin:0mm;size:A4}','@page{margin:52px 0 0 0;size:A4}');
                                  const nt=window.open("","_blank");
                                  nt.document.write("<!DOCTYPE html><html lang='ja'><head><meta charset='utf-8'><title>"+mtitle+"</title><style>"+bCss1+"\n@media print{.no-print{display:none!important}body{margin:0}}</style></head><body>");
                                  nt.document.write("<div class='no-print' style='position:fixed;top:0;left:0;right:0;background:#1e293b;color:#fff;padding:10px 20px;display:flex;align-items:center;gap:12px;z-index:9999;font-family:sans-serif;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,.3)'><span style='font-weight:700;flex:1'>"+mtitle+"</span><button onclick='window.print()' style='background:#2563eb;color:#fff;border:none;border-radius:6px;padding:7px 20px;font-size:14px;font-weight:700;cursor:pointer'>🖨 印刷 / PDF保存</button><button onclick='window.close()' style='background:none;border:1px solid rgba(255,255,255,0.3);color:#fff;border-radius:6px;padding:7px 14px;font-size:13px;cursor:pointer'>✕ 閉じる</button></div>");
                                  nt.document.write("<div>"+allBody+"</div></body></html>");
                                  nt.document.close();
                                }} style={{...S.ib("#94a3b8"),fontSize:10,padding:"2px 6px"}}>
                                  <Ico d={I.print} size={10}/>一括確認
                                </button>
                                <button onClick={async()=>{
                                  let allBody="";let lastCss="";
                                  for(let gi=0;gi<cust.groups.length;gi++){
                                    const grp=cust.groups[gi];
                                    const gkey=grp.customerId+"||"+grp.projectName+"||"+grp.month;
                                    const cur=getInvData(gkey);
                                    let baseNo=cur.invNo;let count;
                                    if(!baseNo){baseNo=await nextInvoiceNo(grp.month);count=1;}
                                    else{count=(cur.printCount||1)+1;}
                                    await updateInvData(gkey,{invNo:baseNo,printCount:count,lastPrintDate:new Date().toISOString()});
                                    const invNo=count<=1?baseNo:(baseNo+"-"+count);
                                    const grpSnap2 = cur.status==="locked" && cur.snapshot && cur.snapshot.items;
                                    const printGrp2 = grpSnap2 ? {...grp, items:cur.snapshot.items, projectName:cur.snapshot.projectName??grp.projectName, adjustments:cur.snapshot.adjustments||cur.adjustments} : {...grp, adjustments:cur.adjustments};
                                    const r=downloadPrintHTML("invoice",Object.assign({},printGrp2,{invNo:invNo,issueDate:cur.issueDate||""}),products,0,incidents,records,true);
                                    if(r&&r.body){
                                      let b=gi<cust.groups.length-1?r.body.replace(/class="pb-last"/g,'class="pb"'):r.body;
                                      b=b.replace('padding:0px 34px 28px 34px','padding:52px 34px 28px 34px');
                                      allBody+=b;lastCss=r.css;
                                    }
                                  }
                                  if(!allBody) return;
                                  const mtitle="ご請求書一括_"+cust.customerName+"御中_"+((cust.groups[0]&&cust.groups[0].month)||"");
                                  const bCss2=lastCss.replace('@page{margin:0mm;size:A4}','@page{margin:52px 0 0 0;size:A4}');
                                  const nt=window.open("","_blank");
                                  nt.document.write("<!DOCTYPE html><html lang='ja'><head><meta charset='utf-8'><title>"+mtitle+"</title><style>"+bCss2+"\n@media print{.no-print{display:none!important}body{margin:0}}</style></head><body>");
                                  nt.document.write("<div class='no-print' style='position:fixed;top:0;left:0;right:0;background:#1e293b;color:#fff;padding:10px 20px;display:flex;align-items:center;gap:12px;z-index:9999;font-family:sans-serif;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,.3)'><span style='font-weight:700;flex:1'>"+mtitle+"</span><button onclick='window.print()' style='background:#2563eb;color:#fff;border:none;border-radius:6px;padding:7px 20px;font-size:14px;font-weight:700;cursor:pointer'>🖨 印刷 / PDF保存</button><button onclick='window.close()' style='background:none;border:1px solid rgba(255,255,255,0.3);color:#fff;border-radius:6px;padding:7px 14px;font-size:13px;cursor:pointer'>✕ 閉じる</button></div>");
                                  nt.document.write("<div>"+allBody+"</div></body></html>");
                                  nt.document.close();
                                }} style={{...S.ib("#1d4ed8"),fontSize:10,padding:"2px 6px"}}>
                                  🖨一括印刷
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                        {/* 層2: 案件行 */}
                        {custOpen&&cust.groups.map(g=>{
                          const key=`${g.customerId}||${g.projectName}||${g.month}`;
                          const d=getInvData(key,g.month);
                          const locked=d.status==="locked";
                          // 締め済みならsnapshotの明細・金額を使う（案件名変更や再計算からの保護）
                          const useSnapshot = locked && d.snapshot && d.snapshot.items;
                          const displayItems = useSnapshot ? d.snapshot.items : g.items;
                          const displayProjectName = useSnapshot ? (d.snapshot.projectName ?? g.projectName) : g.projectName;
                          const gInc = useSnapshot
                            ? (d.snapshot.incidents||[])
                            : (incidents||[]).filter(x=>!x.separate_invoice&&x.customer_id===g.customerId&&x.invoice_month===g.month&&(g.projectName===""||( x.related_project_name||"")===(g.projectName||"")));
                          const incTot = useSnapshot
                            ? gInc.reduce((s,x)=>s+(x.charge_amount||0),0)
                            : gInc.filter(x=>x.status!=="paid").reduce((s,x)=>s+(x.charge_amount||0),0);
                          const baseTot=displayItems.reduce((s,r)=>s+(r.amount||0)+(r.insuranceAmount||0),0)+incTot;
                          const autoAdjTot = useSnapshot ? 0 : (g._autoAdjustments||[]).reduce((s,a)=>s+(Number(a.amount)||0),0);
                          const adjSum = useSnapshot ? (d.snapshot.adjustments||[]).reduce((s,a)=>s+(Number(a.amount)||0),0) : d.adjustments.reduce((s,a)=>s+(Number(a.amount)||0),0);
                          const grandTot=baseTot+autoAdjTot+adjSum;
                          const tax=Math.round(grandTot*0.1);
                          const isOpen=!!expanded[key];
                          const checkIssues = g.items.filter(r => {
                            if (!r.lines || !r.lines.length) return false;
                            const expected = calcExpectedAmount(r, records);
                            if (expected === null) return false;
                            return Math.abs(expected - (r.amount||0)) > 10;
                          });
                          return(
                            <React.Fragment key={key}>
                              <tr onClick={()=>toggleExpand(key)} style={{
                                borderBottom:isOpen?"none":"1px solid #f1f5f9",
                                background:locked?"#f0fdf4":"#f8fafc",
                                cursor:"pointer",transition:"background .15s"
                              }}
                                onMouseEnter={e=>e.currentTarget.style.background=locked?"#dcfce7":"#e8f4ff"}
                                onMouseLeave={e=>e.currentTarget.style.background=locked?"#f0fdf4":"#f8fafc"}
                              >
                                <td style={{padding:"8px 12px",textAlign:"center",color:"#94a3b8",fontSize:11,paddingLeft:28}}>{isOpen?"▼":"▶"}</td>
                                <td style={{padding:"8px 12px",paddingLeft:28,color:"#64748b",fontSize:11}}>
                                  {displayProjectName
                                    ?<span style={{background:"#eff6ff",color:"#1d4ed8",borderRadius:4,padding:"1px 6px",fontSize:11,fontWeight:600}}>{displayProjectName}</span>
                                    :<span style={{color:"#cbd5e1"}}>案件名なし</span>
                                  }
                                  {useSnapshot&&<span style={{marginLeft:6,fontSize:10,color:"#15803d",background:"#dcfce7",borderRadius:3,padding:"1px 5px"}}>凍結</span>}
                                  {d.adjustments.length>0&&<span style={{marginLeft:6,fontSize:10,color:"#92400e"}}>調整あり</span>}
                                  {checkIssues.length > 0 && (
                                    <span style={{marginLeft:6,fontSize:10,background:"#fef2f2",color:"#dc2626",border:"1px solid #fca5a5",borderRadius:3,padding:"1px 5px",fontWeight:700}}>⚠️ {checkIssues.length}件要確認</span>
                                  )}
                                </td>
                                <td></td>
                                <td style={{padding:"8px 12px",textAlign:"center",color:"#64748b"}}>{displayItems.length}</td>
                                <td style={{padding:"8px 12px",textAlign:"right",fontWeight:700,color:"#16a34a"}}>{fmt(grandTot)}</td>
                                <td style={{padding:"8px 12px",textAlign:"right",color:"#9333ea"}}>{fmt(grandTot+tax)}</td>
                                <td style={{padding:"8px 12px",textAlign:"center"}} onClick={e=>toggleLock(key,e)}>
                                  <span style={{
                                    background:locked?"#dcfce7":"#f1f5f9",
                                    color:locked?"#15803d":"#64748b",
                                    border:`1px solid ${locked?"#86efac":"#e2e8f0"}`,
                                    borderRadius:5,padding:"2px 8px",fontSize:10,fontWeight:700,
                                    cursor:"pointer",whiteSpace:"nowrap"
                                  }}>{locked?"✅ 締め済み":"未締め"}</span>
                                {(()=>{const ri=displayItems.find(r=>r.issueReceipt&&r.receiptDate);if(!ri)return null;const rd=new Date(ri.receiptDate+"T00:00:00");return <span style={{display:"block",fontSize:10,color:"#0369a1",fontWeight:700,marginTop:2,whiteSpace:"nowrap"}}>{(rd.getMonth()+1)}月{rd.getDate()}日 領収済　{ri.paymentMethod==="cash"?"現金":ri.paymentMethod==="square"?"スクエア クレジット":"ECクレジット"}</span>;})()}
                                {(()=>{
                                  const pc=getInvData(key)?.printCount||0;
                                  const pi=getInvData(key)?.lastPrintDate||"";
                                  if(!pc||!pi) return null;
                                  const d=new Date(pi);
                                  const ds=`${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
                                  return <span style={{fontSize:9,color:"#16a34a",marginLeft:4,whiteSpace:"nowrap"}}>{ds} {pc}回目発行済</span>;
                                })()}
                              </td>
                                <td style={{padding:"8px 8px",whiteSpace:"nowrap"}} onClick={e=>e.stopPropagation()}>
                                  <button onClick={async()=>{
                                    const cur=getInvData(key);
                                    const invNo=cur.invNo||(g.month?`${g.month}-???`:"");
                                    const printG = useSnapshot ? {...g, items:displayItems, projectName:displayProjectName, adjustments:cur.snapshot?.adjustments||cur.adjustments} : {...g, adjustments:cur.adjustments};
                                    downloadPrintHTML("invoice",{...printG,invNo,issueDate:cur.issueDate||""},products,0,incidents,records);
                                  }} style={{...S.ib("#94a3b8"),fontSize:10,padding:"2px 6px",marginRight:3}}>
                                    <Ico d={I.print} size={10}/>確認
                                  </button>
                                  <button onClick={async()=>{
                                    const cur=getInvData(key);
                                    let baseNo=cur.invNo;
                                    let count;
                                    if(!baseNo){
                                      baseNo=await nextInvoiceNo(g.month);
                                      count=1;
                                    } else {
                                      count=(cur.printCount||1)+1;
                                    }
                                    await updateInvData(key,{invNo:baseNo,printCount:count,lastPrintDate:new Date().toISOString()});
                                    const invNo=count<=1?baseNo:`${baseNo}-${count}`;
                                    const printG = useSnapshot ? {...g, items:displayItems, projectName:displayProjectName, adjustments:cur.snapshot?.adjustments||cur.adjustments} : {...g, adjustments:cur.adjustments};
                                    downloadPrintHTML("invoice",{...printG,invNo,issueDate:cur.issueDate||""},products,0,incidents,records);
                                  }} style={{...S.ib("#1d4ed8"),fontSize:10,padding:"2px 6px"}}>
                                    🖨
                                  </button>
                                </td>
                              </tr>
                              {/* 層3: 詳細行 */}
                              {isOpen&&(
                                <tr>
                                  <td colSpan={8} style={{padding:0,borderBottom:"1px solid #e2e8f0"}}>
                                    <div style={{background:"#f8fafc",padding:"12px 16px 12px 48px"}}>
                                      {/* 発行日 */}
                                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                                        <span style={{fontSize:11,color:"#64748b",whiteSpace:"nowrap"}}>発行日：</span>
                                        <input type="date" value={d.issueDate||""} onChange={e=>updateInvData(key,{issueDate:e.target.value})}
                                          style={{...S.inp,width:140,fontSize:11,padding:"3px 8px"}} disabled={locked}/>
                                        <span style={{fontSize:10,color:"#94a3b8"}}>（デフォルト: 月末日）</span>
                                      </div>
                                      {/* 案件リスト */}
                                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,marginBottom:8}}>
                                        <thead>
                                          <tr style={{color:"#94a3b8",borderBottom:"1px solid #e2e8f0"}}>
                                            <th style={{padding:"3px 8px",textAlign:"left",fontWeight:600,width:90}}>伝票No.</th>
                                            <th style={{padding:"3px 8px",textAlign:"left",fontWeight:600}}>機材</th>
                                            <th style={{padding:"3px 8px",textAlign:"left",fontWeight:600}}>利用期間</th>
                                            <th style={{padding:"3px 8px",textAlign:"center",fontWeight:600,width:50}}>日数</th>
                                            <th style={{padding:"3px 8px",textAlign:"right",fontWeight:600,width:80}}>金額（税抜）</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {(()=>{const _bNo=dn=>(dn||"").replace(/E\d+.*$/,"");const chainEndMap={};displayItems.forEach(r=>{const bk=_bNo(r.deliveryNo);if(!bk)return;const re=r.returnDate||r.endDate||"";if(!chainEndMap[bk]||re>chainEndMap[bk])chainEndMap[bk]=re;});const gKey=r=>{const bk=_bNo(r.deliveryNo);return(bk&&chainEndMap[bk])||(r.returnDate||r.endDate||"");};const sorted=[...displayItems].sort((a,b)=>{const aM=a.billingType==="monthly"?0:1;const bM=b.billingType==="monthly"?0:1;if(aM!==bM)return aM-bM;const kc=gKey(a).localeCompare(gKey(b));if(kc!==0)return kc;return(a.isExtension?1:0)-(b.isExtension?1:0);});const lastMIdx=sorted.reduce((acc,r,i)=>r.billingType==="monthly"?i:acc,-1);const hasBoth=lastMIdx>=0&&sorted.some(r=>r.billingType!=="monthly");return buildChainBlocks(sorted).map((block, bi) => {
                                            if (block.type === "chain") {
                                              const { header: h, segments } = block;
                                              return (
                                                <React.Fragment key={"chain-"+bi}>
                                                  <tr style={{borderBottom:"1px solid #e2e8f0",background:"#f0f7ff"}}>
                                                    <td style={{padding:"4px 8px",color:"#94a3b8",fontSize:10,whiteSpace:"nowrap"}}>{(segments[0].deliveryNo||"").replace(/E\d+.*$/,"")}</td>
                                                    <td style={{padding:"4px 8px",color:"#1e40af",fontWeight:600}}>{h.equipNames.join("、")}</td>
                                                    <td style={{padding:"4px 8px",color:"#64748b",whiteSpace:"nowrap"}}>
                                                      {fmtD(h.chainStart)}〜{fmtD(h.chainEnd)}<span style={{color:"#94a3b8",fontSize:10,marginLeft:4}}>（暦{h.chainCalDays}日 → 請求{h.chainBillDays}日）</span>
                                                    </td>
                                                    <td style={{padding:"4px 8px",textAlign:"center",color:"#94a3b8",fontSize:10}}>―</td>
                                                    <td style={{padding:"4px 8px",textAlign:"right",fontWeight:600,color:"#16a34a"}}>{fmt(h.chainAmount)}</td>
                                                  </tr>
                                                  {segments.map(r => (
                                                    <tr key={r.id} style={{borderBottom:"1px solid #f1f5f9"}}>
                                                      <td style={{padding:"4px 8px",color:"#94a3b8",fontSize:10,whiteSpace:"nowrap"}}>{r.deliveryNo||"―"}</td>
                                                      <td style={{padding:"2px 8px 2px 20px",color:"#475569"}}>
                                                        <span style={{color:"#94a3b8",marginRight:4,fontSize:10}}>└</span>
                                                        <span style={{color:r.isExtension?"#2563eb":"#475569"}}>{r.isExtension?"延長分":"初回分"}</span>
                                                        {r.projectDetail&&<span style={{color:"#94a3b8",marginLeft:4}}>({r.projectDetail})</span>}
                                                        {r.ecOrderNo&&<span style={{color:"#0369a1",marginLeft:4,fontSize:10}}>EC:{r.ecOrderNo}</span>}
                                                      </td>
                                                      <td style={{padding:"2px 8px 2px 16px",color:"#64748b",whiteSpace:"nowrap"}}>
                                                        {fmtD(r.startDate)}〜{fmtD(r.endDate)}<span style={{color:"#94a3b8",fontSize:10,marginLeft:4}}>（{r.days||0}日）</span>
                                                      </td>
                                                      <td style={{padding:"4px 8px",textAlign:"center",color:"#64748b",fontSize:10}}>{r.days||0}</td>
                                                      <td style={{padding:"4px 8px",textAlign:"right",color:"#64748b"}}>{fmt((r.amount||0)+(r.insuranceAmount||0))}</td>
                                                    </tr>
                                                  ))}
                                                </React.Fragment>
                                              );
                                            }
                                            const r = block.record;
                                            const idx = sorted.indexOf(r);
                                            return (
                                              <React.Fragment key={r.id}>
                                                <tr style={{borderBottom:"1px solid #f1f5f9"}}>
                                                  <td style={{padding:"4px 8px",color:"#94a3b8",fontSize:10,whiteSpace:"nowrap"}}>{r.deliveryNo||"―"}</td>
                                                  <td style={{padding:"4px 8px",color:"#475569"}}>
                                                    {r.isExtension
                                                      ?<span style={{color:"#2563eb"}}>
                                                          {r.equipmentName||(r.lines||[]).map(l=>l.equipmentName).filter(Boolean).join("、")||""}
                                                          {<span style={{fontSize:10,marginLeft:2}}>（延長分）</span>}
                                                          {r.extendedFromNo&&<span style={{fontSize:10,color:"#94a3b8",marginLeft:4}}>（元No.{r.extendedFromNo}）</span>}
                                                        </span>
                                                      :r.equipmentName}
                                                    {r.projectDetail&&<span style={{color:"#94a3b8",marginLeft:4}}>({r.projectDetail})</span>}
                                                    {r.ecOrderNo&&<span style={{color:"#0369a1",marginLeft:4,fontSize:10}}>EC:{r.ecOrderNo}</span>}
                                                  </td>
                                                  <td style={{padding:"4px 8px",color:"#64748b",whiteSpace:"nowrap"}}>{fmtD(r.startDate)}〜{fmtD(r.endDate)}</td>
                                                  <td style={{padding:"4px 8px",textAlign:"center",color:"#64748b"}}>
                                                    {r.billingType==="monthly"?(r.months||1)+"ヶ月":(r.days||0)}
                                                  </td>
                                                  <td style={{padding:"4px 8px",textAlign:"right",fontWeight:600,color:"#16a34a"}}>{fmt((r.amount||0)+(r.insuranceAmount||0))}</td>
                                                </tr>
                                                {hasBoth&&idx===lastMIdx&&<tr key="spacer"><td colSpan={5} style={{padding:"6px 0",borderBottom:"2px solid #e2e8f0",background:"#f8fafc"}}></td></tr>}
                                              </React.Fragment>
                                            );
                                          });})()}
                                        </tbody>
                                      </table>
                                      {/* 修理/紛失行 */}
                                      {gInc.length>0&&(
                                        <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:6,padding:"8px 12px",marginBottom:8}}>
                                          <div style={{fontSize:11,fontWeight:700,color:"#dc2626",marginBottom:6}}>修理/紛失</div>
                                          {gInc.map(inc=>(
                                            <div key={inc.id} style={{display:"flex",gap:8,marginBottom:4,alignItems:"center",fontSize:11}}>
                                              <span style={{background:inc.type==="loss"?"#fef2f2":"#fffbeb",color:inc.type==="loss"?"#dc2626":"#d97706",padding:"1px 6px",borderRadius:4,fontWeight:600,minWidth:60,textAlign:"center"}}>{inc.type==="loss"?"紛失":"修理/破損"}</span>
                                              <span style={{flex:1,color:"#374151"}}>{inc.item_name}</span>
                                              <span style={{fontWeight:600,color:"#16a34a"}}>{fmt(inc.charge_amount)}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      {/* 調整行 */}
                                      <div style={{background:"#fefce8",border:"1px solid #fde68a",borderRadius:6,padding:"8px 12px"}}>
                                        <div style={{fontSize:11,fontWeight:700,color:"#92400e",marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                                          <span>調整行</span>
                                          {!locked&&<button onClick={()=>addAdj(key)} style={{...S.ib("#92400e"),fontSize:10,padding:"2px 8px"}}>
                                            <Ico d={I.plus} size={11}/>追加
                                          </button>}
                                        </div>
                                        {d.adjustments.length===0&&(g._autoAdjustments||[]).length===0&&<div style={{fontSize:11,color:"#94a3b8"}}>調整行なし</div>}
                                        {(g._autoAdjustments||[]).map(a=>(
                                          <div key={a.id} style={{display:"flex",gap:6,marginBottom:4,alignItems:"center"}}>
                                            <span style={{flex:1,fontSize:11,padding:"4px 8px",color:"#64748b",background:"#f1f5f9",borderRadius:4}}>🔒 {a.label}</span>
                                            <span style={{width:110,fontSize:11,padding:"4px 8px",textAlign:"right",color:Number(a.amount)<0?"#dc2626":"#16a34a",fontWeight:600}}>{fmt(Number(a.amount)||0)}</span>
                                            <span style={{width:64}}/>
                                          </div>
                                        ))}
                                        {d.adjustments.map(a=>(
                                          <div key={a.id} style={{display:"flex",gap:6,marginBottom:4,alignItems:"center"}}>
                                            <input value={a.label} onChange={e=>updateAdj(key,a.id,{label:e.target.value})}
                                              placeholder="内容（例: 値引き）" style={{...S.inp,flex:1,fontSize:11,padding:"4px 8px"}} disabled={locked}/>
                                            <AdjAmountInput
                                              value={a.amount}
                                              onChange={num=>updateAdj(key,a.id,{amount:num})}
                                              disabled={locked}
                                              style={{...S.inp,width:110,fontSize:11,padding:"4px 8px",textAlign:"right"}}
                                            />
                                            <span style={{fontSize:11,color:"#374151",minWidth:64,textAlign:"right"}}>{fmt(Number(a.amount)||0)}</span>
                                            {!locked&&<button onClick={()=>removeAdj(key,a.id)} style={{background:"none",border:"none",cursor:"pointer"}}><Ico d={I.x} size={12} color="#ef4444"/></button>}
                                          </div>
                                        ))}
                                      </div>
                                      {/* 合計 */}
                                      <div style={{display:"flex",justifyContent:"flex-end",gap:16,fontSize:12,marginTop:8,paddingTop:8,borderTop:"1px solid #e2e8f0"}}>
                                        <span><span style={{color:"#64748b"}}>機材: </span>{fmt(baseTot)}</span>
                                        {adjSum!==0&&<span style={{color:adjSum<0?"#dc2626":"#16a34a"}}><span style={{color:"#64748b"}}>調整: </span>{fmt(adjSum)}</span>}
                                        <span><span style={{color:"#64748b"}}>税抜: </span><strong>{fmt(grandTot)}</strong></span>
                                        <span><span style={{color:"#64748b"}}>消費税: </span>{fmt(tax)}</span>
                                        <strong style={{color:"#9333ea"}}>税込: {fmt(grandTot+tax)}</strong>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </React.Fragment>
                    );
                  });
                })()}
              </tbody>
            </table>
          }
        </div>
      </div>

      {lockModal&&lockModal.mode==="confirm"&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#fff",borderRadius:12,padding:"28px 32px",minWidth:320,boxShadow:"0 8px 32px rgba(0,0,0,0.2)"}}>
            <div style={{fontSize:15,fontWeight:700,marginBottom:12,color:"#1e293b"}}>🔒 締め済みにしますか？</div>
            <div style={{fontSize:13,color:"#374151",marginBottom:20}}>解除にはパスワードが必要になります。</div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={doLockConfirm} style={{flex:1,background:"#0f172a",color:"#fff",border:"none",borderRadius:7,padding:"9px 0",fontSize:13,fontWeight:700,cursor:"pointer"}}>締め済みにする</button>
              <button onClick={()=>setLockModal(null)} style={{flex:1,background:"#f1f5f9",color:"#374151",border:"none",borderRadius:7,padding:"9px 0",fontSize:13,cursor:"pointer"}}>キャンセル</button>
            </div>
          </div>
        </div>
      )}
      {lockModal&&lockModal.mode==="unlock"&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#fff",borderRadius:12,padding:24,width:320,boxShadow:"0 8px 32px rgba(0,0,0,0.25)"}}>
            <div style={{fontSize:15,fontWeight:700,marginBottom:8}}>🔓 締めを解除しますか？</div>
            <div style={{fontSize:12,color:"#64748b",marginBottom:16}}>解除するにはパスワードを入力してください。</div>
            <PwInput onOk={doUnlock} onCancel={()=>setLockModal(null)}/>
          </div>
        </div>
      )}
      {changePwModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#fff",borderRadius:12,padding:24,width:320,boxShadow:"0 8px 32px rgba(0,0,0,0.25)"}}>
            <div style={{fontSize:15,fontWeight:700,marginBottom:8}}>🔑 パスワードの変更</div>
            <div style={{fontSize:12,color:"#64748b",marginBottom:16}}>現在のパスワードを入力してください。</div>
            <PwInput onOk={doChangePw} onCancel={()=>setChangePwModal(false)}/>
          </div>
        </div>
      )}
      {printCountResetModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#fff",borderRadius:12,padding:"28px 32px",minWidth:320,boxShadow:"0 8px 32px rgba(0,0,0,0.2)"}}>
            <div style={{fontSize:15,fontWeight:700,marginBottom:12,color:"#991b1b"}}>⚠️ 発行履歴をリセット</div>
            <div style={{fontSize:13,color:"#374151",marginBottom:20}}>領収済以外の請求書発行履歴（printCount）をリセットします。</div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={doPrintCountReset} style={{flex:1,background:"#dc2626",color:"#fff",border:"none",borderRadius:7,padding:"9px 0",fontSize:13,fontWeight:700,cursor:"pointer"}}>リセットする</button>
              <button onClick={()=>setPrintCountResetModal(false)} style={{flex:1,background:"#f1f5f9",color:"#374151",border:"none",borderRadius:7,padding:"9px 0",fontSize:13,cursor:"pointer"}}>キャンセル</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
