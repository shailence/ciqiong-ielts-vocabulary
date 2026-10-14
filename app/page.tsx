"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Word = { id: string; order: number; word: string; definition: string };
type VocabList = { number: number; title: string; words: Word[] };
type RecordItem = { stage: number; next: string; last: string; rating: "again"|"hard"|"known"; saved?: boolean };
type Records = Record<string, RecordItem>;

const intervals = [0, 1, 2, 4, 7, 15, 30];
const day = () => new Date().toISOString().slice(0, 10);
const addDays = (n: number) => { const d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); };

export default function Home() {
  const [lists,setLists]=useState<VocabList[]>([]);
  const [records,setRecords]=useState<Records>({});
  const [activeList,setActiveList]=useState(1);
  const [index,setIndex]=useState(0);
  const [revealed,setRevealed]=useState(false);
  const [query,setQuery]=useState("");
  const [mode,setMode]=useState<"learn"|"review"|"saved">("learn");
  const [showLists,setShowLists]=useState(false);
  const [showData,setShowData]=useState(false);
  const fileRef=useRef<HTMLInputElement>(null);

  useEffect(()=>{ fetch('/vocab.json').then(r=>r.json()).then(setLists); const raw=localStorage.getItem('ielts-vocab-records'); if(raw) try{setRecords(JSON.parse(raw))}catch{} },[]);
  useEffect(()=>{ if(Object.keys(records).length) localStorage.setItem('ielts-vocab-records',JSON.stringify(records)); },[records]);

  const allWords=useMemo(()=>lists.flatMap(l=>l.words.map(w=>({...w,list:l.number}))),[lists]);
  const activeWords=useMemo(()=>{
    if(query.trim()){const q=query.toLowerCase(); return allWords.filter(w=>w.word.toLowerCase().includes(q)||w.definition.includes(query)).slice(0,120)}
    if(mode==='review') return allWords.filter(w=>records[w.id]&&records[w.id].next<=day());
    if(mode==='saved') return allWords.filter(w=>records[w.id]?.saved);
    return (lists.find(l=>l.number===activeList)?.words||[]).map(w=>({...w,list:activeList}));
  },[lists,allWords,activeList,mode,records,query]);
  useEffect(()=>{setIndex(0);setRevealed(false)},[activeList,mode,query]);
  const current=activeWords[index%Math.max(activeWords.length,1)];
  const learned=Object.values(records).filter(r=>r.rating==='known').length;
  const due=allWords.filter(w=>records[w.id]&&records[w.id].next<=day()).length;
  const progress=allWords.length?Math.round(Object.keys(records).length/allWords.length*100):0;

  useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if((e.target as HTMLElement)?.tagName==='INPUT')return;if(e.code==='Space'){e.preventDefault();setRevealed(true)}if(e.key==='1')rate('again');if(e.key==='2')rate('hard');if(e.key==='3')rate('known')};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[current,activeWords.length,records]);

  function rate(rating:RecordItem['rating']){
    if(!current) return;
    const old=records[current.id]; let stage=old?.stage||0;
    if(rating==='again') stage=0; else if(rating==='hard') stage=Math.max(1,stage); else stage=Math.min(6,stage+1);
    setRecords(v=>({...v,[current.id]:{...v[current.id],stage,next:addDays(intervals[stage]),last:day(),rating}}));
    setRevealed(false); setIndex(i=>(i+1)%Math.max(activeWords.length,1));
  }
  function toggleSaved(){ if(!current)return; const old=records[current.id]||{stage:0,next:day(),last:day(),rating:'again' as const}; setRecords(v=>({...v,[current.id]:{...old,saved:!old.saved}})); }
  function chooseList(n:number){setActiveList(n);setMode('learn');setQuery('');setShowLists(false)}
  function exportData(){const blob=new Blob([JSON.stringify(records,null,2)],{type:'application/json'}); const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`词穹学习记录-${day()}.json`;a.click();URL.revokeObjectURL(a.href)}
  function importData(e:React.ChangeEvent<HTMLInputElement>){const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{setRecords(JSON.parse(String(r.result)));setShowData(false)}catch{alert('无法读取这份记录文件')}};r.readAsText(f)}

  return <main>
    <header className="topbar">
      <button className="brand" onClick={()=>{setMode('learn');setQuery('')}} aria-label="回到学习首页"><span>词穹</span><i>VOCABULARY</i></button>
      <nav>
        <button className={mode==='learn'?'active':''} onClick={()=>setMode('learn')}>学习</button>
        <button className={mode==='review'?'active':''} onClick={()=>setMode('review')}>今日复习 <b>{due}</b></button>
        <button className={mode==='saved'?'active':''} onClick={()=>setMode('saved')}>收藏</button>
      </nav>
      <button className="data-btn" onClick={()=>setShowData(true)}>记录 · {progress}%</button>
    </header>

    <section className="hero">
      <div className="hero-copy">
        <p className="eyebrow">IELTS · 64 LISTS · {allWords.length.toLocaleString()} WORDS</p>
        <h1>让每一个词，<br/><em>在恰好的时间重逢。</em></h1>
        <p className="intro">依据艾宾浩斯记忆节奏安排复习。无需登录，进度安静地保存在你的浏览器里。</p>
      </div>
      <div className="stats">
        <div><strong>{due}</strong><span>今日待复习</span></div>
        <div><strong>{learned}</strong><span>已经掌握</span></div>
        <div><strong>{progress}%</strong><span>总进度</span></div>
      </div>
    </section>

    <section className="workspace">
      <aside>
        <label className="search"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索单词或释义"/></label>
        <button className="list-pick" onClick={()=>setShowLists(true)}><span><small>当前章节</small><b>List {activeList}</b></span><i>选择 List →</i></button>
        <div className="curve">
          <p>复习节奏</p>
          <div>{intervals.slice(1).map((v,i)=><span key={v} className={(records[current?.id]?.stage||0)>i?'done':''}>{v}<small>天</small></span>)}</div>
          <small>每次“认识”都会带你走向下一个复习节点。</small>
        </div>
      </aside>

      <div className="study-area">
        <div className="study-head"><span>{query?'搜索结果':mode==='review'?'今日复习':mode==='saved'?'我的收藏':`LIST ${activeList}`}</span><span>{activeWords.length?`${index+1} / ${activeWords.length}`:'0 / 0'}</span></div>
        {current ? <article className={`word-card ${revealed?'revealed':''}`} onClick={()=>setRevealed(true)}>
          <button className={`save ${records[current.id]?.saved?'saved':''}`} onClick={e=>{e.stopPropagation();toggleSaved()}} aria-label="收藏单词">{records[current.id]?.saved?'★':'☆'}</button>
          <div className="number">{String(current.order).padStart(2,'0')} <span>· LIST {current.list}</span></div>
          <h2>{current.word}</h2>
          <button className="sound" onClick={e=>{e.stopPropagation();speechSynthesis.speak(new SpeechSynthesisUtterance(current.word))}}>↗ <span>听发音</span></button>
          <div className="definition"><small>释义</small><p>{current.definition||'释义待校对'}</p></div>
          {!revealed&&<div className="reveal">点击查看释义 <span>SPACE</span></div>}
        </article> : <div className="empty"><b>{mode==='review'?'今天已经复习完成':'这里还没有单词'}</b><p>{mode==='review'?'去学几个新词，明天再回来。':'换一个 List 或搜索试试。'}</p></div>}
        {current&&<div className="ratings">
          <button onClick={()=>rate('again')}><kbd>1</kbd><span>生疏<small>稍后再见</small></span></button>
          <button onClick={()=>rate('hard')}><kbd>2</kbd><span>模糊<small>明天复习</small></span></button>
          <button className="primary" onClick={()=>rate('known')}><kbd>3</kbd><span>认识<small>进入下一节点</small></span></button>
        </div>}
      </div>
    </section>

    <footer><span>词穹 · 你的雅思词汇记忆空间</span><span>记录仅保存在当前浏览器 · 建议定期导出</span></footer>

    {showLists&&<div className="overlay" onClick={()=>setShowLists(false)}><section className="panel list-panel" onClick={e=>e.stopPropagation()}><div className="panel-head"><div><small>全部词库</small><h3>选择一个 List</h3></div><button onClick={()=>setShowLists(false)}>×</button></div><div className="list-grid">{lists.map(l=>{const done=l.words.filter(w=>records[w.id]).length;return <button key={l.number} onClick={()=>chooseList(l.number)}><span>LIST {String(l.number).padStart(2,'0')}</span><b>{l.words.length} 词</b><i style={{width:`${l.words.length?done/l.words.length*100:0}%`}}/></button>})}</div></section></div>}
    {showData&&<div className="overlay" onClick={()=>setShowData(false)}><section className="panel data-panel" onClick={e=>e.stopPropagation()}><div className="panel-head"><div><small>学习记录</small><h3>把进度带在身边</h3></div><button onClick={()=>setShowData(false)}>×</button></div><p>学习记录只存在这台设备的浏览器中。你可以导出备份，再在另一台设备上导入。</p><div className="data-actions"><button className="primary-action" onClick={exportData}>导出记录</button><button onClick={()=>fileRef.current?.click()}>导入记录</button><input ref={fileRef} type="file" accept="application/json" hidden onChange={importData}/></div></section></div>}
  </main>
}
