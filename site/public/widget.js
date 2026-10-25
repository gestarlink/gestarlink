(()=>{'use strict';
 const $=id=>document.getElementById(id), widget=$('gl-widget'),fab=$('gl-fab'),invite=$('gl-invite'),messages=$('glw-messages'),input=$('glw-input'),send=$('glw-send'),quick=$('glw-quick');
 const phrase={
 pt:{welcome:'Oi! 👋 Sou a Zai, assistente virtual da GestarLink. O que você tem em mente?',site:'Quero um site',app:'Preciso de um app',auto:'Quero automatizar',human:'Falar com a equipe',contact:'Deixar contato',placeholder:'Mensagem para Zai...',invite:'Oi! Sou a Zai 👋',invitesub:'Quer ajuda com seu projeto?',confirm:'Contato recebido! Nossa equipe poderá retornar pelos dados informados.',err:'Não foi possível enviar agora. Por favor, tente novamente mais tarde.',wait:'Zai está digitando…',humanmsg:'Claro! Deixe seu e-mail ou telefone para que possamos responder. Se houver WhatsApp configurado, também posso abrir o contato direto.',privacy:'Sou uma assistente virtual. Não compartilhe senhas ou dados sensíveis.',no:'Para solicitar um retorno, deixe um e-mail ou telefone.'},
 en:{welcome:'Hey! 👋 I’m Zai, GestarLink’s virtual assistant. What can I help you build?',site:'Build a website',app:'App or system',auto:'Automation',human:'Talk to the team',contact:'Leave contact',placeholder:'Message Zai...',invite:'Hey! I’m Zai 👋',invitesub:'Click to chat with me.',confirm:'Contact received! Our team can follow up using the details you provided.',err:'Could not send right now. Please try again later.',wait:'Zai is typing…',humanmsg:'Absolutely. Leave your email or phone and our team can get back to you.',privacy:'Please do not share passwords or sensitive information.',no:'Please leave an email or phone for a reply.'},
 es:{welcome:'¡Hola! 👋 Soy Zai, asistente virtual de GestarLink. ¿Qué tienes en mente?',site:'Crear sitio web',app:'App o sistema',auto:'Automatización',human:'Hablar con el equipo',contact:'Dejar contacto',placeholder:'Mensaje para Zai...',invite:'¡Hola! Soy Zai 👋',invitesub:'Haz clic y conversemos.',confirm:'¡Contacto recibido! Nuestro equipo podrá responderte.',err:'No fue posible enviar ahora. Inténtalo más tarde.',wait:'Zai está escribiendo…',humanmsg:'¡Claro! Déjanos tu correo o teléfono para responderte.',privacy:'No compartas contraseñas ni datos sensibles.',no:'Deja un correo o teléfono para recibir respuesta.'}
 };
 let lang=()=>window.GestarI18n?.current()||'pt'; const t=k=>(phrase[lang()]||phrase.pt)[k]||phrase.pt[k];
 const storage=(type,key,fallback)=>{try{return type.getItem(key)||fallback}catch{return fallback}};
 let consent=storage(localStorage,'gl_analytics',null);
 let visitor=consent==='yes'?storage(localStorage,'gl_visitor',crypto.randomUUID()):storage(sessionStorage,'gl_temp_visitor',crypto.randomUUID());
 let thread=storage(sessionStorage,'gl_thread',crypto.randomUUID()),opening=false,config={},sending=false;
 const historyKey='gl_zai_chat_history';
 let history=[];
 try{const cache=JSON.parse(sessionStorage.getItem(historyKey)||'[]');if(Array.isArray(cache))history=cache.filter(v=>v&&['bot','user'].includes(v.role)&&typeof v.message==='string'&&Number.isFinite(v.at)).slice(-50)}catch(_){}
 function persist(){try{sessionStorage.setItem(historyKey,JSON.stringify(history.slice(-50)))}catch(_){}}
 function clock(at){return new Intl.DateTimeFormat(lang()==='pt'?'pt-BR':lang()==='es'?'es-ES':'en-US',{hour:'2-digit',minute:'2-digit'}).format(at)}
 function sizeComposer(){input.style.height='auto';input.style.height=Math.min(input.scrollHeight,105)+'px';send.disabled=sending||!input.value.trim()}
 try{if(consent==='yes')localStorage.setItem('gl_visitor',visitor);else sessionStorage.setItem('gl_temp_visitor',visitor);sessionStorage.setItem('gl_thread',thread)}catch(_){}
 const query=new URLSearchParams(location.search);const source=query.get('utm_source')||document.referrer&&(()=>{try{return new URL(document.referrer).hostname}catch{return 'direct'}})()||'direct';
 const meta={visitor_id:visitor,thread_id:thread,source,campaign:query.get('utm_campaign')||'',landing:location.pathname,path:location.pathname};
 let pollTimer=null,online=false,renderedIds='',lastKnownMode='';
 const humanAcknowledgement={
  pt:'Sua mensagem chegou! 💬 A equipe está online e vai responder aqui.',
  en:'Message delivered! 💬 Our team is online and will reply here.',
  es:'¡Mensaje recibido! 💬 Nuestro equipo está conectado y responderá aquí.'
 };
 function status(){
  const el=$('glw-subtitle');
  el.textContent=online?(lang()==='pt'?'● Equipe online · Atendimento humano':lang()==='es'?'● Equipo conectado · Atención humana':'● Team online · Human support')
   :(lang()==='pt'?'● Zai · Assistente virtual':lang()==='es'?'● Zai · Asistente virtual':'● Zai · Virtual assistant');
 }
 async function sync(){
  if(widget.hidden||sending)return;
  try{
   const u='/api/thread?visitor_id='+encodeURIComponent(visitor)+'&thread_id='+encodeURIComponent(thread);
   const r=await fetch(u,{credentials:'same-origin',cache:'no-store'});
   if(!r.ok)return;
   const data=await r.json();online=!!data.human_online;status();
   const msgs=Array.isArray(data.messages)?data.messages:[];
   const key=msgs.map(m=>m.id).join('|');
   if(msgs.length&&key!==renderedIds){
    renderedIds=key;messages.replaceChildren();quick.replaceChildren();
    history=msgs.slice(-50).map(m=>({message:m.body,role:m.role==='user'?'user':'bot',at:Date.parse(m.created_at+'Z')||Date.now()}));
    persist();
    for(const m of msgs){
      const role=m.role==='user'?'user':'bot';
      const stamp=Date.parse(m.created_at+'Z')||Date.now();
      const b=bubble(m.body,role,stamp,false);
      if(m.sender==='human')b.parentNode.classList.add('from-team');
    }
   }
  }catch(_){}
 }
 function startSync(){if(pollTimer)clearInterval(pollTimer);sync();pollTimer=setInterval(sync,3500)}
 function stopSync(){if(pollTimer)clearInterval(pollTimer);pollTimer=null}

 async function post(path,data,method='POST'){const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),18000);try{const r=await fetch(path,{method,headers:{'content-type':'application/json'},body:JSON.stringify(data),credentials:'same-origin',signal:ctrl.signal});const out=await r.json();if(!r.ok)throw new Error(out.error||'Unavailable');return out;}finally{clearTimeout(timer)}}
 function event(type,value=''){if(consent!=='yes')return;post('/api/event',{...meta,consent:true,type,path:location.pathname,value}).catch(()=>{});}
 if(consent===null){$('gl-consent').hidden=false;}$('gl-accept').onclick=()=>{consent='yes';localStorage.setItem('gl_analytics','yes');localStorage.setItem('gl_visitor',visitor);$('gl-consent').hidden=true;event('page_view')};$('gl-reject').onclick=()=>{consent='no';localStorage.setItem('gl_analytics','no');localStorage.removeItem('gl_visitor');$('gl-consent').hidden=true};if(consent==='yes')event('page_view');
 const updateUI=()=>{input.placeholder=t('placeholder');$('glw-contact').textContent=t('contact');$('glw-human').textContent=t('human');invite.childNodes[0].textContent=t('invite');invite.querySelector('small').textContent=t('invitesub');status()};
 const bubble=(message,cls='bot',at=Date.now(),save=true)=>{
  const outer=document.createElement('div');outer.className='glw-message '+cls;
  const body=document.createElement('span');body.className='glw-bubble';body.textContent=message;
  outer.appendChild(body);
  if(['bot','user'].includes(cls)){
   const time=document.createElement('time');time.className='glw-time';time.dateTime=new Date(at).toISOString();time.textContent=clock(at);outer.appendChild(time);
   if(save){history.push({message,role:cls,at});persist()}
  }
  messages.appendChild(outer);messages.scrollTop=messages.scrollHeight;return body;
 };
 const typing=()=>{const el=document.createElement('div');el.className='glw-typing';el.setAttribute('aria-label',t('wait'));el.innerHTML='<span></span><span></span><span></span>';messages.appendChild(el);messages.scrollTop=messages.scrollHeight;return el};
 function shortcuts(){quick.replaceChildren();[['site',t('site')],['app',t('app')],['auto',t('auto')]].forEach(([k,v])=>{let b=document.createElement('button');b.type='button';b.textContent=v;b.onclick=()=>sendMsg(v);quick.appendChild(b)});}
 function open(){widget.hidden=false;fab.setAttribute('aria-expanded','true');invite.hidden=true;opening=true;updateUI();if(!messages.childElementCount){if(history.length){history.forEach(m=>bubble(m.message,m.role,m.at,false));quick.replaceChildren()}else{bubble(t('welcome'));shortcuts()}}else{quick.replaceChildren()}event('chat_open');startSync();if(window.matchMedia('(pointer:fine)').matches)input.focus({preventScroll:true});}
 function close(){stopSync();widget.hidden=true;fab.setAttribute('aria-expanded','false');$('glw-lead').hidden=true;}
 fab.onclick=()=>widget.hidden?open():close();
 $('glw-new').onclick=()=>{if(sending)return;thread=crypto.randomUUID();history=[];renderedIds='';persist();try{sessionStorage.setItem('gl_thread',thread)}catch(_){}meta.thread_id=thread;messages.replaceChildren();quick.replaceChildren();input.value='';bubble(t('welcome'));shortcuts();sizeComposer();};$('glw-close').onclick=close;$('open-chat-contact')?.addEventListener('click',open);$('gl-invite-close').onclick=()=>invite.hidden=true;
 setTimeout(()=>{if(!opening&&widget.hidden&&sessionStorage.getItem('gl_invite_shown')!=='1'){invite.hidden=false;updateUI();try{sessionStorage.setItem('gl_invite_shown','1')}catch(_){}}},6500);
 async function sendMsg(value){const msg=String(value||input.value).trim();if(!msg||sending)return;
  sending=true;quick.replaceChildren();input.value='';sizeComposer();bubble(msg,'user');const pending=typing();
  try{
   const r=await post('/api/chat',{...meta,message:msg,lang:lang()});pending.remove();
   online=!!r.human_online;status();
   if(r.mode==='human')bubble(humanAcknowledgement[lang()]||humanAcknowledgement.pt,'system');
   else if(r.reply)bubble(r.reply,'bot');
   event('chat_started');await sync();
  }
  catch(e){pending.remove();bubble(t('err'),'system');input.value=msg;}
  finally{sending=false;sizeComposer();if(window.matchMedia('(pointer:fine)').matches)input.focus({preventScroll:true})}
 }
 $('glw-form').onsubmit=e=>{e.preventDefault();sendMsg()};
 input.addEventListener('input',sizeComposer);
 input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&window.matchMedia('(pointer:fine)').matches){e.preventDefault();sendMsg()}});
 sizeComposer();
 $('glw-contact').onclick=()=>{$('glw-lead').hidden=false;$('glw-email').focus()};$('glw-lead-close').onclick=()=>{$('glw-lead').hidden=true};
 $('glw-human').onclick=async()=>{await sendMsg(lang()==='pt'?'Quero falar com a equipe':lang()==='es'?'Quiero hablar con el equipo':'I want to talk to the team');bubble(t('humanmsg'),'system');try{const r=await fetch('/api/config');if(r.ok){config=await r.json();if(config.whatsapp&&/^\+?\d{10,15}$/.test(config.whatsapp.replace(/\s/g,''))){const a=document.createElement('a');a.href='https://wa.me/'+config.whatsapp.replace(/\D/g,'');a.target='_blank';a.rel='noopener noreferrer';a.textContent='WhatsApp ↗';a.style.color='#92dcfe';messages.appendChild(a);event('whatsapp_click')}else $('glw-lead').hidden=false;}}catch(_){$('glw-lead').hidden=false}};
 $('glw-lead').onsubmit=async e=>{e.preventDefault();const name=$('glw-name').value.trim(),email=$('glw-email').value.trim(),phone=$('glw-phone').value.trim(),company=$('glw-company').value.trim();const feedback=$('glw-lead-feedback');feedback.textContent='...';try{if(!email&&!phone)throw Error(t('no'));await post('/api/lead',{...meta,name,email,phone,company,summary:history.map(m=>m.message).join(' | ').slice(0,900),service:''});feedback.textContent=t('confirm');event('lead_created');$('glw-lead').reset();setTimeout(()=>{$('glw-lead').hidden=true},2400)}catch(err){feedback.textContent=err.message===t('no')?t('no'):t('err')}};
 document.querySelectorAll('[data-service]').forEach(el=>el.addEventListener('click',e=>{e.preventDefault();open();event('service_click',el.dataset.service);sendMsg(el.closest('.service-card')?.querySelector('h3')?.textContent||t('site'))}));
 document.querySelectorAll('a[href="#contato"]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();open();event('cta_click')}));
 const observer=new MutationObserver(()=>{if(opening)updateUI()});observer.observe(document.documentElement,{attributes:true,attributeFilter:['lang']});updateUI();
})()
