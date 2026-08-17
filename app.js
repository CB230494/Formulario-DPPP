const REGIONS = [
  "Dirección Regional Primera – San José Central",
  "Dirección Regional Primera – San José Norte",
  "Dirección Regional Primera – San José Sur",
  "Dirección Regional Segunda – Alajuela",
  "Dirección Regional Tercera – Cartago",
  "Dirección Regional Cuarta – Heredia",
  "Dirección Regional Quinta – Chorotega",
  "Dirección Regional Sexta – Pacífico Central",
  "Dirección Regional Séptima – Pérez Zeledón",
  "Dirección Regional Octava – San Carlos",
  "Dirección Regional Novena – Huetar Atlántica",
  "Dirección Regional Décima – Brunca",
  "Dirección Regional Undécima – Fronteriza Norte",
  "Dirección Regional Duodécima – Caribe",
  "Dirección de Programas Policiales Preventivos (DPPP)"
];

const PPP_COURSES = [
  "Curso 050: Formación de equipos regionales en seguridad comunitaria y comercial.",
  "Taller básico «Para sentir, pensar y enfrentar la violencia de género, intrafamiliar y sexual».",
  "Curso 418: Capacitación a nuevos Oficiales DARE.",
  "Curso DOT: Formación de Mentores de Mentores.",
  "Curso GOI: Actualización de Oficiales en Servicio: Agentes PPP.",
  "Curso GFT: Para Familias GREAT.",
  "Curso GOT: Capacitación para formación de nuevos Instructores GREAT.",
  "Curso GOT: Capacitación para facilitadores del Curso 013, Mi Primera Aventura en Seguridad.",
  "Reforzamiento del Curso 013, Mi Primera Aventura en Seguridad.",
  "Otro curso relacionado con Programas Policiales Preventivos.",
  "Ninguno de los anteriores."
];

const POPULATIONS = ["Personal policial.","Comunidades organizadas.","Instituciones públicas.","Centros educativos.","Otra población."];

let currentStep = 1;
let delegationsCatalog = {};
let adminPassword = "";
let dashboardData = null;
let charts = {};

const $ = (id) => document.getElementById(id);
const $$ = (q) => [...document.querySelectorAll(q)];

function notify(text, error=false){
  const t=$("toast"); t.textContent=text; t.className="toast show"+(error?" error":"");
  clearTimeout(window.__toast); window.__toast=setTimeout(()=>t.className="toast",3000);
}
function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}
function isDppp(v){return v === "Dirección de Programas Policiales Preventivos (DPPP)";}

function init(){
  REGIONS.forEach(r=>$("region").insertAdjacentHTML("beforeend",`<option>${esc(r)}</option>`));
  PPP_COURSES.forEach((c,i)=>$("cursosPpp").insertAdjacentHTML("beforeend",`<label><input type="checkbox" name="cursos_ppp" value="${esc(c)}"> ${esc(c)}</label>`));
  POPULATIONS.forEach(c=>$("poblaciones").insertAdjacentHTML("beforeend",`<label><input type="checkbox" name="poblaciones" value="${esc(c)}"> ${esc(c)}</label>`));
  bind();
  loadPublicCatalog();
  showStep(1);
}

function bind(){
  $("region").addEventListener("change", onRegion);
  $("nextBtn").addEventListener("click",()=>{if(validateStep(currentStep)) showStep(currentStep+1)});
  $("prevBtn").addEventListener("click",()=>showStep(currentStep-1));
  $("surveyForm").addEventListener("submit",submitSurvey);
  $("adminLink").addEventListener("click",()=>switchView("login"));
  $("backSurvey").addEventListener("click",()=>switchView("survey"));
  $("loginBtn").addEventListener("click",adminLogin);
  $("adminPassword").addEventListener("keydown",e=>{if(e.key==="Enter")adminLogin()});
  $("logoutBtn").addEventListener("click",()=>{adminPassword="";switchView("survey")});
  $("refreshBtn").addEventListener("click",loadDashboard);
  $("applyFilters").addEventListener("click",loadDashboard);
  $("clearFilters").addEventListener("click",()=>{$("filterRegion").value=""; updateAdminDelegations(); $("filterDelegacion").value=""; loadDashboard();});
  $("filterRegion").addEventListener("change",updateAdminDelegations);
  $("officerSearch").addEventListener("input",renderOfficers);
  $("exportRegions").addEventListener("click",exportRegionsCsv);

  document.addEventListener("change",e=>{
    if(e.target.name==="cursos_ppp"){
      const checked=$$('input[name="cursos_ppp"]:checked').map(x=>x.value);
      const none=e.target.value==="Ninguno de los anteriores.";
      if(none && e.target.checked) $$('input[name="cursos_ppp"]').filter(x=>x.value!=="Ninguno de los anteriores.").forEach(x=>x.checked=false);
      if(!none && e.target.checked) {const n=$$('input[name="cursos_ppp"]').find(x=>x.value==="Ninguno de los anteriores."); if(n)n.checked=false;}
      $("otroCursoWrap").classList.toggle("hidden",!checked.includes("Otro curso relacionado con Programas Policiales Preventivos."));
    }
    if(e.target.name==="formacion_instructor") $("detalleInstructorWrap").classList.toggle("hidden",e.target.value!=="Sí");
    if(e.target.name==="formacion_trata") $("trataDetails").classList.toggle("hidden",e.target.value!=="Sí");
    if(e.target.name==="mas_capacitaciones") $("capAdicionalesWrap").classList.toggle("hidden",e.target.value!=="Sí");
    if(e.target.name==="ha_impartido") $("experienciaDetails").classList.toggle("hidden",e.target.value!=="Sí");
    if(e.target.name==="poblaciones"){
      const vals=$$('input[name="poblaciones"]:checked').map(x=>x.value);
      $("otraPoblacionWrap").classList.toggle("hidden",!vals.includes("Otra población."));
    }
    if(e.target.name==="requiere_actualizacion") $("temasFortalecerWrap").classList.toggle("hidden",e.target.value==="No");
  });

  $$(".nav-btn").forEach(b=>b.addEventListener("click",()=>{
    $$(".nav-btn").forEach(x=>x.classList.remove("active")); b.classList.add("active");
    $$(".admin-panel").forEach(x=>x.classList.remove("active")); $(b.dataset.panel).classList.add("active");
    $("adminTitle").textContent=b.textContent;
  }));
}

function showStep(n){
  currentStep=Math.max(1,Math.min(6,n));
  $$(".form-step").forEach(s=>s.classList.toggle("active",Number(s.dataset.step)===currentStep));
  $("prevBtn").classList.toggle("hidden",currentStep===1);
  $("nextBtn").classList.toggle("hidden",currentStep===6);
  $("submitBtn").classList.toggle("hidden",currentStep!==6);
  $("stepLabel").textContent=`Sección ${currentStep} de 6`; $("progressPct").textContent=`${Math.round(currentStep/6*100)}%`; $("progressBar").style.width=`${currentStep/6*100}%`;
  window.scrollTo({top:0,behavior:"smooth"});
}

function validateStep(step){
  const s=document.querySelector(`.form-step[data-step="${step}"]`);
  const required=[...s.querySelectorAll("[required]")].filter(el=>!el.closest(".hidden"));
  for(const el of required){
    if(el.type==="radio"){const group=s.querySelectorAll(`input[name="${el.name}"]`);if(![...group].some(x=>x.checked)){notify("Complete las preguntas obligatorias.",true);el.focus();return false;}}
    else if(!el.value){notify("Complete las preguntas obligatorias.",true);el.focus();return false;}
  }
  if(step===1 && !isDppp($("region").value) && !$("delegacion").value){notify("Seleccione la delegación policial.",true);$("delegacion").focus();return false;}
  if(step===2 && $$('input[name="cursos_ppp"]:checked').length===0){notify("Seleccione al menos una opción en la pregunta 8.",true);return false;}
  return true;
}

function onRegion(){
  const r=$("region").value;
  const dppp=isDppp(r);
  $("delegacionWrap").classList.toggle("hidden",dppp);
  $("delegacion").required=!dppp;
  if(dppp){$("delegacion").innerHTML='<option value="">No aplica</option>';return;}
  const items=delegationsCatalog[r]||[];
  $("delegacion").innerHTML='<option value="">Seleccione una delegación</option>'+items.map(x=>`<option>${esc(x)}</option>`).join("");
}

function switchView(view){
  $("surveyView").classList.toggle("hidden",view!=="survey");
  $("loginView").classList.toggle("hidden",view!=="login");
  $("adminView").classList.toggle("hidden",view!=="admin");
  window.scrollTo(0,0);
}

function urlReady(){return APPS_SCRIPT_URL && APPS_SCRIPT_URL.startsWith("https://script.google.com/") && APPS_SCRIPT_URL.endsWith("/exec");}
function jsonp(params){
  return new Promise((resolve,reject)=>{
    if(!urlReady()) return reject(new Error("Falta configurar la URL de Apps Script en config.js."));
    const cb="cb_"+Date.now()+"_"+Math.random().toString(36).slice(2);
    const script=document.createElement("script");
    window[cb]=(data)=>{delete window[cb];script.remove();resolve(data)};
    params.callback=cb;
    script.src=APPS_SCRIPT_URL+"?"+new URLSearchParams(params).toString();
    script.onerror=()=>{delete window[cb];script.remove();reject(new Error("No fue posible conectar con Apps Script."))};
    document.body.appendChild(script);
    setTimeout(()=>{if(window[cb]){delete window[cb];script.remove();reject(new Error("Tiempo de espera agotado."))}},15000);
  });
}

async function loadPublicCatalog(){
  if(!urlReady()) return;
  try{
    const r=await jsonp({action:"catalog"});
    if(r.ok){delegationsCatalog=r.delegations||{};}
  }catch(e){console.warn(e);}
}

function serializeForm(){
  const fd=new FormData($("surveyForm")), out={};
  for(const [k,v] of fd.entries()){
    if(out[k]!==undefined) out[k]=Array.isArray(out[k])?[...out[k],v]:[out[k],v]; else out[k]=v;
  }
  ["cursos_ppp","poblaciones"].forEach(k=>{if(!out[k])out[k]=[]; if(!Array.isArray(out[k]))out[k]=[out[k]];});
  if(isDppp(out.region)) out.delegacion="";
  return out;
}

async function submitSurvey(e){
  e.preventDefault(); if(!validateStep(6))return;
  if(!urlReady()){notify("Primero configure la URL de Apps Script en config.js.",true);return;}
  const btn=$("submitBtn"); btn.disabled=true; btn.textContent="Enviando...";
  const payload=serializeForm();
  try{
    await fetch(APPS_SCRIPT_URL,{method:"POST",mode:"no-cors",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action:"saveSurvey",data:payload})});
    $("surveyForm").reset(); currentStep=1; onRegion(); showStep(1);
    notify("Diagnóstico enviado correctamente.");
  }catch(err){notify("No fue posible enviar la información. Verifique la conexión.",true)}
  finally{btn.disabled=false;btn.textContent="Enviar diagnóstico";}
}

async function adminLogin(){
  const p=$("adminPassword").value;
  if(!p){$("loginMsg").textContent="Ingrese la clave.";return;}
  $("loginBtn").disabled=true;$("loginMsg").textContent="Validando...";
  try{
    const r=await jsonp({action:"login",password:p});
    if(!r.ok) throw new Error(r.message||"Clave incorrecta.");
    adminPassword=p; $("loginMsg").textContent=""; switchView("admin"); await loadDashboard();
  }catch(e){$("loginMsg").textContent=e.message}
  finally{$("loginBtn").disabled=false}
}

async function loadDashboard(){
  if(!adminPassword)return;
  const region=$("filterRegion").value||"", delegacion=$("filterDelegacion").value||"";
  try{
    const r=await jsonp({action:"dashboard",password:adminPassword,region,delegacion});
    if(!r.ok) throw new Error(r.message||"No autorizado");
    dashboardData=r;
    setupAdminFilters(r.catalog||{});
    renderDashboard();
  }catch(e){notify(e.message,true)}
}

function setupAdminFilters(cat){
  if($("filterRegion").options.length<=1){
    Object.keys(cat).forEach(r=>$("filterRegion").insertAdjacentHTML("beforeend",`<option>${esc(r)}</option>`));
  }
  delegationsCatalog=Object.keys(cat).length?cat:delegationsCatalog;
  updateAdminDelegations();
}
function updateAdminDelegations(){
  const r=$("filterRegion").value, current=$("filterDelegacion").value;
  let list=[];
  if(r) list=delegationsCatalog[r]||[]; else list=[...new Set(Object.values(delegationsCatalog).flat())].sort((a,b)=>a.localeCompare(b,"es",{numeric:true}));
  $("filterDelegacion").innerHTML='<option value="">Todas las delegaciones</option>'+list.map(x=>`<option ${x===current?"selected":""}>${esc(x)}</option>`).join("");
}

function renderDashboard(){
  const d=dashboardData, k=d.kpis||{};
  $("kpiGrid").innerHTML=[
    ["Total Oficiales",k.total||0,"Registros válidos"],
    ["Con formación en Trata",k.formacionTrata||0,`${k.pctFormacion||0}%`],
    ["Instructores / Facilitadores",k.instructores||0,`${k.pctInstructores||0}%`],
    ["Ha impartido actividades",k.haImpartido||0,`${k.pctImpartido||0}%`]
  ].map(x=>`<div class="kpi"><div class="label">${x[0]}</div><div class="value">${x[1]}</div><div class="sub">${x[2]}</div></div>`).join("");

  makeChart("regionChart","bar",d.charts?.region||{labels:[],values:[]},"Oficiales con formación");
  makeChart("statusChart","doughnut",d.charts?.status||{labels:[],values:[]},"Estado");
  makeChart("coursesChart","bar",d.charts?.courses||{labels:[],values:[]},"Oficiales");
  makeChart("updateChart","doughnut",d.charts?.update||{labels:[],values:[]},"Respuesta");

  renderTable("regionsTable",d.regions||[],r=>[r.region,r.delegacion,r.total,r.formacionTrata,r.instructores,r.haImpartido,`${r.pct}%`]);
  renderTable("trainingTable",d.training||[],r=>[r.nombre,r.region,r.delegacion,r.capacitacion,r.institucion,r.anio,r.horas,r.certificado]);
  renderOfficers();
}
function makeChart(id,type,obj,label){
  if(charts[id]) charts[id].destroy();
  const palette=["#0b2345","#c89a3d","#174f83","#e1bd6c","#496a8c","#8a6a2d","#6f879f","#d8b05b","#294d72","#b58a35"]; charts[id]=new Chart($(id),{type,data:{labels:obj.labels,datasets:[{label,data:obj.values,borderWidth:1,backgroundColor:type==="doughnut"?obj.labels.map((_,i)=>palette[i%palette.length]):"#174f83",borderColor:type==="doughnut"?"#ffffff":"#0b2345",borderRadius:type==="bar"?5:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:type==="doughnut",position:"bottom",labels:{usePointStyle:true,boxWidth:8}}},scales:type==="bar"?{y:{beginAtZero:true,ticks:{precision:0},grid:{color:"#e7ebf0"}},x:{grid:{display:false}}}:undefined}});
}
function renderTable(id,rows,mapper){
  const tb=$(`${id}`).querySelector("tbody");
  tb.innerHTML=rows.length?rows.map(r=>`<tr>${mapper(r).map(v=>`<td>${esc(v)}</td>`).join("")}</tr>`).join(""):`<tr><td class="empty" colspan="12">Sin datos para los filtros seleccionados.</td></tr>`;
}
function renderOfficers(){
  if(!dashboardData)return;
  const q=$("officerSearch").value.trim().toLowerCase();
  const rows=(dashboardData.officers||[]).filter(r=>!q||String(r.nombre).toLowerCase().includes(q));
  renderTable("officersTable",rows,r=>[r.nombre,r.region,r.delegacion,r.anosServicio,r.anosPpp,r.formacionTrata,r.instructor,r.haImpartido,r.actualizacion]);
}
function exportRegionsCsv(){
  if(!dashboardData)return;
  const rows=dashboardData.regions||[];
  const head=["Región","Delegación","Oficiales","Con formación trata","Instructores / facilitadores","Ha impartido","% formación"];
  const data=[head,...rows.map(r=>[r.region,r.delegacion,r.total,r.formacionTrata,r.instructores,r.haImpartido,r.pct])];
  const csv=data.map(row=>row.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(";")).join("\n");
  const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");
  a.href=URL.createObjectURL(blob);a.download="resumen_formacion_trata_dppp.csv";a.click();URL.revokeObjectURL(a.href);
}
document.addEventListener("DOMContentLoaded",init);
