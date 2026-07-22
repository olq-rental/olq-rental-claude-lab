import { calcDays } from './constants';
import { calcBillingDays, chainBillingDays, chainBillingDetail, buildChainBlocks } from './billing';

export function genReceiptNo(r, idx) {
  const d = r.receiptDate ? new Date(r.receiptDate) : (r.startDate ? new Date(r.startDate) : new Date());
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  const seq = String(idx+1).padStart(2,"0");
  return `${yy}${mm}${dd}${seq}`;
}

export function makeExtFlatItems(lines) {
  const items = [];
  lines.forEach((ln, li) => {
    if (!ln.subItems || ln.subItems.length === 0) {
      items.push({ key: String(li), lineIdx: li, subIdx: null, equipmentName: ln.equipmentName, equipNo: ln.equipNo, quantity: ln.quantity, unitPrice: ln.unitPrice });
    } else {
      ln.subItems.forEach((si, si_i) => {
        items.push({ key: `${li}-${si_i}`, lineIdx: li, subIdx: si_i, equipmentName: ln.equipmentName, equipNo: si.equipNo || ln.equipNo, quantity: si.quantity || 1, unitPrice: ln.unitPrice });
      });
    }
  });
  return items;
}
export function buildExtLines(lines, flatItems, selected) {
  const selItems = flatItems.filter(item => selected[item.key]);
  const lineMap = {};
  selItems.forEach(item => {
    if (!lineMap[item.lineIdx]) lineMap[item.lineIdx] = { ...lines[item.lineIdx], subItems: item.subIdx !== null ? [] : (lines[item.lineIdx].subItems || []) };
    if (item.subIdx !== null) {
      lineMap[item.lineIdx].subItems.push(lines[item.lineIdx].subItems[item.subIdx]);
      lineMap[item.lineIdx].quantity = lineMap[item.lineIdx].subItems.length;
    }
  });
  return Object.values(lineMap);
}

export function genDeliveryNo(r, idx) {
  if(r.deliveryNo) return r.deliveryNo;
  const d = r.createdAt ? new Date(r.createdAt) : (r.startDate ? new Date(r.startDate) : new Date());
  const yy = String(d.getFullYear()).slice(-2);
  const mons = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  const mon = mons[d.getMonth()];
  const dd = String(d.getDate()).padStart(2,"0");
  const seq = String(idx+1).padStart(2,"0");
  return `${yy}${mon}${dd}${seq}`;
}

export function downloadPrintHTML(type, g, products, extraDiscount, incidents, allRecords, _returnBodyOnly) {
  if (!g || !g.items || !g.items.length) return;
  const title = type==="invoice" ? `ご請求書_${g.customerName}御中${g.projectName?"_"+g.projectName:""}_${g.month||""}` : type==="delivery-receipt" ? `納品書・領収証_${g.customerName}_${g.month||""}` : `納品書_${g.customerName}_${g.month||""}`;
  const css = `@page{margin:0mm;size:A4}*{box-sizing:border-box;margin:0;padding:0}tr{page-break-inside:avoid}
body{font-family:'Noto Sans JP','Hiragino Sans','Yu Gothic','Meiryo',sans-serif;color:#111;-webkit-print-color-adjust:exact;print-color-adjust:exact;padding:0;margin:0}
table{border-collapse:separate;border-spacing:0;width:100%;border-top:1px solid #aaa;border-left:1px solid #aaa}td,th{border-right:1px solid #aaa;border-bottom:1px solid #aaa;padding:3px 5px;font-size:10px}
th{background:#f3f3f3;font-weight:bold;text-align:center}.r{text-align:right}.c{text-align:center}
.pb{page-break-after:always;width:794px;box-sizing:border-box;position:relative}.pb-last{width:794px;box-sizing:border-box;position:relative}.title{text-align:center;font-size:22px;font-weight:bold;letter-spacing:6px;margin-bottom:4px}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;margin:14px 0 10px}.cust-name{font-size:16px;font-weight:bold;border-bottom:2px solid #111;padding-bottom:3px;display:inline-block}
.olq{text-align:right;font-size:10px;line-height:1.8}.amount{font-size:20px;font-weight:bold;color:#c00}
.note{font-size:9px;color:#666;line-height:1.7;margin-top:12px}.sign-box{border:2px solid #333;border-radius:4px;padding:8px 14px;min-width:140px;min-height:70px;display:inline-block;margin-right:14px}
.sign-label{font-weight:bold;font-size:9px;margin-bottom:2px}.sign-date{color:#bbb;font-size:10px}.sub-row td{font-size:10px;color:#555;padding:4px 6px}
.empty td{height:18px}.biko{font-weight:bold;letter-spacing:6px;vertical-align:top;width:50px}`;

  let body = "";
  const fd = d => d ? new Date(d).toLocaleDateString("ja-JP") : "―";
  const fm = n => `¥${Number(n||0).toLocaleString()}`;
  const fn = n => Number(n||0).toLocaleString();
  const gIncidentsPdf=(incidents||[]).filter(x=>!x.separate_invoice&&x.status!=="paid"&&x.customer_id===g.customerId&&x.invoice_month===g.month&&(g.projectName===""||( x.related_project_name||"")===(g.projectName||"")));
  const incidentTotPdf=gIncidentsPdf.reduce((s,x)=>s+(x.charge_amount||0),0);
  const equipTotG = g.items.reduce((s,r) => s+(r.amount||0), 0);
  const insurTotG = g.items.reduce((s,r) => s+(r.insuranceAmount||0), 0);
  const tot = equipTotG + insurTotG + incidentTotPdf;
  const tax = Math.round(tot * 0.1);

  if (type === "invoice") {
    // 請求書HTML — Excel雛形準拠レイアウト
    const adjustments = g.adjustments || [];
    const adjSum = adjustments.reduce((s,a)=>s+(Number(a.amount)||0),0);
    const totIns = g.items.reduce((s,r)=>s+(r.insuranceAmount||0),0);
    const showDiscountLine = !!g.customer?.showDiscountLine;
    const extraDiscountAmt = Number(extraDiscount)||0;
    const listTot = showDiscountLine ? g.items.reduce((s,r)=>{
      if(r.billingType==="monthly") return s+(r.amount||0);
      const rLines=(r.lines&&r.lines.length)?r.lines:[{productId:r.productId,unitPrice:r.unitPrice,quantity:r.quantity}];
      const hasPerLineDate=rLines.some(ln=>ln.returnDate&&ln.returnDate!==r.endDate);
      return s+rLines.reduce((s2,ln)=>{
        const prod=(products||[]).find(p=>p.id===ln.productId);
        const lp=prod?prod.priceEx:(ln.unitPrice||0);
        const noDisc=ln.noBillingDiscount||prod?.noBillingDiscount;
        const days=hasPerLineDate?(()=>{const d=calcDays(r.startDate,ln.returnDate||r.endDate);return noDisc?d:calcBillingDays(d);})():(noDisc?(r.days||1):(r.billingDays||r.days||1));
        return s2+Math.round(lp*(ln.quantity||1)*days);
      },0);
    },0) : tot;
    const totalDiscount = showDiscountLine ? (listTot - (equipTotG + insurTotG) + extraDiscountAmt) : 0;
    const grandTot = showDiscountLine ? (tot + adjSum - extraDiscountAmt) : (tot + adjSum);
    const taxAmt = Math.round(grandTot * 0.1);
    // 管理No：先頭案件のcreatedAtから生成
    const firstRec = g.items[0];
    const invNo = g.invNo || (g.month ? `${g.month}-???` : genDeliveryNo(firstRec,0));
    const monthStr = g.month || "";
    const rawDate = g.issueDate||(()=>{
      const [y,m] = (monthStr).split("-").map(Number);
      if(y&&m){ const ld=new Date(y,m,0); return `${y}-${String(m).padStart(2,"0")}-${String(ld.getDate()).padStart(2,"0")}`; }
      return "";
    })();
    const issueDateStr = rawDate ? (()=>{const d=new Date(rawDate+"T00:00:00"); return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;})() : "";
    // 担当者
    const staff = g.customer?.staff || "井上 雄太";
    // 顧客住所


    const invCustomerName = g.customer?.invoiceName || g.customerName || "";
    const PAGE_WEIGHT_REST = 57;
    const ORDERER_2LINE_MIN_W = 12;
    const allInvRows = [];
    const strWidth = str => [...(str||"")].reduce((w,c) => w+(c.match(/[^\x01-\x7E]/)?2:1),0);
    const invHeaderHtml = `<div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:stretch;gap:4px 0;margin-bottom:8px">
        <!-- 左: 顧客名・住所 -->
        <div style="padding-bottom:6px">
          <div style="font-size:14px;font-weight:bold;margin-bottom:6px">${g.customer?.invoiceName || g.customerName}　御中</div>
          ${g.projectName?`<div style="font-size:12px;font-weight:bold;margin-bottom:4px">${g.projectName}</div>`:""}
          ${g.customer?.zipCode?`<div style="margin-bottom:1px">〒${g.customer.zipCode}</div>`:""}
          ${(g.customer?.address||"").split("\n").map(l=>`<div style="margin-bottom:1px">${l}</div>`).join("")}
          ${g.customer?.contact?`<div style="margin-bottom:1px">${g.customer.contact}　様</div>`:""}
        </div>
        <!-- 中央: タイトル -->
        <div style="text-align:center;font-size:14px;font-weight:bold;padding:0 24px">ご請求書</div>
        <!-- 右: 管理No〜MAIL -->
        <div style="font-size:10px;line-height:1.9;white-space:nowrap;text-align:right;grid-row:1/3;display:flex;flex-direction:column;justify-content:space-between">
          <div>
            <div>管理No　<strong>${invNo}</strong></div>
            <div>日付　${issueDateStr}</div>
            ${(()=>{const ri=g.items.find(r=>r.issueReceipt&&r.receiptDate);if(!ri)return "";const rd=new Date(ri.receiptDate+"T00:00:00");const pm=ri.paymentMethod==="cash"?"現金":ri.paymentMethod==="square"?"スクエア クレジット":"ECクレジット";return `<div style="color:#0369a1;font-weight:bold">${rd.getMonth()+1}月${rd.getDate()}日 領収済　${pm}</div>`;})()}
            <div style="margin-bottom:8px">登録番号 T5-0104-0109-2630</div>
            <div style="font-weight:bold;font-size:10px;margin-bottom:2px">オルク株式会社</div>
            <div style="position:relative">
              <div>〒105-0004</div>
              <div>東京都港区新橋6-10-2</div>
              <div>第二新洋ビル 1F</div>
              <img src="data:image/png;base64,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" style="position:absolute;top:-4px;right:-4px;width:62px;height:62px;mix-blend-mode:multiply;background:#fff"/>
            </div>
          <div style="height:1em"></div>
          <div>担当：${staff}</div>
          <div>TEL：03-5777-1100</div>
          <div>MAIL：invoice@olq.co.jp</div>
        </div>
        </div>
        <!-- 左下: 挨拶文・ご請求金額 -->
        <div style="grid-column:1/3;grid-row:2;padding-top:0;display:flex;flex-direction:column;justify-content:flex-end;min-height:0">
          <div style="font-size:10px;margin-bottom:4px">毎度ありがとうございます。下記の通りご請求申し上げます。</div>
          <div style="display:flex;align-items:baseline;gap:14px">
            <span style="font-size:12px;font-weight:bold">ご請求金額</span>
            <span style="font-size:18px;font-weight:bold;border-bottom:2px solid #111;padding:0 8px">${fm(grandTot+taxAmt)}</span>
            <span style="font-size:10px">（税込）</span>
          </div>
        </div>
      </div>`;
    const invTableHeadHtml = `<table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:0"><thead><tr style="background:#f0f0f0"><th style="border:1px solid #aaa;padding:3px 5px;text-align:center;white-space:nowrap">ご利用日</th><th style="border:1px solid #aaa;padding:3px 5px;text-align:center;width:40px">日数</th><th style="border:1px solid #aaa;padding:3px 5px;text-align:center;width:70px">ご発注者</th><th style="border:1px solid #aaa;padding:3px 5px;text-align:center">製品名</th><th style="border:1px solid #aaa;padding:3px 5px;text-align:center;width:36px">台数</th><th style="border:1px solid #aaa;padding:3px 5px;text-align:center;width:72px">単価</th><th style="border:1px solid #aaa;padding:3px 5px;text-align:center;width:80px">金額</th></tr></thead>`;
    let _pdfEquipSum = 0;
    (()=>{const _bNo=dn=>(dn||"").replace(/E\d+.*$/,"");const chainEndMap={};g.items.forEach(r=>{const bk=_bNo(r.deliveryNo);if(!bk)return;const re=r.returnDate||r.endDate||"";if(!chainEndMap[bk]||re>chainEndMap[bk])chainEndMap[bk]=re;});const gKey=r=>{const bk=_bNo(r.deliveryNo);return(bk&&chainEndMap[bk])||(r.returnDate||r.endDate||"");};const _sorted=[...g.items].sort((a,b)=>{const aM=a.billingType==="monthly"?0:1;const bM=b.billingType==="monthly"?0:1;if(aM!==bM)return aM-bM;const kc=gKey(a).localeCompare(gKey(b));if(kc!==0)return kc;return(a.isExtension?1:0)-(b.isExtension?1:0);});const _lastMIdx=_sorted.reduce((acc,r,i)=>r.billingType==="monthly"?i:acc,-1);const _hasBoth=_lastMIdx>=0&&_sorted.some(r=>r.billingType!=="monthly");buildChainBlocks(_sorted).forEach((block, _bi) => {
  if (block.type === "chain") {
    const { header: h, segments } = block;
    const chainOrdener = segments[0].ordererName ? segments[0].ordererName+"　様" : "";
    // 製品（productId）ごとのlegマップを構築
    const legMap = {};
    const legOrder = [];
    segments.forEach(r => {
      const rLns=(r.lines&&r.lines.length)?r.lines:[{productId:r.productId,equipmentName:r.equipmentName,unitPrice:r.unitPrice,quantity:r.quantity,noBillingDiscount:r.noBillingDiscount}];
      rLns.forEach(ln => {
        const pid = ln.productId || ln.equipmentName || "";
        if (!legMap[pid]) { legMap[pid]=[]; legOrder.push(pid); }
        legMap[pid].push({record:r, line:ln});
      });
    });
    legOrder.forEach(pid => {
      const legs = legMap[pid];
      const firstLeg = legs[0];
      const baseLn = firstLeg.line;
      const _ceqName = baseLn.equipmentName || firstLeg.record.equipmentName || "";const _cProjInfo=g.projectName?(firstLeg.record.projectDetail||""):firstLeg.record.projectName?firstLeg.record.projectName+(firstLeg.record.projectDetail?`　${firstLeg.record.projectDetail}`:""):(firstLeg.record.projectDetail||"");const _chainHasAdj=legs.some(function(l){return (l.record.notes||"").indexOf("【日数調整】")>=0;});const _chainAdjReason=_chainHasAdj?(firstLeg.record.adjustReason||""):"";const _chainAdjReasonHtml=_chainAdjReason?`<div style="font-size:8px;color:#555;margin-top:1px">[${_chainAdjReason}]</div>`:"";const _ceqNameDisp=_ceqName+(_cProjInfo?`<span style="color:#555;font-size:10px">　[${_cProjInfo}]</span>`:"")+_chainAdjReasonHtml;
      const _cqty = baseLn.quantity || 1;
      const _cprod2 = showDiscountLine ? (products||[]).find(p=>p.id===baseLn.productId) : null;
      const _clistPrice2 = _cprod2 ? _cprod2.priceEx : (baseLn.unitPrice||0);
      const _cprice = fn(showDiscountLine ? _clistPrice2 : (baseLn.unitPrice||0));
      const _hasNoDisc = !!(baseLn.noBillingDiscount || (products||[]).find(p=>p.id===baseLn.productId)?.noBillingDiscount);
      // ガード(b): 台数・単価がlegで異なる場合はsingle扱い
      const allSame = legs.every(leg=>(leg.line.quantity||1)===_cqty&&(leg.line.unitPrice||0)===(baseLn.unitPrice||0));
      const hasMainRecord=legs.some(({record:r})=>!r.isExtension);
      if (legs.length===1 || !allSame || !hasMainRecord) {
        // single扱い
        legs.forEach(({record:r, line:ln}) => {
          const lineEndDate=ln.returnDate||r.endDate;
          const prod=showDiscountLine?(products||[]).find(p=>p.id===ln.productId):null;
          const listPrice=prod?prod.priceEx:(ln.unitPrice||0);
          const dispPrice=(showDiscountLine&&r.billingType!=="monthly")?listPrice:(ln.unitPrice||0);
          const noDisc=ln.noBillingDiscount||(products||[]).find(p=>p.id===ln.productId)?.noBillingDiscount;
          const _cbdA=(!noDisc&&r.billingType!=="monthly")?chainBillingDetail(r,allRecords||g.items,lineEndDate):null;
          const useDaysSgl=_cbdA?_cbdA.thisBilling:(r.billingType==="monthly"?(r.months||1):(noDisc?(r.days||1):(r.billingDays||r.days||1)));
          const lineAmt=r.billingType==="monthly"?(ln.amount||0):(showDiscountLine&&r.billingType!=="monthly")?Math.round(listPrice*(ln.quantity||1)*useDaysSgl):Math.round((ln.unitPrice||0)*(ln.quantity||1)*useDaysSgl);
          _pdfEquipSum+=lineAmt;
          const equipName=ln.equipmentName||r.equipmentName||"";
          const _csProjInfo=g.projectName?(r.projectDetail||""):r.projectName?r.projectName+(r.projectDetail?`　${r.projectDetail}`:""):(r.projectDetail||"");
          const _csNameExtra=_csProjInfo?`<span style="color:#555;font-size:10px">　[${_csProjInfo}]</span>`:"";
          const _dd=!_cbdA&&!noDisc&&r.billingType!=="monthly"&&(r.billingDays||0)>0&&(r.billingDays||0)<(r.days||0);
          const _ddDays=_cbdA?_cbdA.thisBilling:(_dd?r.billingDays:(r.days||0));
          const _hasAdj=(r.notes||"").indexOf("【日数調整】")>=0;
          const _adjReasonHtml=_hasAdj&&(r.adjustReason||"")?`<div style="font-size:8px;color:#555;margin-top:1px">[${r.adjustReason}]</div>`:"";
          const _chainSubA=_cbdA?`<div style="font-size:8px;color:#555;margin-top:1px">継続通算${_cbdA.cumActual}日間 → ${_cbdA.cumBilling}日間ご請求</div><div style="font-size:8px;color:#555">(${_cbdA.prevBilling}日間ご請求済 → 今回${_cbdA.thisBilling}日間)</div>`:"";
          const _ddSub=_cbdA?_chainSubA:(_dd?(_hasAdj?`<div style="font-size:8px;color:#555;margin-top:1px">日数調整</div>`:`<div style="font-size:8px;color:#555;margin-top:1px">合計${r.days}日間 → 日数値引</div>`):"");
          allInvRows.push({html:`<tr>
            <td style="border:1px solid #aaa;padding:2px 5px;text-align:center;white-space:nowrap;vertical-align:middle">${fd(r.startDate)}〜${fd(lineEndDate)}${r.ecOrderNo?`<div style="font-size:10px;margin-top:2px">${r.ecOrderNo}</div>`:""}${_ddSub}<div style="font-size:7px;color:#555">${r.isExtension?"└ご延長":"└ご注文"}</div></td>
            <td style="border:1px solid #aaa;padding:2px 5px;text-align:center;vertical-align:middle">${_ddDays}</td>
            <td style="border:1px solid #aaa;padding:2px 5px;text-align:center;font-size:10px;vertical-align:middle">${chainOrdener}</td>
            <td style="border:1px solid #aaa;padding:2px 5px;text-align:center;vertical-align:middle">${equipName}${_csNameExtra}${_adjReasonHtml}</td>
            <td style="border:1px solid #aaa;padding:2px 5px;text-align:center;vertical-align:middle">${ln.quantity||1}</td>
            <td style="border:1px solid #aaa;padding:2px 5px;text-align:right;vertical-align:middle">${fn(dispPrice)}</td>
            <td style="border:1px solid #aaa;padding:2px 5px;text-align:right;vertical-align:middle">${fn(lineAmt)}</td>
          </tr>`, weight:(()=>{const sw=strWidth(equipName+(_csProjInfo?`　[${_csProjInfo}]`:""));let base=sw>=150?4:sw>=100?3:sw>=50?2:1;if(strWidth(chainOrdener)>=ORDERER_2LINE_MIN_W)base=Math.max(base,2);if(_cbdA)base=Math.max(base,3);return base+1+(r.ecOrderNo?1:0)+(!_cbdA&&_dd?1:0);})()});
        });
      } else {
        // chainブロック（leg>=2かつ台数・単価一致）
        const _legRspan = legs.length + 1;
        // ガード(a): 金額・日数はlegの保存値を合算（calcBillingDaysで再計算しない）
        let _clineTotal=0, _legCalDays=0, _legBillDays=0;
        legs.forEach(({record:r, line:ln}) => {
          const prod3=showDiscountLine?(products||[]).find(p=>p.id===ln.productId):null;
          const lp=prod3?prod3.priceEx:(ln.unitPrice||0);
          const noDisc=ln.noBillingDiscount||(products||[]).find(p=>p.id===ln.productId)?.noBillingDiscount;
          const lineEnd=ln.returnDate||r.endDate;
          const cbd=noDisc?0:(chainBillingDays(r,allRecords||g.items,lineEnd)||calcBillingDays(r.days||0));
          const useDays=noDisc?(r.days||1):(cbd||r.days||1);
          _clineTotal+=showDiscountLine?Math.round(lp*(ln.quantity||1)*useDays):Math.round((ln.unitPrice||0)*(ln.quantity||1)*useDays);
          _legCalDays+=(r.days||0);
          _legBillDays+=noDisc?(r.days||0):cbd;
        });
        _pdfEquipSum+=_clineTotal;
        const _legStart=legs[0].record.startDate||"";
        const _legEnd=legs[legs.length-1].record.returnDate||legs[legs.length-1].record.endDate||"";
        const _noValueDisc=_hasNoDisc||_legBillDays>=_legCalDays;
        const _chainBillDisp=_noValueDisc?_legCalDays:_legBillDays;
        // チェーン通算注記: rootStartからの累計を算出
        const _cbNoB=no=>(no||"").replace(/E\d+.*$/,"");const _cbKey=_cbNoB(firstLeg.record.deliveryNo);let _cbRootStart=_legStart;if(_cbKey){(allRecords||g.items).forEach(x=>{if(_cbNoB(x.deliveryNo)===_cbKey&&x.startDate&&x.startDate<_cbRootStart)_cbRootStart=x.startDate;});}
        const _cbCumActual=calcDays(_cbRootStart,_legEnd);const _cbCumBilling=calcBillingDays(_cbCumActual);const _cbPrevBilling=Math.max(0,_cbCumBilling-_legBillDays);
        const _chainDateSub=_noValueDisc?``:(_chainHasAdj?`<div style="font-size:8px;color:#555;margin-top:1px">日数調整</div>`:`<div style="font-size:8px;color:#555;margin-top:1px">継続通算${_cbCumActual}日間 → ${_cbCumBilling}日間ご請求</div><div style="font-size:8px;color:#555">(${_cbPrevBilling}日間ご請求済 → 今回${_legBillDays}日間)</div>`);
        const _csegRows=legs.map(({record:r},si)=>{
          const _se=r.returnDate||r.endDate;
          const _sl=r.isExtension?"ご延長":"ご注文";
          const _isLast=si===legs.length-1;
          return `<tr><td style="border-left:1px solid #aaa;border-right:1px solid #aaa;border-top:none;${_isLast?"border-bottom:1px solid #aaa;":"border-bottom:none;"}padding:2px 5px;text-align:center;white-space:nowrap;vertical-align:middle;font-size:7px;color:#555">└${_sl}　${fd(r.startDate)}〜${fd(_se)}（${r.days||0}日間）</td></tr>`;
        }).join("");
        const _hasEc=!!(firstLeg.record.ecOrderNo);const _csw=strWidth(_ceqName);let _cbase=_csw>=150?4:_csw>=100?3:_csw>=50?2:1;if(strWidth(chainOrdener)>=ORDERER_2LINE_MIN_W)_cbase=Math.max(_cbase,2);if(!_noValueDisc&&!_chainHasAdj)_cbase=Math.max(_cbase,3);const _cweight=legs.length+_cbase+(_noValueDisc?0:(_chainHasAdj?1:0))+(_hasEc?1:0);
        allInvRows.push({html:`<tr>
          <td style="border:1px solid #aaa;border-bottom:none;padding:2px 5px;text-align:center;white-space:nowrap;vertical-align:middle">${fd(_legStart)}〜${fd(_legEnd)}${firstLeg.record.ecOrderNo?`<div style="font-size:10px;margin-top:2px">${firstLeg.record.ecOrderNo}</div>`:""}${_chainDateSub}</td>
          <td rowspan="${_legRspan}" style="border:1px solid #aaa;padding:2px 5px;text-align:center;vertical-align:middle">${_chainBillDisp}</td>
          <td rowspan="${_legRspan}" style="border:1px solid #aaa;padding:2px 5px;text-align:center;font-size:10px;vertical-align:middle">${chainOrdener}</td>
          <td rowspan="${_legRspan}" style="border:1px solid #aaa;padding:2px 5px;text-align:center;vertical-align:middle">${_ceqNameDisp}</td>
          <td rowspan="${_legRspan}" style="border:1px solid #aaa;padding:2px 5px;text-align:center;vertical-align:middle">${_cqty}</td>
          <td rowspan="${_legRspan}" style="border:1px solid #aaa;padding:2px 5px;text-align:right;vertical-align:middle">${_cprice}</td>
          <td rowspan="${_legRspan}" style="border:1px solid #aaa;padding:2px 5px;text-align:right;vertical-align:middle">${fn(_clineTotal)}</td>
        </tr>${_csegRows}`, weight:_cweight});
      }
    });
    segments.filter(r=>(r.insuranceAmount||0)>0).forEach(r=>{
      allInvRows.push({html:`<tr><td colspan="6" style="border:1px solid #aaa;padding:4px 6px;text-align:right">補償料</td><td style="border:1px solid #aaa;padding:4px 6px;text-align:right">${fn(r.insuranceAmount)}</td></tr>`, weight:1});
    });
  } else {
    const r = block.record;
    const _ri = _sorted.indexOf(r);
    const orderer = r.ordererName ? r.ordererName+"　様" : "";
    const rLines = (r.lines&&r.lines.length)?r.lines:[{equipmentName:r.equipmentName,quantity:r.quantity,unitPrice:r.unitPrice,amount:r.amount,lineNote:r.lineNote||""}];
    const hasPerLineDate=rLines.some(ln=>ln.returnDate&&ln.returnDate!==r.endDate);
    const hasNoBilling=rLines.some(ln=>ln.noBillingDiscount||(products||[]).find(p=>p.id===ln.productId)?.noBillingDiscount);
    const days = r.billingType==="monthly"?(r.months||1)+"ヶ月":(r.days||0);
    const lineCount = rLines.length;
    rLines.forEach((ln,li)=>{
      const lineEndDate=ln.returnDate||r.endDate;
      const prod = showDiscountLine ? (products||[]).find(p=>p.id===ln.productId) : null;
      const listPrice = prod ? prod.priceEx : (ln.unitPrice||0);
      const dispPrice=(showDiscountLine&&r.billingType!=="monthly")?listPrice:r.billingType==="monthly"?Math.round((ln.amount||0)/(ln.quantity||1)):(ln.unitPrice||r.unitPrice);
      const lnNoDisc=ln.noBillingDiscount||(products||[]).find(p=>p.id===ln.productId)?.noBillingDiscount;
      const _cbdC=(!ln.isFee&&!lnNoDisc&&r.billingType!=="monthly"&&!hasPerLineDate)?chainBillingDetail(r,allRecords||g.items,lineEndDate):null;
      const useDaysForLinePdf=_cbdC?_cbdC.thisBilling:(ln.isFee?1:r.billingType==="monthly"?(r.months||1):(hasPerLineDate?(()=>{const d=calcDays(r.startDate,lineEndDate);return lnNoDisc?d:calcBillingDays(d);})():(lnNoDisc?(r.days||1):(r.billingDays||r.days||1))));
      const lineDaysPdf=_cbdC?_cbdC.thisBilling:(ln.isFee?"手数料及び販売":r.billingType==="monthly"?(r.months||1)+"ヶ月":(hasPerLineDate?(()=>{const d=calcDays(r.startDate,lineEndDate);return lnNoDisc?d:calcBillingDays(d);})():(lnNoDisc?(r.days||0):(r.billingDays||r.days||0))));
      const lineAmt=r.billingType==="monthly"?(ln.amount||0):(showDiscountLine&&r.billingType!=="monthly")?Math.round(listPrice*(ln.quantity||1)*useDaysForLinePdf):Math.round((ln.unitPrice||0)*(ln.quantity||1)*useDaysForLinePdf);
      _pdfEquipSum+=lineAmt;
      const equipName = ln.equipmentName||r.equipmentName||"";
      const projInfo = g.projectName ? (r.projectDetail||"") : r.projectName
        ? r.projectName + (r.projectDetail ? `　${r.projectDetail}` : "")
        : (r.projectDetail || "");
      const nameExtra = projInfo ? `<span style="color:#555;font-size:10px">　[${projInfo}]</span>` : "";
      allInvRows.push({html:`<tr>
        ${ln.isFee
          ? `<td colspan="2" style="border:1px solid #aaa;padding:2px 5px;text-align:center;vertical-align:middle">手数料及び販売</td><td style="border:1px solid #aaa;padding:2px 5px;text-align:center;font-size:10px;vertical-align:middle">${orderer}</td>`
          : hasPerLineDate
            ? `<td style="border:1px solid #aaa;padding:2px 5px;text-align:center;white-space:nowrap;vertical-align:middle">${fd(r.startDate)}〜${fd(lineEndDate)}${r.billingType==="monthly"?'<div style="font-size:10px;margin-top:2px">[月極]</div>':""}</td><td style="border:1px solid #aaa;padding:2px 5px;text-align:center;vertical-align:middle">${lineDaysPdf}</td><td style="border:1px solid #aaa;padding:2px 5px;text-align:center;font-size:10px;vertical-align:middle">${orderer}</td>`
            : (()=>{const _dd=!_cbdC&&!lnNoDisc&&r.billingType!=="monthly"&&(r.billingDays||0)>0&&(r.billingDays||0)<(r.days||0);const _ddDays=_cbdC?_cbdC.thisBilling:(_dd?r.billingDays:days);const _hasAdj3=(r.notes||"").indexOf("【日数調整】")>=0;const _chainSubC=_cbdC?`<div style="font-size:8px;color:#555;margin-top:1px">継続通算${_cbdC.cumActual}日間 → ${_cbdC.cumBilling}日間ご請求</div><div style="font-size:8px;color:#555">(${_cbdC.prevBilling}日間ご請求済 → 今回${_cbdC.thisBilling}日間)</div>`:"";const _ddSub=_cbdC?_chainSubC:(_dd?(_hasAdj3?`<div style="font-size:8px;color:#555;margin-top:1px">日数調整</div>`:`<div style="font-size:8px;color:#555;margin-top:1px">合計${r.days}日間 → 日数値引</div>`):"");return `<td style="border:1px solid #aaa;padding:2px 5px;text-align:center;white-space:nowrap;vertical-align:middle">${fd(r.startDate)}〜${fd(r.endDate)}${r.billingType==="monthly"?'<div style="font-size:10px;margin-top:2px">[月極]</div>':""}${r.ecOrderNo?`<div style="font-size:10px;margin-top:2px">${r.ecOrderNo}</div>`:""}${_ddSub}</td><td style="border:1px solid #aaa;padding:2px 5px;text-align:center;vertical-align:middle">${_ddDays}</td><td style="border:1px solid #aaa;padding:2px 5px;text-align:center;font-size:10px;vertical-align:middle">${orderer}</td>`;})()}
        <td style="border:1px solid #aaa;padding:2px 5px;text-align:center">${equipName}${nameExtra}${(r.notes||"").indexOf("【日数調整】")>=0&&(r.adjustReason||"")?`<div style="font-size:8px;color:#555;margin-top:1px">[${r.adjustReason}]</div>`:""}</td>
        <td style="border:1px solid #aaa;padding:2px 5px;text-align:center">${ln.quantity||1}</td>
        <td style="border:1px solid #aaa;padding:2px 5px;text-align:right">${fn(dispPrice)}</td>
        <td style="border:1px solid #aaa;padding:2px 5px;text-align:right">${fn(lineAmt)}</td>
      </tr>`, weight: (()=>{const sw=strWidth(equipName+(projInfo?`　[${projInfo}]`:""));let base=sw>=150?4:sw>=100?3:sw>=50?2:1;if(strWidth(orderer)>=ORDERER_2LINE_MIN_W)base=Math.max(base,2);if(_cbdC)base=Math.max(base,3);const dd=!_cbdC&&!hasPerLineDate&&!lnNoDisc&&r.billingType!=="monthly"&&(r.billingDays||0)>0&&(r.billingDays||0)<(r.days||0);return((r.billingType==="monthly"||r.ecOrderNo)?Math.max(2,base):base)+(dd?1:0);})()});
    });
    if((r.insuranceAmount||0)>0){
      allInvRows.push({html:`<tr><td colspan="6" style="border:1px solid #aaa;padding:4px 6px;text-align:right">補償料</td><td style="border:1px solid #aaa;padding:4px 6px;text-align:right">${fn(r.insuranceAmount)}</td></tr>`, weight:1});
    }
    if(_hasBoth&&_ri===_lastMIdx){allInvRows.push({html:`<tr><td colspan="99" style="padding:6px 0;border:none;background:#f8fafc"></td></tr>`, weight:1});}
  }
});})();
    // アサーション: 明細金額合計 == 小計（不一致ならPDF生成を止める）
    const _expectedEquipTotal = showDiscountLine ? listTot : equipTotG;
    if (Math.abs(_pdfEquipSum - _expectedEquipTotal) > 1) {
      alert(`請求書PDF生成エラー: 明細金額合計(${_pdfEquipSum.toLocaleString()})と小計(${_expectedEquipTotal.toLocaleString()})が一致しません。\n請求書No: ${invNo}`);
      return;
    }
    gIncidentsPdf.forEach(inc=>{
      allInvRows.push({html:`<tr>
        <td colspan="2" style="border:1px solid #aaa;padding:2px 5px;text-align:center;vertical-align:middle">${inc.type==="loss"?"紛失":"修理/破損"}</td>
        <td style="border:1px solid #aaa;padding:2px 5px;text-align:center;font-size:10px;vertical-align:middle"></td>
        <td style="border:1px solid #aaa;padding:2px 5px;text-align:center">${inc.item_name}</td>
        <td style="border:1px solid #aaa;padding:2px 5px;text-align:center">${inc.quantity||1}</td>
        <td style="border:1px solid #aaa;padding:2px 5px;text-align:right">${fn(inc.unit_price||inc.charge_amount)}</td>
        <td style="border:1px solid #aaa;padding:2px 5px;text-align:right">${fn(inc.charge_amount)}</td>
      </tr>`, weight:1});
    });
    // 調整行
    adjustments.filter(a=>a.label||a.amount).forEach(a=>{
      allInvRows.push({html:`<tr>
        <td colspan="6" style="border:1px solid #aaa;padding:4px 6px;text-align:right">${a.label||"調整"}</td>
        <td style="border:1px solid #aaa;padding:4px 6px;text-align:right">${fn(Number(a.amount)||0)}</td>
      </tr>`, weight:1});
    });
    if(showDiscountLine && totalDiscount > 0){
      allInvRows.push({html:`<tr><td colspan="6" style="border:1px solid #aaa;padding:4px 6px;text-align:right">お値引き</td><td style="border:1px solid #aaa;padding:4px 6px;text-align:right;font-weight:bold">▲${fn(totalDiscount)}</td></tr>`, weight:1});
    }
    const pcH = g.customer?.paymentCycle||"";
    const [myH,mmH] = (g.month||"").split("-").map(Number);
    let dueStrH = "";
    if(myH&&mmH&&pcH&&pcH!=="スクエア"&&pcH!=="その他"){
      let addMH=0, dayValH=0;
      if(pcH.includes("翌月")) addMH=1; else if(pcH.includes("翌々月")) addMH=2;
      const m2H=(mmH-1+addMH)%12+1, y2H=myH+Math.floor((mmH-1+addMH)/12);
      if(pcH.endsWith("末日")){ dayValH=new Date(y2H,m2H,0).getDate(); }
      else { const nH=parseInt((pcH.match(/[0-9]+日/)||[])[0])||0; dayValH=nH; }
      if(dayValH) dueStrH = y2H+"年"+m2H+"月"+dayValH+"日";
    }
    const dueHtml = dueStrH ? `<div>お支払い期日：<span style="color:#c00;font-weight:bold">${dueStrH}</span></div>` : "";
    const pcHtml = pcH&&pcH!=="スクエア"&&pcH!=="その他" ? `<div>お支払い条件：${pcH}</div>` : "";
    const invFooterHtml = `<tbody style="break-inside:avoid;page-break-inside:avoid">
          <tr>
            <td colspan="4" rowspan="3" style="border:1px solid #aaa;padding:6px 10px;vertical-align:middle;font-size:8px;line-height:1.8;text-align:center">
              <div style="display:inline-flex;gap:24px;text-align:left">
                <div>
                  <div style="font-weight:bold;margin-bottom:2px">お振込先</div>
                  <div>みずほ銀行　新橋中央支店　店番号　051</div>
                  <div>普通口座　2333044</div>
                  <div>口座名義　オルク株式会社</div>
                </div>
                <div style="padding-top:2em">
                  ${pcHtml}${dueHtml}
                  <div>※振込み手数料はご負担願います。</div>
                </div>
              </div>
            </td>
            <td colspan="2" style="border:1px solid #aaa;padding:3px 6px;text-align:center;background:#f0f0f0">小計[10%対象]</td>
            <td style="border:1px solid #aaa;padding:3px 6px;text-align:center;background:#f0f0f0">${fn(grandTot)}</td>
          </tr>
          <tr>
            <td colspan="2" style="border:1px solid #aaa;padding:3px 6px;text-align:center">消費税[10%]</td>
            <td style="border:1px solid #aaa;padding:3px 6px;text-align:center">${fn(taxAmt)}</td>
          </tr>
          <tr style="background:#f0f0f0">
            <td colspan="2" style="border:1px solid #aaa;padding:3px 6px;text-align:center">税込合計</td>
            <td style="border:1px solid #aaa;padding:3px 6px;text-align:center">${fn(grandTot+taxAmt)}</td>
          </tr>
        </tbody>`;
    const invQrHtml = `<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px"><div style="text-align:center"><div style="position:relative;display:inline-block;width:54px;height:54px"><img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://rental.olq.co.jp&ecc=H&color=444444&qzone=2" style="width:54px;height:54px"/><div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:white;padding:1px 3px;border-radius:2px;font-size:6px;font-weight:900;color:#111;font-family:sans-serif">olq</div></div><div style="font-size:8px;color:#999;margin-top:1px">ECサイト</div></div><div style="text-align:center"><img src="https://qr-official.line.me/gs/M_783vxgoh_BW.png?oat_content=qr" style="width:54px;height:54px" alt="LINE"/><div style="font-size:8px;color:#999;margin-top:1px">公式LINE</div></div></div>`;
    const buildInvPages=(w1,wRest)=>{
      const pages=[];let current=[],currentW=0,isFirst=true;
      for(const row of allInvRows){
        const limit=isFirst?w1:wRest;
        if(currentW+row.weight>limit&&current.length>0){
          pages.push(current);current=[row];currentW=row.weight;isFirst=false;
        }else{current.push(row);currentW+=row.weight;}
      }
      if(current.length>0)pages.push(current);
      if(pages.length===0)pages.push([]);
      return pages;
    };
    let invPages=buildInvPages(40,PAGE_WEIGHT_REST);
    if(invPages.length===1)invPages=buildInvPages(40,PAGE_WEIGHT_REST);
    const totalInvPages=invPages.length;
    invPages.forEach((pageRows,pageIdx)=>{
      const isFirstPage=pageIdx===0;
      const isLastPage=pageIdx===totalInvPages-1;
      const pageNo=pageIdx+1;
      body+=`<div class="${isLastPage?"pb-last":"pb"}" style="padding:${isFirstPage?"0px":"20px"} 34px 28px 34px;position:relative;font-size:10px">`;
      if(isFirstPage){
        body+=invHeaderHtml;
      } else {
        body+=`<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid #999"><div style="font-size:11px;font-weight:bold">${invCustomerName}　御中　ご請求書（続き）</div><div style="font-size:9px;color:#666">管理No：${invNo}　${pageNo}/${totalInvPages}ページ</div></div>`;
      }
      body+=invTableHeadHtml+`<tbody>`+pageRows.map(r=>r.html).join("")+`</tbody>`;
      if(isLastPage){
        body+=invFooterHtml+`</table>`+invQrHtml;
      } else {
        body+=`</table><div style="text-align:right;font-size:9px;color:#666;margin-top:4px">${pageNo}/${totalInvPages}ページ</div>`;
      }
      body+=`</div>`;
    });
  } else {
    // 納品書HTML（各案件 → 納品書1ページ + 控え1ページ）
    g.items.forEach((r, idx) => {
      const no = genDeliveryNo(r, idx);
      const lines = (r.lines && r.lines.length) ? r.lines.map(ln=>({...ln,unitPrice:Number(ln.unitPrice)||0,quantity:Number(ln.quantity)||1})) : [{equipmentName:r.equipmentName,equipNo:r.equipNo,unitPrice:Number(r.unitPrice)||0,quantity:Number(r.quantity)||1,lineNote:r.lineNote||"",subItems:r.subItems||[]}];
      const projText = r.projectName || g.projectName || "";
      const projDisplay = projText ? `${projText}${r.projectDetail ? `　${r.projectDetail}` : ""}` : "";
      const orderer = r.ordererName || g.customer?.contact || "";
      const honorific = orderer ? "　様" : "";
      const staff = r.ourStaff || "―";

      const olqBlock = `<div class="olq" style="position:relative"><div style="font-weight:bold;font-size:12px">オルク株式会社</div>
        <div>担当　${staff}</div><div>〒105-0004</div>
        <div>東京都港区新橋6-10-2</div><div>第二新洋ビル 1F</div>
        <div>TEL: 03-5777-1100</div><div>MAIL: rental@olq.co.jp</div>
        </div>`;

      // 納品書控（社内用）
      { // ページ分割スコープ
        const ROWS_PER_PAGE_C = 32; // 1ページ目
        const ROWS_PER_PAGE_C_REST = 40; // 2ページ目以降
        const allRowsC = [];
        lines.forEach(ln => {
          allRowsC.push({type:'main', ln});
          (ln.expandRows?(ln.subItems||[]):[]).forEach(si => allRowsC.push({type:'sub', ln, si}));
        });
        if((r.insuranceAmount||0)>0) allRowsC.push({type:'insurance'});
        const pagesC = [];
        { let remaining = [...allRowsC]; let isFirst = true;
          while(remaining.length > 0){ const limit = isFirst ? ROWS_PER_PAGE_C : ROWS_PER_PAGE_C_REST; pagesC.push(remaining.slice(0,limit)); remaining = remaining.slice(limit); isFirst = false; }
          if(pagesC.length===0) pagesC.push([]);
        }
        const totalPagesC = pagesC.length;
        const emptyColsC = `<td></td><td></td><td></td><td></td><td></td><td></td><td></td>`;
        pagesC.forEach((pageRows, pageIdx) => {
          const isFirstPage = pageIdx === 0;
          const pageNo = pageIdx + 1;
          const topPad = isFirstPage ? '5px' : '20px';
          body += `<div class="pb" style="padding:${topPad} 19px 30px 56px;position:relative;width:794px;box-sizing:border-box">`;
          if(isFirstPage){
            body += `<div style="position:relative">
              <div class="title" style="letter-spacing:4px">納品書控</div>
              <div style="position:absolute;top:0;right:0;text-align:right;font-size:10px;line-height:1.8"><div>納品書No.　<strong>${no}</strong></div><div>日付　${fd(r.createdAt||r.startDate)}</div></div>
            </div>
            <div class="hdr"><div>
              <div class="cust-name">${g.customer?.invoiceName||g.customerName}　${orderer?"御中":"様"}</div>
              ${projDisplay?`<div style="margin-top:4px"><strong>『${projDisplay}』</strong></div>`:""}
              ${orderer?`<div style="margin-top:3px"><strong>${orderer}　様</strong></div>`:""}
              ${r.ecOrderNo?`<div style="margin-top:2px;font-size:10px">EC注文番号：${r.ecOrderNo}</div>`:""}
              <div style="display:flex;gap:14px;margin-top:12px">
                <div class="sign-box"><div style="display:flex;justify-content:flex-start;align-items:center;margin-bottom:2px"><span class="sign-label">納品確認</span><span class="sign-date" style="margin-left:8px">Date　　／</span></div><div style="min-height:28px;border-bottom:1px solid #ccc;margin-bottom:4px"></div><div style="font-size:9px;color:#555">担当</div></div>
                <div class="sign-box"><div style="display:flex;justify-content:flex-start;align-items:center;margin-bottom:2px"><span class="sign-label">返却確認</span><span class="sign-date" style="margin-left:8px">Date　　／</span></div><div style="min-height:28px;border-bottom:1px solid #ccc;margin-bottom:4px"></div><div style="font-size:9px;color:#555">担当</div></div>
              </div>
            </div>${olqBlock}</div>`;
          } else {
            body += `<div style="position:relative;margin-bottom:14px">
              <div style="font-size:16px;font-weight:bold;letter-spacing:6px;text-align:center;margin-bottom:10px">納品書控　${pageNo}/${totalPagesC}</div>
              <div style="text-align:right;font-size:10px;line-height:1.8"><div>納品書No.　<strong>${no}</strong></div><div>日付　${fd(r.createdAt||r.startDate)}</div></div>
            </div>`;
          }
          body += `<table style="margin-top:10px;table-layout:fixed;width:100%"><colgroup><col style="width:339px"><col style="width:36px"><col style="width:56px"><col style="width:36px"><col style="width:72px"><col style="width:72px"><col></colgroup><thead><tr><th>機材名</th><th>No</th><th>単価</th><th>数量</th><th>開始日</th><th>終了日</th><th>備考</th></tr></thead><tbody>`;
          let rowNumC = pagesC.slice(0, pageIdx).reduce((s,p)=>s+p.length, 0);
          pageRows.forEach(row => {
            rowNumC++;
            if(row.type==='main'){
              const ln=row.ln;
              body += `<tr><td>${ln.equipmentName||""}</td><td class="c">${ln.equipNo||""}</td><td class="r">${fm(ln.unitPrice)}</td><td class="c">${ln.quantity||""}</td><td class="c">${fd(r.startDate)}</td><td class="c">${fd(r.endDate)}</td><td style="font-size:9px">${r.billingType==="monthly"?("月極"+(ln.lineNote?" "+ln.lineNote:"")):(ln.lineNote||"")}</td></tr>`;
            } else if(row.type==='sub'){
              const ln=row.ln; const si=row.si;
              body += `<tr class="sub-row"><td style="padding-left:14px">└ ${ln.equipmentName||""}</td><td class="c" style="font-size:10px">${si.no}</td><td></td><td></td><td></td><td></td><td style="font-size:9px;padding-left:5px">${si.note||""}</td></tr>`;
            } else if(row.type==='insurance'){
              body += `<tr><td>補償料</td><td></td><td class="r">${fm(r.insuranceAmount)}</td><td></td><td></td><td></td><td></td></tr>`;
            }
          });
          const pageLimitC = isFirstPage ? ROWS_PER_PAGE_C : ROWS_PER_PAGE_C_REST;
          const emptyCountC = pageLimitC - pageRows.length;
          for(let i=0; i<emptyCountC; i++) body += `<tr class="empty">${emptyColsC}</tr>`;
          body += `</tbody></table>`;
          if(pageNo===totalPagesC){
            body += `<table style="margin-top:-1px"><tr><td class="biko">備　考</td><td style="min-height:90px;white-space:pre-wrap">${r.notes||""}</td></tr></table>`;
          }
          if(!isFirstPage){
            body += `<div style="position:absolute;bottom:14px;right:34px;font-size:10px;color:#111">納品書No.${no}　${pageNo}/${totalPagesC}</div>`;
          }
          body += `</div>`;
        });
      }

      // 納品書（お客様用）
      const showDPrice = !!g.customer?.showDeliveryPrice;
      { // ページ分割スコープ
        const ROWS_PER_PAGE = 32; // 1ページ目
        const ROWS_PER_PAGE_REST = 40; // 2ページ目以降
        const allRows = [];
        lines.forEach(ln => {
          allRows.push({type:'main', ln});
          (ln.expandRows?(ln.subItems||[]):[]).forEach(si => allRows.push({type:'sub', ln, si}));
        });
        if((r.insuranceAmount||0)>0) allRows.push({type:'insurance'});
        const pages = [];
        { let remaining = [...allRows]; let isFirst = true;
          while(remaining.length > 0){ const limit = isFirst ? ROWS_PER_PAGE : ROWS_PER_PAGE_REST; pages.push(remaining.slice(0,limit)); remaining = remaining.slice(limit); isFirst = false; }
          if(pages.length===0) pages.push([]);
        }
        const totalPages = pages.length;
        const emptyCols = showDPrice ? `<td></td><td></td><td></td><td></td><td></td><td></td>` : `<td></td><td></td><td></td><td></td><td></td>`;
        pages.forEach((pageRows, pageIdx) => {
          const isFirstPage = pageIdx === 0;
          const pageNo = pageIdx + 1;
          body += `<div class="pb" style="padding:30px 34px;position:relative">`;
          if(isFirstPage){
            body += `<div style="position:relative">
              <div class="title">納 品 書</div>
              ${r.isExtension?`<div style="font-size:11px;color:#2563eb;font-weight:700;text-align:center;margin-top:2px">${r.extendedFromNo?"元伝票No."+r.extendedFromNo+" ":""}ご延長分</div>`:""}
              <div style="position:absolute;top:0;right:0;text-align:right;font-size:10px;line-height:1.8"><div>納品書No.　<strong>${no}</strong></div><div>日付　${fd(r.createdAt||r.startDate)}</div></div>
            </div>
            <div class="hdr"><div>
              <div class="cust-name">${g.customer?.invoiceName||g.customerName}　${orderer?"御中":"様"}</div>
              ${projDisplay?`<div style="margin-top:4px"><strong>『${projDisplay}』</strong></div>`:""}
              ${orderer?`<div style="margin-top:3px"><strong>${orderer}　様</strong></div>`:""}
              ${r.ecOrderNo?`<div style="margin-top:2px;font-size:10px">EC注文番号：${r.ecOrderNo}</div>`:""}
            </div>${olqBlock}</div>
            <div style="font-size:10px;color:#444;margin-bottom:10px">毎度ありがとうございます。下記の通り納品致しましたのでご査収下さい。</div>`;
          } else {
            body += `<div style="position:relative;margin-bottom:10px">
              <div style="font-size:16px;font-weight:bold;letter-spacing:6px;text-align:center">納 品 書　${pageNo}/${totalPages}</div>
              <div style="position:absolute;top:0;right:0;text-align:right;font-size:10px;line-height:1.8"><div>納品書No.　<strong>${no}</strong></div><div>日付　${fd(r.createdAt||r.startDate)}</div></div>
            </div>`;
          }
          body += `<table><thead><tr><th>機材名</th>${showDPrice?`<th style="width:60px">単価</th>`:""}<th style="width:40px">数量</th><th style="width:80px">開始日</th><th style="width:80px">終了日</th><th>備考</th></tr></thead><tbody>`;
          let rowNum = pages.slice(0, pageIdx).reduce((s,p)=>s+p.length, 0);
          pageRows.forEach(row => {
            rowNum++;
            if(row.type==='main'){
              const ln=row.ln;
              body += `<tr><td>${ln.equipmentName||""}</td>${showDPrice?`<td class="r">${fm(ln.unitPrice||0)}</td>`:""}<td class="c">${ln.quantity||""}</td><td class="c">${fd(r.startDate)}</td><td class="c">${fd(r.endDate)}</td><td style="font-size:9px">${r.billingType==="monthly"?("月極"+(ln.lineNote?" "+ln.lineNote:"")):(ln.lineNote||"")}</td></tr>`;
            } else if(row.type==='sub'){
              body += `<tr class="sub-row"><td style="padding-left:16px">└ No.${row.si.no}</td>${showDPrice?`<td></td>`:""}<td></td><td></td><td></td><td style="font-size:9px;padding-left:5px">${row.si.note||""}</td></tr>`;
            } else if(row.type==='insurance'){
              body += showDPrice
                ? `<tr><td>補償料</td><td></td><td class="r">${fm(r.insuranceAmount)}</td><td></td><td></td><td></td></tr>`
                : `<tr><td>補償料</td><td></td><td></td><td></td><td></td></tr>`;
            }
          });
          const pageLimit = isFirstPage ? ROWS_PER_PAGE : ROWS_PER_PAGE_REST;
          const emptyCount = pageLimit - pageRows.length;
          for(let i=0; i<emptyCount; i++) body += `<tr class="empty">${emptyCols}</tr>`;
          body += `</tbody></table>`;
          if(pageNo===totalPages){
            body += `<table style="margin-top:-1px"><tr><td class="biko">備　考</td><td style="min-height:90px;white-space:pre-wrap">${r.notes||""}</td></tr></table>
              <div class="note"><div><strong>※ご利用前に、必ず内容物確認と動作チェックを行なってください。</strong></div></div>
              <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px"><div style="text-align:center"><div style="position:relative;display:inline-block;width:54px;height:54px"><img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://rental.olq.co.jp&ecc=H&color=444444&qzone=2" style="width:54px;height:54px"/><div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:white;padding:1px 3px;border-radius:2px;font-size:6px;font-weight:900;color:#111;font-family:sans-serif">olq</div></div><div style="font-size:8px;color:#999;margin-top:1px">ECサイト</div></div><div style="text-align:center"><img src="https://qr-official.line.me/gs/M_783vxgoh_BW.png?oat_content=qr" style="width:54px;height:54px" alt="LINE"/><div style="font-size:8px;color:#999;margin-top:1px">公式LINE</div></div></div>`;
          }
          if(!isFirstPage){
            body += `<div style="position:absolute;bottom:14px;right:34px;font-size:10px;color:#111">納品書No.${no}　${pageNo}/${totalPages}</div>`;
          }
          body += `</div>`;
        });
      }

      // 領収証ページ（delivery-receipt かつ issueReceipt=true の案件のみ）
      if (type === "delivery-receipt" && r.issueReceipt) {
        const rIdx = g.items.indexOf(r);
        const receiptNo = genDeliveryNo(r, rIdx);
        const receiptDateStr = r.receiptDate || fd(r.startDate);
        const payLabel = r.paymentMethod === "cash" ? "現金" : r.paymentMethod === "square" ? "スクエア クレジット" : "ECクレジット";
        const receiptName = r.receiptNameCustom && r.receiptNameOverride ? r.receiptNameOverride : (g.customer?.invoiceName || g.customerName);
        const honorific = r.receiptNameCustom && r.receiptNameOverride ? (r.receiptHonorific || '様') : ((receiptName.includes('株式会社') || receiptName.includes('有限会社') || receiptName.includes('合同会社')) ? '御中' : '様');
        const equipAmt = r.amount || 0;
        const insurAmt = r.insuranceAmount || 0;
        const subTot = equipAmt + insurAmt;
        const tax = Math.round(subTot * 0.1);
        const grandTot = subTot + tax;

        body += `<div class="pb" style="padding:80px 34px 48px 34px">
          <div style="position:relative">
            <div class="title" style="letter-spacing:8px">領 収 証</div>
            <div style="position:absolute;top:0;right:0;text-align:right;font-size:10px;line-height:1.8"><div>領収証No.　<strong>${receiptNo}</strong></div><div>登録番号　T5-0104-0109-2630</div><div>領収日　${receiptDateStr}</div></div>
          </div>
          <div class="hdr" style="position:relative"><div>
            <div class="cust-name">${receiptName}　${honorific}</div>
          </div>${olqBlock}<img src="data:image/png;base64,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" style="position:absolute;top:-8px;right:-6px;width:62px;height:62px;opacity:.9;pointer-events:none"/></div>
          <div style="margin-bottom:6px;font-size:11px">
            <span style="margin-right:16px">合計金額</span>
            <span style="font-size:20px;font-weight:900;border-bottom:2px solid #111;padding:0 14px">${fm(grandTot)}</span>
            <span style="font-size:11px;margin-left:8px">（税込）</span>
          </div>
          <div style="margin-bottom:6px;font-size:11px">上記、正に領収いたしました。</div>
          <div style="font-size:11px;margin-bottom:8px;border:1px solid #ddd;border-radius:4px;padding:6px 10px;background:#f9f9f9">
            但書き　${r.receiptNote || `機材レンタル代として　［${payLabel}］`}
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:0">
            <thead>
              <tr style="background:#f3f3f3">
                <th style="border:1px solid #aaa;padding:4px 6px;text-align:center">ご利用日</th>
                <th style="border:1px solid #aaa;padding:4px 6px;text-align:center;width:40px">日数</th>
                <th style="border:1px solid #aaa;padding:4px 6px">製品名</th>
                <th style="border:1px solid #aaa;padding:4px 6px;text-align:center;width:36px">数量</th>
                <th style="border:1px solid #aaa;padding:4px 6px;text-align:right;width:64px">単価</th>
                <th style="border:1px solid #aaa;padding:4px 6px;text-align:right;width:72px">金額</th>
              </tr>
            </thead>
            <tbody>
              ${lines.map(ln=>{
                const noDisc = ln.noBillingDiscount;
                const useDays = r.billingType==="monthly"?(r.months||1):(noDisc?(r.days||0):(r.billingDays||r.days||0));
                const lineAmt = Math.round((ln.unitPrice||0)*(ln.quantity||1)*useDays);
                const daysLabel = r.billingType==="monthly"?`${r.months||1}ヶ月`:`${useDays}日`;
                return `<tr>
                  <td style="border:1px solid #aaa;padding:4px 6px;text-align:center">${fd(r.startDate)}〜${fd(r.endDate)}</td>
                  <td style="border:1px solid #aaa;padding:4px 6px;text-align:center">${daysLabel}</td>
                  <td style="border:1px solid #aaa;padding:4px 6px">${ln.equipmentName||""}</td>
                  <td style="border:1px solid #aaa;padding:2px 5px;text-align:center">${ln.quantity||1}</td>
                  <td style="border:1px solid #aaa;padding:4px 6px;text-align:right">${fm(ln.unitPrice)}</td>
                  <td style="border:1px solid #aaa;padding:4px 6px;text-align:right">${fn(lineAmt)}</td>
                </tr>`;
              }).join("")}
              ${(r.insuranceAmount||0)>0?`<tr>
                <td colspan="5" style="border:1px solid #aaa;padding:4px 8px;text-align:right">補償料</td>
                <td style="border:1px solid #aaa;padding:4px 6px;text-align:right">${fm(r.insuranceAmount)}</td>
              </tr>`:""}
            </tbody>
            <tfoot>
              <tr style="background:#f9f9f9">
                <td colspan="5" style="border:1px solid #aaa;padding:4px 8px;text-align:right;font-weight:700">小計 [10%対象]</td>
                <td style="border:1px solid #aaa;padding:4px 6px;text-align:right;font-weight:700">${fm(subTot)}</td>
              </tr>
              <tr>
                <td colspan="5" style="border:1px solid #aaa;padding:4px 8px;text-align:right">消費税 [10%]</td>
                <td style="border:1px solid #aaa;padding:4px 6px;text-align:right">${fm(tax)}</td>
              </tr>
              <tr style="background:#f0f0f0">
                <td colspan="5" style="border:1px solid #aaa;padding:4px 8px;text-align:right;font-weight:900;font-size:11px">税込合計</td>
                <td style="border:1px solid #aaa;padding:4px 6px;text-align:right;font-weight:900;font-size:11px">${fm(grandTot)}</td>
              </tr>
            </tfoot>
          </table>
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px"><div style="text-align:center"><div style="position:relative;display:inline-block;width:54px;height:54px"><img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://rental.olq.co.jp&ecc=H&color=444444&qzone=2" style="width:54px;height:54px"/><div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:white;padding:1px 3px;border-radius:2px;font-size:6px;font-weight:900;color:#111;font-family:sans-serif">olq</div></div><div style="font-size:8px;color:#999;margin-top:1px">ECサイト</div></div><div style="text-align:center"><img src="https://qr-official.line.me/gs/M_783vxgoh_BW.png?oat_content=qr" style="width:54px;height:54px" alt="LINE"/><div style="font-size:8px;color:#999;margin-top:1px">公式LINE</div></div></div>

        </div>`;
      }
    });
  }

  if (_returnBodyOnly) return {body: body, css: css};

  const fullHTML = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><title>${title}</title><style>
${css}
@media print { .no-print { display:none!important; } body { margin:0; } }
</style></head><body>
<div class="no-print" style="position:fixed;top:0;left:0;right:0;background:#1e293b;color:#fff;padding:10px 20px;display:flex;align-items:center;gap:12px;z-index:9999;font-family:sans-serif;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,.3)">
  <span style="font-weight:700;flex:1">${title}</span>
  <button onclick="window.print()" style="background:#2563eb;color:#fff;border:none;border-radius:6px;padding:7px 20px;font-size:14px;font-weight:700;cursor:pointer">🖨 印刷 / PDF保存</button>
  <button onclick="window.close()" style="background:none;border:1px solid rgba(255,255,255,0.3);color:#fff;border-radius:6px;padding:7px 14px;font-size:13px;cursor:pointer">✕ 閉じる</button>
</div>
<div style="margin-top:52px">${body}</div>
<script>
${type==="invoice"?``:""}
</script>
</body></html>`;
  const newTab = window.open('', '_blank');
  newTab.document.write(fullHTML);
  newTab.document.close();
}
