"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Tool = {
  id: string; name: string; shortName: string; description: string;
  category: "ê¸‰ì—¬Â·ìˆ˜ë‹¹" | "íšŒê³„Â·ì •ì‚°" | "ë¬¼í’ˆÂ·ëª…ë‹¨";
  href: string; mark: string; tone: string; features: string[]; storageKeys: string[]; download?: boolean;
};
type TaskStatus = "planned" | "doing" | "done" | "delayed";
type WorkMode = "temporary" | "routine";
type RoutineKind = "daily" | "weekly" | "monthly";
type Task = {
  id: string; field: string; title: string; type: string; mode: WorkMode;
  routineKind?: RoutineKind; routineValue?: string; startDate: string; deadline: string;
  status: TaskStatus; memo: string; createdAt: string;
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
  const add=(date:string,name:string,substitute=false)=>{const current=result.get(date);result.set(date,{name:current&&!current.name.includes(name)?`${current.name} Â· ${name}`:current?.name||name,substitute:current?.substitute||substitute});};
  const fixed:[string,string,"all"|"none"][]=[
    [`${year}-01-01`,"ì‹ ì •","none"],[`${year}-03-01`,"3Â·1ì ˆ","all"],[`${year}-05-05`,"ì–´ë¦°ì´ë‚ ","all"],
    [`${year}-06-06`,"í˜„ì¶©ì¼","none"],[`${year}-08-15`,"ê´‘ë³µì ˆ","all"],[`${year}-10-03`,"ê°œì²œì ˆ","all"],
    [`${year}-10-09`,"í•œê¸€ë‚ ","all"],[`${year}-12-25`,"ê¸°ë…íƒ„ì‹ ì¼","all"],
  ];
  if(year<=2007||year>=2026)fixed.push([`${year}-07-17`,"ì œí—Œì ˆ","all"]);
  if(year>=2026)fixed.push([`${year}-05-01`,"ë…¸ë™ì ˆ","all"]);
  fixed.forEach(([date,name,weekend])=>{add(date,name);groups.set(`${name}-${date}`,{dates:[date],name,weekend});});
  const lunar:[string,string,string][]=[["ì„¤ë‚ ","1","1"],["ë¶€ì²˜ë‹˜ì˜¤ì‹ ë‚ ","4","8"],["ì¶”ì„","8","15"]];
  lunar.forEach(([name,lunarMonth,lunarDay])=>{const date=lunarDate(year,lunarMonth,lunarDay);if(!date)return;if(name==="ì„¤ë‚ "||name==="ì¶”ì„"){const dates=[shiftISO(date,-1),date,shiftISO(date,1)];dates.forEach((item,index)=>add(item,index===1?name:`${name} ì—°íœ´`));groups.set(name,{dates,name,weekend:"sunday"});}else{add(date,name);groups.set(`${name}-${date}`,{dates:[date],name,weekend:"all"});}});
  if(year===2026){add("2026-06-03","ì „êµ­ë™ì‹œì§€ë°©ì„ ê±°");}
  const occupancy=new Map<string,number>();groups.forEach(group=>group.dates.forEach(date=>occupancy.set(date,(occupancy.get(date)||0)+1)));
  const reserved=new Set(result.keys());
  groups.forEach(group=>{
    if(group.weekend==="none")return;
    const needs=group.dates.some(date=>{const day=new Date(`${date}T12:00:00`).getDay();return(group.weekend==="all"&&(day===0||day===6))||(group.weekend==="sunday"&&day===0)||(occupancy.get(date)||0)>1;});
    if(!needs)return;
    let substitute=shiftISO([...group.dates].sort().at(-1)!,1);while(reserved.has(substitute)||[0,6].includes(new Date(`${substitute}T12:00:00`).getDay()))substitute=shiftISO(substitute,1);
    add(substitute,`ëŒ€ì²´ê³µíœ´ì¼ (${group.name})`,true);reserved.add(substitute);
  });
  holidayCache.set(year,result);return result;
}

const tools: Tool[] = [
  { id:"payroll", name:"ê³µë¬´ì§ ë³´ìˆ˜ ì§€ê¸‰ë‚´ì—­", shortName:"ë³´ìˆ˜ ì§€ê¸‰", description:"ì›”ë³„ ê¸‰ì—¬ë¥¼ ë¶ˆëŸ¬ì˜¤ê³  ì„¸ì•¡ ê²€ì¦ë¶€í„° ì§€ê¸‰ë‚´ì—­ ì¶œë ¥ê¹Œì§€ í•œ ë²ˆì— ì²˜ë¦¬í•´ìš”.", category:"ê¸‰ì—¬Â·ìˆ˜ë‹¹", href:"/tools/payroll.html", mark:"â‚©", tone:"violet", features:["ì „ì›” ê¸‰ì—¬ ë³µì‚¬","ì„¸ì•¡ ìë™ê³„ì‚°","ì—‘ì…€ ë‹¤ìš´ë¡œë“œ"], storageKeys:["gongmujikPayroll.finalForm.v2"] },
  { id:"accounts", name:"ê¸°ê´€ê³„ì¢Œ ê´€ë¦¬ì‹œìŠ¤í…œ", shortName:"ê¸°ê´€ê³„ì¢Œ", description:"ê³„ì¢Œì™€ í˜„ê¸ˆ ì¥ë¶€ë¥¼ ì›”ë³„ë¡œ ê´€ë¦¬í•˜ê³  ì”ì•¡ê³¼ ì¦ë¹™ì„ ë¹ ë¥´ê²Œ í™•ì¸í•´ìš”.", category:"íšŒê³„Â·ì •ì‚°", href:"/tools/accounts.html", mark:"â–¤", tone:"blue", features:["ì…ì¶œê¸ˆ ì¥ë¶€","ì˜ìˆ˜ì¦ ì²¨ë¶€","í†µí•© ë³´ê³ ì„œ"], storageKeys:["officeBudgetLedgerMultiDirectory.v1"] },
  { id:"supplies", name:"ì‚¬ë¬´ìš©í’ˆ ì£¼ë¬¸ëª©ë¡", shortName:"ì‚¬ë¬´ìš©í’ˆ", description:"ê²¬ì  ë‚´ìš©ì„ ì •ë¦¬í•˜ê³  ì£¼ë¬¸ ëª©ë¡ì„ CSVÂ·XLSXÂ·PDFë¡œ ë°”ë¡œ ë§Œë“¤ì–´ìš”.", category:"ë¬¼í’ˆÂ·ëª…ë‹¨", href:"/tools/supplies.html", mark:"â–¡", tone:"orange", features:["OCR í…ìŠ¤íŠ¸ ë°˜ì˜","ì´ì „ ëª©ë¡ ë¶ˆëŸ¬ì˜¤ê¸°","ë‹¤ì–‘í•œ ì¶œë ¥"], storageKeys:["officeSupplyOrderApp.savedOrders.v3"] },
  { id:"checklist", name:"ìˆ˜í•©ëª…ë‹¨ ì²´í¬ë¦¬ìŠ¤íŠ¸", shortName:"ìˆ˜í•©ëª…ë‹¨", description:"ì—‘ì…€ ëª…ë‹¨ì„ ë¶ˆëŸ¬ì™€ ì œì¶œ ì—¬ë¶€ë¥¼ í‘œì‹œí•˜ê³  í•„ìš”í•œ ì´ë¦„ì„ ì¦‰ì‹œ ë³µì‚¬í•´ìš”.", category:"ë¬¼í’ˆÂ·ëª…ë‹¨", href:"/tools/checklist.html", mark:"âœ“", tone:"mint", features:["XLSX ì—´ ì„ íƒ","í´ë¦­ ë³µì‚¬","ì§„í–‰ìƒíƒœ ì €ì¥"], storageKeys:["click-copy-name-list-v2","click-copy-name-list-v1"] },
  { id:"salary-rpa", name:"ê¸‰ì—¬ RPA", shortName:"ê¸‰ì—¬ RPA", description:"ê¸‰ì—¬ìë£Œë¥¼ ëŒ€ìƒ ì‚¬ì´íŠ¸ì— ì…ë ¥í•˜ëŠ” ë¸Œë¼ìš°ì € í™•ì¥ í”„ë¡œê·¸ë¨ì„ ë‚´ë ¤ë°›ì•„ìš”.", category:"ê¸‰ì—¬Â·ìˆ˜ë‹¹", href:"/downloads/SalaryRPA_Extension.zip", mark:"R", tone:"violet", features:["ZIP ë‹¤ìš´ë¡œë“œ","ë¸Œë¼ìš°ì € í™•ì¥","ê¸‰ì—¬ ì…ë ¥ ìë™í™”"], storageKeys:[], download:true },
  { id:"travel", name:"ì—¬ë¹„ ì •ì‚°", shortName:"ì—¬ë¹„ ì •ì‚°", description:"ê·¼ë¬´ì§€ ë‚´Â·ì™¸ ì¶œì¥ë¹„ë¥¼ êµ¬ë¶„í•´ ê³„ì‚°í•˜ê³  í†µí•© ëª©ë¡ê³¼ ê°œì¸ë³„ í•©ê³„ë¥¼ ë§Œë“¤ì–´ìš”.", category:"íšŒê³„Â·ì •ì‚°", href:"/tools/travel.html", mark:"â†—", tone:"cyan", features:["ì¶œì¥ë‚´ì—­ XLSX","ì—¬ë¹„ ìë™ë°°ë¶„","í†µí•© PDF"], storageKeys:[] },
  { id:"overtime-meals", name:"íŠ¹ê·¼ë§¤ì‹ë¹„ ì •ì‚°", shortName:"íŠ¹ê·¼ë§¤ì‹ë¹„", description:"ë§¤ì‹ ë‚´ì—­ê³¼ ê·¼ë¬´ì‹œê°„ì„ ëŒ€ì¡°í•´ ì§‘í–‰ ëŒ€ìƒì„ ê²€ì¦í•˜ê³  ê²°ê³¼ íŒŒì¼ì„ ìƒì„±í•´ìš”.", category:"ê¸‰ì—¬Â·ìˆ˜ë‹¹", href:"/tools/overtime-meals.html", mark:"â—‹", tone:"rose", features:["ê·¼ë¬´ì‹œê°„í‘œ ëŒ€ì¡°","ì§‘í–‰ëŒ€ìƒ ê²€ì¦","ê°œì¸ë³„ í•©ê³„"], storageKeys:[] },
];

const defaultTypes = ["ìˆ˜í•©","ì œì¶œ","ì§€ì¶œ","ê³„íš","ë³´ê³ ","ì‘ì„±","ê¸°íƒ€"];
const notebookKey = "seomuHub.notebook.v1";
const favoriteKey = "seomuHub.favorites.v1";
const recentKey = "seomuHub.recent.v1";
const statusMeta: Record<TaskStatus,{label:string; mark:string}> = {
  planned:{label:"ì˜ˆì •",mark:"â—‹"}, doing:{label:"ì§„í–‰ ì¤‘",mark:"â—"}, done:{label:"ì™„ë£Œ",mark:"â—"}, delayed:{label:"ì—°ê¸°",mark:"â–³"},
};
const emptyTask = (): Omit<Task,"id"|"createdAt"> => ({ field:"", title:"", type:"", mode:"temporary", routineKind:"daily", routineValue:"", startDate:"", deadline:"", status:"planned", memo:"" });

function readJson<T>(key:string, fallback:T):T { try { const v=window.localStorage.getItem(key); return v ? JSON.parse(v) as T : fallback; } catch { return fallback; } }
function localISO(date=new Date()){ const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,"0"),d=String(date.getDate()).padStart(2,"0"); return `${y}-${m}-${d}`; }
function uid(){ return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`; }
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
  if(task.mode==="temporary") { const start=task.startDate||task.deadline,end=task.deadline||task.startDate;if(!start&&!end)return "ê¸°í•œ ì—†ìŒ";const fmt=(v:string)=>new Intl.DateTimeFormat("ko-KR",{month:"short",day:"numeric"}).format(new Date(`${v}T00:00:00`));return start===end?fmt(start):`${fmt(start)}â€“${fmt(end)}`; }
  if(task.routineKind==="daily") return "ë§¤ì¼";
  if(task.routineKind==="weekly") return `ë§¤ì£¼ ${["ì¼","ì›”","í™”","ìˆ˜","ëª©","ê¸ˆ","í† "][Number(task.routineValue||0)]}ìš”ì¼`;
  return `ë§¤ì›” ${Number(task.routineValue||1)}ì¼`;
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
    const data=readJson<NotebookData>(notebookKey,{fields:["ì„œë¬´","ê³µë¬´ì§ê¸‰ì—¬","ë³´ì•ˆ"],customTypes:[],tasks:[]});
    setNotebook({...data,fields:Array.isArray(data.fields)?data.fields:[],customTypes:Array.isArray(data.customTypes)?data.customTypes:[],tasks:Array.isArray(data.tasks)?data.tasks.map(t=>({...t,startDate:t.startDate||t.deadline||""})):[]});
    setFavorites(readJson<string[]>(favoriteKey,[])); setRecents(readJson<string[]>(recentKey,[]));
    setToday(new Intl.DateTimeFormat("ko-KR",{year:"numeric",month:"long",day:"numeric",weekday:"long"}).format(new Date()));
    setReady(true);
  },[]);
  useEffect(()=>{ const sync=()=>{const top=document.getElementById("notebook-home")?.offsetTop??window.innerHeight;setNotebookVisible(window.scrollY>=top-180);};sync();window.addEventListener("scroll",sync,{passive:true});window.addEventListener("resize",sync);return()=>{window.removeEventListener("scroll",sync);window.removeEventListener("resize",sync);}; },[]);
  useEffect(()=>{ if(ready) window.localStorage.setItem(notebookKey,JSON.stringify(notebook)); },[notebook,ready]);
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
  const openTool=(tool:Tool)=>{ const next=[tool.id,...recents.filter(id=>id!==tool.id)].slice(0,6); setRecents(next); localStorage.setItem(recentKey,JSON.stringify(next)); if(tool.download){ const a=document.createElement("a");a.href=tool.href;a.download="SalaryRPA_Extension.zip";a.click();setToast("ê¸‰ì—¬ RPA ë‹¤ìš´ë¡œë“œë¥¼ ì‹œì‘í–ˆìŠµë‹ˆë‹¤."); }else setActiveTool(tool); setMenuOpen(false); };
  const openNewTask=(date="")=>{ setEditingId(null);setNewType("");setDraft({...emptyTask(),field:notebook.fields[0]||"",startDate:date,deadline:date});setTaskModal(true); };
  const editTask=(task:Task)=>{ const {id,createdAt,...rest}=task;void id;void createdAt;setEditingId(task.id);setNewType("");setDraft(rest);setTaskModal(true); };
  const saveTask=(e:FormEvent)=>{ e.preventDefault(); if(!draft.title.trim()){setToast("ì—…ë¬´ ì œëª©ì„ ì…ë ¥í•´ ì£¼ì„¸ìš”.");return;} if(!draft.field){setToast("ì—…ë¬´ í•„ë“œë¥¼ ë¨¼ì € ì„¤ì •í•´ ì£¼ì„¸ìš”.");return;} if(draft.mode==="temporary"&&draft.startDate&&draft.deadline&&draft.startDate>draft.deadline){setToast("ì¢…ë£Œì¼ì€ ì‹œì‘ì¼ë³´ë‹¤ ë¹ ë¥¼ ìˆ˜ ì—†ìŠµë‹ˆë‹¤.");return;} const normalizedDraft=draft.mode==="temporary"?{...draft,startDate:draft.startDate||draft.deadline,deadline:draft.deadline||draft.startDate}:draft; const type=(draft.type==="__custom"?newType:draft.type).trim(); if(draft.type==="__custom"&&!type){setToast("ìƒˆ ì—…ë¬´ ìœ í˜•ì„ ì…ë ¥í•´ ì£¼ì„¸ìš”.");return;} const nextTypes=type&&!defaultTypes.includes(type)&&!notebook.customTypes.includes(type)?[...notebook.customTypes,type]:notebook.customTypes; setNotebook(n=>({...n,customTypes:nextTypes,tasks:editingId?n.tasks.map(t=>t.id===editingId?{...t,...normalizedDraft,title:draft.title.trim(),type}:t):[...n.tasks,{...normalizedDraft,title:draft.title.trim(),type,id:uid(),createdAt:new Date().toISOString()}]})); setTaskModal(false);setToast(editingId?"ì—…ë¬´ë¥¼ ìˆ˜ì •í–ˆìŠµë‹ˆë‹¤.":"ì—…ë¬´ë¥¼ ì¶”ê°€í–ˆìŠµë‹ˆë‹¤."); };
  const updateStatus=(id:string,status:TaskStatus)=>setNotebook(n=>({...n,tasks:n.tasks.map(t=>t.id===id?{...t,status}:t)}));
  const deleteTask=(id:string)=>{ if(!window.confi×®¶¶‰ËkºwµçM¡¥À¡¥Àµ…±•¹‘…ÈˆøñÍÁ…¸ûŠZ„ğ½ÍÁ…¸øñˆû²vó²‚Tƒ²^ÃªÊÀğ½ˆøñÍµ…±°û².s²zG®Ú¶Àƒ²Š®3ªæ3² ğ½Íµ…±°øğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰™±½…Ñ¥¹œµ¡¥À¡¥ÀµÑ½½±ÌˆøñÍÁ…¸ûŠ2`ğ½ÍÁ…¸øñˆû²^®²Ğƒ®>ªÖ°ğ½ˆøñÍµ…±°ùíÑ½½±Ì¹±•¹Ñ¡÷ªÂpƒ¶VsªÎÏ²^@ğ½Íµ…±°øğ½‘¥Øø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€ğ½Í•Ñ¥½¸ø(€€€€€€ğ½‘¥Øø(€€€€€€ñ™½½Ñ•È±…ÍÍ9…µ”ô‰±…¹‘¥¹œµ™½½Ñ•ÈˆøñÍÁ…¸ùM=5T19ƒ
Ü€ÈÀÈØğ½ÍÁ…¸øñÀ±…ÍÍ9…µ”ô‰ÍÉ½±°µÕ”ˆû²*“¶³®†“¶Vc²^°ƒ²^®²Ó²"c²Ê¤ƒ®ÎÓªâÀ€ñˆûŠLğ½ˆøğ½Àøğ½™½½Ñ•Èø(€€€€ğ½Í•Ñ¥½¸ø(€€€€ñ…Í¥‘”±…ÍÍ9…µ”õíÍ¥‘•‰…È€‘íµ•¹Õ=Á•¸ü‰¥Ìµ½Á•¸ˆèˆ‰õô…É¥„µ±…‰•°ô‹²ğƒ®¦S®&Ğˆø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰É…¹ˆ½¹±¥¬õí½!½µ•ôÉ½±”ô‰‰ÕÑÑ½¸ˆÑ…‰%¹‘•àõìÁôøñÍÁ…¸±…ÍÍ9…µ”ô‰‰É…¹µµ…É¬ˆøñ¤¼øñ¤¼øñ¤¼øğ½ÍÁ…¸øñÍÁ…¸øñÍÑÉ½¹œû²s®²Ó®zs®Npğ½ÍÑÉ½¹œøñÍµ…±°û²^®²Ğƒ¶^#®â0ğ½Íµ…±°øğ½ÍÁ…¸øğ½‘¥Øø(€€€€€€ñ¹…Ø±…ÍÍ9…µ”ô‰Í¥‘”µ¹…Ø¹½Ñ•‰½½¬µ¹…Øˆø(€€€€€€€€ñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰…Ñ¥Ù”ˆ½¹±¥¬õì ¤ôùÍÉ½±±Q¼ ‰¹½Ñ•‰½½¬µ¡½µ”ˆ¥ôøñÍÁ…¸ûŠZŒğ½ÍÁ…¸øƒ²^®²Ó²"c²Ê¤ğ½‰ÕÑÑ½¸ø(€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤ôùÍÉ½±±Q¼ ‰…±•¹‘…Èˆ¥ôøñÍÁ…¸ûŠZ„ğ½ÍÁ…¸øƒ®.³®‚”ğ½‰ÕÑÑ½¸ø(€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤ôùÍÉ½±±Q¼ ‰­…¹‰…¸ˆ¥ôøñÍÁ…¸ûŠZğ½ÍÁ…¸øƒ²æã®Â`ğ½‰ÕÑÑ½¸ø(€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤ôùÍÉ½±±Q¼ ‰™¥•±µ±¥ÍĞˆ¥ôøñÍÁ…¸ûŠbÜğ½ÍÁ…¸øƒ¶V®Ns®Îƒ²^®²Ğğ½‰ÕÑÑ½¸ø(€€€€€€€€ñÀû²^®²Ğƒ®>ªÖ°ğ½ÀùíÑ½½±Ì¹µ…À¡Ğôøñ‰ÕÑÑ½¸­•äõíĞ¹¥‘ô½¹±¥¬õì ¤ôù½Á•¹Q½½°¡Ğ¥ôøñÍÁ…¸±…ÍÍ9…µ”õí¹…ØµÑ½½°µµ…É¬Ñ½¹”´‘íĞ¹Ñ½¹•õôùíĞ¹µ…É­ôğ½ÍÁ…¸ùíĞ¹Í¡½ÉÑ9…µ•ôğ½‰ÕÑÑ½¸ø¥ô(€€€€€€ğ½¹…Øø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Í¥‘•‰…ÈµÍÁ…•Èˆ¼øñ‘¥Ø±…ÍÍ9…µ”ô‰‰…­ÕÀµ…ÉˆøñÍÁ…¸±…ÍÍ9…µ”ô‰‰…­ÕÀµ¥½¸ˆûŠœğ½ÍÁ…¸øñÍÑÉ½¹œû®
Ğƒ²zC®0ƒ²ÆgªâÃªâÀğ½ÍÑÉ½¹œøñÀû²^®²Ó²"c²Ê§ªÎğƒ®>ªÖ°ƒ²zC®3®–ğƒ¶Vpƒ¶23²vó®†pƒ®ÎÓªÒ¶Vc²ã²jP¸ğ½Àøñ‰ÕÑÑ½¸½¹±¥¬õí‘½İ¹±½…‘	…­ÕÁôû¶×¶V¤ƒ®ÂÇ²^ğ½‰ÕÑÑ½¸øğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰±½…°µ‰…‘”ˆøñÍÁ…¸¼û²vĞƒ®â3®vó²jÃ²‚²^@ƒ²‚²z”ğ½‘¥Øø(€€€€ğ½…Í¥‘”ø(€€€íµ•¹Õ=Á•¸˜˜ñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰µ•¹ÔµÍÉ¥´ˆ…É¥„µ±…‰•°ô‹®¦S®&Ğƒ®.¯ªâÀˆ½¹±¥¬õì ¤ôùÍ•Ñ5•¹Õ=Á•¸¡™…±Í”¥ô¼ùô(€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰Á…”ˆ¥ô‰¹½Ñ•‰½½¬µ¡½µ”ˆø(€€€€€€ñ¡•…‘•È±…ÍÍ9…µ”ô‰Ñ½Á‰…Èˆøñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰µ½‰¥±”µµ•¹Ôˆ½¹±¥¬õì ¤ôùÍ•Ñ5•¹Õ=Á•¸¡ÑÉÕ”¥ôûŠbÀğ½‰ÕÑÑ½¸øñ‘¥Ø±…ÍÍ9…µ”ô‰Í•…É µİÉ…ÀˆøñÍÁ…¸ûŠ2Tğ½ÍÁ…¸øñ¥¹ÁÕĞÙ…±Õ”õíÅÕ•Éåô½¹¡…¹”õí”ôùÍ•ÑEÕ•Éä¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ôÁ±…•¡½±‘•Èô‹²^®²Ğƒ®>ªÖ³®–ğƒªÊ²'¶Vc²ã²jPˆ¼øñ­‰ûªÊ²$ğ½­‰øğ½‘¥Øøñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰Ñ½Àµ…‘ˆ½¹±¥¬õì ¤ôù½Á•¹9•İQ…Í¬ ¥ôû¾ò,ƒ²^®²Ğƒ²ÚSªÂ ğ½‰ÕÑÑ½¸øğ½¡•…‘•Èø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰½¹Ñ•¹Ğ¹½Ñ•‰½½¬µ½¹Ñ•¹Ğˆø(€€€€€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰Ñ½‘…äµ‰½…Éˆø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ½‘…äµ¥¹ÑÉ¼ˆøñÍÁ…¸±…ÍÍ9…µ”ô‰Í•Ñ¥½¸µ­¥­•Èˆù5d]=I,ğ½ÍÁ…¸øñ Äû²b“®*c²v`ƒ²^®²Ó²"c²Ê¤ğ½ ÄøñÀùíÑ½‘…åñğ‹²b“®*`‰ôğ½Àøğ½‘¥Øø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ½‘…äµÍÕµµ…Éäˆøñ‘¥ØøñÍÑÉ½¹œùíÑ½‘…åQ…Í­Ì¹±•¹Ñ¡ôğ½ÍÑÉ½¹œøñÍÁ…¸û²b“®*`ƒ¶V€ƒ²vğğ½ÍÁ…¸øğ½‘¥Øøñ‘¥ØøñÍÑÉ½¹œùí¹½Ñ•‰½½¬¹Ñ…Í­Ì¹™¥±Ñ•È¡ĞôùĞ¹ÍÑ…ÑÕÌôôô‰‘½¥¹œˆ¤¹±•¹Ñ¡ôğ½ÍÑÉ½¹œøñÍÁ…¸û²¶Z$ƒ²’Dğ½ÍÁ…¸øğ½‘¥Øøñ‰ÕÑÑ½¸½¹±¥¬õì ¤ôù½Á•¹9•İQ…Í¬¡±½…±%M< ¤¥ôû²b“®*`ƒ²^®²Ğƒ²ÚSªÂ ğ½‰ÕÑÑ½¸øğ½‘¥Øø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ½‘…äµ±¥ÍĞˆùíÑ½‘…åQ…Í­Ì¹±•¹Ñ ıÑ½‘…åQ…Í­Ì¹µ…À¡Ğôøñ‰ÕÑÑ½¸­•äõíĞ¹¥‘ô½¹±¥¬õì ¤ôù•‘¥ÑQ…Í¬¡Ğ¥ôøñ¤±…ÍÍ9…µ”õí‘½Ğ´‘íĞ¹ÍÑ…ÑÕÍõô¼øñÍÁ…¸øñˆùíĞ¹Ñ¥Ñ±•ôğ½ˆøñÍµ…±°ùíĞ¹™¥•±‘ôƒ
ÜíĞ¹ÑåÁ•ñğ‹²vó®Â`ƒ²^®²Ğ‰ôğ½Íµ…±°øğ½ÍÁ…¸øñ•´ùíÍÑ…ÑÕÍ5•Ñ…mĞ¹ÍÑ…ÑÕÍt¹±…‰•±ôğ½•´øğ½‰ÕÑÑ½¸ø¤èñ‘¥Ø±…ÍÍ9…µ”ô‰¹½Ñ•‰½½¬µ•µÁÑäˆøñÍÁ…¸ûŠrLğ½ÍÁ…¸øñˆû²b“®*`ƒ²b#²‚W®Bpƒ²^®²ÓªÂ ƒ²^²*×®.#®.¸ğ½ˆøñÀû² ƒ²^®²Ó®–ğƒ²ÚSªÂ¶VcªÆÃ®
`ƒ®.³®‚—²^C²pƒ²vó²‚W²vƒ²²‚W¶VĞƒ®ÎÓ²ã²jP¸ğ½Àøğ½‘¥Øùôğ½‘¥Øø(€€€€€€€€ğ½Í•Ñ¥½¸ø((€€€€€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰¹½Ñ•‰½½¬µÍ•Ñ¥½¸…±•¹‘…ÈµÍ•Ñ¥½¸ˆ¥ô‰…±•¹‘…Èˆø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Í•Ñ¥½¸µ¡•…‘¥¹œˆøñ‘¥ØøñÍÁ…¸±…ÍÍ9…µ”ô‰Í•Ñ¥½¸µ­¥­•Èˆù19Hğ½ÍÁ…¸øñ Èû²^®²Ğƒ®.³®‚”ğ½ Èøğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰…±•¹‘…Èµ½¹ÑÉ½±Ìˆøñ‰ÕÑÑ½¸½¹±¥¬õì ¤ôùÍ•Ñ5½¹Ñ ¡¹•Ü…Ñ”¡µ½¹Ñ ¹•ÑÕ±±e•…È ¤±µ½¹Ñ ¹•Ñ5½¹Ñ  ¤´Ä°Ä¤¥ôûŠ@ğ½‰ÕÑÑ½¸øñˆùíµ½¹Ñ ¹•ÑÕ±±e•…È ¥÷®íµ½¹Ñ ¹•Ñ5½¹Ñ  ¤¬Å÷²nPğ½ˆøñ‰ÕÑÑ½¸½¹±¥¬õì ¤ôùÍ•Ñ5½¹Ñ ¡¹•Ü…Ñ”¡µ½¹Ñ ¹•ÑÕ±±e•…È ¤±µ½¹Ñ ¹•Ñ5½¹Ñ  ¤¬Ä°Ä¤¥ôûŠHğ½‰ÕÑÑ½¸øğ½‘¥Øøğ½‘¥Øø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…±•¹‘…Èµ±…å½ÕĞˆøñ‘¥Ø±…ÍÍ9…µ”ô‰…±•¹‘…Èµ…Éˆøñ‘¥Ø±…ÍÍ9…µ”ô‰İ••­‘…äµÉ½Üˆùíl‹²vğˆ°‹²nPˆ°‹¶fPˆ°‹²"`ˆ°‹®ª¤ˆ°‹ªâ ˆ°‹¶€‰t¹µ…À¡àôøñÍÁ…¸­•äõíáôùíáôğ½ÍÁ…¸ø¥ôğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰…±•¹‘…ÈµÉ¥ˆùí…±•¹‘…É…åÌ¹µ…À ¡±¤¤ôùí¥˜ …¥É•ÑÕÉ¸€ñÍÁ…¸±…ÍÍ9…µ”ô‰…±•¹‘…Èµ‘…ä‰±…¹¬ˆ­•äõíˆ‘í¥õô¼øí½¹ÍĞ¥Í¼õ±½…±%M<¡¤±¡½±¥‘…äõµ½¹Ñ¡!½±¥‘…åÌ¹•Ğ¡¥Í¼¤±•¹ÑÉ¥•Ìõ¹½Ñ•‰½½¬¹Ñ…Í­Ì¹™¥±Ñ•È¡ĞôùÑ…Í­=ÕÉÌ¡Ğ±¤¤¹Í±¥” À°Ì¤íÉ•ÑÕÉ¸€ñ‘¥Ø­•äõí¥Í½ô±…ÍÍ9…µ”õí…±•¹‘…Èµ‘…ä€‘í¥Í¼ôôõÍ•±•Ñ•‘…Ñ”ü‰Í•±•Ñ•ˆèˆ‰ô€‘í¥Í¼ôôõ±½…±%M< ¤ü‰Ñ½‘…äˆèˆ‰ô€‘í¡½±¥‘…äü‰¡½±¥‘…äˆèˆ‰õôøñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰‘…äµ¹Õµ‰•Èˆ½¹±¥¬õì ¤ôùÍ•ÑM•±•Ñ•‘…Ñ”¡¥Í¼¥ôÑ¥Ñ±”õí¡½±¥‘…äü¹¹…µ•ôøñˆùí¹•Ñ…Ñ” ¥ôğ½ˆùí¡½±¥‘…ä˜˜ñÍµ…±°ùí¡½±¥‘…ä¹¹…µ•ôğ½Íµ…±°ùôğ½‰ÕÑÑ½¸øñ‘¥Ø±…ÍÍ9…µ”ô‰…±•¹‘…Èµ•Ù•¹ÑÌˆùí•¹ÑÉ¥•Ì¹µ…À¡Ğôùí½¹ÍĞÍÑ…ÉĞõĞ¹ÍÑ…ÉÑ…Ñ•ññĞ¹‘•…‘±¥¹”±•¹õĞ¹‘•…‘±¥¹•ññĞ¹ÍÑ…ÉÑ…Ñ”±±•™ĞõĞ¹µ½‘”ôôô‰Ñ•µÁ½É…Éäˆ˜™	½½±•…¸¡ÍÑ…ÉĞ˜™ÍÑ…ÉĞñ¥Í¼¤±É¥¡ĞõĞ¹µ½‘”ôôô‰Ñ•µÁ½É…Éäˆ˜™	½½±•…¸¡•¹˜™•¹ù¥Í¼¤±Í¡½İQ¥Ñ±”ô…±•™Ñññ¤”ÜôôôÀíÉ•ÑÕÉ¸€ñ‰ÕÑÑ½¸­•äõíĞ¹¥‘ôÑ¥Ñ±”õíĞ¹Ñ¥Ñ±•ô±…ÍÍ9…µ”õí…±•¹‘…Èµ•Ù•¹Ğ•Ù•¹Ğ´‘íĞ¹ÍÑ…ÑÕÍô€‘í±•™Ğü‰½¹Ñ¥¹Õ•Ìµ±•™Ğˆèˆ‰ô€‘íÉ¥¡Ğü‰½¹Ñ¥¹Õ•ÌµÉ¥¡Ğˆèˆ‰õô½¹±¥¬õì ¤ôù•‘¥ÑQ…Í¬¡Ğ¥ôøñÍÁ…¸ùíÍ¡½İQ¥Ñ±”ıĞ¹Ñ¥Ñ±”èˆ‰ôğ½ÍÁ…¸øğ½‰ÕÑÑ½¸ùô¥ôğ½‘¥Øøğ½‘¥Øùô¥ôğ½‘¥Øøğ½‘¥Øø(€€€€€€€€€€€€ñ…Í¥‘”±…ÍÍ9…µ”ô‰‘…äµ…•¹‘„ˆøñÍÁ…¸ùí¹•Ü%¹Ñ°¹…Ñ•Q¥µ•½Éµ…Ğ ‰­¼µ-Hˆ±íµ½¹Ñ è‰±½¹œˆ±‘…äè‰¹Õµ•É¥Œˆ±İ••­‘…äè‰Í¡½ÉĞ‰ô¤¹™½Éµ…Ğ¡¹•Ü…Ñ”¡€‘íÍ•±•Ñ•‘…Ñ•õPÀÀèÀÀèÀÁ€¤¥ôğ½ÍÁ…¸ùíÍ•±•Ñ•‘!½±¥‘…ä˜˜ñÀ±…ÍÍ9…µ”õí…•¹‘„µ¡½±¥‘…ä€‘íÍ•±•Ñ•‘!½±¥‘…ä¹ÍÕ‰ÍÑ¥ÑÕÑ”ü‰¥ÌµÍÕ‰ÍÑ¥ÑÕÑ”ˆèˆ‰õôøñ¤ûŠ^<ğ½¤ùíÍ•±•Ñ•‘!½±¥‘…ä¹¹…µ•ôğ½Àùôñ ÌùíÍ•±•Ñ•‘Q…Í­Ì¹±•¹Ñ¡÷ªÂs²v`ƒ²^®²Ğğ½ Ìøñ‘¥ØùíÍ•±•Ñ•‘Q…Í­Ì¹±•¹Ñ ıÍ•±•Ñ•‘Q…Í­Ì¹µ…À¡Ğôøñ‰ÕÑÑ½¸­•äõíĞ¹¥‘ô½¹±¥¬õì ¤ôù•‘¥ÑQ…Í¬¡Ğ¥ôøñ¤±…ÍÍ9…µ”õí‘½Ğ´‘íĞ¹ÍÑ…ÑÕÍõô¼øñÍÁ…¸øñˆùíĞ¹Ñ¥Ñ±•ôğ½ˆøñÍµ…±°ùíĞ¹™¥•±‘ôğ½Íµ…±°øğ½ÍÁ…¸øğ½‰ÕÑÑ½¸ø¤èñÀû®NÇ®†w®Bpƒ²^®²ÓªÂ ƒ²^²*×®.#®.¸ğ½Àùôğ½‘¥Øøñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰…•¹‘„µ…‘ˆ½¹±¥¬õì ¤ôù½Á•¹9•İQ…Í¬¡Í•±•Ñ•‘…Ñ”¥ôû¾ò,ƒ²vĞƒ®
ƒ²s²^@ƒ²^®²Ğƒ²ÚSªÂ ğ½‰ÕÑÑ½¸øğ½…Í¥‘”ø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€ğ½Í•Ñ¥½¸ø((€€€€€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰¹½Ñ•‰½½¬µÍ•Ñ¥½¸ˆ¥ô‰­…¹‰…¸ˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Í•Ñ¥½¸µ¡•…‘¥¹œˆøñ‘¥ØøñÍÁ…¸±…ÍÍ9…µ”ô‰Í•Ñ¥½¸µ­¥­•Èˆù]=I-1=\ğ½ÍÁ…¸øñ Èû²^®²Ğƒ²¶Z$ƒ¶b¶f¤ğ½ Èøğ½‘¥ØøñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ½½°µ½Õ¹Ğˆû²¶s®–ğƒ®ÂSªúã®¦Ğƒ²š'².pƒ®Âc²b®B§®.#®.ğ½ÍÁ…¸øğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰­…¹‰…¸µ‰½…Éˆùì¡=‰©•Ğ¹­•åÌ¡ÍÑ…ÑÕÍ5•Ñ„¤…ÌQ…Í­MÑ…ÑÕÍmt¤¹µ…À¡Ìôøñ‘¥Ø±…ÍÍ9…µ”õí­…¹‰…¸µ½±Õµ¸½±Õµ¸´‘íÍõô­•äõíÍôøñ¡•…‘•ÈøñÍÁ…¸ùíÍÑ…ÑÕÍ5•Ñ…mÍt¹µ…É­ôíÍÑ…ÑÕÍ5•Ñ…mÍt¹±…‰•±ôğ½ÍÁ…¸øñˆùí¹½Ñ•‰½½¬¹Ñ…Í­Ì¹™¥±Ñ•È¡ĞôùĞ¹ÍÑ…ÑÕÌôôõÌ¤¹±•¹Ñ¡ôğ½ˆøğ½¡•…‘•Èøñ‘¥Øùí¹½Ñ•‰½½¬¹Ñ…Í­Ì¹™¥±Ñ•È¡ĞôùĞ¹ÍÑ…ÑÕÌôôõÌ¤¹±•¹Ñ ı¹½Ñ•‰½½¬¹Ñ…Í­Ì¹™¥±Ñ•È¡ĞôùĞ¹ÍÑ…ÑÕÌôôõÌ¤¹µ…À¡ĞôøñQ…Í­…É­•äõíĞ¹¥‘ôÑ…Í¬õíÑô¼ø¤èñÀ±…ÍÍ9…µ”ô‰½±Õµ¸µ•µÁÑäˆû²^®²Ğƒ²^²v0ğ½Àùôğ½‘¥Øøğ½‘¥Øø¥ôğ½‘¥Øøğ½Í•Ñ¥½¸ø((€€€€€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰¹½Ñ•‰½½¬µÍ•Ñ¥½¸ˆ¥ô‰™¥•±µ±¥ÍĞˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Í•Ñ¥½¸µ¡•…‘¥¹œˆøñ‘¥ØøñÍÁ…¸±…ÍÍ9…µ”ô‰Í•Ñ¥½¸µ­¥­•Èˆù]=I,%1Lğ½ÍÁ…¸øñ Èû¶V®Ns®Îƒ²^®²Ğğ½ Èøğ½‘¥Øøñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰Í•Ñ¥½¸µ…Ñ¥½¸ˆ½¹±¥¬õì ¤ôùÍ•Ñ¥•±‘5½‘…°¡ÑÉÕ”¥ôû¶V®NpƒªÒ®š°ğ½‰ÕÑÑ½¸øğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰™¥•±µÉ½ÕÁÌˆùí¹½Ñ•‰½½¬¹™¥•±‘Ì¹±•¹Ñ ı¹½Ñ•‰½½¬¹™¥•±‘Ì¹µ…À¡˜ôùí½¹ÍĞ±¥ÍĞõ¹½Ñ•‰½½¬¹Ñ…Í­Ì¹™¥±Ñ•È¡ĞôùĞ¹™¥•±ôôõ˜¤íÉ•ÑÕÉ¸€ñ…ÉÑ¥±”­•äõí™ôøñ¡•…‘•Èøñ‘¥ØøñÍÁ…¸ùí˜¹Í±¥” À°Ä¥ôğ½ÍÁ…¸øñ Ìùí™ôğ½ Ìøğ½‘¥Øøñˆùí±¥ÍĞ¹±•¹Ñ¡÷ªÆĞğ½ˆøğ½¡•…‘•Èøñ‘¥Øùí±¥ÍĞ¹±•¹Ñ ı±¥ÍĞ¹µ…À¡ĞôøñQ…Í­…É­•äõíĞ¹¥‘ôÑ…Í¬õíÑô½µÁ…Ğ¼ø¤èñÀû®NÇ®†w®Bpƒ²^®²ÓªÂ ƒ²^²*×®.#®.¸ğ½Àùôğ½‘¥Øøñ‰ÕÑÑ½¸½¹±¥¬õì ¤ôùíÍ•Ñ‘¥Ñ¥¹%¡¹Õ±°¤íÍ•ÑÉ…™Ğ¡ì¸¸¹•µÁÑåQ…Í¬ ¤±™¥•±é™ô¤íÍ•ÑQ…Í­5½‘…°¡ÑÉÕ”¥õôû¾ò,í™ôƒ²^®²Ğƒ²ÚSªÂ ğ½‰ÕÑÑ½¸øğ½…ÉÑ¥±”ùô¤èñ‘¥Ø±…ÍÍ9…µ”ô‰¹½Ñ•‰½½¬µ•µÁÑäİ¥‘”ˆøñˆû²^®²Ğƒ¶V®Ns®–ğƒ®¢ó²‚ ƒ²“²‚W¶VĞƒ²ó²ã²jP¸ğ½ˆøñ‰ÕÑÑ½¸½¹±¥¬õì ¤ôùÍ•Ñ¥•±‘5½‘…°¡ÑÉÕ”¥ôû¶V®Npƒ²“²‚Tğ½‰ÕÑÑ½¸øğ½‘¥Øùôğ½‘¥Øøğ½Í•Ñ¥½¸ø((€€€€€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰Í•Ñ¥½¸µ‰±½¬Ñ½½±ÌµÍ•Ñ¥½¸ˆ¥ô‰…±°µÑ½½±Ìˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Í•Ñ¥½¸µ¡•…‘¥¹œˆøñ‘¥ØøñÍÁ…¸±…ÍÍ9…µ”ô‰Í•Ñ¥½¸µ­¥­•Èˆù]=I,Q==1Lğ½ÍÁ…¸øñ ÈûªâÃ²†Ğƒ²^®²Ğƒ®>ªÖ°ğ½ Èøğ½‘¥ØøñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ½½°µ½Õ¹ĞˆùíÙ¥Í¥‰±•Q½½±Ì¹±•¹Ñ¡÷ªÂs²v`ƒ®>ªÖ°ğ½ÍÁ…¸øğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ½½°µÉ¥ˆùíÙ¥Í¥‰±•Q½½±Ì¹µ…À ¡Ğ±¤¤ôøñ…ÉÑ¥±”±…ÍÍ9…µ”õíÑ½½°µ…ÉÑ½¹”´‘íĞ¹Ñ½¹•õô­•äõíĞ¹¥‘ôÍÑå±”õíìˆ´µ‘•±…äˆé€‘í¤¨ÌÕõµÍô…ÌI•…Ğ¹MMAÉ½Á•ÉÑ¥•Íôøñ‘¥Ø±…ÍÍ9…µ”ô‰…ÉµÑ½ÀˆøñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ½½°µµ…É¬ˆùíĞ¹µ…É­ôğ½ÍÁ…¸øñ‰ÕÑÑ½¸±…ÍÍ9…µ”õí™…Ù½É¥Ñ”€‘í™…Ù½É¥Ñ•Ì¹¥¹±Õ‘•Ì¡Ğ¹¥¤ü‰¥Ìµ™…Ù½É¥Ñ”ˆèˆ‰õô½¹±¥¬õì ¤ôùÑ½±•…Ù½É¥Ñ”¡Ğ¹¥¥ôûŠbğ½‰ÕÑÑ½¸øğ½‘¥ØøñÍÁ…¸±…ÍÍ9…µ”ô‰…Ñ•½Éäµ±…‰•°ˆùíĞ¹…Ñ•½Éåôğ½ÍÁ…¸øñ ÌùíĞ¹¹…µ•ôğ½ ÌøñÀùíĞ¹‘•ÍÉ¥ÁÑ¥½¹ôğ½Àøñ‘¥Ø±…ÍÍ9…µ”ô‰™•…ÑÕÉ”µ±¥ÍĞˆùíĞ¹™•…ÑÕÉ•Ì¹µ…À¡àôøñÍÁ…¸­•äõíáôøíáôğ½ÍÁ…¸ø¥ôğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰…Éµ™½½Ñ•ÈˆøñÍÁ…¸±…ÍÍ9…µ”ô‰Í…Ù”µÍÑ…Ñ”ˆøñ¤¼ùíĞ¹‘½İ¹±½…ü‹¶23²vğƒªâÃ®Â`ˆè‹®â3®vó²jÃ²‚ ƒ²‚²z”‰ôğ½ÍÁ…¸øñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰½Á•¸µ‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôù½Á•¹Q½½°¡Ğ¥ôùíĞ¹‘½İ¹±½…ü‹®.“²jÓ®†s®Npˆè‹²^ÓªâÀ‰ô€ñÍÁ…¸ùíĞ¹‘½İ¹±½…ü‹ŠLˆè‹ŠH‰ôğ½ÍÁ…¸øğ½‰ÕÑÑ½¸øğ½‘¥Øøğ½…ÉÑ¥±”ø¥ôğ½‘¥Øøğ½Í•Ñ¥½¸ø(€€€€€€€€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰±½İ•ÈµÉ¥ˆøñ‘¥Ø±…ÍÍ9…µ”ô‰É••¹ĞµÁ…¹•°ˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Á…¹•°µ¡•…‘¥¹œˆøñ‘¥ØøñÍÁ…¸±…ÍÍ9…µ”ô‰Í•Ñ¥½¸µ­¥­•ÈˆùI9Pğ½ÍÁ…¸øñ Èû²ÖsªŞğƒ²
³²j¤ƒ®>ªÖ°ğ½ Èøğ½‘¥Øøğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰É••¹Ğµ±¥ÍĞˆùíÉ••¹ÑÌ¹Í±¥” À°Ì¤¹µ…À¡¥ôùÑ½½±Ì¹™¥¹¡ĞôùĞ¹¥ôôõ¥¤¤¹™¥±Ñ•È¡	½½±•…¸¤¹µ…À¡Ğôøñ‰ÕÑÑ½¸­•äõíĞ„¹¥‘ô½¹±¥¬õì ¤ôù½Á•¹Q½½°¡Ğ„¥ôøñÍÁ…¸±…ÍÍ9…µ”õíÉ••¹Ğµµ…É¬Ñ½¹”´‘íĞ„¹Ñ½¹•õôùíĞ„¹µ…É­ôğ½ÍÁ…¸øñÍÁ…¸øñˆùíĞ„¹Í¡½ÉÑ9…µ•ôğ½ˆøñÍµ…±°û²ÖsªŞğƒ²
³²j§¶Vpƒ®>ªÖ°ğ½Íµ…±°øğ½ÍÁ…¸øñ¤ûŠHğ½¤øğ½‰ÕÑÑ½¸ø¥ôğ½‘¥Øøğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰‘…Ñ„µÁ…¹•°ˆøñÍÁ…¸±…ÍÍ9…µ”ô‰Í•Ñ¥½¸µ­¥­•ÈˆùQIğ½ÍÁ…¸øñ Èû²zC®3®*Pƒ®
Ğƒ®â3®vó²jÃ²‚²^@ğ½ ÈøñÀû²^®²Ó²"c²Ê§ªÎğƒªâÃ²†Ğƒ®>ªÖ³²v`ƒ®
Ó²j§²v ƒ¶b²z°ƒ®â3®vó²jÃ²‚²^@ƒ²‚²z—®B§®.#®.¸ƒ²’G²jS¶Vpƒ²zC®3®*Pƒ¶×¶V§®ÂÇ²^²ró®†pƒ®ÎÓªÒ¶VĞƒ²ó²ã²jP¸ğ½Àøñ‘¥Ø±…ÍÍ9…µ”ô‰‘…Ñ„µ…Ñ¥½¹Ìˆøñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰‰…­ÕÀµ…Ñ¥½¸ˆ½¹±¥¬õí‘½İ¹±½…‘	…­ÕÁôûŠœƒ¶×¶V§®ÂÇ²^ƒ²‚²z”ğ½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰É•ÍÑ½É”µ…Ñ¥½¸ˆ½¹±¥¬õì ¤ôùÉ•ÍÑ½É•%¹ÁÕĞ¹ÕÉÉ•¹Ğü¹±¥¬ ¥ôûŠ”ƒ®ÂÇ²^ƒ®Î×²n@ğ½‰ÕÑÑ½¸øğ½‘¥Øøñ¥¹ÁÕĞÉ•˜õíÉ•ÍÑ½É•%¹ÁÕÑô±…ÍÍ9…µ”ô‰Ù¥ÍÕ…±±äµ¡¥‘‘•¸ˆÑåÁ”ô‰™¥±”ˆ…•ÁĞôˆ¹©Í½¸ˆ½¹¡…¹”õíÉ•ÍÑ½É•	…­ÕÁô¼øğ½‘¥Øøğ½Í•Ñ¥½¸ø(€€€€€€€€ñ™½½Ñ•ÈøñÍÁ…¸øñˆû²s®²Ó®zs®Npğ½ˆøƒ
Üƒ¶Z'²‚W²^®²Ó®–ğƒªÂ®Î7ªÊ0ğ½ÍÁ…¸øñÍÁ…¸û²^®²Ó²"c²Ê§ªÎğƒ®>ªÖ³®*Pƒ®â3®vó²jÃ²‚²^C²pƒ².“¶Z'®B§®.#®.¸ğ½ÍÁ…¸øğ½™½½Ñ•Èø(€€€€€€ğ½‘¥Øø(€€€€ğ½Í•Ñ¥½¸ø((€€€íÑ…Í­5½‘…°˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰µ½‘…°µ‰…­‘É½ÀˆÉ½±”ô‰‘¥…±½œˆ…É¥„µµ½‘…°ô‰ÑÉÕ”ˆøñ™½É´±…ÍÍ9…µ”ô‰Ñ…Í¬µµ½‘…°ˆ½¹MÕ‰µ¥ĞõíÍ…Ù•Q…Í­ôøñ¡•…‘•Èøñ‘¥ØøñÍÁ…¸±…ÍÍ9…µ”ô‰Í•Ñ¥½¸µ­¥­•Èˆù]=I,Iğ½ÍÁ…¸øñ Èùí•‘¥Ñ¥¹%ü‹²^®²Ğƒ²"c²‚Tˆè‹² ƒ²^®²Ğƒ²ÚSªÂ ‰ôğ½ Èøğ½‘¥Øøñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤ôùÍ•ÑQ…Í­5½‘…°¡™…±Í”¥ôû\ğ½‰ÕÑÑ½¸øğ½¡•…‘•Èøñ‘¥Ø±…ÍÍ9…µ”ô‰™½É´µÉ¥ˆøñ±…‰•°±…ÍÍ9…µ”ô‰™Õ±°ˆû²^®²Ğƒ²‚s®ª¤€ñˆø¨ğ½ˆøñ¥¹ÁÕĞ…ÕÑ½½ÕÌÙ…±Õ”õí‘É…™Ğ¹Ñ¥Ñ±•ô½¹¡…¹”õí”ôùÍ•ÑÉ…™Ğ¡ì¸¸¹‘É…™Ğ±Ñ¥Ñ±”é”¹Ñ…É•Ğ¹Ù…±Õ•ô¥ôÁ±…•¡½±‘•Èô‹²b è€ÈÀÈÛ®ƒ²r²nC¶j0ƒ¶j3²vc®†tƒ®ÎÓªÎ€ˆ¼øğ½±…‰•°øñ±…‰•°û²^®²Ğƒ¶V®Np€ñˆø¨ğ½ˆøñÍ•±•ĞÙ…±Õ”õí‘É…™Ğ¹™¥•±‘ô½¹¡…¹”õí”ôùÍ•ÑÉ…™Ğ¡ì¸¸¹‘É…™Ğ±™¥•±é”¹Ñ…É•Ğ¹Ù…±Õ•ô¥ôøñ½ÁÑ¥½¸Ù…±Õ”ôˆˆû²ƒ¶tğ½½ÁÑ¥½¸ùí¹½Ñ•‰½½¬¹™¥•±‘Ì¹µ…À¡˜ôøñ½ÁÑ¥½¸­•äõí™ôùí™ôğ½½ÁÑ¥½¸ø¥ôğ½Í•±•Ğøğ½±…‰•°øñ±…‰•°û²^®²Ğƒ²rƒ¶bTñÍ•±•ĞÙ…±Õ”õí‘É…™Ğ¹ÑåÁ•ô½¹¡…¹”õí”ôùÍ•ÑÉ…™Ğ¡ì¸¸¹‘É…™Ğ±ÑåÁ”é”¹Ñ…É•Ğ¹Ù…±Õ•ô¥ôøñ½ÁÑ¥½¸Ù…±Õ”ôˆˆû²ƒ¶tƒ²V ƒ¶V ğ½½ÁÑ¥½¸ùíl¸¸¹‘•™…Õ±ÑQåÁ•Ì°¸¸¹¹½Ñ•‰½½¬¹ÕÍÑ½µQåÁ•Ít¹µ…À¡Ğôøñ½ÁÑ¥½¸­•äõíÑôùíÑôğ½½ÁÑ¥½¸ø¥ôñ½ÁÑ¥½¸Ù…±Õ”ô‰}}ÕÍÑ½´ˆû²²‚Dƒ²ÚSªÂ ğ½½ÁÑ¥½¸øğ½Í•±•Ğøğ½±…‰•°ùí‘É…™Ğ¹ÑåÁ”ôôô‰}}ÕÍÑ½´ˆ˜˜ñ±…‰•°±…ÍÍ9…µ”ô‰™Õ±°ˆû² ƒ²^®²Ğƒ²rƒ¶bTñ¥¹ÁÕĞÙ…±Õ”õí¹•İQåÁ•ô½¹¡…¹”õí”ôùÍ•Ñ9•İQåÁ”¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ôÁ±…•¡½±‘•Èô‹²^®²Ğƒ²rƒ¶bTƒ²z®‚”ˆ¼øğ½±…‰•°ùôñ±…‰•°û²^®²Ğƒ¶bW¶pñÍ•±•ĞÙ…±Õ”õí‘É…™Ğ¹µ½‘•ô½¹¡…¹”õí”ôùÍ•ÑÉ…™Ğ¡ì¸¸¹‘É…™Ğ±µ½‘”é”¹Ñ…É•Ğ¹Ù…±Õ”…Ì]½É­5½‘•ô¥ôøñ½ÁÑ¥½¸Ù…±Õ”ô‰Ñ•µÁ½É…Éäˆû²vó².s²‚ğ½½ÁÑ¥½¸øñ½ÁÑ¥½¸Ù…±Õ”ô‰É½ÕÑ¥¹”ˆû®£¶.Ğğ½½ÁÑ¥½¸øğ½Í•±•Ğøğ½±…‰•°øñ±…‰•°û²¶Z$ƒ²¶pñÍ•±•ĞÙ…±Õ”õí‘É…™Ğ¹ÍÑ…ÑÕÍô½¹¡…¹”õí”ôùÍ•ÑÉ…™Ğ¡ì¸¸¹‘É…™Ğ±ÍÑ…ÑÕÌé”¹Ñ…É•Ğ¹Ù…±Õ”…ÌQ…Í­MÑ…ÑÕÍô¥ôùí=‰©•Ğ¹•¹ÑÉ¥•Ì¡ÍÑ…ÑÕÍ5•Ñ„¤¹µ…À ¡m¬±Ùt¤ôøñ½ÁÑ¥½¸­•äõí­ôÙ…±Õ”õí­ôùíØ¹±…‰•±ôğ½½ÁÑ¥½¸ø¥ôğ½Í•±•Ğøğ½±…‰•°ùí‘É…™Ğ¹µ½‘”ôôô‰É½ÕÑ¥¹”ˆüğøñ±…‰•°û®Âc®ÎÔƒ²óªâÀñÍ•±•ĞÙ…±Õ”õí‘É…™Ğ¹É½ÕÑ¥¹•-¥¹‘ô½¹¡…¹”õí”ôùÍ•ÑÉ…™Ğ¡ì¸¸¹‘É…™Ğ±É½ÕÑ¥¹•-¥¹é”¹Ñ…É•Ğ¹Ù…±Õ”…ÌI½ÕÑ¥¹•-¥¹±É½ÕÑ¥¹•Y…±Õ”èˆ‰ô¥ôøñ½ÁÑ¥½¸Ù…±Õ”ô‰‘…¥±äˆû®“²vğğ½½ÁÑ¥½¸øñ½ÁÑ¥½¸Ù…±Õ”ô‰İ••­±äˆû®“²ğğ½½ÁÑ¥½¸øñ½ÁÑ¥½¸Ù…±Õ”ô‰µ½¹Ñ¡±äˆû®“²nPğ½½ÁÑ¥½¸øğ½Í•±•Ğøğ½±…‰•°øñ±…‰•°ùí‘É…™Ğ¹É½ÕÑ¥¹•-¥¹ôôô‰İ••­±äˆü‹²jS²vğˆé‘É…™Ğ¹É½ÕÑ¥¹•-¥¹ôôô‰µ½¹Ñ¡±äˆü‹®
ƒ²pˆè‹®Âc®ÎÔ‰õí‘É…™Ğ¹É½ÕÑ¥¹•-¥¹ôôô‰İ••­±äˆüñÍ•±•ĞÙ…±Õ”õí‘É…™Ğ¹É½ÕÑ¥¹•Y…±Õ•ô½¹¡…¹”õí”ôùÍ•ÑÉ…™Ğ¡ì¸¸¹‘É…™Ğ±É½ÕÑ¥¹•Y…±Õ”é”¹Ñ…É•Ğ¹Ù…±Õ•ô¥ôùíl‹²vğˆ°‹²nPˆ°‹¶fPˆ°‹²"`ˆ°‹®ª¤ˆ°‹ªâ ˆ°‹¶€‰t¹µ…À ¡±¤¤ôøñ½ÁÑ¥½¸Ù…±Õ”õí¥ô­•äõí‘ôùí‘÷²jS²vğğ½½ÁÑ¥½¸ø¥ôğ½Í•±•Ğøé‘É…™Ğ¹É½ÕÑ¥¹•-¥¹ôôô‰µ½¹Ñ¡±äˆüñ¥¹ÁÕĞÑåÁ”ô‰¹Õµ‰•Èˆµ¥¸ôˆÄˆµ…àôˆÌÄˆÙ…±Õ”õí‘É…™Ğ¹É½ÕÑ¥¹•Y…±Õ•ô½¹¡…¹”õí”ôùÍ•ÑÉ…™Ğ¡ì¸¸¹‘É…™Ğ±É½ÕÑ¥¹•Y…±Õ”é”¹Ñ…É•Ğ¹Ù…±Õ•ô¥ôÁ±…•¡½±‘•ÈôˆÅøÌÄˆ¼øèñ¥¹ÁÕĞÙ…±Õ”ô‹®“²vğˆ‘¥Í…‰±•¼ùôğ½±…‰•°øñ±…‰•°±…ÍÍ9…µ”ô‰™Õ±°ˆû®Âc®ÎÔƒ².s²zG²vğñ¥¹ÁÕĞÑåÁ”ô‰‘…Ñ”ˆÙ…±Õ”õí‘É…™Ğ¹ÍÑ…ÉÑ…Ñ•ô½¹%¹ÁÕĞõí”ôùÍ•ÑÉ…™Ğ¡ì¸¸¹‘É…™Ğ±ÍÑ…ÉÑ…Ñ”é”¹ÕÉÉ•¹ÑQ…É•Ğ¹Ù…±Õ•ô¥ô¼øğ½±…‰•°øğ¼øèğøñ±…‰•°û².s²zDƒ®
ƒ²pñ¥¹ÁÕĞÑåÁ”ô‰‘…Ñ”ˆÙ…±Õ”õí‘É…™Ğ¹ÍÑ…ÉÑ…Ñ•ô½¹%¹ÁÕĞõí”ôùÍ•ÑÉ…™Ğ¡ì¸¸¹‘É…™Ğ±ÍÑ…ÉÑ…Ñ”é”¹ÕÉÉ•¹ÑQ…É•Ğ¹Ù…±Õ•ô¥ô¼øğ½±…‰•°øñ±…‰•°û²Š®0ƒ®
ƒ²pƒ
Üƒ®#ªÂ@ñ¥¹ÁÕĞÑåÁ”ô‰‘…Ñ”ˆÙ…±Õ”õí‘É…™Ğ¹‘•…‘±¥¹•ô½¹%¹ÁÕĞõí”ôùÍ•ÑÉ…™Ğ¡ì¸¸¹‘É…™Ğ±‘•…‘±¥¹”é”¹ÕÉÉ•¹ÑQ…É•Ğ¹Ù…±Õ•ô¥ô¼øğ½±…‰•°øğ¼ùôñ±…‰•°±…ÍÍ9…µ”ô‰™Õ±°ˆû®¦S®ª ñÑ•áÑ…É•„É½İÌõìÑôÙ…±Õ”õí‘É…™Ğ¹µ•µ½ô½¹¡…¹”õí”ôùÍ•ÑÉ…™Ğ¡ì¸¸¹‘É…™Ğ±µ•µ¼é”¹Ñ…É•Ğ¹Ù…±Õ•ô¥ôÁ±…•¡½±‘•Èô‹²¶Z'²^@ƒ¶V²jS¶Vpƒ®¦S®ª£®–ğƒ²z®‚—¶Vc²ã²jP¸ˆ¼øğ½±…‰•°øğ½‘¥Øøñ™½½Ñ•Èùí•‘¥Ñ¥¹%üñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”ô‰‘…¹•Èµ‰Ñ¸ˆ½¹±¥¬õì ¤ôù‘•±•Ñ•Q…Í¬¡•‘¥Ñ¥¹%¥ôû²
·²‚pğ½‰ÕÑÑ½¸øèñÍÁ…¸¼ùôñ‘¥Øøñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”ô‰…¹•°µ‰Ñ¸ˆ½¹±¥¬õì ¤ôùÍ•ÑQ…Í­5½‘…°¡™…±Í”¥ôû²Ş£²0ğ½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸ÑåÁ”ô‰ÍÕ‰µ¥Ğˆ±…ÍÍ9…µ”ô‰Í…Ù”µ‰Ñ¸ˆùí•‘¥Ñ¥¹%ü‹²"c²‚Tƒ²‚²z”ˆè‹²^®²Ğƒ²ÚSªÂ ‰ôğ½‰ÕÑÑ½¸øğ½‘¥Øøğ½™½½Ñ•Èøğ½™½É´øğ½‘¥Øùô(€€€í™¥•±‘5½‘…°˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰µ½‘…°µ‰…­‘É½ÀˆÉ½±”ô‰‘¥…±½œˆ…É¥„µµ½‘…°ô‰ÑÉÕ”ˆøñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰™¥•±µµ½‘…°ˆøñ¡•…‘•Èøñ‘¥ØøñÍÁ…¸±…ÍÍ9…µ”ô‰Í•Ñ¥½¸µ­¥­•Èˆù]=I,%1Lğ½ÍÁ…¸øñ Èû²^®²Ğƒ¶V®NpƒªÒ®š°ğ½ Èøğ½‘¥Øøñ‰ÕÑÑ½¸½¹±¥¬õì ¤ôùÍ•Ñ¥•±‘5½‘…°¡™…±Í”¥ôû\ğ½‰ÕÑÑ½¸øğ½¡•…‘•ÈøñÀû²^®²Ó®Ú²z—²v`ƒ¶Àƒ®.£²r®–ğƒ®NÇ®†w¶Vc²ã²jP¸ƒªÂƒ²^®²Ğƒ²æÓ®Ns®*Pƒ¶Vc®
c²v`ƒ¶V®Ns²^@ƒ²7¶V§®.#®.¸ğ½Àøñ‘¥Ø±…ÍÍ9…µ”ô‰™¥•±µ¥¹ÁÕĞˆøñ¥¹ÁÕĞÙ…±Õ”õí¹•İ¥•±‘ô½¹¡…¹”õí”ôùÍ•Ñ9•İ¥•±¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ô½¹-•å½İ¸õí”ôùí¥˜¡”¹­•äôôô‰¹Ñ•Èˆ¥…‘‘¥•± ¥õôÁ±…•¡½±‘•Èô‹²b èƒ²s®²Ğ°ƒªÎ×®²Ó²ªâ'²^°°ƒ®ÎÓ²V ˆ¼øñ‰ÕÑÑ½¸½¹±¥¬õí…‘‘¥•±‘ôû²ÚSªÂ ğ½‰ÕÑÑ½¸øğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰™¥•±µ¡¥Àµ±¥ÍĞˆùí¹½Ñ•‰½½¬¹™¥•±‘Ì¹µ…À¡˜ôøñÍÁ…¸­•äõí™ôùí™ôñ‰ÕÑÑ½¸½¹±¥¬õì ¤ôùÉ•µ½Ù•¥•±¡˜¥ôû\ğ½‰ÕÑÑ½¸øğ½ÍÁ…¸ø¥ôğ½‘¥Øøñ™½½Ñ•Èøñ‰ÕÑÑ½¸½¹±¥¬õì ¤ôùÍ•Ñ¥•±‘5½‘…°¡™…±Í”¥ôû²f®0ğ½‰ÕÑÑ½¸øğ½™½½Ñ•Èøğ½Í•Ñ¥½¸øğ½‘¥Øùô(€€€í…Ñ¥Ù•Q½½°˜˜ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰Ñ½½°µİ½É­ÍÁ…”ˆÉ½±”ô‰‘¥…±½œˆ…É¥„µµ½‘…°ô‰ÑÉÕ”ˆøñ¡•…‘•Èøñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰İ½É­ÍÁ…”µ‰…¬ˆ½¹±¥¬õì ¤ôùÍ•ÑÑ¥Ù•Q½½°¡¹Õ±°¥ôûŠ@ğ½‰ÕÑÑ½¸øñÍÁ…¸±…ÍÍ9…µ”õíİ½É­ÍÁ…”µµ…É¬Ñ½¹”´‘í…Ñ¥Ù•Q½½°¹Ñ½¹•õôùí…Ñ¥Ù•Q½½°¹µ…É­ôğ½ÍÁ…¸øñ‘¥ØøñÍÑÉ½¹œùí…Ñ¥Ù•Q½½°¹¹…µ•ôğ½ÍÑÉ½¹œøñÍµ…±°û²s®²Ó®zs®Ns²^C²pƒ².“¶Z$ƒ²’Dğ½Íµ…±°øğ½‘¥ØøñÍÁ…¸±…ÍÍ9…µ”ô‰İ½É­ÍÁ…”µÍ…Ù•ˆøñ¤¼û®â3®vó²jÃ²‚ ƒ²‚²z”ğ½ÍÁ…¸øñ„¡É•˜õí…Ñ¥Ù•Q½½°¹¡É•™ôÑ…É•Ğô‰}‰±…¹¬ˆÉ•°ô‰¹½É•™•ÉÉ•Èˆû² ƒ²Â÷²^C²pƒ²^ÓªâÀƒŠ\ğ½„øñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰İ½É­ÍÁ…”µ±½Í”ˆ½¹±¥¬õì ¤ôùÍ•ÑÑ¥Ù•Q½½°¡¹Õ±°¥ôû¶^#®â3®†pƒ®>3²VªÂªâÀğ½‰ÕÑÑ½¸øğ½¡•…‘•Èøñ¥™É…µ”ÍÉŒõí…Ñ¥Ù•Q½½°¹¡É•™ôÑ¥Ñ±”õí…Ñ¥Ù•Q½½°¹¹…µ•ô¼øğ½Í•Ñ¥½¸ùô(€€€íÑ½…ÍĞ˜˜ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ½…ÍĞˆÉ½±”ô‰ÍÑ…ÑÕÌˆøñÍÁ…¸ûŠrLğ½ÍÁ…¸ùíÑ½…ÍÑôğ½‘¥Øùô(€€ğ½µ…¥¸øì)ô(