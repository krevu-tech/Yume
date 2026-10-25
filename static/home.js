document.addEventListener("DOMContentLoaded", () => {
  // Original tabs, tasks and Pomodoro behavior preserved.
  const tabs=document.querySelectorAll(".nav-tab"), pages=document.querySelectorAll(".tab-page");
  tabs.forEach(t=>t.onclick=()=>{tabs.forEach(x=>x.classList.remove("active"));pages.forEach(x=>x.classList.remove("active"));t.classList.add("active");document.getElementById(t.dataset.tab).classList.add("active");});
  const modal=document.getElementById("task-modal"), open=document.getElementById("open-task-modal"), close=document.getElementById("close-task-modal"), form=document.getElementById("task-form"), input=document.getElementById("task-input"), list=document.getElementById("task-list"), empty=document.getElementById("empty-state");
  const taskStorageKey="yumeTasks:"+(window.YUME_USER_KEY||"guest");
  let tasks=JSON.parse(localStorage.getItem(taskStorageKey)||"[]");
  function save(){localStorage.setItem(taskStorageKey,JSON.stringify(tasks))}
  function render(){
    list.querySelectorAll(".task-item").forEach(x=>x.remove()); empty.style.display=tasks.length?"none":"flex";
    tasks.forEach(task=>{const el=document.createElement("div");el.className="task-item"+(task.done?" completed":"");el.innerHTML='<label class="task-check"><input type="checkbox"><span class="custom-checkbox">✓</span></label><span class="task-title"></span><button class="delete-task">×</button>';el.querySelector(".task-title").textContent=task.title;el.querySelector("input").checked=task.done;
    el.querySelector("input").onchange=()=>{task.done=!task.done;el.classList.toggle("completed",task.done);save()};
    el.querySelector(".delete-task").onclick=()=>{el.classList.add("removing");setTimeout(()=>{tasks=tasks.filter(x=>x.id!==task.id);save();render()},280)};list.appendChild(el)})}
  open.onclick=()=>{modal.classList.add("visible");setTimeout(()=>input.focus(),100)};function hide(){modal.classList.remove("visible");input.value=""}close.onclick=hide;modal.onclick=e=>{if(e.target===modal)hide()};document.onkeydown=e=>{if(e.key==="Escape"){hide();closeThemeDrawer()}};
  form.onsubmit=e=>{e.preventDefault();let title=input.value.trim();if(!title)return;tasks.push({id:Date.now(),title,done:false});save();render();hide()};render();
  const WORK=1500, BREAK=300;let left=WORK,running=false,isBreak=false,round=1,timer=null;
  const display=document.getElementById("timer-display"),label=document.getElementById("timer-label"),roundLabel=document.getElementById("timer-round"),toggle=document.getElementById("toggle-timer"),reset=document.getElementById("reset-timer"),ring=document.getElementById("timer-ring"),dots=document.querySelectorAll(".timer-dot");
  function update(){let m=Math.floor(left/60),s=left%60;display.textContent=String(m).padStart(2,"0")+":"+String(s).padStart(2,"0");label.textContent=isBreak?"Перерыв":"Фокус";roundLabel.textContent=round+" / 4";let total=isBreak?BREAK:WORK;ring.style.setProperty("--progress",(1-left/total)*360+"deg");dots.forEach((d,i)=>d.classList.toggle("active",i<round))}
  function switchPhase(){if(!isBreak){isBreak=true;left=BREAK}else{isBreak=false;round=round>=4?1:round+1;left=WORK}update()}
  toggle.onclick=()=>{if(running){clearInterval(timer);running=false;toggle.textContent="Продолжить"}else{running=true;toggle.textContent="Пауза";timer=setInterval(()=>{left--;if(left<=0)switchPhase();else update()},1000)}};
  reset.onclick=()=>{clearInterval(timer);running=false;isBreak=false;round=1;left=WORK;toggle.textContent="Начать";update()};update();

  // Mood tracker
  const moodInfo={great:{label:"Прекрасно",score:6,cls:"mood-great"},good:{label:"Хорошо",score:5,cls:"mood-good"},okay:{label:"Нормально",score:4,cls:"mood-okay"},low:{label:"Усталость",score:3,cls:"mood-low"},sad:{label:"Грустно",score:2,cls:"mood-sad"},awful:{label:"Тяжело",score:1,cls:"mood-awful"}};
  const $=id=>document.getElementById(id), now=new Date(), iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  let selectedDate=iso(now), selectedMood=null, period=7, viewMonth=new Date(now.getFullYear(),now.getMonth(),1), records=[], lineChart=null,pieChart=null;
  $("mood-today-label").textContent=new Intl.DateTimeFormat("ru-RU",{day:"numeric",month:"long"}).format(now);
  const dateLabel=s=>new Intl.DateTimeFormat("ru-RU",{day:"numeric",month:"long"}).format(new Date(s+"T12:00:00"));
  const showToast=msg=>{const el=$("mood-toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2300)};
  const findRecord=day=>records.find(r=>r.date===day);
  async function loadMoods(){
    try{const res=await fetch("/api/moods");if(!res.ok)throw Error();records=await res.json()}
    catch{records=[];showToast("Не удалось загрузить записи")}
    selectDate(selectedDate);renderAll();
  }
  function selectDate(day){
    selectedDate=day;const r=findRecord(day);selectedMood=r?.mood||null;$("mood-note").value=r?.note||"";
    document.querySelectorAll(".mood-option").forEach(b=>b.classList.toggle("selected",b.dataset.mood===selectedMood));
    $("save-mood").disabled=!selectedMood;$("mood-save-status").textContent=r?"":"";
    renderCalendar();
  }
  document.querySelectorAll(".mood-option").forEach(btn=>btn.addEventListener("click",()=>{selectedMood=btn.dataset.mood;document.querySelectorAll(".mood-option").forEach(b=>b.classList.toggle("selected",b===btn));$("save-mood").disabled=false;$("mood-save-status").textContent=`${moodInfo[selectedMood].label}`}));
  $("save-mood").addEventListener("click",async()=>{
    if(!selectedMood)return;const rec={date:selectedDate,mood:selectedMood,note:$("mood-note").value.trim()};
    try{const res=await fetch("/api/moods",{method:"POST",headers:{"Content-Type":"application/json","X-CSRFToken":document.querySelector('meta[name="csrf-token"]').content},body:JSON.stringify(rec)});if(!res.ok)throw Error();const data=await res.json();const i=records.findIndex(r=>r.date===selectedDate);if(i<0)records.push(data.record);else records[i]=data.record;records.sort((a,b)=>a.date.localeCompare(b.date));$("mood-save-status").textContent="Сохранено";showToast("Настроение сохранено");renderAll()}
    catch{showToast("Не удалось сохранить запись")}
  });
  document.querySelectorAll(".period-btn").forEach(b=>b.addEventListener("click",()=>{period=Number(b.dataset.period);document.querySelectorAll(".period-btn").forEach(x=>x.classList.toggle("active",x===b));renderCharts()}));
  $("prev-month").onclick=()=>{viewMonth=new Date(viewMonth.getFullYear(),viewMonth.getMonth()-1,1);renderCalendar()};
  $("next-month").onclick=()=>{viewMonth=new Date(viewMonth.getFullYear(),viewMonth.getMonth()+1,1);renderCalendar()};
  function renderCalendar(){
    $("month-label").textContent=new Intl.DateTimeFormat("ru-RU",{month:"long",year:"numeric"}).format(viewMonth);
    const offset=(new Date(viewMonth.getFullYear(),viewMonth.getMonth(),1).getDay()+6)%7,days=new Date(viewMonth.getFullYear(),viewMonth.getMonth()+1,0).getDate(),prevDays=new Date(viewMonth.getFullYear(),viewMonth.getMonth(),0).getDate();let html="";
    for(let i=0;i<42;i++){let n,d,out=false;if(i<offset){n=prevDays-offset+i+1;d=new Date(viewMonth.getFullYear(),viewMonth.getMonth()-1,n);out=true}else if(i>=offset+days){n=i-offset-days+1;d=new Date(viewMonth.getFullYear(),viewMonth.getMonth()+1,n);out=true}else{n=i-offset+1;d=new Date(viewMonth.getFullYear(),viewMonth.getMonth(),n)}const key=iso(d),r=findRecord(key),m=r?moodInfo[r.mood]:null;html+=`<button class="calendar-day ${out?"outside":""} ${key===iso(now)?"is-today":""} ${key===selectedDate?"is-selected":""} ${m?m.cls:""}" data-date="${key}" title="${key}${m?" — "+m.label:""}"><span>${n}</span>${m?'<i class="day-mark"></i>':""}</button>`}
    $("calendar-grid").innerHTML=html;$("calendar-grid").querySelectorAll("[data-date]").forEach(b=>b.onclick=()=>selectDate(b.dataset.date));
  }
  function renderCharts(){
    if(!window.Chart)return;const end=new Date(selectedDate+"T12:00:00"),start=new Date(end);start.setDate(start.getDate()-period+1);const subset=records.filter(r=>r.date>=iso(start)&&r.date<=selectedDate),labels=[],values=[];
    for(let i=period-1;i>=0;i--){const d=new Date(end);d.setDate(d.getDate()-i);const r=findRecord(iso(d));labels.push(new Intl.DateTimeFormat("ru-RU",{day:"numeric",month:"short"}).format(d));values.push(r?moodInfo[r.mood].score:null)}
    const accent=getComputedStyle(document.documentElement).getPropertyValue("--theme-accent").trim()||"#d98eae",panel=getComputedStyle(document.documentElement).getPropertyValue("--theme-panel").trim()||"#fff";
    if(lineChart)lineChart.destroy();lineChart=new Chart($("mood-line-chart"),{type:"line",data:{labels,datasets:[{data:values,tension:.35,spanGaps:false,borderWidth:3,pointRadius:3,fill:true,borderColor:accent,pointBackgroundColor:accent,backgroundColor:accent+"22"}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{min:1,max:6,ticks:{stepSize:1,callback:v=>({1:"Тяжело",2:"Грустно",3:"Усталость",4:"Нормально",5:"Хорошо",6:"Прекрасно"}[v])},grid:{color:"rgba(120,120,120,.13)"}},x:{grid:{display:false},ticks:{maxTicksLimit:7}}}}});
    const keys=Object.keys(moodInfo),colors=["#e6a0bd","#8fcaad","#e5ca77","#9bbbe8","#a99adf","#e58b8b"],counts=keys.map((k,i)=>({key:k,label:moodInfo[k].label,count:subset.filter(r=>r.mood===k).length,color:colors[i]})).filter(x=>x.count);
    if(pieChart)pieChart.destroy();pieChart=new Chart($("mood-pie-chart"),{type:"doughnut",data:{labels:counts.map(x=>x.label),datasets:[{data:counts.map(x=>x.count),backgroundColor:counts.map(x=>x.color),borderColor:panel,borderWidth:3,hoverOffset:5}]},options:{responsive:true,maintainAspectRatio:false,cutout:"62%",plugins:{legend:{display:false}}}});
    $("mood-summary").innerHTML=counts.length?counts.map(x=>`<span><i class="summary-dot" style="--dot:${x.color}"></i>${x.label}<strong>${x.count}</strong></span>`).join(""):'<p class="empty-chart">За этот период пока нет записей. Выберите настроение выше, чтобы начать статистику.</p>';
  }
  function renderAll(){renderCalendar();renderCharts();if(selectedMood)document.querySelectorAll(".mood-option").forEach(b=>b.classList.toggle("selected",b.dataset.mood===selectedMood))}
  selectDate(selectedDate);loadMoods();

  // Theme drawer, with persistent rainbow palette.
  const themeList=[
    ["pink-light","Розовая","Светлая","#d98eae","light"],["pink-dark","Розовая","Тёмная","#d98eae","dark"],
    ["red-light","Красная","Светлая","#e87878","light"],["red-dark","Красная","Тёмная","#e87878","dark"],
    ["orange-light","Оранжевая","Светлая","#e99a63","light"],["orange-dark","Оранжевая","Тёмная","#e99a63","dark"],
    ["yellow-light","Жёлтая","Светлая","#d8b84e","light"],["yellow-dark","Жёлтая","Тёмная","#d8b84e","dark"],
    ["green-light","Зелёная","Светлая","#80b89a","light"],["green-dark","Зелёная","Тёмная","#80b89a","dark"],
    ["cyan-light","Бирюзовая","Светлая","#65bdbb","light"],["cyan-dark","Бирюзовая","Тёмная","#65bdbb","dark"],
    ["blue-light","Голубая","Светлая","#7caee8","light"],["blue-dark","Голубая","Тёмная","#7caee8","dark"],
    ["purple-light","Фиолетовая","Светлая","#a48ae0","light"],["purple-dark","Фиолетовая","Тёмная","#a48ae0","dark"]
  ];
  const drawer=$("theme-drawer"),backdrop=$("theme-backdrop"),options=$("theme-options");
  options.innerHTML=themeList.map(t=>`<button class="theme-option" data-theme="${t[0]}" aria-pressed="false"><span class="theme-swatch ${t[4]}" style="--swatch:${t[3]}"></span><span class="theme-label"><strong>${t[1]}</strong><small>${t[2]}</small></span><span class="theme-check">✓</span></button>`).join("");
  function applyTheme(id){const t=themeList.find(x=>x[0]===id)||themeList[0];document.documentElement.dataset.theme=t[0];localStorage.setItem("yume-theme",t[0]);options.querySelectorAll(".theme-option").forEach(b=>{b.classList.toggle("selected",b.dataset.theme===t[0]);b.setAttribute("aria-pressed",String(b.dataset.theme===t[0]))});if(records.length)renderCharts()}
  function openThemeDrawer(){backdrop.hidden=false;requestAnimationFrame(()=>{backdrop.classList.add("visible");drawer.classList.add("open")});drawer.setAttribute("aria-hidden","false")}
  function closeThemeDrawer(){if(!drawer||!backdrop)return;drawer.classList.remove("open");backdrop.classList.remove("visible");drawer.setAttribute("aria-hidden","true");setTimeout(()=>{if(!drawer.classList.contains("open"))backdrop.hidden=true},250)}
  $("theme-open").onclick=openThemeDrawer;$("theme-close").onclick=closeThemeDrawer;backdrop.onclick=closeThemeDrawer;
  options.addEventListener("click",e=>{const b=e.target.closest("[data-theme]");if(b)applyTheme(b.dataset.theme)});
  applyTheme(localStorage.getItem("yume-theme")||"pink-light");
});
