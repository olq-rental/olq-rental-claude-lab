import { calcDays } from './constants';

// 終了未定月極案件を月ごとに展開する
export function expandMonthlyOpenRecord(r, calcBillingDaysFn, todayFn, products, cust) {
  const results = [];
  if (!r.startDate) return results;
  const startD = new Date(r.startDate + 'T00:00:00');
  const returnD = r.returnDate ? new Date(r.returnDate + 'T00:00:00') : null;
  const todayD  = new Date(todayFn() + 'T00:00:00');
  const limitD  = returnD || todayD;
  const rLns = (r.lines && r.lines.length) ? r.lines
    : [{productId:r.productId||"",equipNo:r.equipNo||"",unitPrice:r.unitPrice,
        dailyUnitPrice:r.dailyUnitPrice||r.unitPrice,
        quantity:r.quantity,lineNote:r.lineNote||"",subItems:r.subItems||[],
        equipmentName:r.equipmentName||""}];

  const limitMonth = limitD.getFullYear() * 12 + limitD.getMonth();
  let n = 0;
  while (n <= 120) {
    const pStart = new Date(startD);
    pStart.setMonth(pStart.getMonth() + n);
    const pStartMonth = pStart.getFullYear() * 12 + pStart.getMonth();
    if (pStartMonth > limitMonth) break;

    const pEnd = new Date(pStart);
    pEnd.setMonth(pEnd.getMonth() + 1);
    pEnd.setDate(pEnd.getDate() - 1);

    const _pad = n=>String(n).padStart(2,"0");
    const bMonth = `${pStart.getFullYear()}-${_pad(pStart.getMonth()+1)}`;
    const pStartStr = `${pStart.getFullYear()}-${_pad(pStart.getMonth()+1)}-${_pad(pStart.getDate())}`;
    const pEndStr   = `${pEnd.getFullYear()}-${_pad(pEnd.getMonth()+1)}-${_pad(pEnd.getDate())}`;

    if (returnD && returnD >= pStart && returnD <= pEnd) {
      // 戻り月：部分期間を日極で計上
      const days = Math.max(1, Math.ceil((returnD - pStart) / 86400000) + 1);
      const bDays = calcBillingDaysFn(days);
      const lines = rLns.map(ln => {
        const prod = (products||[]).find(p => p.id === ln.productId);
        const dailyPrice = prod ? resolvePrice(prod, cust) : Number(ln.dailyUnitPrice || ln.unitPrice || 0);
        const qty = Number(ln.quantity) || 1;
        const monthlyPrice = Number(ln.unitPrice || 0) * qty;
        const rawAmt = dailyPrice * qty * bDays;
        const amount = monthlyPrice > 0 ? Math.min(rawAmt, monthlyPrice) : rawAmt;
        return {...ln, unitPrice: dailyPrice, amount};
      });
      const amt = lines.reduce((s,ln)=>s+(ln.amount||0),0);
      results.push({
        ...r, id:r.id+'__ret__'+bMonth,
        startDate:pStartStr, endDate:r.returnDate,
        billingType:'daily', billingDays:bDays, days:bDays,
        isReturnEntry:true, isOpenMonthly:true, amount:amt, lines,
        _billingMonth:bMonth,
      });
      break;
    } else {
      // 通常月：1ヶ月分
      const lines = rLns.map(ln => {
        const up = Number(ln.unitPrice || 0);
        const qty = Number(ln.quantity) || 1;
        return {...ln, amount: up * qty * 1};
      });
      const amt = lines.reduce((s,ln)=>s+(ln.amount||0),0);
      results.push({
        ...r, id:r.id+'__mo__'+bMonth,
        startDate:pStartStr, endDate:pEndStr,
        billingType:'monthly', months:1,
        isMonthlyEntry:true, isOpenMonthly:true, amount:amt, lines,
        _billingMonth:bMonth,
      });
    }
    n++;
  }
  return results;
}



// オルク独自の請求日数計算ルール
// 1-4日: そのまま / 5日: 4日 / 6-7日: 5日 / ... / 26-31日: 15日
// 32日〜: 31日ごとにリセットして同じルールを再適用
export function applyBillingTable(d) {
  if (d <= 0) return 0;
  if (d <= 4) return d;
  if (d === 5) return 4;
  if (d <= 7) return 5;
  if (d <= 9) return 6;
  if (d <= 11) return 7;
  if (d <= 13) return 8;
  if (d <= 15) return 9;
  if (d <= 17) return 10;
  if (d <= 19) return 11;
  if (d <= 21) return 12;
  if (d <= 23) return 13;
  if (d <= 25) return 14;
  return 15; // 26-31日
}
export function calcBillingDays(actualDays) {
  if (actualDays <= 0) return 0;
  const cycles    = Math.floor(actualDays / 31);
  const remainder = actualDays % 31;
  return cycles * 15 + applyBillingTable(remainder);
}
export function chainBillingDays(record, allRecords, segEnd) {
  const segStart = record.startDate;
  if (!segStart || !segEnd) return 0;
  const baseNo = no => (no || "").replace(/E\d+.*$/, "");
  const key = baseNo(record.deliveryNo);
  let rootStart = segStart;
  if (key) {
    allRecords.forEach(x => {
      if (baseNo(x.deliveryNo) === key && x.startDate && x.startDate < rootStart) {
        rootStart = x.startDate;
      }
    });
  }
  const cumThrough = calcDays(rootStart, segEnd);
  const cumBefore = Math.max(0, calcDays(rootStart, segStart) - 1);
  return Math.max(0, calcBillingDays(cumThrough) - calcBillingDays(cumBefore));
}
export function chainBillingDetail(record, allRecords, segEnd) {
  const segStart = record.startDate;
  if (!segStart || !segEnd) return null;
  const bNo = no => (no || "").replace(/E\d+.*$/, "");
  const key = bNo(record.deliveryNo);
  if (!key) return null;
  let rootStart = segStart;
  (allRecords || []).forEach(x => {
    if (bNo(x.deliveryNo) === key && x.startDate && x.startDate < rootStart) rootStart = x.startDate;
  });
  const segDays = calcDays(segStart, segEnd);
  const standaloneBilling = calcBillingDays(segDays);
  const cbd = chainBillingDays(record, allRecords || [], segEnd);
  if (cbd === standaloneBilling) return null;
  const cumActual = calcDays(rootStart, segEnd);
  const cumBilling = calcBillingDays(cumActual);
  return { cumActual, cumBilling, thisBilling: cbd, prevBilling: cumBilling - cbd };
}
export function buildChainBlocks(sortedItems) {
  const baseNo = dn => (dn || "").replace(/E\d+.*$/, "");
  const chainMap = {};
  const order = [];
  sortedItems.forEach(r => {
    const key = baseNo(r.deliveryNo) || r.id;
    if (!chainMap[key]) { chainMap[key] = []; order.push(key); }
    chainMap[key].push(r);
  });
  return order.map(key => {
    const segs = chainMap[key];
    if (segs.length === 1) return { type: "single", record: segs[0] };
    const allDates = segs.flatMap(r => [r.startDate, r.returnDate || r.endDate]).filter(Boolean);
    const chainStart = allDates.reduce((a,b) => a < b ? a : b);
    const chainEnd   = allDates.reduce((a,b) => a > b ? a : b);
    const chainCalDays  = segs.reduce((s,r) => s + (r.days||0), 0);
    const chainBillDays = calcBillingDays(chainCalDays);
    const chainAmount   = segs.reduce((s,r) => s + (r.amount||0) + (r.insuranceAmount||0), 0);
    const equipNames = [...new Set(segs.flatMap(r => (r.lines||[]).map(ln => ln.equipmentName).filter(Boolean)))];
    if (!equipNames.length) equipNames.push(segs[0].equipmentName || "");
    return { type: "chain", header: { equipNames, chainStart, chainEnd, chainCalDays, chainBillDays, chainAmount }, segments: segs };
  });
}
export function calcExpectedAmount(r, allRecords) {
  const lines = r.lines || [];
  if (!lines.length) return null;
  const segEnd = r.returnDate || r.endDate;
  const correctBillingDays = (r.isExtension && segEnd && allRecords && allRecords.length)
    ? chainBillingDays(r, allRecords, segEnd)
    : calcBillingDays(Number(r.days)||0);
  return lines.reduce((s, ln) => {
    if (ln.isFee) return s + (Number(ln.unitPrice)||0) * (Number(ln.quantity)||1);
    if (r.billingType === "monthly") return s + (Number(ln.unitPrice)||0) * (Number(ln.quantity)||1) * (Number(r.months)||1);
    const qty = ln.noBillingDiscount ? (Number(r.days)||0) : correctBillingDays;
    return s + (Number(ln.unitPrice)||0) * (Number(ln.quantity)||1) * qty;
  }, 0);
}

export function resolvePrice(prod, cust) {
  if (!prod) return 0;
  if (!cust) return prod.priceEx;
  const sp = (cust.specialPrices||[]).find(s => s.productId === prod.id);
  if (sp) return sp.price;
  const kake = Number(cust.discountRate)||0;
  if (kake > 0 && kake < 10) return Math.round(prod.priceEx * kake / 10);
  return prod.priceEx;
}

// 特別価格の製品名を製品マスタから動的解決（削除済み製品はフォールバック表示）
export function spName(sp, products) {
  const p = products.find(x => x.id === sp.productId);
  return p ? p.fullName : (sp.productName || `[削除済:${sp.productId}]`);
}
// 特別価格リストのproductNameを最新に同期（削除済み製品は除去せず保持）
export function syncSPs(specialPrices, products) {
  return (specialPrices||[]).map(sp => {
    const p = products.find(x => x.id === sp.productId);
    return p ? { ...sp, productName: p.fullName } : sp;
  });
}

export const getLines = r => (r.lines&&r.lines.length)?r.lines:[{productId:r.productId||"",equipNo:r.equipNo||"",unitPrice:r.unitPrice,quantity:r.quantity,lineNote:r.lineNote||"",subItems:r.subItems||[],equipmentName:r.equipmentName||""}];
