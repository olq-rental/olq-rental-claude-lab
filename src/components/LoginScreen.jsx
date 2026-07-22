import React, { useState } from "react";
import { supabase } from '../supabaseClient';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError('メールアドレスまたはパスワードが正しくありません');
    setLoading(false);
  };

  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'#f1f5f9',fontFamily:"'Noto Sans JP','Hiragino Sans',sans-serif"}}>
      <div style={{background:'#fff',borderRadius:16,boxShadow:'0 4px 32px rgba(0,0,0,0.10)',padding:'40px 36px',width:360}}>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',marginBottom:28}}>
          <div style={{background:"#fff",borderRadius:"50%",width:56,height:56,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",padding:6,marginBottom:14,boxShadow:"0 2px 12px rgba(0,0,0,0.10)"}}>
            <img src="/olq-logo.png" alt="olq" style={{width:"100%",height:"100%",objectFit:"contain"}}/>
          </div>
          <span style={{fontWeight:800,fontSize:17,letterSpacing:2,color:'#0f172a'}}>オルク レンタル伝票管理</span>
        </div>
        <form onSubmit={handleLogin}>
          <div style={{marginBottom:14}}>
            <label style={{display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:4}}>メールアドレス</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required
              style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:7,fontSize:13,outline:'none',boxSizing:'border-box'}}/>
          </div>
          <div style={{marginBottom:20}}>
            <label style={{display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:4}}>パスワード</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required
              style={{width:'100%',padding:'9px 12px',border:'1.5px solid #e2e8f0',borderRadius:7,fontSize:13,outline:'none',boxSizing:'border-box'}}/>
          </div>
          {error && <div style={{color:'#dc2626',fontSize:12,marginBottom:12,padding:'8px 12px',background:'#fef2f2',borderRadius:6}}>{error}</div>}
          <button type="submit" disabled={loading}
            style={{width:'100%',padding:'10px',background:'#0f172a',color:'#fff',border:'none',borderRadius:8,fontSize:14,fontWeight:700,cursor:loading?'not-allowed':'pointer',opacity:loading?0.7:1}}>
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  );
}
