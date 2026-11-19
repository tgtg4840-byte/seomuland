
(()=>{
"use strict";
const KEY="seomuHub.notebook.v1";
const defaultData={fields:["서무","공무직급여","보안"],customTypes:[],tasks:[],notes:[],deskQuickMemo:"",dailyResolutions:{}};
const statusMeta={planned:{label:"예정",mark:"○"},doing:{label:"진행 중",mark:"◐"},done:{label:"완료",mark:"●"},delayed:{label:"연기",mark:"△"}};
let data=load(),month=new Date(new Date().getFullYear(),new Date().getMonth(),1),selectedDate=iso(),editingId=null,editingNoteId=null,selectedNoteId=null;
const $=id=>document.getElementById(id);
/* Import only a bounded, validated JSON data model. Never overwrite existing records
   until the complete incoming file has passed validation and storage succeeds. */
const MAX_BACKUP_BYTES=2*1024*1024;
const isRecord=v=>v!==null&&typeof v==="object"&&!Array.isArray(v);
const validText=(v,max=5000)=>typeof v==="string"&&v.length<=max;
const validDate=v=>v===""||(
 typeof v==="string"&&/^\\d{4}-\\d{2}-\\d{2}$/.test(v)&&
 !Number.isNaN(new Date(v+"T12:00:00").getTime())&&
 new Date(v+"T12:00:00").toISOString().slice(0,10)===v
);
function validateNotebook(n){
 if(!isRecord(n)||!Array.isArray(n.fields)||!Array.isArray(n.tasks)||
    n.fields.length>100||n.tasks.length>5000)throw Error("업무 항목 또는 필드 형식이 올바르지 않습니다.");
 const fields=n.fields.map(f=>{if(!validText(f,100)||!f.trim())throw Error("잘못된 업무 필드가 있습니다.");return f;});
 const customTypes=n.customTypes===undefined?[]:n.customTypes;
 if(!Array.isArray(customTypes)||customTypes.length>100||!customTypes.every(t=>validText(t,100)))throw Error("업무 유형 형식이 올바르지 않습니다.");
 const validStatuses=new Set(["planned","doing","done","delayed"]);
 const validModes=new Set(["temporary","routine"]);
 const validKinds=new Set(["daily","weekly","monthly"]);
 const usedTaskIds=new Set();
 const tasks=n.tasks.map(t=>{
  if(!isRecord(t)||!validText(t.id,100)||!t.id||usedTaskIds.has(t.id)||
     !validText(t.title,1000)||!validText(t.field,100)||!validStatuses.has(t.status)||
     !validText(t.type??"",100)||!validText(t.memo??"",10000)||
     !validModes.has(t.mode??"temporary")||!validKinds.has(t.routineKind??"daily")||
     !validText(String(t.routineValue??""),5)||!validDate(t.startDate??"")||
     !validDate(t.deadline??"")||
     (t.completedAt!==undefined&&!validText(t.completedAt,80))||
     (t.createdAt!==undefined&&!validText(t.createdAt,80))||
     (t.hiddenFromKanban!==undefined&&typeof t.hiddenFromKanban!=="boolean")
  )throw Error("잘못된 업무 데이터 또는 진행 상태가 있습니다.");
  usedTaskIds.add(t.id);
  return {id:t.id,title:t.title,field:t.field,type:t.type??"",
   memo:t.memo??"",status:t.status,mode:t.mode??"temporary",
   routineKind:t.routineKind??"daily",routineValue:String(t.routineValue??""),
   startDate:t.startDate??"",deadline:t.deadline??"",
   hiddenFromKanban:t.hiddenFromKanban===true,
   ...(t.completedAt?{completedAt:t.completedAt}:{}),
   ...(t.createdAt?{createdAt:t.createdAt}:{})};
 });
 const rawNotes=n.notes===undefined?[]:n.notes;
 if(!Array.isArray(rawNotes)||rawNotes.length>2000)throw Error("메모 개수가 허용 범위를 초과했습니다.");
 const noteIds=new Set();
 const notes=rawNotes.map(note=>{
  if(!isRecord(note)||!validText(note.id,100)||!note.id||noteIds.has(note.id)||
     !validText(note.title,1000)||!validText(note.content??"",10000)||
     !validText(note.color??"yellow",20)||!validDate(note.date??"")||
     (note.createdAt!==undefined&&!validText(note.createdAt,80))||
     (note.updatedAt!==undefined&&!validText(note.updatedAt,80)))
   throw Error("잘못된 메모 데이터가 있습니다.");
  noteIds.add(note.id);
  return {id:note.id,title:note.title,content:note.content??"",
    color:["yellow","pink","blue","green"].includes(note.color)?note.color:"yellow",
    date:note.date??"",...(note.createdAt?{createdAt:note.createdAt}:{}),
    ...(note.updatedAt?{updatedAt:note.updatedAt}:{})};
 });
 const rawResolutions=n.dailyResolutions??{};
 if(!isRecord(rawResolutions)||Object.keys(rawResolutions).length>3660)
  throw Error("다짐 데이터 형식이 올바르지 않습니다.");
 const resolutions=Object.create(null);
 for(const [day,entry] of Object.entries(rawResolutions)){
  if(!validDate(day)||!day||!validText(entry,120))throw Error("잘못된 날짜별 다짐입니다.");
  Object.defineProperty(resolutions,day,{value:entry,writable:true,enumerable:true,configurable:true});
 }
 if(!validText(n.deskQuickMemo??"",10000))throw Error("메모 내용이 너무 깁니다.");
 return {fields,customTypes:customTypes.slice(),tasks,notes,
  deskQuickMemo:n.deskQuickMemo??"",dailyResolutions:resolutions};
}
function load(){
 try{
  const raw=localStorage.getItem(KEY);
  if(raw){
   if(new Blob([raw]).size>MAX_BACKUP_BYTES)throw Error("저장된 기록이 너무 큽니다.");
   return validateNotebook(JSON.parse(raw));
  }
 }catch(e){console.warn("저장된 자료를 불러오지 못했습니다. 원본은 삭제하지 않았습니다.",e);}
 return structuredClone(defaultData);
}
function save(){try{localStorage.setItem(KEY,JSON.stringify(data));render();return true}catch(e){toast("저장에 실패했습니다. 저장 공간을 확인해 주세요.");return false}}
function saveDailyResolution(){
 const input=$("dailyResolutionInput"),content=input.value;
 if(!data.dailyResolutions||typeof data.dailyResolutions!=="object")data.dailyResolutions={};
 if(content.trim())data.dailyResolutions[selectedDate]=content;
 else delete data.dailyResolutions[selectedDate];
 try{localStorage.setItem(KEY,JSON.stringify(data))}
 catch(e){toast("오늘의 다짐을 저장하지 못했습니다.")}
}
function saveQuickMemo(){data.deskQuickMemo=$("deskQuickMemo").value;try{localStorage.setItem(KEY,JSON.stringify(data))}catch(e){toast("메모를 저장하지 못했습니다. 저장 공간을 확인해 주세요.")}}
function iso(d=new Date()){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");return `${y}-${m}-${day}`}
function uid(){return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`}
function esc(v){return String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]))}
function dateLabel(v){if(!v)return"기한 없음";return new Intl.DateTimeFormat("ko-KR",{month:"short",day:"numeric"}).format(new Date(v+"T00:00:00"))}
function scheduleLabel(t){if(t.mode!=="routine"){const a=t.startDate||t.deadline,b=t.deadline||t.startDate;if(!a&&!b)return"기한 없음";return a===b?dateLabel(a):`${dateLabel(a)}–${dateLabel(b)}`}if(t.routineKind==="weekly")return`매주 ${["일","월","화","수","목","금","토"][Number(t.routineValue||0)]}요일`;if(t.routineKind==="monthly")return`매월 ${Number(t.routineValue||1)}일`;return"매일"}
function occurs(t,d){const v=iso(d);if(t.mode!=="routine"){const a=t.startDate||t.deadline,b=t.deadline||t.startDate;return!!(a&&b&&a<=v&&v<=b)}if(t.startDate&&t.startDate>v)return false;if(t.routineKind==="weekly")return String(d.getDay())===String(t.routineValue||0);if(t.routineKind==="monthly")return String(d.getDate())===String(Number(t.routineValue||1));return true}
function toast(msg){const el=$("toast");el.textContent=msg;el.classList.remove("hidden");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.add("hidden"),2300)}
function taskCard(t){return `<article class="card"><div class="card-top"><span class="pill">${esc(t.field)}</span><button class="edit" data-edit="${esc(t.id)}" aria-label="업무 수정"><svg class="petit-icon" aria-hidden="true" focusable="false"><use href="#pi-pencil"></use></svg></button></div><h3>${esc(t.title)}</h3>${t.memo?`<p>${esc(t.memo)}</p>`:""}<div class="meta"><span>${t.type?"#"+esc(t.type):"일반 업무"}</span><span>${esc(scheduleLabel(t))}</span></div><select data-status="${esc(t.id)}" aria-label="진행 상태">${Object.entries(statusMeta).map(([k,v])=>`<option value="${k}" ${t.status===k?"selected":""}>${v.label}</option>`).join("")}</select></article>`}
/* One stable Little Prince-inspired sentence for each diary date. */
const petitDailyLines=[
 "정말 소중한 것은 눈으로만 볼 수 없어요.",
 "함께한 시간이 서로를 특별하게 만듭니다.",
 "당신이 돌본 장미는 그래서 더욱 소중합니다.",
 "사막의 아름다움은 보이지 않는 우물에 있습니다.",
 "누군가에게는 작은 별 하나가 온 우주가 됩니다."
];
function renderPetitDailyLine(){
 const el=document.getElementById("petitRotatingQuote");if(!el)return;
 const index=Math.floor(new Date(selectedDate+"T12:00:00").getTime()/86400000)%petitDailyLines.length;
 el.textContent=petitDailyLines[(index+petitDailyLines.length)%petitDailyLines.length];
}

function render(){

 const today=new Date(),diaryDay=new Date(selectedDate+"T00:00:00"),todayTasks=data.tasks.filter(t=>occurs(t,diaryDay));
 $("todayText").textContent=new Intl.DateTimeFormat("ko-KR",{year:"numeric",month:"long",day:"numeric",weekday:"long"}).format(today);
 $("todayCount").textContent=todayTasks.length;$("doingCount").textContent=data.tasks.filter(t=>t.status==="doing").length;$("doneCount").textContent=data.tasks.filter(t=>t.status==="done").length;
 $("todayList").innerHTML=todayTasks.length?todayTasks.map(t=>`<article class="journal-task ${esc(t.status)}"><button class="journal-task-open" type="button" data-edit="${esc(t.id)}" aria-label="${esc(t.title)} 업무 수정"><span class="journal-task-mark" aria-hidden="true">${t.status==="done"?"✓":"✦"}</span><span class="journal-task-copy"><strong>${esc(t.title)}</strong><small>${esc(t.field)} · ${esc(t.type||"일반 업무")} · ${esc(scheduleLabel(t))}</small></span><span class="journal-task-edit" aria-hidden="true">✎</span></button><label class="journal-task-status"><span>진행 상태</span><select data-status="${esc(t.id)}" aria-label="${esc(t.title)} 진행 상태 변경">${Object.entries(statusMeta).map(([k,v])=>`<option value="${k}" ${t.status===k?"selected":""}>${v.label}</option>`).join("")}</select></label></article>`).join(""):`<div class="empty"><b>이 날짜에 등록된 업무가 없습니다.</b><span>새 업무를 추가하거나 달력에서 일정을 지정해 보세요.</span></div>`;
 $("taskDateHeader").textContent=fullDiaryDate(selectedDate)+" · "+todayTasks.length+"건";
 $("noteDateHeader").textContent=fullDiaryDate(selectedDate);
 $("diaryDate").value=selectedDate;
 $("pageIndicator").textContent=fullDiaryDate(selectedDate);
 $("dailyResolutionInput").value=typeof data.dailyResolutions?.[selectedDate]==="string"?data.dailyResolutions[selectedDate]:"";
 renderPetitDailyLine();
 renderCalendar();
 renderNotes();
 $("kanbanBoard").innerHTML=Object.entries(statusMeta).map(([s,m])=>{const list=data.tasks.filter(t=>t.status===s&&!t.hiddenFromKanban);return`<section class="column"><header><span>${m.mark} ${m.label}</span><b>${list.length}</b></header><div class="cards">${list.length?list.map(taskCard).join(""):`<p class="column-empty">업무 없음</p>`}</div></section>`}).join("");
 const done=data.tasks.filter(t=>t.status==="done"&&!t.hiddenFromKanban).length;$("clearDone").disabled=!done;$("clearDone").textContent=`✦ 완료항목 일괄 정리${done?` (${done})`:""}`;
 $("fieldGrid").innerHTML=data.fields.length?data.fields.map(f=>{const list=data.tasks.filter(t=>t.field===f);return`<article class="field-box"><header><h3>${esc(f)}</h3><b>${list.length}건</b></header><div class="field-tasks">${list.length?list.map(t=>`<button class="field-task" data-edit="${esc(t.id)}"><span>${esc(t.title)}</span><small>${statusMeta[t.status].label}</small></button>`).join(""):`<div class="empty" style="padding:18px">등록된 업무가 없습니다.</div>`}</div><button class="field-add" data-add-field="${esc(f)}"><svg class="petit-icon" aria-hidden="true" focusable="false"><use href="#pi-feather"></use></svg> ${esc(f)} 업무 추가</button></article>`}).join(""):`<div class="empty"><b>업무 필드를 먼저 설정해 주세요.</b></div>`;
 bindDynamic();
}
function fullDiaryDate(v){return new Intl.DateTimeFormat("ko-KR",{year:"numeric",month:"long",day:"numeric",weekday:"long"}).format(new Date(v+"T00:00:00"))}
function noteDay(n){if(n.date)return n.date;const raw=n.createdAt||n.updatedAt;if(!raw)return iso();const d=new Date(raw);return Number.isNaN(d.getTime())?iso():iso(d)}
function renderNotes(){
 const notes=(Array.isArray(data.notes)?data.notes:[]).filter(n=>noteDay(n)===selectedDate);
 if(selectedNoteId && !notes.some(n=>n.id===selectedNoteId))selectedNoteId=null;
 const holder=$("stickyBoard"), previousScroll=holder.scrollTop;
 holder.innerHTML=notes.map(n=>`<div class="sticky editable-sticky ${["yellow","pink","blue","green"].includes(n.color)?n.color:"yellow"} ${selectedNoteId===n.id?"selected-note":""}" data-note-id="${esc(n.id)}"><div class="editable-sticky-heading"><span class="sticky-title">${esc(n.title)}</span><div><button type="button" data-note-color="${esc(n.id)}" aria-label="메모 색상 변경" title="색상 변경"><svg class="petit-icon" aria-hidden="true" focusable="false"><use href="#pi-rose"></use></svg></button><button type="button" data-note-edit="${esc(n.id)}" aria-label="메모 제목 또는 날짜 수정" title="제목·날짜 수정"><svg class="petit-icon" aria-hidden="true" focusable="false"><use href="#pi-pencil"></use></svg></button><button type="button" data-inline-delete="${esc(n.id)}" aria-label="메모 삭제" title="삭제"><svg class="petit-icon" aria-hidden="true" focusable="false"><use href="#pi-cross"></use></svg></button></div></div><textarea rows="3" data-inline-edit="${esc(n.id)}" aria-label="스티커 메모 바로 수정">${esc(n.content??n.title)}</textarea></div>`).join("")+`<button type="button" class="sticky sticky-create" id="stickyAdd"><span class="plus"><svg class="petit-icon" aria-hidden="true" focusable="false"><use href="#pi-rose"></use></svg></span><span>새 메모 붙이기</span></button>`;
 holder.scrollTop=previousScroll;
 holder.querySelectorAll("[data-note-edit]").forEach(el=>el.onclick=()=>openNote(el.dataset.noteEdit));
 holder.querySelectorAll("[data-inline-edit]").forEach(el=>el.addEventListener("input",()=>{
  const n=data.notes.find(x=>x.id===el.dataset.inlineEdit);if(!n)return;
  n.content=el.value;n.updatedAt=new Date().toISOString();persistInlineNote();
 }));
 holder.querySelectorAll("[data-note-color]").forEach(el=>el.onclick=()=>{
  const n=data.notes.find(x=>x.id===el.dataset.noteColor);if(!n)return;
  const colors=["yellow","pink","blue","green"];
  n.color=colors[(colors.indexOf(n.color)+1)%colors.length];
  n.updatedAt=new Date().toISOString();save();
 });
 holder.querySelectorAll("[data-inline-delete]").forEach(el=>el.onclick=()=>{
  if(!confirm("이 메모를 삭제하시겠습니까?"))return;
  data.notes=data.notes.filter(n=>n.id!==el.dataset.inlineDelete);save();
 });
 $("stickyAdd").onclick=()=>openNote();
 renderNoteIndex(notes);
}
function noteIndexLabel(n){
 const title=(n.title||"").trim();
 if(title)return title;
 const body=(n.content||"").trim().split(/\n+/)[0]||"제목 없는 메모";
 return body.slice(0,30);
}
function renderNoteIndex(notes){
 $("noteIndexDate").textContent=fullDiaryDate(selectedDate);
 const list=$("noteIndexList");
 if(!notes.length){
  list.innerHTML='<div class="note-index-empty">이 날짜에 등록된 스티커 메모가 없습니다. 새 메모를 추가해 보세요.</div>';
 }else{
  list.innerHTML=notes.map((n,i)=>`<button type="button" class="note-index-item ${selectedNoteId===n.id?"active":""}" data-note-jump="${esc(n.id)}"><b aria-hidden="true"><svg class="petit-icon" aria-hidden="true" focusable="false"><use href="#pi-star"></use></svg></b><span>${esc(noteIndexLabel(n))}</span></button>`).join("");
  list.querySelectorAll("[data-note-jump]").forEach(el=>el.onclick=()=>focusNoteFromIndex(el.dataset.noteJump));
 }
 $("noteIndexAdd").onclick=()=>openNote();
}
function focusNoteFromIndex(id){
 selectedNoteId=id;
 renderNotes();
 const target=document.querySelector(`[data-note-id="${CSS.escape(id)}"]`);
 if(target){
  const board=$("stickyBoard");const relativeTop=target.offsetTop-board.offsetTop;board.scrollTo({top:relativeTop,behavior:"smooth"});
  target.classList.add("selected-note");
  setTimeout(()=>target.classList.remove("selected-note"),900);
 }
}
function persistInlineNote(){
 try{localStorage.setItem(KEY,JSON.stringify(data));return true}
 catch(e){toast("메모 저장에 실패했습니다. 브라우저 저장 공간을 확인해 주세요.");return false}
}
function addInlineNote(){
 const field=$("inlineNoteInput"),value=field.value.trim();
 if(!value)return field.focus();
 if(!Array.isArray(data.notes))data.notes=[];
 data.notes.unshift({id:uid(),title:value.split("\n")[0].slice(0,80)||"스티커 메모",content:value,color:"yellow",date:selectedDate,createdAt:new Date().toISOString()});
 field.value="";save();field.focus();
}
$("inlineNoteAdd").onclick=addInlineNote;
$("inlineNoteInput").addEventListener("keydown",e=>{if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){e.preventDefault();addInlineNote()}});
function openNote(id=null){
 editingNoteId=id;
 const n=id?(data.notes||[]).find(x=>x.id===id):null;
 $("noteModalTitle").textContent=n?"스티커 메모 수정":"스티커 메모 추가";
 $("noteTitle").value=n?.title||"";
 $("noteDateInput").value=n?noteDay(n):selectedDate;
 $("noteContent").value=n?.content||"";
 const color=["yellow","pink","blue","green"].includes(n?.color)?n.color:"yellow";
 document.querySelectorAll('input[name="noteColor"]').forEach(el=>el.checked=el.value===color);
 $("deleteNoteBtn").classList.toggle("hidden",!n);
 $("noteBackdrop").classList.remove("hidden");
 $("noteTitle").focus();
}
$("newNoteBtn").onclick=()=>openNote();
$("noteForm").onsubmit=e=>{
 e.preventDefault();
 const title=$("noteTitle").value.trim(),content=$("noteContent").value.trim();
 if(!title)return toast("메모 제목을 입력해 주세요.");
 const color=document.querySelector('input[name="noteColor"]:checked')?.value||"yellow";
 const date=$("noteDateInput").value;if(!date)return toast("메모 날짜를 선택해 주세요.");
 if(!Array.isArray(data.notes))data.notes=[];
 if(editingNoteId){const n=data.notes.find(x=>x.id===editingNoteId);if(!n)return toast("해당 메모를 찾을 수 없습니다.");Object.assign(n,{title,content,color,date,updatedAt:new Date().toISOString()});}
 else data.notes.unshift({id:uid(),title,content,color,date,createdAt:new Date().toISOString()});
 $("noteBackdrop").classList.add("hidden");save();toast("메모를 저장했습니다.");
};
$("deleteNoteBtn").onclick=()=>{
 if(!editingNoteId||!confirm("이 스티커 메모를 삭제할까요?"))return;
 data.notes=data.notes.filter(n=>n.id!==editingNoteId);
 $("noteBackdrop").classList.add("hidden");save();toast("메모를 삭제했습니다.");
};
function renderCalendar(){const y=month.getFullYear(),m=month.getMonth(),last=new Date(y,m+1,0).getDate(),first=new Date(y,m,1).getDay();$("monthTitle").textContent=`${y}년 ${m+1}월`;let html="";for(let i=0;i<first;i++)html+='<div class="day blank"></div>';for(let d=1;d<=last;d++){const date=new Date(y,m,d),v=iso(date),list=data.tasks.filter(t=>occurs(t,date)).slice(0,3);html+=`<div class="day ${v===selectedDate?"selected":""} ${v===iso()?"today":""}"><button class="num" data-date="${v}">${d}</button><div class="events">${list.map(t=>`<button class="event ${t.status}" data-edit="${esc(t.id)}" title="${esc(t.title)}">${esc(t.title)}</button>`).join("")}</div></div>`}const total=first+last;for(let i=total;i%7;i++)html+='<div class="day blank"></div>';$("calendarGrid").innerHTML=html;const date=new Date(selectedDate+"T00:00:00"),list=data.tasks.filter(t=>occurs(t,date));$("agendaDate").textContent=new Intl.DateTimeFormat("ko-KR",{month:"long",day:"numeric",weekday:"short"}).format(date);$("agendaCount").textContent=`${list.length}개의 업무`;$("agendaList").innerHTML=list.length?list.map(t=>`<button class="agenda-item" data-edit="${esc(t.id)}"><b>${esc(t.title)}</b><small>${esc(t.field)} · ${statusMeta[t.status].label}</small></button>`).join(""):`<div class="empty" style="padding:22px">등록된 업무가 없습니다.</div>`}
function bindDynamic(){document.querySelectorAll("[data-edit]").forEach(el=>el.onclick=e=>{e.stopPropagation();openTask("",el.dataset.edit)});document.querySelectorAll("[data-status]").forEach(el=>el.onchange=()=>{const t=data.tasks.find(x=>x.id===el.dataset.status);if(t){if(t.status!==el.value)t.hiddenFromKanban=false;t.status=el.value;t.completedAt=el.value==="done"?(t.completedAt||new Date().toISOString()):undefined;save()}});document.querySelectorAll("[data-date]").forEach(el=>el.onclick=()=>setDiaryDate(el.dataset.date));document.querySelectorAll("[data-add-field]").forEach(el=>el.onclick=()=>openTask("",null,el.dataset.addField))}
function fillFields(selected=""){$("fieldSelect").innerHTML='<option value="">선택</option>'+data.fields.map(f=>`<option ${f===selected?"selected":""}>${esc(f)}</option>`).join("")}
function updateRoutineUI(){const routine=$("modeSelect").value==="routine";$("deadlineLabel").classList.toggle("hidden",routine);$("routineKindLabel").classList.toggle("hidden",!routine);$("routineValueLabel").classList.toggle("hidden",!routine||$("routineKind").value==="daily");$("startLabel").firstChild.textContent=routine?"반복 시작일":"시작 날짜";const kind=$("routineKind").value,sel=$("routineValue");if(kind==="weekly"){$("routineValueText").textContent="요일";sel.innerHTML=["일","월","화","수","목","금","토"].map((x,i)=>`<option value="${i}">${x}요일</option>`).join("")}else if(kind==="monthly"){ $("routineValueText").textContent="날짜";sel.innerHTML=Array.from({length:31},(_,i)=>`<option value="${i+1}">${i+1}일</option>`).join("")}}
function openTask(date="",id=null,field=""){editingId=id;const t=id?data.tasks.find(x=>x.id===id):null;$("taskModalTitle").textContent=t?"업무 수정":"새 업무 추가";fillFields(t?.field||field||data.fields[0]||"");$("titleInput").value=t?.title||"";$("typeSelect").value=t?.type||"";$("modeSelect").value=t?.mode||"temporary";$("statusSelect").value=t?.status||"planned";$("startInput").value=t?.startDate||date;$("deadlineInput").value=t?.deadline||date;$("routineKind").value=t?.routineKind||"daily";updateRoutineUI();$("routineValue").value=t?.routineValue||"";$("memoInput").value=t?.memo||"";$("deleteTaskBtn").classList.toggle("hidden",!t);$("newTaskSpacer").classList.toggle("hidden",!!t);$("taskBackdrop").classList.remove("hidden");setTimeout(()=>$("titleInput").focus(),0)}
function closeModal(which){$(which==="task"?"taskBackdrop":which==="note"?"noteBackdrop":"fieldBackdrop").classList.add("hidden")}
$("taskForm").onsubmit=e=>{e.preventDefault();const title=$("titleInput").value.trim(),field=$("fieldSelect").value;if(!title||!field)return toast("업무 제목과 필드를 입력해 주세요.");const mode=$("modeSelect").value,start=$("startInput").value,end=mode==="routine"?"":$("deadlineInput").value;if(mode!=="routine"&&start&&end&&start>end)return toast("종료일은 시작일보다 빠를 수 없습니다.");const status=$("statusSelect").value,payload={field,title,type:$("typeSelect").value,mode,routineKind:$("routineKind").value,routineValue:$("routineValue").value,startDate:start||end,deadline:end||start,status,memo:$("memoInput").value.trim(),completedAt:status==="done"?(editingId&&data.tasks.find(t=>t.id===editingId)?.completedAt||new Date().toISOString()):undefined};if(editingId){const i=data.tasks.findIndex(t=>t.id===editingId);data.tasks[i]={...data.tasks[i],...payload,...(status!==data.tasks[i].status?{hiddenFromKanban:false}:{})}}else data.tasks.push({...payload,id:uid(),createdAt:new Date().toISOString()});closeModal("task");save();toast(editingId?"업무를 수정했습니다.":"업무를 추가했습니다.")};
$("deleteTaskBtn").onclick=()=>{if(!editingId||!confirm("이 업무를 삭제할까요?"))return;data.tasks=data.tasks.filter(t=>t.id!==editingId);closeModal("task");save();toast("업무를 삭제했습니다.")};
$("newTaskBtn").onclick=()=>openTask();$("newTodayBtn").onclick=()=>openTask(selectedDate);$("agendaAdd").onclick=()=>openTask(selectedDate);$("prevMonth").onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()-1,1);render()};$("nextMonth").onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()+1,1);render()};
$("clearDone").onclick=()=>{const list=data.tasks.filter(t=>t.status==="done"&&!t.hiddenFromKanban),n=list.length;if(!n)return;if(!confirm(`완료한 업무 ${n}건을 칸반에서만 정리할까요?\n업무 기록은 달력과 필드별 업무에 계속 남습니다.`))return;list.forEach(t=>t.hiddenFromKanban=true);save();toast(`완료한 업무 ${n}건을 칸반에서 숨겼습니다.`)};
$("manageFields").onclick=()=>{$("fieldBackdrop").classList.remove("hidden");renderFields()};function renderFields(){$("fieldChips").innerHTML=data.fields.map(f=>`<span class="chip">${esc(f)}<button data-remove-field="${esc(f)}" aria-label="필드 삭제"><svg class="petit-icon" aria-hidden="true" focusable="false"><use href="#pi-cross"></use></svg></button></span>`).join("");document.querySelectorAll("[data-remove-field]").forEach(b=>b.onclick=()=>{const f=b.dataset.removeField;if(data.tasks.some(t=>t.field===f))return toast("연결된 업무가 있어 삭제할 수 없습니다.");data.fields=data.fields.filter(x=>x!==f);save();renderFields()})}
$("addFieldBtn").onclick=()=>{const f=$("newFieldInput").value.trim();if(!f)return;if(data.fields.includes(f))return toast("이미 있는 업무 필드입니다.");data.fields.push(f);$("newFieldInput").value="";save();renderFields()};$("newFieldInput").onkeydown=e=>{if(e.key==="Enter")$("addFieldBtn").click()};
$("modeSelect").onchange=updateRoutineUI;$("routineKind").onchange=updateRoutineUI;document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>closeModal(b.dataset.close));document.querySelectorAll(".modal-backdrop").forEach(b=>b.onclick=e=>{if(e.target===b)b.classList.add("hidden")});
$("backupBtn").onclick=()=>{
 const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),notebook:data},null,2)],{type:"application/json"});
 const a=document.createElement("a"),url=URL.createObjectURL(blob);
 a.href=url;a.download=`나의_작은별_이야기_백업_${iso()}.json`;
 a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 toast("백업 파일을 저장했습니다.");
};
$("restoreBtn").onclick=()=>$("restoreInput").click();
$("restoreInput").onchange=async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{
  if(file.size>MAX_BACKUP_BYTES)throw Error("백업 파일은 2MB 이하여야 합니다.");
  if(!/\\.json$/i.test(file.name))throw Error("JSON 백업 파일만 복원할 수 있습니다.");
  const raw=await file.text();
  const v=JSON.parse(raw);
  if(!isRecord(v))throw Error("JSON 객체 형식이 아닙니다.");
  if(v.version!==undefined&&v.version!==1)throw Error("지원하지 않는 백업 버전입니다.");
  const candidate=validateNotebook(v.notebook??v);
  if(!confirm("현재 업무수첩을 검증된 백업 파일 내용으로 바꿀까요?"))return;
  const serialized=JSON.stringify(candidate);
  if(new Blob([serialized]).size>MAX_BACKUP_BYTES)throw Error("복원 데이터 크기가 2MB를 초과했습니다.");
  /* Commit storage first: invalid files and quota failures never erase existing data. */
  localStorage.setItem(KEY,serialized);
  data=candidate;render();
  toast("검증된 백업을 복원했습니다.");
 }catch(err){
  toast(err instanceof Error?err.message:"백업 파일을 복원할 수 없습니다.");
  console.warn("백업 복원 거부:",err);
 }finally{e.target.value="";}
};

// Cover opens the dated spread; no changes to stored tasks, notes or backup format.
function toggleJournalCover(open){
 const cover=$("journalCover"),book=$("diaryBook");
 book.classList.toggle("cover-closed",!open);
 cover.classList.toggle("is-open",open);
 cover.setAttribute("aria-hidden",String(open));
 $("openJournal").tabIndex=open?-1:0;
 $("closeJournal").tabIndex=open?0:-1;
 if(open)$("closeJournal").focus();else $("openJournal").focus();
}
$("dailyResolutionInput").addEventListener("input",saveDailyResolution);
$("openJournal").onclick=()=>toggleJournalCover(true);
function showJournalLastPage(show){
 const book=$("diaryBook"),page=$("journalLastPage"),button=$("lastPageBtn"),back=$("returnDiaryBtn");
 book.classList.toggle("show-last-page",show);
 page.setAttribute("aria-hidden",String(!show));
 button.setAttribute("aria-pressed",String(show));
 button.querySelector(".last-page-label").textContent=show?"본문으로 돌아가기":"마지막 페이지";
 back.tabIndex=show?0:-1;
}
$("lastPageBtn").onclick=()=>showJournalLastPage(!$("diaryBook").classList.contains("show-last-page"));
$("returnDiaryBtn").onclick=()=>{showJournalLastPage(false);$("lastPageBtn").focus()};
$("closeJournal").onclick=()=>{showJournalLastPage(false);toggleJournalCover(false)};

// Only dates turn. Dashboard, calendar, Kanban and field manager stay on the desk.
let diaryFlipTimer=null;
function setDiaryDate(next,animate=true){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(next)||next===selectedDate)return;
 const parsed=new Date(next+"T00:00:00");if(Number.isNaN(parsed.getTime())||iso(parsed)!==next)return;
 const direction=next>selectedDate?"turn-next":"turn-prev";
 const spread=$("dailySpread");spread.classList.remove("turn-next","turn-prev");
 void spread.offsetWidth;
 selectedDate=next;month=new Date(parsed.getFullYear(),parsed.getMonth(),1);render();
 if(diaryFlipTimer)clearTimeout(diaryFlipTimer);
 if(animate&&!window.matchMedia("(prefers-reduced-motion: reduce)").matches){
  spread.classList.add(direction);diaryFlipTimer=setTimeout(()=>{spread.classList.remove("turn-next","turn-prev");diaryFlipTimer=null},560);
 }
}
function shiftDiaryDay(delta){const day=new Date(selectedDate+"T12:00:00");day.setDate(day.getDate()+delta);setDiaryDate(iso(day))}
$("pagePrev").onclick=()=>shiftDiaryDay(-1);
$("pageNext").onclick=()=>shiftDiaryDay(1);
$("goToday").onclick=()=>setDiaryDate(iso());
$("diaryDate").onchange=e=>setDiaryDate(e.target.value,false);
document.addEventListener("keydown",e=>{
 if(!["ArrowLeft","ArrowRight"].includes(e.key)||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey)return;
 if(document.querySelector(".modal-backdrop:not(.hidden)"))return;
 if(e.target.closest("input,textarea,select,button,[contenteditable]"))return;
 e.preventDefault();shiftDiaryDay(e.key==="ArrowRight"?1:-1);
});


// Small desk props are presentation-only; calendar dates use existing date navigation.
let deskCalendarMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1);
function renderDeskCalendar(){
 const y=deskCalendarMonth.getFullYear(),m=deskCalendarMonth.getMonth();
 $("miniCalMonth").textContent=`${y} · ${String(m+1).padStart(2,"0")}`;
 const first=new Date(y,m,1).getDay(),count=new Date(y,m+1,0).getDate(),today=iso();
 let content="";
 for(let n=0;n<first;n++)content+="<span></span>";
 for(let d=1;d<=count;d++){
  const v=iso(new Date(y,m,d));
  content+=`<button type="button" data-mini-date="${v}" class="${v===selectedDate?'selected ':''}${v===today?'today-mark':''}" aria-label="${v} 다이어리로 이동" ${v===selectedDate?'aria-current="date"':''}>${d}</button>`;
 }
 $("miniCalendarDays").innerHTML=content;
 document.querySelectorAll("[data-mini-date]").forEach(el=>el.onclick=()=>setDiaryDate(el.dataset.miniDate));
}
$("miniCalPrev").onclick=()=>{deskCalendarMonth=new Date(deskCalendarMonth.getFullYear(),deskCalendarMonth.getMonth()-1,1);renderDeskCalendar()};
$("miniCalNext").onclick=()=>{deskCalendarMonth=new Date(deskCalendarMonth.getFullYear(),deskCalendarMonth.getMonth()+1,1);renderDeskCalendar()};
$("miniCalToday").onclick=()=>setDiaryDate(iso());
function tickFlipClock(){
 const now=new Date(),hours=String(now.getHours()).padStart(2,"0"),minutes=String(now.getMinutes()).padStart(2,"0");
 for(const [id,value] of [["flipHour",hours],["flipMinute",minutes]]){
  const el=$(id);if(el.textContent!==value){el.textContent=value;el.classList.remove("flip-tick");void el.offsetWidth;el.classList.add("flip-tick")}
 }

 $("flipWeekday").textContent=new Intl.DateTimeFormat("ko-KR",{weekday:"short"}).format(now);
}
const originalRenderDesk=render;
render=function(){originalRenderDesk();renderDeskCalendar()};
const originalSetDiaryDate=setDiaryDate;
setDiaryDate=function(next,animate=true){originalSetDiaryDate(next,animate);if(/^\d{4}-\d{2}-\d{2}$/.test(next)){const p=new Date(next+'T00:00:00');if(!Number.isNaN(p.getTime())){deskCalendarMonth=new Date(p.getFullYear(),p.getMonth(),1);renderDeskCalendar()}}};
tickFlipClock();setInterval(tickFlipClock,15000);
renderDeskCalendar();

render();
})();
