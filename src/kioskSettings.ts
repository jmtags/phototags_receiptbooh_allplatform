import { useState } from "react";
function saved(key:string,fallback:string){try{return localStorage.getItem(key)??fallback;}catch{return fallback;}}
export function useKioskSettings(locked: boolean) {
  const [autoDownloadQr,setAutoQr]=useState(()=>saved("autoDownloadQr","true")!=="false");
  const [kioskResetSeconds,setSeconds]=useState(()=>{
    const value=Number(saved("kioskResetSeconds","120"));
    return Number.isInteger(value) && (value===0 || value>=30 && value<=600) ? value : 120;
  });
  const [kioskSettingsError,setError]=useState("");
  function persist(key:string,value:string,commit:()=>void){
    if(locked)return;
    try{localStorage.setItem(key,value);commit();setError("");}catch{setError("These settings could not be saved. Allow browser storage and try again.");}
  }
  return {autoDownloadQr,kioskResetSeconds,kioskSettingsError,
    setAutoDownloadQr(value:boolean){persist("autoDownloadQr",String(value),()=>setAutoQr(value));},
    setKioskResetSeconds(value:number){if(Number.isInteger(value)&&(value===0||value>=30&&value<=600))persist("kioskResetSeconds",String(value),()=>setSeconds(value));}
  };
}
