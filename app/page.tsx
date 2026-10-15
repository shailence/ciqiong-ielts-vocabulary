"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Word = { id: string; order: number; word: string; definition: string; phonetic?: string };
type VocabList = { number: number; title: string; words: Word[] };
type RecordItem = { stage: number; next: string; last: string; rating: "again"|"hard"|"known"; saved?: boolean; planNew?: boolean; passes?: Record<string,string[]>; completed?: string };
type Records = Record<string, RecordItem>;
type Drill = "recognize"|"recall"|"dictation";
const drillOrder:Drill[]=["recognize","recall","dictation"];

const intervals = [0, 1, 3, 7, 15, 30, 60];
const day = () => new Date().toISOString().slice(0, 10);
const addDays = (n: number) => { const d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); };
const addMinutes = (n:number) => new Date(Date.now()+n*60_000).toISOString();
const isDue = (next:string) => next.length===10 ? next<=day() : new Date(next).getTime()<=Date.now();

export default function Home() {
  const [lists,setLists]=useState<VocabList[]>([]);
  const [records,setRecords]=useState<Records>({});
  const [activeList,setActiveList]=useState(1);
  const [index,setIndex]=useState(0);
  const [revealed,setRevealed]=useState(false);
  const [query,setQuery]=useState("");
  const [mode,setMode]=useState<"learn"|"review"|"saved"|"plan">("learn");
  const [showLists,setShowLists]=useState(false);
  const [showData,setShowData]=useState(false);
  const [drill,setDrill]=useState<Drill>("recognize");
  const [answer,setAnswer]=useState("");
  const [examDate,setExamDate]=useState("");
  const [showPlan,setShowPlan]=useState(false);
  const fileRef=useRef<HTMLInputElement>(null);

  useEffect(()=>{ fetch(`${import.meta.env.BASE_URL||'/'}vocab.json`).then(r=>r.json()).then(setLists); const raw=localStorage.getItem('ielts-vocab-records'); if(raw) try{setRecords(JSON.parse(raw))}catch{};setExamDate(localStorage.getItem('ielts-exam-date')||'') },[]);
  useEffect(()=>{ if(Object.keys(records).length) localStorage.setItem('ielts-vocab-records',JSON.stringify(records)); },[records]);

  const allWords=useMemo(()=>lists.flatMap(l=>l.words.map(w=>({...w,list:l.number}))),[lists]);
  const remaining=allWords.filter(w=>!records[w.id]).length;
  const daysLeft=examDate?Math.max(1,Math.ceil((new Date(`${examDate}T12:00:00`).getTime()-Date.now())/86_400_000)):0;
  const dailyTarget=examDate?Math.max(1,Math.ceil(remaining/daysLeft)):30;
  const todayDone=Object.values(records).filter(r=>r.completed===day()||(!r.completed&&r.last===day()&&!r.planNew)).length;
  const activeWords=useMemo(()=>{
    if(query.trim()){const q=query.toLowerCase(); return allWords.filter(w=>w.word.toLowerCase().includes(q)||w.definition.includes(query)).slice(0,120)}
    if(mode==='review') return allWords.filter(w=>records[w.id]&&isDue(records[w.id].next));
    if(mode==='saved') return allWords.filter(w=>records[w.id]?.saved);
    if(mode==='plan'){const dueWords=allWords.filter(w=>records[w.id]&&isDue(records[w.id].next));const fresh=allWords.filter(w=>!records[w.id]).slice(0,Math.max(0,dailyTarget-dueWords.length));return [...dueWords,...fresh]}
    return (lists.find(l=>l.number===activeList)?.words||[]).map(w=>({...w,list:activeList}));
  },[lists,allWords,activeList,mode,records,query,dailyTarget]);
  useEffect(()=>{setIndex(0);setRevealed(false);setAnswer("")},[activeList,mode,query,drill]);
  const current=activeWords[index%Math.max(activeWords.length,1)];
  const currentPasses=current?(records[current.id]?.passes?.[day()]||[]):[];
  const guidedNew=!!current&&mode==='plan'&&(!records[current.id]||records[current.id]?.planNew===true);
  const planStep=Math.min(currentPasses.length,2);
  const activeDrill:Drill=guidedNew?drillOrder[planStep]:drill;
  const learned=Object.values(records).filter(r=>r.rating==='known').length;
  const due=allWords.filter(w=>records[w.id]&&isDue(records[w.id].next)).length;
  const progress=allWords.length?Math.round(Object.keys(records).length/allWords.length*100):0;

  useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if((e.target as HTMLElement)?.tagName==='INPUT')return;if(e.code==='Space'){e.preventDefault();setRevealed(true)}if(e.key==='1')rate('again');if(e.key==='2')rate('hard');if(e.key==='3')rate('known')};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[current,activeWords.length,records,revealed]);

  function rate(rating:RecordItem['rating']){
    if(!current||!revealed) return;
    const old=records[current.id]; let stage=old?.stage||0;
    if(guidedNew&&activeDrill!=='dictation'){
      const nextPasses=[...new Set([...currentPasses,activeDrill])];
      setRecords(v=>({...v,[current.id]:{...(v[current.id]||{}),stage,next:day(),last:day(),rating,planNew:true,passes:{...(v[current.id]?.passes||{}),[day()]:nextPasses}}}));
      setAnswer("");setRevealed(false);return;
    }
    let next:string;
    if(rating==='again'){stage=0;next=addMinutes(10)}
    else if(rating==='hard'){stage=Math.max(1,stage);next=addDays(1)}
    else {stage=Math.min(6,stage+1);next=addDays(intervals[stage])}
    const passes=guidedNew?[...new Set([...currentPasses,activeDrill])]:currentPasses;
    setRecords(v=>({...v,[current.id]:{...v[current.id],stage,next,last:day(),rating,planNew:false,completed:day(),passes:guidedNew?{...(v[current.id]?.passes||{}),[day()]:passes}:v[current.id]?.passes}}));
    setAnswer("");setRevealed(false); setIndex(i=>(i+1)%Math.max(activeWords.length,1));
  }
  function speak(){if(!current)return; speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(current.word);u.lang='en-GB';u.rate=.86;speechSynthesis.speak(u)}
  function checkAnswer(){if(!answer.trim())return;setRevealed(true)}
  function toggleSaved(){ if(!current)return; const old=records[current.id]||{stage:0,next:day(),last:day(),rating:'again' as const}; setRecords(v=>({...v,[current.id]:{...old,saved:!old.saved}})); }
  function chooseList(n:number){setActiveList(n);setMode('learn');setQuery('');setShowLists(false)}
  function exportData(){const blob=new Blob([JSON.stringify(records,null,2)],{type:'application/json'}); const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`词穹学习记录-${day()}.json`;a.click();URL.revokeObjectURL(a.href)}
  function importData(e:React.ChangeEvent<HTMLInputElement>){const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{setRecords(JSON.parse(String(r.result)));setShowData(false)}catch{alert('无法读取这份记录文件')}};r.readAsText(f)}

  return <main>
    <header className="topbar">
      <button className="brand" onClick={()=>{setMode('learn');setQuery('')}} aria-label="回到学习首页"><span>词穹</span><i>VOCABULARY</i></button>
      <nav>
        <button className={mode==='learn'?'active':''} onClick={()=>setMode('learn')}>学习</button>
        <button className={mode==='plan'?'active':''} onClick={()=>setMode('plan')}>今日计划</button>
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
        <div><strong>{todayDone}<small>/ {dailyTarget}</small></strong><span>今日学习目标</span></div>
      </div>
    </section>

    <section className="workspace">
      <aside>
        <label className="search"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索单词或释义"/></label>
        <button className="list-pick" onClick={()=>setShowLists(true)}><span><small>当前章节</small><b>List {activeList}</b></span><i>选择 List →</i></button>
        <button className="plan-card" onClick={()=>setShowPlan(true)}><span><small>{examDate?'距离考试':'制定学习计划'}</small><b>{examDate?`${daysLeft} 天`:'设置考试日期'}</b></span><i>{examDate?`每天约 ${dailyTarget} 词`:'开始 →'}</i><em style={{width:`${Math.min(100,todayDone/dailyTarget*100)}%`}}/></button>
        <div className="curve">
          <p>复习节奏</p>
          <div>{intervals.slice(1).map((v,i)=><span key={v} className={(records[current?.id]?.stage||0)>i?'done':''}>{v}<small>天</small></span>)}</div>
          <small>每次“认识”都会带你走向下一个复习节点。</small>
        </div>
      </aside>

      <div className="study-area">
        {mode==='plan'&&<div className="plan-flow"><div><small>今日完成规则</small><strong>{guidedNew?'新词三步闭环':'复习词针对训练'}</strong></div><ol>{drillOrder.map((d,i)=><li key={d} className={guidedNew?(i<planStep?'done':i===planStep?'current':''):''}><i>{i<planStep?'✓':i+1}</i><span>{d==='recognize'?'看词辨义':d==='recall'?'看义回想':'听音拼写'}</span></li>)}</ol><p>{guidedNew?'完成三步后，这个词才计入今日进度。':'复习词完成当前训练即可，不必机械重复三遍。'}</p></div>}
        <div className="drill-tabs" aria-label="训练模式">
          <button disabled={guidedNew} className={activeDrill==='recognize'?'active':''} onClick={()=>setDrill('recognize')}><b>看词</b><small>辨认释义</small></button>
          <button disabled={guidedNew} className={activeDrill==='recall'?'active':''} onClick={()=>setDrill('recall')}><b>看义</b><small>回想单词</small></button>
          <button disabled={guidedNew} className={activeDrill==='dictation'?'active':''} onClick={()=>{setDrill('dictation');setTimeout(speak,80)}}><b>听音</b><small>拼写单词</small></button>
        </div>
        <div className="study-head"><span>{query?'搜索结果':mode==='review'?'今日复习':mode==='saved'?'我的收藏':mode==='plan'?'今日计划':`LIST ${activeList}`}</span><span>{activeWords.length?`${index+1} / ${activeWords.length}`:'0 / 0'}</span></div>
        {current ? <article key={`${current.id}-${activeDrill}`} className={`word-card ${revealed?'revealed':''}`} onClick={()=>activeDrill==='recognize'&&setRevealed(true)}>
          <button className={`save ${records[current.id]?.saved?'saved':''}`} onClick={e=>{e.stopPropagation();toggleSaved()}} aria-label="收藏单词">{records[current.id]?.saved?'★':'☆'}</button>
          <div className="number">{String(current.order).padStart(2,'0')} <span>· LIST {current.list}</span></div>
          {activeDrill==='recognize' ? <><h2>{current.word}</h2>{current.phonetic&&<p className="phonetic">{current.phonetic}</p>}<button className="sound" onClick={e=>{e.stopPropagation();speak()}}>↗ <span>听发音</span></button><div className="definition"><small>释义</small><p>{current.definition||'释义待校对'}</p></div></> : <>
            <div className="prompt-label">{activeDrill==='dictation'?'听音拼写':'根据释义回想单词'}</div>
            {activeDrill==='dictation'?<button className="listen-orb" onClick={e=>{e.stopPropagation();speak()}} aria-label="播放发音">▶</button>:<p className="meaning-prompt">{current.definition||'释义待校对'}</p>}
            <form className="answer-box" onClick={e=>e.stopPropagation()} onSubmit={e=>{e.preventDefault();checkAnswer()}}><input autoCapitalize="none" autoComplete="off" spellCheck={false} value={answer} onChange={e=>setAnswer(e.target.value)} placeholder="输入英文单词"/><button>确认</button></form>
            {revealed&&<div className={`answer-result ${answer.trim().toLowerCase()===current.word.toLowerCase()?'correct':''}`}><small>{answer.trim().toLowerCase()===current.word.toLowerCase()?'拼写正确':'正确答案'}</small><b>{current.word}</b>{current.phonetic&&<span>{current.phonetic}</span>}</div>}
          </>}
          {!revealed&&activeDrill==='recognize'&&<div className="reveal">点击查看释义 <span>SPACE</span></div>}
        </article> : <div className="empty"><b>{mode==='review'?'今天已经复习完成':'这里还没有单词'}</b><p>{mode==='review'?'去学几个新词，明天再回来。':'换一个 List 或搜索试试。'}</p></div>}
        {current&&<div className={`ratings ${!revealed?'waiting':''}`}>
          <button disabled={!revealed} onClick={()=>rate('again')}><kbd>1</kbd><span>生疏<small>10 分钟后</small></span></button>
          <button disabled={!revealed} onClick={()=>rate('hard')}><kbd>2</kbd><span>模糊<small>明天复习</small></span></button>
          <button disabled={!revealed} className="primary" onClick={()=>rate('known')}><kbd>3</kbd><span>认识<small>{`约 ${intervals[Math.min(6,(records[current.id]?.stage||0)+1)]} 天后`}</small></span></button>
        </div>}
      </div>
    </section>

    <footer><span>词穹 · 你的雅思词汇记忆空间</span><span>记录仅保存在当前浏览器 · 建议定期导出</span></footer>

    {showLists&&<div className="overlay" onClick={()=>setShowLists(false)}><section className="panel list-panel" onClick={e=>e.stopPropagation()}><div className="panel-head"><div><small>全部词库</small><h3>选择一个 List</h3></div><button onClick={()=>setShowLists(false)}>×</button></div><div className="list-grid">{lists.map(l=>{const done=l.words.filter(w=>records[w.id]).length;return <button key={l.number} onClick={()=>chooseList(l.number)}><span>LIST {String(l.number).padStart(2,'0')}</span><b>{l.words.length} 词</b><i style={{width:`${l.words.length?done/l.words.length*100:0}%`}}/></button>})}</div></section></div>}
    {showData&&<div className="overlay" onClick={()=>setShowData(false)}><section className="panel data-panel" onClick={e=>e.stopPropagation()}><div className="panel-head"><div><small>学习记录</small><h3>把进度带在身边</h3></div><button onClick={()=>setShowData(false)}>×</button></div><p>学习记录只存在这台设备的浏览器中。你可以导出备份，再在另一台设备上导入。</p><div className="data-actions"><button className="primary-action" onClick={exportData}>导出记录</button><button onClick={()=>fileRef.current?.click()}>导入记录</button><input ref={fileRef} type="file" accept="application/json" hidden onChange={importData}/></div></section></div>}
    {showPlan&&<div className="overlay" onClick={()=>setShowPlan(false)}><section className="panel plan-panel" onClick={e=>e.stopPropagation()}><div className="panel-head"><div><small>学习计划</small><h3>把目标变成今天的一小步</h3></div><button onClick={()=>setShowPlan(false)}>×</button></div><label><span>IELTS 考试日期</span><input type="date" min={day()} value={examDate} onChange={e=>setExamDate(e.target.value)}/></label><div className="plan-summary"><div><strong>{remaining.toLocaleString()}</strong><small>剩余单词</small></div><div><strong>{examDate?daysLeft:'—'}</strong><small>可用天数</small></div><div><strong>{examDate?dailyTarget:'—'}</strong><small>每日新词</small></div></div><p>今日计划会优先安排到期复习，再用新词补足每日目标。计划与学习记录一样，只保存在当前浏览器。</p><button className="save-plan" disabled={!examDate} onClick={()=>{localStorage.setItem('ielts-exam-date',examDate);setMode('plan');setShowPlan(false)}}>保存并开始今日计划</button></section></div>}
  </main>
}
