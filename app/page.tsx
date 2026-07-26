"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Tool = {
  id: string; name: string; shortName: string; description: string;
  category: "급여·수당" | "회계·정산" | "물품·명단";
  href: string; mark: string; tone: string; features: string[]; storageKeys: string[]; download?: boolean;
};
type TaskStatus = "planned" | "doing" | "done" | "delayed";
type WorkMode = "temporary" | "routine";
type RoutineKind = "daily" | "weekly" | "monthly";
type Task = {
  id: string; field: string; title: string; type: string; mode: WorkMode;
  routineKind?: RoutineKind; routineValue?: string; startDate: string; deadline: string;
  status: TaskStatus; memo: string; createdAt: string; completedAt?: string;
};
type NotebookData = { fields: string[]; customTypes: string[]; tasks: Task[] };
type HolidayInfo = { name:string; substitute?:boolean };

const holidayCache = new Map<number,Map<string,HolidayInfo>>();
function shiftISO(iso:string,days:number){ const d=new Date(`${iso}T12:00:00`);d.setDate(d.getDate()+days);return localISO(d); }
const lunarFormatter=new Intl.DateTimeFormat("en-u-ca-chinese",{month:"numeric",day:"numeric",timeZone:"Asia/Seoul"});
function lunarDate(year:number,month:string,day:string){
  for(let cursor=new Date(Date.UTC(year,0,1));cursor.getUTCFullYear()===year;cursor.setUTCDate(cursor.getUTCDate()+1)){
    const parts=Object.fromEntries(lunarFormatter.formatToParts(cursor).map(part=>[part.type,part.value]));
    if(parts.month===month&&parts.day===day)return cursor.toISOString().slice(0,10);
  }
  return "";
}
function koreanHolidays(year:number){
  const cached=holidayCache.get(year);if(cached)return cached;
  const result=new Map<string,HolidayInfo>(), groups=new Map<string,{dates:string[];name:string;weekend:"all"|"sunday"|"none"}>();
  const add=(date:string,name:string,substitute=false)=>{const current=result.get(date);result.set(date,{name:current&&!current.name.includes(name)?`${current.name} · ${name}`:current?.name||name,substitute:current?.substitute||substitute});};
  const fixed:[string,string,"all"|"none"][]=[
    [`${year}-01-01`,"신정","none"],[`${year}-03-01`,"3·1절","all"],[`${year}-05-05`,"어린이날","all"],
    [`${year}-06-06`,"현충일","none"],[`${year}-08-15`,"광복절","all"],[`${year}-10-03`,"개천절","all"],
    [`${year}-10-09`,"한글날","all"],[`${year}-12-25`,"기독탄신일","all"],
  ];
  if(year<=2007||year>=2026)fixed.push([`${year}-07-17`,"제헌절","all"]);
  if(year>=2026)fixed.push([`${year}-05-01`,"노동절","all"]);
  fixed.forEach(([date,name,weekend])=>{add(date,name);groups.set(`${name}-${date}`,{dates:[date],name,weekend});});
  const lunar:[string,string,string][]=[["설날","1","1"],["부처님오신날","4","8"],["추석","8","15"]];
  lunar.forEach(([name,lunarMonth,lunarDay])=>{const date=lunarDate(year,lunarMonth,lunarDay);if(!date)return;if(name==="설날"||name==="추석"){const dates=[shiftISO(date,-1),date,shiftISO(date,1)];dates.forEach((item,index)=>add(item,index===1?name:`${name} 연휴`));groups.set(name,{dates,name,weekend:"sunday"});}else{add(date,name);groups.set(`${name}-${date}`,{dates:[date],name,weekend:"all"});}});
  if(year===2026){add("2026-06-03","전국동시지방선거");}
  const occupancy=new Map<string,number>();groups.forEach(group=>group.dates.forEach(date=>occupancy.set(date,(occupancy.get(date)||0)+1)));
  const reserved=new Set(result.keys());
  groups.forEach(group=>{
    if(group.weekend==="none")return;
    const needs=group.dates.some(date=>{const day=new Date(`${date}T12:00:00`).getDay();return(group.weekend==="all"&&(day===0||day===6))||(group.weekend==="sunday"&&day===0)||(occupancy.get(date)||0)>1;});
    if(!needs)return;
    let substitute=shiftISO([...group.dates].sort().at(-1)!,1);while(reserved.has(substitute)||[0,6].includes(new Date(`${substitute}T12:00:00`).getDay()))substitute=shiftISO(substitute,1);
    add(substitute,`대체공휴일 (${group.name})`,true);reserved.add(substitute);
  });
  holidayCache.set(year,result);return result;
}

const tools: Tool[] = [
  { id:"payroll", name:"공무직 보수 지급내역", shortName:"보수 지급", description:"월별 급여를 불러오고 세액 검증부터 지급내역 출력까지 한 번에 처리해요.", category:"급여·수당", href:"/tools/payroll.html", mark:"₩", tone:"violet", features:["전월 급여 복사","세액 자동계산","엑셀 다운로드"], storageKeys:["gongmujikPayroll.finalForm.v2"] },
  { id:"accounts", name:"기관계좌 관리시스템", shortName:"기관계좌", description:"계좌와 현금 장부를 월별로 관리하고 잔액과 증빙을 빠르게 확인해요.", category:"회계·정산", href:"/tools/accounts.html", mark:"▤", tone:"blue", features:["입출금 장부","영수증 첨부","통합 보고서"], storageKeys:["officeBudgetLedgerMultiDirectory.v1"] },
  { id:"supplies", name:"사무용품 주문목록", shortName:"사무용품", description:"견적 내용을 정리하고 주문 목록을 CSV·XLSX·PDF로 바로 만들어요.", category:"물품·명단", href:"/tools/supplies.html", mark:"□", tone:"orange", features:["OCR 텍스트 반영","이전 목록 불러오기","다양한 출력"], storageKeys:["officeSupplyOrderApp.savedOrders.v3"] },
  { id:"checklist", name:"수합명단 체크리스트", shortName:"수합명단", description:"엑셀 명단을 불러와 제출 여부를 표시하고 필요한 이름을 즉시 복사해요.", category:"물품·명단", href:"/tools/checklist.html", mark:"✓", tone:"mint", features:["XLSX 열 선택","클릭 복사","진행상태 저장"], storageKeys:["click-copy-name-list-v2","click-copy-name-list-v1"] },
  { id:"salary-rpa", name:"급여 RPA", shortName:"급여 RPA", description:"급여자료를 대상 사이트에 입력하는 브라우저 확장 프로그램을 내려받아요.", category:"급여·수당", href:"/downloads/SalaryRPA_Extension.zip", mark:"R", tone:"violet", features:["ZIP 다운로드","브라우저 확장","급여 입력 자동화"], storageKeys:[], download:true },
  { id:"travel", name:"여비 정산", shortName:"여비 정산", description:"근무지 내·외 출장비를 구분해 계산하고 통합 목록과 개인별 합계를 만들어요.", category:"회계·정산", href:"/tools/travel.html", mark:"↗", tone:"cyan", features:["출장내역 XLSX","여비 자동배분","통합 PDF"], storageKeys:[] },
  { id:"overtime-meals", name:"특근매식비 정산", shortName:"특근매식비", description:"매식 내역과 근무시간을 대조해 집행 대상을 검증하고 결과 파일을 생성해요.", category:"급여·수당", href:"/tools/overtime-meals.html", mark:"○", tone:"rose", features:["근무시간표 대조","집행대상 검증","개인별 합계"], storageKeys:[] },
];

const defaultTypes = ["수합","제출","지출","계획","보고","작성","기타"];
const notebookKey = "seomuHub.notebook.v1";
const favoriteKey = "seomuHub.favorites.v1";
const recentKey = "seomuHub.recent.v1";
const statusMeta: Record<TaskStatus,{label:string; mark:string}> = {
  planned:{label:"예정",mark:"○"}, doing:{label:"진행 중",mark:"◐"}, done:{label:"완료",mark:"●"}, delayed:{label:"연기",mark:"△"},
};
const emptyTask = (): Omit<Task,"id"|"createdAt"> => ({ field:"", title:"", type:"", mode:"temporary", routineKind:"daily", routineValue:"", startDate:"", deadline:"", status:"planned", memo:"" });

function readJson<T>(key:string, fallback:T):T { try { const v=window.localStorage.getItem(key); return v ? JSON.parse(v) as T : fallback; } catch { return fallback; } }
function localISO(date=new Date()){ const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,"0"),d=String(date.getDate()).padStart(2,"0"); return `${y}-${m}-${d}`; }
function uid(){ return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`; }
function keepTaskForToday(task:Task,today=localISO()){ return task.status!=="done"||!task.completedAt||localISO(new Date(task.completedAt))>=today; }
function taskOccurs(task:Task,date:Date){
  const iso=localISO(date);
  if(task.mode==="temporary") { const start=task.startDate||task.deadline,end=task.deadline||task.startDate; return Boolean(start&&end&&start<=iso&&iso<=end); }
  if(task.startDate && task.startDate>iso) return false;
  if(task.routineKind==="daily") return true;
  if(task.routineKind==="weekly") return String(date.getDay())===task.routineValue;
  if(task.routineKind==="monthly") return String(date.getDate())===String(Number(task.routineValue||1));
  return false;
}
function scheduleLabel(task:Task){
  if(task.mode==="temporary") { const start=task.startDate||task.deadline,end=task.deadline||task.startDate;if(!start&&!end)return "기한 없음";const fmt=(v:string)=>new Intl.DateTimeFormat("ko-KR",{month:"short",day:"numeric"}).format(new Date(`${v}T00:00:00`));return start===end?fmt(start):`${fmt(start)}–${fmt(end)}`; }
  if(task.routineKind==="daily") return "매일";
  if(task.routineKind==="weekly") return `매주 ${["일","월","화","수","목","금","토"][Number(task.routineValue||0)]}요일`;
  return `매월 ${Number(task.routineValue||1)}일`;
}

export default function Home(){
  const [notebookVisible,setNotebookVisible]=useState(false);
  const [query,setQuery]=useState("");
  const [activeTool,setActiveTool]=useState<Tool|null>(null);
  const [favorites,setFavorites]=useState<string[]>([]);
  const [recents,setRecents]=useState<string[]>([]);
  const [notebook,setNotebook]=useState<NotebookData>({fields:[],customTypes:[],tasks:[]});
  const [ready,setReady]=useState(false);
  const [today,setToday]=useState("");
  const [month,setMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1));
  const [selectedDate,setSelectedDate]=useState(localISO());
  const [taskModal,setTaskModal]=useState(false);
  const [fieldModal,setFieldModal]=useState(false);
  const [editingId,setEditingId]=useState<string|null>(null);
  const [draft,setDraft]=useState(emptyTask());
  const [newField,setNewField]=useState("");
  const [newType,setNewType]=useState("");
  const [toast,setToast]=useState("");
  const [menuOpen,setMenuOpen]=useState(false);
  const restoreInput=useRef<HTMLInputElement>(null);

  useEffect(()=>{
    const data=readJson<NotebookData>(notebookKey,{fields:["서무","공무직급여","보안"],customTypes:[],tasks:[]});
    const loadedAt=new Date().toISOString();
    const tasks=Array.isArray(data.tasks)?data.tasks.map(t=>({...t,startDate:t.startDate||t.deadline||"",completedAt:t.status==="done"?(t.completedAt||loadedAt):undefined})).filter(task=>keepTaskForToday(task)):[];
    setNotebook({...data,fields:Array.isArray(data.fields)?data.fields:[],customTypes:Array.isArray(data.customTypes)?data.customTypes:[],tasks});
    setFavorites(readJson<string[]>(favoriteKey,[])); setRecents(readJson<string[]>(recentKey,[]));
    setToday(new Intl.DateTimeFormat("ko-KR",{year:"numeric",month:"long",day:"numeric",weekday:"long"}).format(new Date()));
    setReady(true);
  },[]);
  useEffect(()=>{ const sync=()=>{const top=document.getElementById("notebook-home")?.offsetTop??window.innerHeight;setNotebookVisible(window.scrollY>=top-180);};sync();window.addEventListener("scroll",sync,{passive:true});window.addEventListener("resize",sync);return()=>{window.removeEventListener("scroll",sync);window.removeEventListener("resize",sync);}; },[]);
  useEffect(()=>{ if(ready) window.localStorage.setItem(notebookKey,JSON.stringify(notebook)); },[notebook,ready]);
  useEffect(()=>{ if(!ready)return; const cleanup=()=>setNotebook(n=>{const tasks=n.tasks.filter(task=>keepTaskForToday(task));return tasks.length===n.tasks.length?n:{...n,tasks};});cleanup();const timer=window.setInterval(cleanup,60000);return()=>window.clearInterval(timer); },[ready]);
  useEffect(()=>{ if(!toast)return; const t=window.setTimeout(()=>setToast(""),2400); return()=>window.clearTimeout(t); },[toast]);
  useEffect(()=>{ if(!activeTool)return; document.body.classList.add("workspace-open"); return()=>document.body.classList.remove("workspace-open"); },[activeTool]);

  const todayDate=new Date();
  const todayTasks=useMemo(()=>notebook.tasks.filter(t=>t.status!=="done"&&taskOccurs(t,todayDate)),[notebook.tasks]);
  const selectedTasks=useMemo(()=>{ const d=new Date(`${selectedDate}T00:00:00`); return notebook.tasks.filter(t=>taskOccurs(t,d)); },[notebook.tasks,selectedDate]);
  const visibleTools=useMemo(()=>{ const q=query.trim().toLocaleLowerCase("ko-KR"); return tools.filter(t=>!q||[t.name,t.description,t.category,...t.features].join(" ").toLocaleLowerCase("ko-KR").includes(q)); },[query]);
  const calendarDays=useMemo(()=>{
    const start=new Date(month.getFullYear(),month.getMonth(),1), first=start.getDay(), last=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
    const cells:(Date|null)[]=Array(first).fill(null); for(let d=1;d<=last;d++) cells.push(new Date(month.getFullYear(),month.getMonth(),d)); while(cells.length%7)cells.push(null); return cells;
  },[month]);
  const monthHolidays=useMemo(()=>koreanHolidays(month.getFullYear()),[month]);
  const selectedHoliday=monthHolidays.get(selectedDate);

  const goHome=()=>{ window.scrollTo({top:0,behavior:"smooth"}); setMenuOpen(false); };
  const scrollTo=(id:string)=>{ document.getElementById(id)?.scrollIntoView({behavior:"smooth",block:"start"}); setMenuOpen(false); };
  const openTool=(tool:Tool)=>{ const next=[tool.id,...recents.filter(id=>id!==tool.id)].slice(0,6); setRecents(next); localStorage.setItem(recentKey,JSON.stringify(next)); if(tool.download){ const a=document.createElement("a");a.href=tool.href;a.download="SalaryRPA_Extension.zip";a.click();setToast("급여 RPA 다운로드를 시작했습니다."); }else setActiveTool(tool); setMenuOpen(false); };
  const openNewTask=(date="")=>{ setEditingId(null);setNewType("");setDraft({...emptyTask(),field:notebook.fields[0]||"",startDate:date,deadline:date});setTaskModal(true); };
  const editTask=(task:Task)=>{ const {id,createdAt,...rest}=task;void id;void createdAt;setEditingId(task.id);setNewType("");setDraft(rest);setTaskModal(true); };
  const saveTask=(e:FormEvent)=>{ e.preventDefault(); if(!draft.title.trim()){setToast("업무 제목을 입력해 주세요.");return;} if(!draft.field){setToast("업무 필드를 먼저 설정해 주세요.");return;} if(draft.mode==="temporary"&&draft.startDate&&draft.deadline&&draft.startDate>draft.deadline){setToast("종료일은 시작일보다 빠를 수 없습니다.");return;} const normalizedDraft=draft.mode==="temporary"?{...draft,startDate:draft.startDate||draft.deadline,deadline:draft.deadline||draft.startDate}:draft; const type=(draft.type==="__custom"?newType:draft.type).trim(); if(draft.type==="__custom"&&!type){setToast("새 업무 유형을 입력해 주세요.");return;} const nextTypes=type&&!defaultTypes.includes(type)&&!notebook.customTypes.includes(type)?[...notebook.customTypes,type]:notebook.customTypes; const finalizedDraft={...normalizedDraft,completedAt:normalizedDraft.status==="done"?(normalizedDraft.completedAt||new Date().toISOString()):undefined}; setNotebook(n=>({...n,customTypes:nextTypes,tasks:editingId?n.tasks.map(t=>t.id===editingId?{...t,...finalizedDraft,title:draft.title.trim(),type}:t):[...n.tasks,{...finalizedDraft,title:draft.title.trim(),type,id:uid(),createdAt:new Date().toISOString()}]})); setTaskModal(false);setToast(editingId?"업무를 수정했습니다.":"업무를 추가했습니다."); };
  const updateStatus=(id:string,status:TaskStatus)=>setNotebook(n=>({...n,tasks:n.tasks.map(t=>t.id===id?{...t,status,completedAt:status==="done"?(t.completedAt||new Date().toISOString()):undefined}:t)}));
  const deleteTask=(id:string)=>{ if(!window.confirm("이 업무를 삭제할까요?"))return;setNotebook(n=>({...n,tasks:n.tasks.filter(t=>t.id!==id)}));setTaskModal(false);setToast("업무를 삭제했습니다."); };
  const addField=()=>{ const name=newField.trim();if(!name)return;if(notebook.fields.includes(name)){setToast("이미 있는 업무 필드입니다.");return;}setNotebook(n=>({...n,fields:[...n.fields,name]}));setNewField(""); };
  const removeField=(field:string)=>{ if(notebook.tasks.some(t=>t.field===field)){setToast("연결된 업무가 있어 필드를 삭제할 수 없습니다.");return;}setNotebook(n=>({...n,fields:n.fields.filter(f=>f!==field)})); };
  const toggleFavorite=(id:string)=>{ const next=favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id];setFavorites(next);localStorage.setItem(favoriteKey,JSON.stringify(next)); };
  const downloadBackup=()=>{ const keys=[notebookKey,...tools.flatMap(t=>t.storageKeys)],data:Record<string,string>={};keys.forEach(k=>{const v=localStorage.getItem(k);if(v!==null)data[k]=v;});const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify({app:"서무랜드",version:2,exportedAt:new Date().toISOString(),data},null,2)],{type:"application/json"}));a.download=`서무랜드_통합백업_${localISO()}.json`;a.click();URL.revokeObjectURL(a.href);setToast("통합백업을 저장했습니다."); };
  const restoreBackup=(e:ChangeEvent<HTMLInputElement>)=>{const file=e.target.files?.[0];e.target.value="";if(!file)return;const r=new FileReader();r.onload=()=>{try{const p=JSON.parse(String(r.result));if(p?.app!=="서무랜드"||typeof p.data!=="object")throw 0;const allowed=new Set([notebookKey,...tools.flatMap(t=>t.storageKeys)]);Object.entries(p.data).forEach(([k,v])=>{if(allowed.has(k)&&typeof v==="string")localStorage.setItem(k,v);});setNotebook(readJson(notebookKey,notebook));setToast("백업을 복원했습니다.");}catch{setToast("올바른 서무랜드 백업 파일이 아닙니다.");}};r.readAsText(file,"utf-8");};

  const TaskCard=({task,compact=false}:{task:Task;compact?:boolean})=><article className={`work-card status-${task.status} ${compact?"compact":""}`} onDoubleClick={()=>editTask(task)}>
    <div className="work-card-top"><span className="field-pill">{task.field}</span><button onClick={()=>editTask(task)} aria-label="업무 수정">•••</button></div>
    <h3>{task.title}</h3>{!compact&&task.memo&&<p>{task.memo}</p>}
    <div className="work-meta">{task.type&&<span>#{task.type}</span>}<span>{task.mode==="routine"?"↻ ":""}{scheduleLabel(task)}</span></div>
    <select aria-label="진행 상태" value={task.status} onChange={e=>updateStatus(task.id,e.target.value as TaskStatus)}>{Object.entries(statusMeta).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select>
  </article>;

  return <main className={`app-shell notebook-app ${notebookVisible?"notebook-visible":""}`}>
    <section className="landing-page">
      <header className="landing-header"><button className="landing-brand" onClick={goHome}><span className="brand-mark"><i/><i/><i/></span><span><strong>서무랜드</strong><small>WORK LIGHTER, EVERY DAY</small></span></button><span className="landing-motto">반복 업무는 짧게, 퇴근은 가볍게.</span></header>
      <div className="landing-content">
        <section className="landing-hero">
          <div className="landing-copy"><span className="eyebrow"><i/>오늘의 서무를 가볍게</span><h1>서무, 오늘도<br/><em>더 가볍게.</em></h1><p>흩어진 일정과 반복 업무, 자주 쓰는 도구까지.<br/>서무랜드에서 한 번에 시작하세요.</p><small className="landing-note"><i/>모든 자료는 이 브라우저에 안전하게 저장됩니다</small></div>
          <div className="welcome-scene" aria-label="오늘의 업무 미리보기">
            <span className="scene-orbit orbit-a"/><span className="scene-orbit orbit-b"/><i className="scene-spark spark-a">✦</i><i className="scene-spark spark-b">✦</i>
            <article className="welcome-card"><div className="welcome-card-head"><span><small>GOOD MORNING</small><strong>환영합니다, 주무관님!</strong></span><b>{today||"2026년 7월 22일"}</b></div><div className="welcome-tasks"><div className="welcome-count"><strong>{todayTasks.length}</strong><span>오늘 할 일</span></div><div className="welcome-list">{todayTasks.slice(0,3).map((task,index)=><div className="welcome-task" key={task.id}><i className={`dot-${task.status}`}/><span><b>{task.title}</b><small>{task.field} · {task.type||"일반 업무"}</small></span><em>{index+1}</em></div>)}{!todayTasks.length&&<div className="welcome-empty"><span>✓</span><div><b>오늘은 여유로운 하루예요</b><small>업무수첩에서 새 일정을 추가해 보세요.</small></div></div>}</div></div><div className="welcome-open">오늘의 일정과 업무 도구가 아래로 이어집니다 <span>↓</span></div></article>
            <div className="floating-chip chip-calendar"><span>□</span><b>일정 연결</b><small>시작부터 종료까지</small></div><div className="floating-chip chip-tools"><span>⌘</span><b>업무 도구</b><small>{tools.length}개 한곳에</small></div>
          </div>
        </section>
      </div>
      <footer className="landing-footer"><span>SEOMU LAND · 2026</span><p className="scroll-cue">스크롤하여 업무수첩 보기 <b>↓</b></p></footer>
    </section>
    <aside className={`sidebar ${menuOpen?"is-open":""}`} aria-label="주 메뉴">
      <div className="brand" onClick={goHome} role="button" tabIndex={0}><span className="brand-mark"><i/><i/><i/></span><span><strong>서무랜드</strong><small>업무 허브</small></span></div>
      <nav className="side-nav notebook-nav">
        <button className="active" onClick={()=>scrollTo("notebook-home")}><span>▣</span> 업무수첩</button>
        <button onClick={()=>scrollTo("calendar")}><span>□</span> 달력</button>
        <button onClick={()=>scrollTo("kanban")}><span>▤</span> 칸반</button>
        <button onClick={()=>scrollTo("field-list")}><span>☷</span> 필드별 업무</button>
        <p>업무 도구</p>{tools.map(t=><button key={t.id} onClick={()=>openTool(t)}><span className={`nav-tool-mark tone-${t.tone}`}>{t.mark}</span>{t.shortName}</button>)}
      </nav>
      <div className="sidebar-spacer"/><div className="backup-card"><span className="backup-icon">↧</span><strong>내 자료 챙기기</strong><p>업무수첩과 도구 자료를 한 파일로 보관하세요.</p><button onClick={downloadBackup}>통합 백업</button></div><div className="local-badge"><span/>이 브라우저에 저장</div>
    </aside>
    {menuOpen&&<button className="menu-scrim" aria-label="메뉴 닫기" onClick={()=>setMenuOpen(false)}/>}
    <section className="page" id="notebook-home">
      <header className="topbar"><button className="mobile-menu" onClick={()=>setMenuOpen(true)}>☰</button><div className="search-wrap"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="업무 도구를 검색하세요"/><kbd>검색</kbd></div><button className="top-add" onClick={()=>openNewTask()}>＋ 업무 추가</button></header>
      <div className="content notebook-content">
        <section className="today-board">
          <div className="today-intro"><span className="section-kicker">MY WORK</span><h1>오늘의 업무수첩</h1><p>{today||"오늘"}</p></div>
          <div className="today-summary"><div><strong>{todayTasks.length}</strong><span>오늘 할 일</span></div><div><strong>{notebook.tasks.filter(t=>t.status==="doing").length}</strong><span>진행 중</span></div><button onClick={()=>openNewTask(localISO())}>오늘 업무 추가</button></div>
          <div className="today-list">{todayTasks.length?todayTasks.map(t=><button key={t.id} onClick={()=>editTask(t)}><i className={`dot-${t.status}`}/><span><b>{t.title}</b><small>{t.field} · {t.type||"일반 업무"}</small></span><em>{statusMeta[t.status].label}</em></button>):<div className="notebook-empty"><span>✓</span><b>오늘 예정된 업무가 없습니다.</b><p>새 업무를 추가하거나 달력에서 일정을 지정해 보세요.</p></div>}</div>
        </section>

        <section className="notebook-section calendar-section" id="calendar">
          <div className="section-heading"><div><span className="section-kicker">CALENDAR</span><h2>업무 달력</h2></div><div className="calendar-controls"><button onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}>←</button><b>{month.getFullYear()}년 {month.getMonth()+1}월</b><button onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}>→</button></div></div>
          <div className="calendar-layout"><div className="calendar-card"><div className="weekday-row">{["일","월","화","수","목","금","토"].map(x=><span key={x}>{x}</span>)}</div><div className="calendar-grid">{calendarDays.map((d,i)=>{if(!d)return <span className="calendar-day blank" key={`b${i}`}/>;const iso=localISO(d),holiday=monthHolidays.get(iso),entries=notebook.tasks.filter(t=>taskOccurs(t,d)).slice(0,3);return <div key={iso} className={`calendar-day ${iso===selectedDate?"selected":""} ${iso===localISO()?"today":""} ${holiday?"holiday":""}`}><button className="day-number" onClick={()=>setSelectedDate(iso)} title={holiday?.name}><b>{d.getDate()}</b>{holiday&&<small>{holiday.name}</small>}</button><div className="calendar-events">{entries.map(t=>{const start=t.startDate||t.deadline,end=t.deadline||t.startDate,left=t.mode==="temporary"&&Boolean(start&&start<iso),right=t.mode==="temporary"&&Boolean(end&&end>iso),showTitle=!left||i%7===0;return <button key={t.id} title={t.title} className={`calendar-event event-${t.status} ${left?"continues-left":""} ${right?"continues-right":""}`} onClick={()=>editTask(t)}><span>{showTitle?t.title:""}</span></button>})}</div></div>})}</div></div>
            <aside className="day-agenda"><span>{new Intl.DateTimeFormat("ko-KR",{month:"long",day:"numeric",weekday:"short"}).format(new Date(`${selectedDate}T00:00:00`))}</span>{selectedHoliday&&<p className={`agenda-holiday ${selectedHoliday.substitute?"is-substitute":""}`}><i>●</i>{selectedHoliday.name}</p>}<h3>{selectedTasks.length}개의 업무</h3><div>{selectedTasks.length?selectedTasks.map(t=><button key={t.id} onClick={()=>editTask(t)}><i className={`dot-${t.status}`}/><span><b>{t.title}</b><small>{t.field}</small></span></button>):<p>등록된 업무가 없습니다.</p>}</div><button className="agenda-add" onClick={()=>openNewTask(selectedDate)}>＋ 이 날짜에 업무 추가</button></aside>
          </div>
        </section>

        <section className="notebook-section" id="kanban"><div className="section-heading"><div><span className="section-kicker">WORKFLOW</span><h2>업무 진행 현황</h2></div><span className="tool-count">상태를 바꾸면 즉시 반영됩니다</span></div><div className="kanban-board">{(Object.keys(statusMeta) as TaskStatus[]).map(s=><div className={`kanban-column column-${s}`} key={s}><header><span>{statusMeta[s].mark} {statusMeta[s].label}</span><b>{notebook.tasks.filter(t=>t.status===s).length}</b></header><div>{notebook.tasks.filter(t=>t.status===s).length?notebook.tasks.filter(t=>t.status===s).map(t=><TaskCard key={t.id} task={t}/>):<p className="column-empty">업무 없음</p>}</div></div>)}</div></section>

        <section className="notebook-section" id="field-list"><div className="section-heading"><div><span className="section-kicker">WORK FIELDS</span><h2>필드별 업무</h2></div><button className="section-action" onClick={()=>setFieldModal(true)}>필드 관리</button></div><div className="field-groups">{notebook.fields.length?notebook.fields.map(f=>{const list=notebook.tasks.filter(t=>t.field===f);return <article key={f}><header><div><span>{f.slice(0,1)}</span><h3>{f}</h3></div><b>{list.length}건</b></header><div>{list.length?list.map(t=><TaskCard key={t.id} task={t} compact/>):<p>등록된 업무가 없습니다.</p>}</div><button onClick={()=>{setEditingId(null);setDraft({...emptyTask(),field:f});setTaskModal(true)}}>＋ {f} 업무 추가</button></article>}):<div className="notebook-empty wide"><b>업무 필드를 먼저 설정해 주세요.</b><button onClick={()=>setFieldModal(true)}>필드 설정</button></div>}</div></section>

        <section className="section-block tools-section" id="all-tools"><div className="section-heading"><div><span className="section-kicker">WORK TOOLS</span><h2>기존 업무 도구</h2></div><span className="tool-count">{visibleTools.length}개의 도구</span></div><div className="tool-grid">{visibleTools.map((t,i)=><article className={`tool-card tone-${t.tone}`} key={t.id} style={{"--delay":`${i*35}ms`} as React.CSSProperties}><div className="card-top"><span className="tool-mark">{t.mark}</span><button className={`favorite ${favorites.includes(t.id)?"is-favorite":""}`} onClick={()=>toggleFavorite(t.id)}>☆</button></div><span className="category-label">{t.category}</span><h3>{t.name}</h3><p>{t.description}</p><div className="feature-list">{t.features.map(x=><span key={x}>#{x}</span>)}</div><div className="card-footer"><span className="save-state"><i/>{t.download?"파일 기반":"브라우저 저장"}</span><button className="open-button" onClick={()=>openTool(t)}>{t.download?"다운로드":"열기"} <span>{t.download?"↓":"→"}</span></button></div></article>)}</div></section>
        <section className="lower-grid"><div className="recent-panel"><div className="panel-heading"><div><span className="section-kicker">RECENT</span><h2>최근 사용 도구</h2></div></div><div className="recent-list">{recents.slice(0,3).map(id=>tools.find(t=>t.id===id)).filter(Boolean).map(t=><button key={t!.id} onClick={()=>openTool(t!)}><span className={`recent-mark tone-${t!.tone}`}>{t!.mark}</span><span><b>{t!.shortName}</b><small>최근 사용한 도구</small></span><i>→</i></button>)}</div></div><div className="data-panel"><span className="section-kicker">DATA CARE</span><h2>자료는 내 브라우저에</h2><p>업무수첩과 기존 도구의 내용은 현재 브라우저에 저장됩니다. 중요한 자료는 통합백업으로 보관해 주세요.</p><div className="data-actions"><button className="backup-action" onClick={downloadBackup}>↧ 통합백업 저장</button><button className="restore-action" onClick={()=>restoreInput.current?.click()}>↥ 백업 복원</button></div><input ref={restoreInput} className="visually-hidden" type="file" accept=".json" onChange={restoreBackup}/></div></section>
        <footer><span><b>서무랜드</b> · 행정업무를 가볍게</span><span>업무수첩과 도구는 브라우저에서 실행됩니다.</span></footer>
      </div>
    </section>

    {taskModal&&<div className="modal-backdrop" role="dialog" aria-modal="true"><form className="task-modal" onSubmit={saveTask}><header><div><span className="section-kicker">WORK CARD</span><h2>{editingId?"업무 수정":"새 업무 추가"}</h2></div><button type="button" onClick={()=>setTaskModal(false)}>×</button></header><div className="form-grid"><label className="full">업무 제목 <b>*</b><input autoFocus value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})} placeholder="예: 2026년 위원회 회의록 보고"/></label><label>업무 필드 <b>*</b><select value={draft.field} onChange={e=>setDraft({...draft,field:e.target.value})}><option value="">선택</option>{notebook.fields.map(f=><option key={f}>{f}</option>)}</select></label><label>업무 유형<select value={draft.type} onChange={e=>setDraft({...draft,type:e.target.value})}><option value="">선택 안 함</option>{[...defaultTypes,...notebook.customTypes].map(t=><option key={t}>{t}</option>)}<option value="__custom">직접 추가</option></select></label>{draft.type==="__custom"&&<label className="full">새 업무 유형<input value={newType} onChange={e=>setNewType(e.target.value)} placeholder="업무 유형 입력"/></label>}<label>업무 형태<select value={draft.mode} onChange={e=>setDraft({...draft,mode:e.target.value as WorkMode})}><option value="temporary">일시적</option><option value="routine">루틴</option></select></label><label>진행 상태<select value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value as TaskStatus})}>{Object.entries(statusMeta).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></label>{draft.mode==="routine"?<><label>반복 주기<select value={draft.routineKind} onChange={e=>setDraft({...draft,routineKind:e.target.value as RoutineKind,routineValue:""})}><option value="daily">매일</option><option value="weekly">매주</option><option value="monthly">매월</option></select></label><label>{draft.routineKind==="weekly"?"요일":draft.routineKind==="monthly"?"날짜":"반복"}{draft.routineKind==="weekly"?<select value={draft.routineValue} onChange={e=>setDraft({...draft,routineValue:e.target.value})}>{["일","월","화","수","목","금","토"].map((d,i)=><option value={i} key={d}>{d}요일</option>)}</select>:draft.routineKind==="monthly"?<input type="number" min="1" max="31" value={draft.routineValue} onChange={e=>setDraft({...draft,routineValue:e.target.value})} placeholder="1~31"/>:<input value="매일" disabled/>}</label><label className="full">반복 시작일<input type="date" value={draft.startDate} onInput={e=>setDraft({...draft,startDate:e.currentTarget.value})}/></label></>:<><label>시작 날짜<input type="date" value={draft.startDate} onInput={e=>setDraft({...draft,startDate:e.currentTarget.value})}/></label><label>종료 날짜 · 마감<input type="date" value={draft.deadline} onInput={e=>setDraft({...draft,deadline:e.currentTarget.value})}/></label></>}<label className="full">메모<textarea rows={4} value={draft.memo} onChange={e=>setDraft({...draft,memo:e.target.value})} placeholder="진행에 필요한 메모를 입력하세요."/></label></div><footer>{editingId?<button type="button" className="danger-btn" onClick={()=>deleteTask(editingId)}>삭제</button>:<span/>}<div><button type="button" className="cancel-btn" onClick={()=>setTaskModal(false)}>취소</button><button type="submit" className="save-btn">{editingId?"수정 저장":"업무 추가"}</button></div></footer></form></div>}
    {fieldModal&&<div className="modal-backdrop" role="dialog" aria-modal="true"><section className="field-modal"><header><div><span className="section-kicker">WORK FIELDS</span><h2>업무 필드 관리</h2></div><button onClick={()=>setFieldModal(false)}>×</button></header><p>업무분장의 큰 단위를 등록하세요. 각 업무 카드는 하나의 필드에 속합니다.</p><div className="field-input"><input value={newField} onChange={e=>setNewField(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addField()}} placeholder="예: 서무, 공무직급여, 보안"/><button onClick={addField}>추가</button></div><div className="field-chip-list">{notebook.fields.map(f=><span key={f}>{f}<button onClick={()=>removeField(f)}>×</button></span>)}</div><footer><button onClick={()=>setFieldModal(false)}>완료</button></footer></section></div>}
    {activeTool&&<section className="tool-workspace" role="dialog" aria-modal="true"><header><button className="workspace-back" onClick={()=>setActiveTool(null)}>←</button><span className={`workspace-mark tone-${activeTool.tone}`}>{activeTool.mark}</span><div><strong>{activeTool.name}</strong><small>서무랜드에서 실행 중</small></div><span className="workspace-saved"><i/>브라우저 저장</span><a href={activeTool.href} target="_blank" rel="noreferrer">새 창에서 열기 ↗</a><button className="workspace-close" onClick={()=>setActiveTool(null)}>허브로 돌아가기</button></header><iframe src={activeTool.href} title={activeTool.name}/></section>}
    {toast&&<div className="toast" role="status"><span>✓</span>{toast}</div>}
  </main>;
}
