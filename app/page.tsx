"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { localDateKey } from "./v2/date";
import { isDue, REVIEW_INTERVALS, scheduleReview } from "./v2/scheduler";
import { isAppStateV2, loadState, saveState } from "./v2/storage";
import type { AppStateV2, Checkin, Drill, ListTheme, RecordItem, Records, VocabularyExtension } from "./v2/types";

type Word = { id: string; order: number; word: string; definition: string; phonetic?: string };
type VocabList = { number: number; title: string; words: Word[] };
type ViewMode = "home"|"learn"|"review"|"saved"|"plan"|"checkin"|"records";
type ActivityDay = { attempts:number; learned:number; reviews:number; correct:number; seconds:number };
const drillOrder:Drill[]=["recognize","recall","dictation"];
const planLabels=["认识与听音","四选一辨义","听音拼写"];

const intervals = REVIEW_INTERVALS;
const day = () => localDateKey();

function GlassCard({variant="light",className="",onClick,children}:{variant?:"light"|"dark";className?:string;onClick?:()=>void;children:React.ReactNode}) {
  const classes=`glass-card glass-card--${variant} ${className}`;
  return onClick?<button className={classes} onClick={onClick}>{children}</button>:<div className={classes}>{children}</div>;
}

function HighlightTarget({text,target}:{text:string;target:string}) {
  const index=text.toLowerCase().indexOf(target.toLowerCase());
  if(index<0)return text;
  return <>{text.slice(0,index)}<mark>{text.slice(index,index+target.length)}</mark>{text.slice(index+target.length)}</>;
}

export default function Home() {
  const [lists,setLists]=useState<VocabList[]>([]);
  const [themes,setThemes]=useState<ListTheme[]>([]);
  const [extensions,setExtensions]=useState<VocabularyExtension[]>([]);
  const [records,setRecords]=useState<Records>({});
  const [checkins,setCheckins]=useState<Checkin[]>([]);
  const [dailyPlans,setDailyPlans]=useState<Record<string,string[]>>({});
  const [hydrated,setHydrated]=useState(false);
  const [activity,setActivity]=useState<Record<string,ActivityDay>>({});
  const [calendarMonth,setCalendarMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1));
  const [selectedDate,setSelectedDate]=useState(day());
  const [activeList,setActiveList]=useState(1);
  const [index,setIndex]=useState(0);
  const [revealed,setRevealed]=useState(false);
  const [query,setQuery]=useState("");
  const [mode,setMode]=useState<ViewMode>("home");
  const [showLists,setShowLists]=useState(false);
  const [showData,setShowData]=useState(false);
  const [drill,setDrill]=useState<Drill>("recognize");
  const [answer,setAnswer]=useState("");
  const [examDate,setExamDate]=useState("");
  const [showPlan,setShowPlan]=useState(false);
  const [planIds,setPlanIds]=useState<string[]>([]);
  const [planRound,setPlanRound]=useState(0);
  const [choiceSelected,setChoiceSelected]=useState("");
  const [todayCheckin,setTodayCheckin]=useState<Checkin|null>(null);
  const [showExpansion,setShowExpansion]=useState(false);
  const [extraCount,setExtraCount]=useState(10);
  const [customExtraCount,setCustomExtraCount]=useState(15);
  const [isExtraSession,setIsExtraSession]=useState(false);
  const [completedGroupIds,setCompletedGroupIds]=useState<string[]>([]);
  const fileRef=useRef<HTMLInputElement>(null);
  const interactionStarted=useRef(Date.now());

  useEffect(()=>{
    Promise.all([
      fetch(`${import.meta.env.BASE_URL||'/'}vocab.json`).then(r=>r.json()),
      fetch(`${import.meta.env.BASE_URL||'/'}data/list-themes.v1.json`).then(r=>r.json()),
      fetch(`${import.meta.env.BASE_URL||'/'}data/vocab-expansions.demo.v1.json`).then(r=>r.json()),
    ]).then(([vocab,themeData,extensionData])=>{setLists(vocab);setThemes(themeData.lists||[]);setExtensions(extensionData.entries||[])});
    const state=loadState(localStorage);
    setRecords(state.records);setExamDate(state.settings.examDate);setCheckins(state.checkins);setDailyPlans(state.dailyPlans);setActivity((state.sessions.dailyActivity as Record<string,ActivityDay>)||{});
    setTodayCheckin(state.checkins.find(v=>v.date===day())||null);setHydrated(true);
  },[]);
  useEffect(()=>{
    if(!hydrated)return;
    const state:AppStateV2={schemaVersion:2,records,settings:{examDate},checkins,dailyPlans,sessions:{dailyActivity:activity},meta:{updatedAt:new Date().toISOString()}};
    saveState(localStorage,state);
  },[hydrated,records,examDate,checkins,dailyPlans,activity]);

  const allWords=useMemo(()=>lists.flatMap(l=>l.words.map(w=>({...w,list:l.number}))),[lists]);
  const activeTheme=themes.find(theme=>theme.list===activeList);
  const remaining=allWords.filter(w=>!records[w.id]).length;
  const daysLeft=examDate?Math.max(1,Math.ceil((new Date(`${examDate}T12:00:00`).getTime()-Date.now())/86_400_000)):0;
  const dailyTarget=examDate?Math.max(1,Math.ceil(remaining/daysLeft)):30;
  const todayDone=Object.values(records).filter(r=>r.completed===day()||(!r.completed&&r.last===day()&&!r.planNew)).length;
  useEffect(()=>{if(mode!=='plan'||!allWords.length||planIds.length)return;const date=day();const saved=dailyPlans[date];if(saved?.length){setPlanIds(saved);return}const dueWords=allWords.filter(w=>records[w.id]&&isDue(records[w.id].next));const fresh=allWords.filter(w=>!records[w.id]).slice(0,Math.max(0,dailyTarget-dueWords.length));const ids=[...dueWords,...fresh].map(w=>w.id);setPlanIds(ids);setDailyPlans(v=>({...v,[date]:ids}))},[mode,allWords.length,dailyTarget,dailyPlans,planIds.length,records]);
  const activeWords=useMemo(()=>{
    if(query.trim()){const q=query.toLowerCase(); return allWords.filter(w=>w.word.toLowerCase().includes(q)||w.definition.includes(query)).slice(0,120)}
    if(mode==='review') return allWords.filter(w=>records[w.id]&&isDue(records[w.id].next));
    if(mode==='saved') return allWords.filter(w=>records[w.id]?.saved);
    if(mode==='plan'){const step=drillOrder[planRound];return planIds.map(id=>allWords.find(w=>w.id===id)).filter((w):w is typeof allWords[number]=>!!w&&!records[w.id]?.passes?.[day()]?.includes(step))}
    return (lists.find(l=>l.number===activeList)?.words||[]).map(w=>({...w,list:activeList}));
  },[lists,allWords,activeList,mode,records,query,dailyTarget,planIds,planRound]);
  useEffect(()=>{setIndex(0);setRevealed(false);setAnswer("")},[activeList,mode,query,drill]);
  const current=activeWords[index%Math.max(activeWords.length,1)];
  const currentExtension=extensions.find(entry=>entry.wordId===current?.id);
  const currentPasses=current?(records[current.id]?.passes?.[day()]||[]):[];
  const activeDrill:Drill=mode==='plan'?drillOrder[planRound]:drill;
  const due=allWords.filter(w=>records[w.id]&&isDue(records[w.id].next)).length;
  const progress=allWords.length?Math.round(Object.keys(records).length/allWords.length*100):0;
  const mastered=Object.values(records).filter(record=>record.rating==='known').length;
  const masteryRate=Object.keys(records).length?Math.round(mastered/Object.keys(records).length*100):0;
  const monthLabel=`${calendarMonth.getFullYear()} 年 ${calendarMonth.getMonth()+1} 月`;
  const calendarCells=useMemo(()=>{const year=calendarMonth.getFullYear();const month=calendarMonth.getMonth();const first=(new Date(year,month,1).getDay()+6)%7;const count=new Date(year,month+1,0).getDate();return [...Array(first).fill(null),...Array.from({length:count},(_,i)=>localDateKey(new Date(year,month,i+1)))]},[calendarMonth]);
  const selectedActivity=activity[selectedDate]||{attempts:0,learned:0,reviews:0,correct:0,seconds:0};
  const selectedLegacyCount=Object.values(records).filter(record=>record.last===selectedDate).length;
  const selectedCheckin=checkins.find(entry=>entry.date===selectedDate);
  const choiceIsCnToEn=!!current&&current.order%2===0;
  const choiceOptions=useMemo(()=>{if(!current)return[];const pool=allWords.filter(w=>w.id!==current.id);const picked=[0,1,2].map(i=>pool[(current.order*37+i*193)%Math.max(pool.length,1)]).filter(Boolean);return [current,...picked].sort((a,b)=>((a.order*17)%11)-((b.order*17)%11)).map(w=>choiceIsCnToEn?w.word:w.definition)},[current,allWords,choiceIsCnToEn]);
  const planMastered=planIds.filter(id=>records[id]?.rating==='known').length;
  const planReinforce=Math.max(0,planIds.length-planMastered);
  const todayActivity=activity[day()]||{attempts:0,learned:0,reviews:0,correct:0,seconds:0};
  const todayAccuracy=todayActivity.attempts?Math.round(todayActivity.correct/todayActivity.attempts*100):0;

  useEffect(()=>{if(mode==='plan'&&planIds.length&&activeWords.length===0&&planRound<2){setPlanRound(r=>r+1);setIndex(0);setRevealed(false);setAnswer("");setChoiceSelected("")}},[mode,planIds.length,activeWords.length,planRound]);
  useEffect(()=>{if(mode==='plan'&&activeDrill==='recognize'&&current){const t=setTimeout(speak,180);return()=>clearTimeout(t)}},[mode,activeDrill,current?.id]);

  useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if((e.target as HTMLElement)?.tagName==='INPUT')return;if(e.code==='Space'){e.preventDefault();setRevealed(true)}if(e.key==='1')rate('again');if(e.key==='2')rate('hard');if(e.key==='3')rate('known')};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[current,activeWords.length,records,revealed]);

  function rate(rating:RecordItem['rating'],force=false){
    if(!current||(!revealed&&!force)) return;
    const old=records[current.id]; let stage=old?.stage||0;
    const elapsed=Math.max(1,Math.min(120,Math.round((Date.now()-interactionStarted.current)/1000)));
    setActivity(value=>{const date=day();const prior=value[date]||{attempts:0,learned:0,reviews:0,correct:0,seconds:0};return {...value,[date]:{attempts:prior.attempts+1,learned:prior.learned+(old?0:1),reviews:prior.reviews+(old?1:0),correct:prior.correct+(rating==='known'?1:0),seconds:prior.seconds+elapsed}}});interactionStarted.current=Date.now();
    if(mode==='plan'&&activeDrill==='recall'){
      const nextPasses=[...new Set([...currentPasses,activeDrill])];
      setRecords(v=>({...v,[current.id]:{...(v[current.id]||{}),stage,next:day(),last:day(),rating,planNew:true,passes:{...(v[current.id]?.passes||{}),[day()]:nextPasses}}}));
      setAnswer("");setChoiceSelected("");setRevealed(false);setShowExpansion(false);setIndex(0);return;
    }
    const scheduled=scheduleReview(old,rating);stage=scheduled.stage;const next=scheduled.next;
    const passes=mode==='plan'?[...new Set([...currentPasses,activeDrill])]:currentPasses;
    setRecords(v=>({...v,[current.id]:{...v[current.id],stage,next,last:day(),rating,planNew:false,completed:day(),passes:mode==='plan'?{...(v[current.id]?.passes||{}),[day()]:passes}:v[current.id]?.passes}}));
    setAnswer("");setChoiceSelected("");setRevealed(false);setShowExpansion(false); setIndex(mode==='plan'?0:i=>(i+1)%Math.max(activeWords.length,1));
  }
  function speak(){if(!current)return; speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(current.word);u.lang='en-GB';u.rate=.86;speechSynthesis.speak(u)}
  function checkAnswer(){if(!answer.trim())return;setRevealed(true)}
  function choosePlanOption(option:string,correct:boolean){if(revealed)return;setChoiceSelected(option);setRevealed(true);window.setTimeout(()=>rate(correct?'known':'hard',true),700)}
  function submitPlanSpelling(submitted=answer){if(!current||!submitted.trim()||revealed)return;setAnswer(submitted);const correct=submitted.trim().toLowerCase()===current.word.toLowerCase();setRevealed(true);window.setTimeout(()=>rate(correct?'known':'again',true),850)}
  function beginPlan(ids:string[],extra=false){if(!ids.length)return;setPlanIds(ids);setIsExtraSession(extra);setPlanRound(0);setIndex(0);setRevealed(false);setAnswer('');setChoiceSelected('');setMode('plan')}
  function continueWithCount(count:number){const requested=Math.max(1,Math.floor(count));const sameList=allWords.filter(w=>w.list===activeList&&!records[w.id]&&!planIds.includes(w.id));const following=allWords.filter(w=>w.list>activeList&&!records[w.id]&&!planIds.includes(w.id));const candidates=[...sameList,...following].slice(0,requested);if(!candidates.length){alert('当前词库没有未学单词，请选择其他 List。');setShowLists(true);return}if(candidates.length<requested)alert(`当前及后续 List 仅剩 ${candidates.length} 个未学单词，本轮将学习这些词。`);beginPlan(candidates.map(w=>w.id),true)}
  function startAnotherGroup(){continueWithCount(Math.max(1,planIds.length||dailyTarget))}
  function reinforceMistakes(){const source=completedGroupIds.length?completedGroupIds:planIds;const ids=source.filter(id=>records[id]&&records[id].rating!=='known');if(!ids.length){alert('本轮没有需要强化的错词。');return}beginPlan(ids,true)}
  function finishCheckin(){setCompletedGroupIds(planIds);if(isExtraSession&&todayCheckin){setMode('checkin');return}const entry:Checkin={date:day(),completed:planIds.length,mastered:planMastered,reinforce:planReinforce};setCheckins(history=>[...history.filter(v=>v.date!==entry.date),entry]);setTodayCheckin(entry);setIsExtraSession(false);setMode('checkin')}
  function openTodayPlan(){setMode(todayCheckin?'checkin':'plan')}
  function openView(view:ViewMode){setMode(view);setQuery('');setIndex(0);setRevealed(false);setShowExpansion(false)}
  function toggleSaved(){ if(!current)return; const old=records[current.id]||{stage:0,next:day(),last:day(),rating:'again' as const}; setRecords(v=>({...v,[current.id]:{...old,saved:!old.saved}})); }
  function chooseList(n:number){setActiveList(n);setMode('learn');setQuery('');setShowLists(false)}
  function openRelatedWord(wordId:string){const target=allWords.find(word=>word.id===wordId);if(!target)return;setActiveList(target.list);setMode('learn');setQuery('');setIndex(Math.max(0,target.order-1));setRevealed(true);setShowExpansion(false)}
  function exportData(){const snapshot:AppStateV2={schemaVersion:2,records,settings:{examDate},checkins,dailyPlans,sessions:{dailyActivity:activity},meta:{updatedAt:new Date().toISOString()}};const blob=new Blob([JSON.stringify(snapshot,null,2)],{type:'application/json'}); const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`词穹完整学习记录-${day()}.json`;a.click();URL.revokeObjectURL(a.href)}
  function importData(e:React.ChangeEvent<HTMLInputElement>){const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const value=JSON.parse(String(r.result));if(isAppStateV2(value)){setRecords(value.records);setExamDate(value.settings.examDate);setCheckins(value.checkins);setDailyPlans(value.dailyPlans);setActivity((value.sessions.dailyActivity as Record<string,ActivityDay>)||{})}else if(value&&typeof value==='object'){setRecords(value as Records)}else throw new Error();setShowData(false)}catch{alert('无法读取这份记录文件')}};r.readAsText(f)}

  return <main>
    <header className={`topbar ${mode==='home'?'home-topbar':''}`}>
      <button className="brand" onClick={()=>{setMode('home');setQuery('')}} aria-label="回到首页"><span>词穹</span><i>VOCABULARY</i></button>
      <nav>
        <button className={mode==='home'?'active':''} onClick={()=>openView('home')}>首页</button>
        <button className={mode==='learn'?'active':''} onClick={()=>openView('learn')}>词库学习</button>
        <button className={mode==='plan'||mode==='checkin'?'active':''} onClick={openTodayPlan}>今日计划 {todayCheckin&&<b className="checked">✓</b>}</button>
        <button className={mode==='review'?'active':''} onClick={()=>openView('review')}>今日复习 <b>{due}</b></button>
        <button className={mode==='records'?'active':''} onClick={()=>openView('records')}>学习记录</button>
      </nav>
      <button className="data-btn" onClick={()=>setShowData(true)}>记录 · {progress}%</button>
    </header>

    {mode==='home'&&<section className="immersive-home">
      <div className="home-shade"/>
      <div className="home-heading"><p>IELTS · 22 THEMES · 64 LISTS · 3,693 WORDS</p><h1>让每一个单词，<br/>都成为抵达远方的力量。</h1><span>从主题词汇到阅读语境，让记忆不止于背诵。</span></div>
      <div className="glass-bento" aria-label="今日学习面板">
        <GlassCard variant="dark" className="today-card" onClick={openTodayPlan}><small>今日学习</small><strong>{todayCheckin?'已完成':'开始三轮训练'}</strong><p>{todayCheckin?'今日打卡已经保存。':`${dailyTarget} 个词 · 认识、辨义、听写`}</p><span>{todayCheckin?'查看今日总结':'开始学习 →'}</span></GlassCard>
        <GlassCard className="calendar-card">
          <header><div><small>学习日历</small><strong>{monthLabel}</strong></div><div><button aria-label="上个月" onClick={()=>setCalendarMonth(new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()-1,1))}>‹</button><button aria-label="下个月" onClick={()=>setCalendarMonth(new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+1,1))}>›</button></div></header>
          <div className="calendar-week">{['一','二','三','四','五','六','日'].map(label=><span key={label}>{label}</span>)}</div>
          <div className="calendar-days">{calendarCells.map((date,index)=>date?<button key={date} className={`${date===day()?'today':''} ${selectedDate===date?'selected':''} ${checkins.some(item=>item.date===date)?'complete':''}`} onClick={()=>setSelectedDate(date)}><span>{Number(date.slice(-2))}</span>{(activity[date]?.attempts||Object.values(records).some(record=>record.last===date))&&<i/>}</button>:<i key={`blank-${index}`}/>)}</div>
          <footer><span>{selectedDate}</span><b>{selectedCheckin?'✓ 已完成':`${selectedActivity.attempts||selectedLegacyCount} 次学习 · ${Math.ceil(selectedActivity.seconds/60)} 分钟`}</b><button onClick={()=>openView('records')}>完整记录 →</button></footer>
        </GlassCard>
        <GlassCard variant="dark" className="review-card" onClick={()=>openView('review')}><small>今日复习</small><strong>{due}</strong><p>{due?'到期词汇等待复习':'今天暂时没有到期任务'}</p><span>{due?'进入任务 →':'查看复习页'}</span></GlassCard>
        <GlassCard className="theme-card" onClick={()=>{setActiveList(1);openView('learn')}}><small>正在学习的主题</small><strong>Chapter 01 · 自然地理</strong><p>Natural Geography · List 01–04</p><span>进入主题 →</span></GlassCard>
        <GlassCard className="overview-card"><small>学习概览</small><div><span><b>{progress}%</b>总进度</span><span><b>{checkins.length}</b>打卡天数</span><span><b>{masteryRate}%</b>掌握率</span></div></GlassCard>
        <GlassCard className="quick-card"><small>快捷入口</small><div><button onClick={()=>openView('saved')}>收藏 <b>{allWords.filter(word=>records[word.id]?.saved).length}</b></button><button onClick={()=>openView('review')}>错词 <b>{Object.values(records).filter(record=>record.rating==='again').length}</b></button><button onClick={()=>openView('records')}>记录 <b>→</b></button></div></GlassCard>
      </div>
    </section>}

    {mode==='checkin'&&<section className="checkin-page">
      <header><div className="checkin-mark" aria-label="今日目标已完成">✓</div><div><p className="eyebrow">DAILY CHECK-IN · {day()}</p><h1>今日目标已完成</h1><p>完成目标不代表今天必须停止，你可以按自己的节奏继续。</p></div></header>
      <div className="checkin-stats"><div><strong>{todayCheckin?.completed??planIds.length}</strong><span>目标学习词数</span></div><div><strong>{todayCheckin?.mastered??planMastered}</strong><span>目标内已掌握</span></div><div><strong>{todayCheckin?.reinforce??planReinforce}</strong><span>目标内待强化</span></div><div><strong>{todayAccuracy}%</strong><span>今日正确率</span></div><div><strong>{todayActivity.learned}</strong><span>今日累计新学</span></div><div><strong>{todayActivity.reviews}</strong><span>今日累计复习</span></div></div>
      <div className="checkin-confirmed"><span>✓</span> 每日目标 {todayCheckin?.completed??dailyTarget} 词已保存，额外学习会单独累计</div>
      <section className="continue-panel"><h2>还想继续学一会儿？</h2><p>选择额外学习数量，不会覆盖今天的打卡记录。</p><div className="extra-options">{[10,20,30].map(value=><button key={value} className={extraCount===value?'active':''} onClick={()=>setExtraCount(value)}>{value} 词</button>)}<label className={extraCount===-1?'active':''}><input type="radio" checked={extraCount===-1} onChange={()=>setExtraCount(-1)}/>自定义 <input type="number" min="1" max="100" value={customExtraCount} onFocus={()=>setExtraCount(-1)} onChange={event=>setCustomExtraCount(Math.max(1,Number(event.target.value)||1))}/></label></div><button className="continue-primary" onClick={()=>continueWithCount(extraCount===-1?customExtraCount:extraCount)}>继续学习 →</button><div className="checkin-links"><button onClick={()=>setShowLists(true)}>选择其他 List</button><button onClick={reinforceMistakes}>强化本轮错词</button><button onClick={()=>setMode('home')}>返回首页</button></div></section>
    </section>}

    {mode==='records'&&<section className="records-page">
      <header><div><p className="eyebrow">LEARNING HISTORY</p><h1>学习记录</h1><span>所有数据来自当前设备的真实学习行为。</span></div><button onClick={()=>setShowData(true)}>导入 / 导出</button></header>
      <div className="records-layout"><div className="records-calendar"><div className="records-month"><button onClick={()=>setCalendarMonth(new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()-1,1))}>‹</button><strong>{monthLabel}</strong><button onClick={()=>setCalendarMonth(new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+1,1))}>›</button></div><div className="calendar-week">{['一','二','三','四','五','六','日'].map(label=><span key={label}>{label}</span>)}</div><div className="calendar-days large">{calendarCells.map((date,index)=>date?<button key={date} className={`${date===day()?'today':''} ${selectedDate===date?'selected':''} ${checkins.some(item=>item.date===date)?'complete':''}`} onClick={()=>setSelectedDate(date)}><span>{Number(date.slice(-2))}</span>{(activity[date]?.attempts||Object.values(records).some(record=>record.last===date))&&<i/>}</button>:<i key={`blank-${index}`}/>)}</div></div><aside className="day-detail"><small>日期详情</small><h2>{selectedDate}</h2><div><span><b>{selectedActivity.attempts||selectedLegacyCount}</b>学习次数</span><span><b>{selectedActivity.reviews}</b>复习次数</span><span><b>{Math.ceil(selectedActivity.seconds/60)}</b>学习分钟</span><span><b>{selectedCheckin?'已完成':'未打卡'}</b>完成状态</span></div><p>{selectedActivity.attempts?`正确反馈 ${selectedActivity.correct} 次；新学 ${selectedActivity.learned} 个词。`:'这一天还没有可记录的学习操作。'}</p></aside></div>
    </section>}

    {mode!=='home'&&mode!=='checkin'&&mode!=='records'&&<section className={`workspace ${mode==='plan'?'plan-only':''}`}>
      {mode!=='plan'&&<aside>
        <label className="search"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索单词或释义"/></label>
        <button className="list-pick" onClick={()=>setShowLists(true)}><span><small>当前章节 · List {activeList}</small><b>{activeTheme?.themeZh||`List ${activeList}`}</b></span><i>选择 List →</i></button>
        <button className="plan-card" onClick={()=>setShowPlan(true)}><span><small>{examDate?'距离考试':'制定学习计划'}</small><b>{examDate?`${daysLeft} 天`:'设置考试日期'}</b></span><i>{examDate?`每天约 ${dailyTarget} 词`:'开始 →'}</i><em style={{width:`${Math.min(100,todayDone/dailyTarget*100)}%`}}/></button>
        <div className="curve">
          <p>复习节奏</p>
          <div>{intervals.slice(1).map((v,i)=><span key={v} className={(records[current?.id]?.stage||0)>i?'done':''}>{v}<small>天</small></span>)}</div>
          <small>每次“认识”都会带你走向下一个复习节点。</small>
        </div>
      </aside>}

      <div className="study-area">
        {mode==='plan'&&<div className="plan-flow"><div><small>今日训练</small><strong>第 {planRound+1} 轮 · {planLabels[planRound]}</strong></div><ol>{planLabels.map((label,i)=><li key={label} className={i<planRound?'done':i===planRound?'current':''}><i>{i<planRound?'✓':i+1}</i><span>{label}</span></li>)}</ol><p>{planRound===0?'看到单词时自动播放发音，点击卡片查看释义。':planRound===1?'英译中与中译英交替出现，从四个选项中选择。':'只听发音完成拼写，答题结果决定下次复习时间。'}</p></div>}
        {mode!=='plan'&&<div className="drill-tabs" aria-label="训练模式">
          <button className={activeDrill==='recognize'?'active':''} onClick={()=>setDrill('recognize')}><b>看词</b><small>辨认释义</small></button>
          <button className={activeDrill==='recall'?'active':''} onClick={()=>setDrill('recall')}><b>看义</b><small>回想单词</small></button>
          <button className={activeDrill==='dictation'?'active':''} onClick={()=>{setDrill('dictation');setTimeout(speak,80)}}><b>听音</b><small>拼写单词</small></button>
        </div>}
        <div className="study-head"><span>{query?'搜索结果':mode==='review'?'今日复习任务':mode==='saved'?'我的收藏':mode==='plan'?`第 ${planRound+1} 轮 · ${planLabels[planRound]}`:`CHAPTER ${String(activeTheme?.chapterNumbers[0]||1).padStart(2,'0')} · ${activeTheme?.themeZh||''} · LIST ${activeList}`}</span><span>{mode==='plan'?`本轮剩余 ${activeWords.length}`:activeWords.length?`${index+1} / ${activeWords.length}`:'0 / 0'}</span></div>
        {current ? <article key={`${current.id}-${activeDrill}`} className={`word-card ${revealed?'revealed expanded':''}`}>
          <button className={`save ${records[current.id]?.saved?'saved':''}`} onClick={e=>{e.stopPropagation();toggleSaved()}} aria-label="收藏单词">{records[current.id]?.saved?'★':'☆'}</button>
          <div className="number">{String(current.order).padStart(2,'0')} <span>· LIST {current.list}</span></div>
          {activeDrill==='recognize' ? <><h2>{current.word}</h2>{current.phonetic&&<p className="phonetic">{current.phonetic}</p>}<div className="word-primary-actions"><button className="sound" onClick={e=>{e.stopPropagation();speak()}}>↗ <span>{mode==='plan'?'再听一次':'听发音'}</span></button>{!revealed&&<button className="reveal" onClick={()=>setRevealed(true)}>查看释义 <span>SPACE</span></button>}</div><div className="definition"><small>释义</small><p>{current.definition||'释义待校对'}</p></div></> : activeDrill==='recall'&&mode==='plan'?<>
            <div className="prompt-label">{choiceIsCnToEn?'中译英 · 选择单词':'英译中 · 选择释义'}</div>
            <p className={`choice-prompt ${choiceIsCnToEn?'cn':''}`}>{choiceIsCnToEn?current.definition:current.word}</p>
            <div className="choice-grid" onClick={e=>e.stopPropagation()}>{choiceOptions.map((option,i)=>{const correct=option===(choiceIsCnToEn?current.word:current.definition);return <button key={`${option}-${i}`} className={revealed?(correct?'correct':choiceSelected===option?'wrong':''):''} disabled={revealed} onClick={()=>choosePlanOption(option,correct)}><i>{String.fromCharCode(65+i)}</i><span>{option}</span></button>})}</div>
          </> : <>
            <div className="prompt-label">{activeDrill==='dictation'?'听音拼写':'根据释义回想单词'}</div>
            {activeDrill==='dictation'?<button className="listen-orb" onClick={e=>{e.stopPropagation();speak()}} aria-label="播放发音">▶</button>:<p className="meaning-prompt">{current.definition||'释义待校对'}</p>}
            <form className="answer-box" onClick={e=>e.stopPropagation()} onSubmit={e=>{e.preventDefault();const submitted=(e.currentTarget.elements.namedItem('spelling') as HTMLInputElement)?.value||answer;mode==='plan'?submitPlanSpelling(submitted):checkAnswer()}}><input name="spelling" autoFocus={mode==='plan'} autoCapitalize="none" autoComplete="off" spellCheck={false} value={answer} onChange={e=>setAnswer(e.target.value)} onKeyDown={e=>{if(mode==='plan'&&e.key==='Enter'){e.preventDefault();submitPlanSpelling(e.currentTarget.value)}}} placeholder={mode==='plan'?'输入后按回车':'输入英文单词'}/>{mode!=='plan'&&<button type="submit">确认</button>}</form>
            {revealed&&<div className={`answer-result ${answer.trim().toLowerCase()===current.word.toLowerCase()?'correct':'incorrect'}`}><small>{answer.trim().toLowerCase()===current.word.toLowerCase()?'拼写正确':'拼写错误 · 正确答案'}</small>{answer.trim().toLowerCase()!==current.word.toLowerCase()&&<em>你的答案：{answer}</em>}<b>{current.word}</b>{current.phonetic&&<span>{current.phonetic}</span>}</div>}
          </>}
          {revealed&&currentExtension&&activeDrill==='recognize'&&<div className="extension-shell" onClick={event=>event.stopPropagation()}>
            <div className="extension-content">
              {currentExtension.memoryAid&&<section className="memory-card"><small>联想记忆</small><p>{currentExtension.memoryAid.noteZh}</p></section>}
              <section className="relation-card"><small>主题关联</small><div className="relation-chips">{currentExtension.relations.map(relation=><button key={`${relation.label}-${relation.type}`} disabled={relation.isExtension} onClick={()=>relation.targetWordId&&openRelatedWord(relation.targetWordId)}><span>{relation.label}</span><i>{relation.isExtension?'扩展词':'查看 →'}</i></button>)}</div></section>
              <section><small>高频搭配</small><div className="collocations">{currentExtension.collocations.map(item=><p key={item.text}><b>{item.text}</b><span>{item.translationZh}</span></p>)}</div></section>
              <section className="context-example"><small>原创雅思风格例句</small><p><HighlightTarget text={currentExtension.example.text} target={currentExtension.example.target}/></p><em>{currentExtension.example.translationZh}</em><div className="example-source">{currentExtension.example.copyrightStatus} · {currentExtension.provenance.reviewStatus} · {currentExtension.provenance.updatedAt}</div></section>
            </div>
          </div>}
        </article> : mode==='plan'&&planRound===2?<section className="plan-complete"><small>本组三轮已完成</small><h2>这一组，完成了。</h2><p>答错的词已经自动进入强化复习，不需要现在一次记牢。</p><div><span><strong>{planMastered}</strong> 已掌握</span><span><strong>{planReinforce}</strong> 需强化</span></div><h3>还要继续来一组吗？</h3><div className="plan-complete-actions"><button onClick={startAnotherGroup}>继续一组</button><button className="primary" onClick={finishCheckin}>完成并打卡</button></div></section>:<div className="empty"><b>{mode==='plan'?'正在进入下一轮':mode==='review'?'今天已经复习完成':'这里还没有单词'}</b><p>{mode==='plan'?'准备下一种训练方式。':mode==='review'?'去学几个新词，明天再回来。':'换一个 List 或搜索试试。'}</p></div>}
        {current&&activeDrill==='recognize'&&<div className={`ratings ${!revealed?'waiting':''}`}>
          <button disabled={!revealed} onClick={()=>rate('again')}><kbd>1</kbd><span>不认识<small>10 分钟后</small></span></button>
          <button disabled={!revealed} onClick={()=>rate('hard')}><kbd>2</kbd><span>模糊<small>明天复习</small></span></button>
          <button disabled={!revealed} className="primary" onClick={()=>rate('known')}><kbd>3</kbd><span>已掌握<small>{`约 ${intervals[Math.min(6,(records[current.id]?.stage||0)+1)]} 天后`}</small></span></button>
        </div>}
      </div>
    </section>}

    <footer><span>词穹 · 你的雅思词汇记忆空间</span><span>记录仅保存在当前浏览器 · 建议定期导出</span></footer>
    <nav className="mobile-nav" aria-label="移动端主导航">
      <button className={mode==='home'?'active':''} onClick={()=>openView('home')}><b>⌂</b><span>首页</span></button>
      <button className={mode==='learn'||mode==='saved'?'active':''} onClick={()=>openView('learn')}><b>文</b><span>词库</span></button>
      <button className={mode==='plan'||mode==='checkin'?'active':''} onClick={openTodayPlan}><b>{todayCheckin?'✓':'◉'}</b><span>计划</span></button>
      <button className={mode==='review'?'active':''} onClick={()=>openView('review')}><b>{due||'↻'}</b><span>复习</span></button>
    </nav>

    {showLists&&<div className="overlay" onClick={()=>setShowLists(false)}><section className="panel list-panel" onClick={e=>e.stopPropagation()}><div className="panel-head"><div><small>全部词库 · 22 个主题</small><h3>按原书主题选择 List</h3></div><button onClick={()=>setShowLists(false)}>×</button></div><div className="list-grid">{lists.map(l=>{const done=l.words.filter(w=>records[w.id]).length;const theme=themes.find(item=>item.list===l.number);return <button key={l.number} onClick={()=>chooseList(l.number)}><span>LIST {String(l.number).padStart(2,'0')} · {l.words.length} 词</span><b>{theme?.themeZh||'主题待核对'}</b><small>{theme?.themeEn||''}</small><i style={{width:`${l.words.length?done/l.words.length*100:0}%`}}/></button>})}</div></section></div>}
    {showData&&<div className="overlay" onClick={()=>setShowData(false)}><section className="panel data-panel" onClick={e=>e.stopPropagation()}><div className="panel-head"><div><small>学习记录</small><h3>把进度带在身边</h3></div><button onClick={()=>setShowData(false)}>×</button></div><p>学习记录只存在这台设备的浏览器中。你可以导出备份，再在另一台设备上导入。</p><div className="data-actions"><button className="primary-action" onClick={exportData}>导出记录</button><button onClick={()=>fileRef.current?.click()}>导入记录</button><input ref={fileRef} type="file" accept="application/json" hidden onChange={importData}/></div></section></div>}
    {showPlan&&<div className="overlay" onClick={()=>setShowPlan(false)}><section className="panel plan-panel" onClick={e=>e.stopPropagation()}><div className="panel-head"><div><small>学习计划</small><h3>把目标变成今天的一小步</h3></div><button onClick={()=>setShowPlan(false)}>×</button></div><label><span>IELTS 考试日期</span><input type="date" min={day()} value={examDate} onChange={e=>setExamDate(e.target.value)}/></label><div className="plan-summary"><div><strong>{remaining.toLocaleString()}</strong><small>剩余单词</small></div><div><strong>{examDate?daysLeft:'—'}</strong><small>可用天数</small></div><div><strong>{examDate?dailyTarget:'—'}</strong><small>每日新词</small></div></div><p>今日计划会优先安排到期复习，再用新词补足每日目标。计划与学习记录一样，只保存在当前浏览器。</p><button className="save-plan" disabled={!examDate} onClick={()=>{localStorage.setItem('ielts-exam-date',examDate);setMode('plan');setShowPlan(false)}}>保存并开始今日计划</button></section></div>}
  </main>
}
