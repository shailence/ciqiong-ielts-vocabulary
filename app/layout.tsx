import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata():Promise<Metadata>{
  const h=await headers();
  const host=h.get('x-forwarded-host')||h.get('host')||'localhost:3002';
  const protocol=h.get('x-forwarded-proto')||(host.startsWith('localhost')?'http':'https');
  const image=`${protocol}://${host}/og.png`;
  return {
    title:"词穹 · 雅思词汇记忆空间",
    description:"按照艾宾浩斯记忆节奏学习与复习雅思词汇，64 个 List，进度本地保存。",
    icons:{icon:"/favicon.svg",shortcut:"/favicon.svg"},
    openGraph:{title:"词穹 · 雅思词汇记忆空间",description:"让每一个词，在恰好的时间重逢。",images:[image],type:"website"},
    twitter:{card:"summary_large_image",title:"词穹 · 雅思词汇记忆空间",description:"让每一个词，在恰好的时间重逢。",images:[image]},
  }
}

export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
