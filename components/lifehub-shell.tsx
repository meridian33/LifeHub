"use client";
import {usePathname} from "next/navigation";
import {useEffect, useState, type ReactNode} from "react";
import LifeHub from "./lifehub";

// Keep the session and loaded workspace mounted across section transitions.
export default function LifeHubShell({children}:{children:ReactNode}) {
  const initialPathname=usePathname();
  const [pathname,setPathname]=useState(initialPathname);
  useEffect(()=>{
    const syncPathname=()=>setPathname(window.location.pathname);
    window.addEventListener("popstate",syncPathname);
    window.addEventListener("lifehub:navigate",syncPathname);
    return()=>{
      window.removeEventListener("popstate",syncPathname);
      window.removeEventListener("lifehub:navigate",syncPathname);
    };
  },[]);
  const section=pathname==="/"?"dashboard":pathname.slice(1);
  return ["dashboard","tasks","notes","finances","calendar","wishlist","settings"].includes(section)
    ? <LifeHub section={section}/> : children;
}
