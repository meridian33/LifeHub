"use client";
import {useEffect} from "react";
export default function PWARegister() {
  useEffect(()=>{
    if(process.env.NODE_ENV!=="production"||!("serviceWorker" in navigator))return;
    void navigator.serviceWorker.register("/sw.js",{scope:"/"}).catch(()=>{ /* App remains usable without install support. */ });
  },[]);
  return null;
}
