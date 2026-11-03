import type { Metadata, Viewport } from "next";
import "./globals.css";
import "@fontsource-variable/inter/index.css";
import "@fontsource-variable/montserrat/index.css";
import "@fontsource-variable/manrope/index.css";
import "@fontsource-variable/plus-jakarta-sans/index.css";
import PWARegister from "@/components/pwa-register";
import LifeHubShell from "@/components/lifehub-shell";
export const metadata: Metadata = {title:"LifeHub — личное пространство",description:"Задачи, заметки и финансы в одном месте",applicationName:"LifeHub",manifest:"/manifest.webmanifest",icons:{icon:[{url:"/icon.svg",type:"image/svg+xml"},{url:"/icon-192.png",sizes:"192x192",type:"image/png"}],apple:[{url:"/apple-touch-icon.png",sizes:"180x180",type:"image/png"}]},appleWebApp:{capable:true,title:"LifeHub",statusBarStyle:"default"}};
export const viewport: Viewport = {width:"device-width",initialScale:1,viewportFit:"cover",themeColor:[{media:"(prefers-color-scheme: light)",color:"#f5f5f7"},{media:"(prefers-color-scheme: dark)",color:"#0b0b0d"}]};
const themeScript = `(function(){var root=document.documentElement;var dark=matchMedia('(prefers-color-scheme: dark)').matches;try{var t=localStorage.getItem('lifehub-theme');root.dataset.theme=t==='light'||t==='dark'||t==='warm'?t:dark?'dark':'light';var choices={accent:['blue','green','violet','graphite'],density:['comfortable','compact','spacious'],font:['system','inter','montserrat','manrope','plus-jakarta-sans','georgia']};for(var p in choices){var v=localStorage.getItem('lifehub-'+p);root.dataset[p]=choices[p].includes(v)?v:choices[p][0]}}catch(e){root.dataset.theme=dark?'dark':'light'}})()`;
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ru" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:themeScript}}/></head><body><PWARegister/><LifeHubShell>{children}</LifeHubShell></body></html>}
