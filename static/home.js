document.addEventListener("DOMContentLoaded", () => {
const tabs=document.querySelectorAll(".nav-tab"), pages=document.querySelectorAll(".tab-page");
tabs.forEach(t=>t.onclick=()=>{tabs.forEach(x=>x.classList.remove("active"));pages.forEach(x=>x.classList.remove("active"));t.classList.add("active");document.getElementById(t.dataset.tab).classList.add("active");});

const modal=document.getElementById("task-modal"), open=document.getElementById("open-task-modal"), close=document.getElementById("close-task-modal"), form=document.getElementById("task-form"), input=document.getElementById("task-input"), list=document.getElementById("task-list"), empty=document.getElementById("empty-state");
let tasks=JSON.parse(localStorage.getItem("yumeTasks")||"[]");
function save(){localStorage.setItem("yumeTasks",JSON.stringify(tasks))}
function render(){
list.querySelectorAll(".task-item").forEach(x=>x.remove()); empty.style.display=tasks.length?"none":"flex";
tasks.forEach(task=>{const el=document.createElement("div");el.className="task-item"+(task.done?" completed":"");el.innerHTML='<label class="task-check"><input type="checkbox"><span class="custom-checkbox">✓</span></label><span class="task-title"></span><button class="delete-task">×</button>';el.querySelector(".task-title").textContent=task.title;el.querySelector("input").checked=task.done;
el.querySelector("input").onchange=()=>{task.done=!task.done;el.classList.toggle("completed",task.done);save()};
el.querySelector(".delete-task").onclick=()=>{el.classList.add("removing");setTimeout(()=>{tasks=tasks.filter(x=>x.id!==task.id);save();render()},280)};list.appendChild(el)})}
open.onclick=()=>{modal.classList.add("visible");setTimeout(()=>input.focus(),100)};function hide(){modal.classList.remove("visible");input.value=""}close.onclick=hide;modal.onclick=e=>{if(e.target===modal)hide()};document.onkeydown=e=>{if(e.key==="Escape")hide()};
form.onsubmit=e=>{e.preventDefault();let title=input.value.trim();if(!title)return;tasks.push({id:Date.now(),title,done:false});save();render();hide()};render();

const WORK=1500, BREAK=300;let left=WORK,running=false,isBreak=false,round=1,timer=null;
const display=document.getElementById("timer-display"),label=document.getElementById("timer-label"),roundLabel=document.getElementById("timer-round"),toggle=document.getElementById("toggle-timer"),reset=document.getElementById("reset-timer"),ring=document.getElementById("timer-ring"),dots=document.querySelectorAll(".timer-dot");
function update(){let m=Math.floor(left/60),s=left%60;display.textContent=String(m).padStart(2,"0")+":"+String(s).padStart(2,"0");label.textContent=isBreak?"Перерыв":"Фокус";roundLabel.textContent=round+" / 4";let total=isBreak?BREAK:WORK;ring.style.setProperty("--progress",(1-left/total)*360+"deg");dots.forEach((d,i)=>d.classList.toggle("active",i<round))}
function switchPhase(){if(!isBreak){isBreak=true;left=BREAK}else{isBreak=false;round=round>=4?1:round+1;left=WORK}update()}
toggle.onclick=()=>{if(running){clearInterval(timer);running=false;toggle.textContent="Продолжить"}else{running=true;toggle.textContent="Пауза";timer=setInterval(()=>{left--;if(left<=0)switchPhase();else update()},1000)}};
reset.onclick=()=>{clearInterval(timer);running=false;isBreak=false;round=1;left=WORK;toggle.textContent="Начать";update()};update();
});