(()=>{'use strict';const $=id=>document.getElementById(id);let info=null;const stages={new:'Novo',qualified:'Qualificado',contacted:'Em contato',proposal:'Proposta',won:'Ganho',lost:'Perdido'};const esc=s=>String(s??'');function node(tag,text='',cls=''){const el=document.createElement(tag);el.textContent=esc(text);if(cls)el.className=cls;return el}function el(tag,cls=''){let x=document.createElement(tag);x.className=cls;return x}async function api(path,method='GET',body){const r=await fetch(path,{method,headers:{'content-type':'application/json'},credentials:'same-origin',body:body?JSON.stringify(body):undefined});let json=await r.json().catch(()=>({error:'Erro de conexão'}));if(!r.ok)throw Error(json.error||'Erro');return json}const fdate=d=>{try{return new Date(d+'Z').toLocaleString('pt-BR')}catch{return d}};function k(n){return Number(n||0).toLocaleString('pt-BR')}
const counts=(rows,key)=>Object.fromEntries((rows||[]).map(i=>[i[key],i.n]));function rowsView(id,data,labelKey){const container=$(id);container.replaceChildren();if(!data.length){container.appendChild(node('p','Nenhum dado encontrado'));return}const max=Math.max(...data.map(a=>Number(a.n)),1);for(const a of data){const r=el('div','row-item');r.appendChild(node('span',a[labelKey]));const bar=el('div','bar'),fill=el('i');fill.style.width=(Number(a.n)/max*100)+'%';bar.appendChild(fill);r.append(bar,node('b',k(a.n)));container.appendChild(r)}}function table(root,head,rows){root.replaceChildren();const wrap=el('div','table-wrap'),t=el('table','data-table'),thead=el('thead'),tr=el('tr');head.forEach(x=>tr.appendChild(node('th',x)));thead.appendChild(tr);t.appendChild(thead);const tbody=el('tbody');for(const cells of rows){const tr=el('tr');for(const cell of cells){const td=el('td');if(cell instanceof Node)td.appendChild(cell);else td.textContent=esc(cell);tr.appendChild(td)}tbody.appendChild(tr)}t.appendChild(tbody);wrap.appendChild(t);root.appendChild(wrap)}
async function refresh(){try{info=await api('/api/admin/dashboard');$('panel').hidden=false;$('login-screen').hidden=true;draw()}catch(e){$('panel').hidden=true;$('login-screen').hidden=false;}}function draw(){const ev=counts(info.events,'type');$('metric-visitors').textContent=k(info.visitors);$('metric-chats').textContent=k(info.conversations);$('metric-leads').textContent=k(info.leads.length);$('metric-requests').textContent=k(ev.lead_created);$('metric-views').textContent=k(ev.page_view);$('metric-opens').textContent=k(ev.chat_open);const funnel=$('funnel');funnel.replaceChildren();const stageCount=counts(info.lead_counts,'stage');const max=Math.max(...Object.values(stageCount).map(Number),1);for(const [key,label] of Object.entries(stages)){let r=el('div','funnel-item');r.appendChild(node('span',label));let bar=el('div','bar'),fill=el('i');fill.style.width=(Number(stageCount[key]||0)/max*100)+'%';bar.appendChild(fill);r.append(bar,node('b',k(stageCount[key])));funnel.appendChild(r)}rowsView('sources-chart',info.sources,'source');rowsView('pages-chart',info.pages,'path');rowsView('events-chart',info.events,'type');leadTable('leads-table',info.leads);leadTable('latest-leads',info.leads.slice(0,5));drawThreads();drawVisitors();$('setting-whatsapp').value=info.settings.whatsapp||'';$('setting-email').value=info.settings.contact_email||'';$('setting-name').value=info.settings.assistant_name||''}
function leadTable(id,leads){table($(id),['Nome','Contato','Serviço','Origem','Data','Etapa'],leads.map(l=>{let select=el('select');select.setAttribute('aria-label','Etapa do lead');for(const [key,label] of Object.entries(stages)){let op=node('option',label);op.value=key;op.selected=l.stage===key;select.appendChild(op)}select.onchange=async()=>{try{await api('/api/admin/lead','PATCH',{id:l.id,stage:select.value});l.stage=select.value;}catch(e){alert(e.message)}};return [l.name||'—',l.email||l.phone||'—',l.service||'A definir',l.source||'—',fdate(l.created_at),select]}))}
function drawVisitors(){table($('visitors-table'),['ID da sessão','Origem','País','Conversas','Acesso'],(info.visitors_list||[]).map(v=>{const b=node('button',v.id.slice(0,8)+'...');b.className='visitor-link';b.onclick=async()=>{const r=await api('/api/admin/visitor?id='+encodeURIComponent(v.id));$('visitor-metadata').textContent=v.source+' · '+v.country+' · '+v.campaign;$('visitor-events').replaceChildren();r.events.forEach(e=>{const div=el('div','msg');div.append(node('b',e.type+' · '+e.path),node('small',fdate(e.created_at)));$('visitor-events').appendChild(div)})};return [b,v.source,v.country||'—',v.chats,fdate(v.last_seen)]}))}
function drawThreads(){let list=$('threads-list');list.replaceChildren();for(const t of info.threads){const b=el('button','thread-item');b.type='button';const left=el('span');left.appendChild(node('strong',t.intent||'Nova conversa'));left.appendChild(node('small',t.source+' · '+fdate(t.created_at)));b.append(left,node('span',String(t.message_count)+' msgs'));b.onclick=()=>openThread(t,b);list.appendChild(b)}}async function openThread(t,b){document.querySelectorAll('.thread-item').forEach(x=>x.classList.toggle('selected',x===b));$('thread-metadata').textContent=t.source+' · '+t.page+' · '+fdate(t.created_at);$('transcript').replaceChildren();try{const r=await api('/api/admin/thread?id='+encodeURIComponent(t.id));for(const m of r.messages){let box=el('div','msg '+(m.role==='user'?'user':'assistant'));box.append(node('span',m.body),node('small',fdate(m.created_at)));$('transcript').append(box)}}catch(e){$('transcript').append(node('p',e.message))}}
$('login-form').onsubmit=async e=>{e.preventDefault();$('login-error').textContent='';try{await api('/api/admin/login','POST',{password:$('password').value});$('password').value='';await refresh()}catch(err){$('login-error').textContent=err.message}};$('logout').onclick=async()=>{try{await api('/api/admin/logout','POST')}finally{location.reload()}};$('refresh').onclick=refresh;
const headings={overview:'Visão geral',leads:'Leads',threads:'Conversas',traffic:'Tráfego',visitors:'Visitantes',settings:'Configurações'};document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t===b));document.querySelectorAll('.view').forEach(v=>v.hidden=v.id!==b.dataset.target);$('section-title').textContent=headings[b.dataset.target]||''});
$('export-leads').onclick=()=>{if(!info)return;const cells=[['Nome','E-mail','Telefone','Empresa','Serviço','Etapa','Origem','Data'],...info.leads.map(l=>[l.name,l.email,l.phone,l.company,l.service,l.stage,l.source,l.created_at])];const quote=x=>'"'+esc(x).replaceAll('"','""')+'"';const csv='\uFEFF'+cells.map(row=>row.map(quote).join(',')).join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='gestarlink-leads.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)};
$('settings-form').onsubmit=async e=>{e.preventDefault();const s=$('settings-msg');s.textContent='Salvando...';try{await api('/api/admin/settings','POST',{whatsapp:$('setting-whatsapp').value.replace(/[^0-9+]/g,''),contact_email:$('setting-email').value,assistant_name:$('setting-name').value});s.textContent='Configurações salvas.';await refresh()}catch(e){s.textContent=e.message}};
refresh();})();


/* GestarLink live attendance — separate from the read-only CRM analytics. */
(()=>{
 const $=id=>document.getElementById(id),pane=$('panel');if(!$('operator-toggle'))return;
 const toggle=$('operator-toggle'),notice=$('operator-notification'),feedback=$('operator-feedback');
 let enabled=false,initialized=false,lastInbound=0,selected='',lastRoom='',inFlight=false,audio=null,threads=[];
 const esc=x=>String(x??'');
 const api=async(path,method='GET',body)=>{
  const r=await fetch(path,{method,credentials:'same-origin',cache:'no-store',headers:{'content-type':'application/json'},body:body?JSON.stringify(body):undefined});
  let v;try{v=await r.json()}catch{throw Error('Resposta indisponível')};if(!r.ok)throw Error(v.error||'Falha de conexão');return v;
 };
 const unlockSound=async()=>{
  const Constructor=window.AudioContext||window.webkitAudioContext;if(!Constructor)return;
  try{audio=audio||new Constructor();if(audio.state==='suspended')await audio.resume()}catch(_){}
 };
 const alertSound=()=>{
  if(!audio||audio.state!=='running')return;
  try{
   for(const [freq,delay] of [[650,0],[880,.14]]){
    const osc=audio.createOscillator(),gain=audio.createGain(),at=audio.currentTime+delay;
    osc.type='sine';osc.frequency.value=freq;
    gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(.16,at+.012);
    gain.gain.exponentialRampToValueAtTime(.0001,at+.12);
    osc.connect(gain).connect(audio.destination);osc.start(at);osc.stop(at+.13);
   }
  }catch(_){}
 };
 const reflect=()=>{
  $('operator-mode').textContent=enabled?'Você está online · Atendimento humano':'Zai virtual · Você está offline';
  $('operator-mode').classList.toggle('online',enabled);
  $('operator-send').disabled=!enabled||inFlight||!selected;
  toggle.checked=enabled;
 };
 async function presence(online){
  const out=await api('/api/admin/presence','POST',{online});
  enabled=!!out.online;reflect();
  notice.textContent=enabled?'🔔 Atendimento humano ativado. Mantenha esta aba aberta para receber as mensagens e ouvir os avisos.':'Zai virtual ativada. As novas mensagens serão registradas no CRM.';
 }
 toggle.addEventListener('change',async()=>{
  toggle.disabled=true;feedback.textContent='';
  try{if(toggle.checked)await unlockSound();await presence(toggle.checked);}
  catch(e){toggle.checked=enabled;feedback.textContent='Não foi possível alterar: '+e.message;}
  finally{toggle.disabled=false;}
 });
 async function heartbeat(){
  if(!enabled||pane.hidden)return;
  try{await api('/api/admin/presence','POST',{online:true});}
  catch(e){enabled=false;reflect();notice.textContent='Conexão perdida. Zai voltará ao atendimento virtual após a expiração da presença.';}
 }
 setInterval(heartbeat,25000);
 function printMessage(m){
  const b=document.createElement('div');b.className='operator-bubble '+(m.role==='user'?'visitor':m.sender==='human'?'staff':'virtual');
  const tag=document.createElement('small');tag.textContent=m.role==='user'?'Visitante':m.sender==='human'?'Você · Equipe':'Zai virtual';
  const body=document.createElement('span');body.textContent=m.body;b.append(tag,body);return b;
 }
 async function loadRoom(){
  if(!selected||pane.hidden)return;
  try{
   const d=await api('/api/admin/thread?id='+encodeURIComponent(selected));
   const key=(d.messages||[]).map(m=>m.id).join('|');
   if(key===lastRoom)return;
   lastRoom=key;const room=$('operator-messages');room.replaceChildren();
   for(const m of d.messages||[])room.appendChild(printMessage(m));
   room.scrollTop=room.scrollHeight;
  }catch(e){feedback.textContent=e.message;}
 }
 function renderList(){
  const list=$('operator-list');list.replaceChildren();
  $('operator-count').textContent='('+threads.length+')';
  if(!threads.length){list.textContent='Ainda não há conversas. Quando alguém chamar, aparecerá aqui.';return}
  for(const t of threads){
   const b=document.createElement('button');b.type='button';b.className='operator-item'+(selected===t.id?' active':'');
   const name=document.createElement('strong');name.textContent=(t.intent||'Novo atendimento').replace(/^./,x=>x.toUpperCase());
   const snippet=document.createElement('span');snippet.textContent=esc(t.last_message||'Nova conversa').slice(0,110);
   const meta=document.createElement('small');meta.textContent=(t.source||'Acesso direto')+' · '+(t.message_count||0)+' mensagens';
   b.append(name,snippet,meta);
   b.onclick=()=>{selected=t.id;lastRoom='';feedback.textContent='';
    $('operator-room-title').textContent='Atendimento '+t.id.slice(0,8);
    $('operator-room-meta').textContent=(t.source||'Direto')+' · '+(t.lang||'pt').toUpperCase();
    renderList();reflect();loadRoom();};
   list.appendChild(b);
  }
 }
 async function poll(){
  if(pane.hidden)return;
  try{
   const data=await api('/api/admin/dashboard');
   const latest=Number(data.latest_inbound_id||0);
   if(!initialized){lastInbound=latest;initialized=true;}
   else if(latest>lastInbound){
    if(enabled){
     alertSound();
     notice.textContent='🔔 Nova mensagem de um possível cliente! Abra a conversa para responder.';
     if('Notification'in window&&Notification.permission==='granted')new Notification('GestarLink: nova mensagem',{body:'Novo contato na Zai'});
    }
    lastInbound=latest;
   }
   threads=Array.isArray(data.threads)?data.threads:[];
   renderList();await loadRoom();
  }catch(_){}
 }
 setInterval(poll,4500);
 $('operator-form').addEventListener('submit',async e=>{
  e.preventDefault();if(!enabled||!selected||inFlight)return;
  const input=$('operator-input'),msg=input.value.trim();if(!msg)return;
  inFlight=true;reflect();feedback.textContent='Enviando...';
  try{
   await api('/api/admin/reply','POST',{thread_id:selected,message:msg});
   input.value='';feedback.textContent='Mensagem entregue à conversa. ✓';
   lastRoom='';await loadRoom();await poll();
  }catch(e){feedback.textContent=e.message;}
  finally{inFlight=false;reflect();}
 });
 document.querySelector('[data-target="live"]')?.addEventListener('click',()=>{$('section-title').textContent='Atendimento ao vivo';poll();});
 $('logout').addEventListener('click',()=>{if(enabled)fetch('/api/admin/presence',{method:'POST',credentials:'same-origin',keepalive:true,headers:{'content-type':'application/json'},body:JSON.stringify({online:false})}).catch(()=>{});});
 window.addEventListener('pagehide',()=>{if(enabled)fetch('/api/admin/presence',{method:'POST',credentials:'same-origin',keepalive:true,headers:{'content-type':'application/json'},body:JSON.stringify({online:false})}).catch(()=>{});});
 const ready=setInterval(()=>{if(!pane.hidden){clearInterval(ready);poll()}},1000);
 reflect();
})();