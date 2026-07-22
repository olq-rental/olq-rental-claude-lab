import React from "react";

export function AdjAmountInput({value,onChange,disabled,style}){
  const [str,setStr]=React.useState(value===0?"":String(value));
  React.useEffect(()=>{setStr(value===0?"":String(value));},[value]);
  return <input
    type="text" inputMode="numeric"
    value={str}
    style={style}
    disabled={disabled}
    onChange={e=>{
      const v=e.target.value.replace(/[^0-9\-]/g,"");
      const raw=v.startsWith("-")?"-"+v.slice(1).replace(/-/g,""):v.replace(/-/g,"");
      setStr(raw);
      if(raw===""){onChange(0);return;}
      if(raw==="-")return;
      const num=Number(raw);
      if(!isNaN(num))onChange(num);
    }}
  />;
}
