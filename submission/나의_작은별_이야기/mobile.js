
/* UI-only mobile page navigation; tasks, notes, date sync, and storage use the original app. */
(()=>{
 const tabs=[...document.querySelectorAll('[data-mobile-tab]')];
 const mobile=window.matchMedia('(max-width: 820px)');
 const allowed=new Set(['today','notes','calendar','workflow','fields']);
 function show(tab,scroll=false){
   if(!allowed.has(tab))return;
   document.body.dataset.mobileView=tab;
   for(const el of tabs){const active=el.dataset.mobileTab===tab;el.classList.toggle('active',active);el.setAttribute('aria-selected',String(active));el.tabIndex=active?0:-1;}
   if(scroll&&mobile.matches)document.querySelector('.mobile-bookmarks').scrollIntoView({block:'start',behavior:'instant'});
 }
 tabs.forEach(tab=>tab.addEventListener('click',()=>show(tab.dataset.mobileTab,true)));
 document.addEventListener('click',ev=>{
   if(!mobile.matches)return;
   if(ev.target.closest('[data-note-jump]'))show('notes');
   else if(ev.target.closest('#newNoteBtn,#noteIndexAdd'))show('notes');
 });
 if(mobile.matches){
   show('today');
   const open=document.getElementById('openJournal'),book=document.getElementById('diaryBook');
   if(book&&book.classList.contains('cover-closed')&&open)open.click();
 }
 mobile.addEventListener('change',ev=>{if(ev.matches){show(document.body.dataset.mobileView||'today');}else document.body.removeAttribute('data-mobile-view');});
})();


