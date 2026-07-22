import { Ico, I } from './Ico';

export function Toast({t}) {
  if (!t) return null;
  return (
    <div style={{position:"fixed",top:62,right:16,zIndex:9999,background:t.ok?"#166534":"#991b1b",color:"#fff",borderRadius:9,padding:"10px 16px",fontSize:13,fontWeight:600,boxShadow:"0 6px 24px rgba(0,0,0,.3)",display:"flex",alignItems:"center",gap:8,maxWidth:380}}>
      <Ico d={t.ok?I.check:"M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"} size={14}/>{t.msg}
    </div>
  );
}
