import { useState, useEffect, useRef } from "react";

// 検索絞り込み付きセレクト
const _INP={width:"100%",padding:"8px 11px",border:"1.5px solid #e2e8f0",borderRadius:7,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit",background:"#fff"};
export function SearchableSelect({value, onChange, options, placeholder="選択...", style}){
  const [q,setQ]=useState("");
  const [open,setOpen]=useState(false);
  const ref=useRef(null);
  const filtered=q?options.filter(o=>o.label.toLowerCase().includes(q.toLowerCase())):options;
  const selected=options.find(o=>o.value===value);
  useEffect(()=>{
    const handler=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};
    document.addEventListener("mousedown",handler);
    return()=>document.removeEventListener("mousedown",handler);
  },[]);
  return(
    <div ref={ref} style={{position:"relative",...style}}>
      <div
        onClick={()=>{setOpen(v=>!v);setQ("");}}
        style={{..._INP,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",userSelect:"none"}}
      >
        <span style={{color:selected?"#0f172a":"#94a3b8",fontSize:13}}>{selected?selected.label:placeholder}</span>
        <span style={{color:"#94a3b8",fontSize:10}}>▼</span>
      </div>
      {open&&(
        <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:200,background:"#fff",border:"1.5px solid #2563eb",borderRadius:7,boxShadow:"0 8px 24px rgba(0,0,0,0.12)",overflow:"hidden"}}>
          <input
            autoFocus
            value={q}
            onChange={e=>setQ(e.target.value)}
            placeholder="絞り込み..."
            style={{width:"100%",padding:"8px 11px",border:"none",borderBottom:"1px solid #e2e8f0",fontSize:13,outline:"none",boxSizing:"border-box"}}
          />
          <div style={{maxHeight:220,overflowY:"auto"}}>
            {filtered.length===0
              ?<div style={{padding:"10px 14px",fontSize:12,color:"#94a3b8"}}>該当なし</div>
              :filtered.map(o=>(
                <div
                  key={o.value}
                  onClick={()=>{onChange(o.value);setOpen(false);setQ("");}}
                  style={{padding:"8px 14px",fontSize:13,cursor:"pointer",background:o.value===value?"#eff6ff":"#fff",color:o.value===value?"#2563eb":"#0f172a",fontWeight:o.value===value?700:400}}
                  onMouseEnter={e=>e.currentTarget.style.background=o.value===value?"#dbeafe":"#f8fafc"}
                  onMouseLeave={e=>e.currentTarget.style.background=o.value===value?"#eff6ff":"#fff"}
                >
                  {o.label}
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}
