export const S = {
  lbl:{display:"block",fontSize:11,fontWeight:700,color:"#64748b",marginBottom:4},
  inp:{width:"100%",padding:"8px 11px",border:"1.5px solid #e2e8f0",borderRadius:7,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit",background:"#fff"},
  td:{border:"1px solid #d1d5db",padding:"6px 10px"},
  btn:(bg,sm)=>({background:bg,color:"#fff",border:"none",borderRadius:7,padding:sm?"6px 12px":"8px 16px",fontSize:sm?12:13,fontWeight:600,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:5,whiteSpace:"nowrap"}),
  ib:c=>({background:"none",border:`1.5px solid ${c}`,color:c,borderRadius:6,padding:"3px 7px",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:3,fontSize:12,whiteSpace:"nowrap"}),
  card:{background:"#fff",borderRadius:12,boxShadow:"0 2px 12px rgba(0,0,0,0.07)",overflow:"hidden"},
};
