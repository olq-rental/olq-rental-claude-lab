import React from "react";

// シンプルなパスワード入力コンポーネント
export function PwInput({onOk, onCancel}) {
  const [v, setV] = React.useState("");
  return (
    <div>
      <input type="password" value={v} onChange={e=>setV(e.target.value)}
        onKeyDown={e=>{if(e.key==="Enter")onOk(v);if(e.key==="Escape")onCancel();}}
        placeholder="パスワードを入力" autoFocus
        style={{width:"100%",border:"1px solid #e2e8f0",borderRadius:6,padding:"8px 10px",fontSize:13,marginBottom:10,boxSizing:"border-box"}}/>
      <div style={{display:"flex",gap:8}}>
        <button onClick={()=>onOk(v)}
          style={{flex:1,background:"#0f172a",color:"#fff",border:"none",borderRadius:6,padding:"8px 0",fontSize:13,fontWeight:700,cursor:"pointer"}}>確認</button>
        <button onClick={onCancel}
          style={{flex:1,background:"#e2e8f0",color:"#475569",border:"none",borderRadius:6,padding:"8px 0",fontSize:13,cursor:"pointer"}}>キャンセル</button>
      </div>
    </div>
  );
}
