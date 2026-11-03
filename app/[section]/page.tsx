export const dynamic = "force-dynamic";
import {notFound} from "next/navigation";
export default async function Page({params}:{params:Promise<{section:string}>}){const {section}=await params;if(!["dashboard","tasks","notes","finances","settings"].includes(section))notFound();return null;}
