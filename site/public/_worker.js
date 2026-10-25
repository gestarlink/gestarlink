/* GestarLink API - Cloudflare Pages Functions + D1 + optional Workers AI.
 * Requires DB D1 binding and ADMIN_PASSWORD, SESSION_SECRET secrets.
 */
const ALLOWED_LANG = new Set(['pt','en','es']);
const TYPES = new Set(['page_view','chat_open','service_click','whatsapp_click','cta_click','lead_created','chat_started']);
const STAGES = new Set(['new','qualified','contacted','proposal','won','lost']);
const uuid = () => crypto.randomUUID();
const clean = (v, max=200) => String(v ?? '').trim().slice(0,max);
const validId = v => typeof v === 'string' && /^[a-f0-9-]{20,50}$/i.test(v);
const encoder = new TextEncoder();
function j(data, status=200, headers={}) { return new Response(JSON.stringify(data), {status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...headers}}); }
function fail(msg,status=400) { return j({error:msg},status); }
async function payload(request) { const size=Number(request.headers.get('content-length')||0); if(size>12000)throw new Error('too_large'); const body=await request.text();if(body.length>12000)throw new Error('too_large');try{return JSON.parse(body)}catch(_){throw new Error('invalid_json')} }
async function sign(value,secret){let key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);let signature=await crypto.subtle.sign('HMAC',key,encoder.encode(value));return [...new Uint8Array(signature)].map(n=>n.toString(16).padStart(2,'0')).join('');}
async function adminAuthorized(req,env){const cookie=(req.headers.get('cookie')||'').match(/(?:^|; )gl_admin=([^;]+)/)?.[1];if(!cookie||!env.SESSION_SECRET)return false;let bits=cookie.split('.');if(bits.length!==2)return false;const [ts,mac]=bits;const date=Number(ts);if(!Number.isInteger(date)||date<Date.now()-86400000||date>Date.now()+300000)return false;const expected=await sign(`gestarlink-admin|${ts}`,env.SESSION_SECRET);return mac.length===expected.length&&mac.split('').reduce((n,c,i)=>n | (c.charCodeAt(0)^expected.charCodeAt(i)),0)===0;}
function sourceFrom(req,body) { const ref=req.headers.get('referer')||''; let origin='direct';try{const r=new URL(ref);if(r.hostname!==new URL(req.url).hostname)origin=r.hostname;}catch(_){} return clean(body?.source||origin,120); }
async function withinRateLimit(req,env,kind,limit,windowMs){
 // Anonymous IP-based throttling: HMAC only; never store a raw address.
 if(!env.SESSION_SECRET)return false;
 const ip=req.headers.get('cf-connecting-ip')||'unknown';
 const fingerprint=await sign(`${kind}|${ip}`,env.SESSION_SECRET);
 const bucket=Math.floor(Date.now()/windowMs);
 const key=`${kind}:${fingerprint}:${bucket}`;
 const result=await env.DB.prepare('INSERT INTO api_limits(key,count) VALUES(?,1) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key).first();
 return Number(result?.count||0)<=limit;
}
async function settings(env){const rows=await env.DB.prepare('SELECT key,value FROM settings').all();return Object.fromEntries((rows.results||[]).map(x=>[x.key,x.value]));}
function method(req,m){return req.method===m;}
async function aiAnswer(env,context,lang){
 if(!env.AI)return null;
 const prompts={
 pt:'Você é a Zai, assistente virtual de projetos da GestarLink. Converse de forma natural, como no WhatsApp, e não como um formulário: respostas claras e calorosas, uma ou duas frases curtas (máx. 65 palavras) e no máximo uma pergunta útil por vez. Responda primeiro a dúvida, acompanhe o histórico e não repita questões já respondidas. Apresente sites, ajustes, aplicativos, SaaS e automações. Preços são pontos de partida: ajustes US$100, sites US$250, automações US$300, MVPs US$600, variam pelo escopo. Se pedirem humano, indique o botão "Falar com a equipe" ou "Deixar contato", sem prometer disponibilidade imediata. Nunca peça dados sensíveis nem prometa preço/prazo final. Você é virtual; nunca finja ser pessoa real.',
 en:'You are Zai, GestarLink’s virtual project assistant. Chat like WhatsApp: warm and concise, one or two short sentences (max 65 words) with at most one useful follow-up question. Answer the question first, remember context, avoid repetitive scripted replies. Services: websites, fixes, apps, SaaS, automation. Starting prices USD: fixes 100, sites 250, automations 300, MVP 600; final quote depends on scope. For humans, refer to "Talk to the team" or "Leave contact" without promising live availability. Never ask sensitive data or pretend to be human.',
 es:'Eres Zai, la asistente virtual de proyectos de GestarLink. Habla como en WhatsApp, cálida y breve, una o dos frases (máx. 65 palabras), como máximo una pregunta útil por respuesta. Contesta primero, recuerda el contexto, evita preguntas repetidas. Servicios: sitios, mejoras, apps, SaaS y automatizaciones. Precios desde: mejoras USD 100, sitios 250, automatizaciones 300, MVP 600, según alcance. Para asistencia humana sugiere "Hablar con el equipo" o "Dejar contacto". Nunca pidas datos sensibles ni finjas ser humana.'
 };
 try {const response=await env.AI.run('@cf/meta/llama-3.1-8b-instruct',{messages:[{role:'system',content:prompts[lang]||prompts.pt},...context.map(m=>({role:m.role==='user'?'user':'assistant',content:m.body}))],max_tokens:145,temperature:.6});return clean(response?.response,600)||null;}catch(e){console.log('AI unavailable',String(e).slice(0,80));return null;}
}
function fallback(message,lang,history=[]){
 const m=String(message).toLowerCase(),en=lang==='en',es=lang==='es';
 const prior=history.filter(x=>x.role==='user').slice(0,-1).map(x=>x.body.toLowerCase()).join(' ');
 const whole=prior+' '+m,first=!prior.trim();
 const say=(pt,english,spanish)=>es?spanish:en?english:pt;
 if(/(preço|preco|valor|custa|quanto|orçamento|orcamento|price|cost|quote|presupuesto|cu[aá]nto|precio)/i.test(m))
   return say('Os valores iniciais são US$100 para ajustes, US$250 para sites, US$300 para automações e US$600 para MVPs. O orçamento depende do projeto. Qual dessas soluções você procura?',
   'Starting points are $100 for fixes, $250 for websites, $300 for automation and $600 for MVPs. Final pricing depends on scope. Which fits your idea?',
   'Como referencia: mejoras desde US$100, sitios US$250, automatización US$300 y MVPs US$600. El presupuesto depende del alcance. ¿Cuál necesitas?');
 if(/(prazo|demora|tempo|quando|urgente|deadline|timeline|plazo|cu[aá]ndo)/i.test(m))
   return say('O prazo varia conforme o escopo. Você tem uma data em mente para começar?','Timing depends on the project scope. Do you have a target start date?','El plazo depende del proyecto. ¿Tienes una fecha para empezar?');
 if(/(humano|atendente|pessoa|human|person|persona|whatsapp|contato|contact|contacto)/i.test(m))
   return say('Claro! É só tocar em “Falar com a equipe” ou “Deixar contato”. Se houver WhatsApp configurado, ele aparece por aqui.','Sure! Tap “Talk to the team” or “Leave contact”. WhatsApp is available here when configured.','¡Claro! Toca “Hablar con el equipo” o “Dejar contacto”. Si WhatsApp está configurado, aparecerá aquí.');
 if(/(obrigad|valeu|thanks|thank you|gracias)/i.test(m))
   return say('Por nada! 💜 Se quiser, posso ajudar a organizar sua ideia para a equipe.','You’re welcome! 💜 I can help you describe your idea for the team.','¡Con gusto! 💜 Puedo ayudarte a resumir tu idea para el equipo.');
 if(/^(oi|olá|ola|hey|hello|hi|hola|buenas|bom dia|boa tarde)[!\s.]*$/i.test(m.trim()))
   return say('Oi! 😊 Me conta o que você quer criar ou melhorar.','Hey! 😊 Tell me what you want to build or improve.','¡Hola! 😊 Cuéntame qué quieres crear o mejorar.');
 if(/(site|página|pagina|website|landing|web)/i.test(whole))
   return first?say('Legal! Você quer começar um site do zero ou melhorar um existente?','Great! Are you creating a new site or improving an existing one?','¡Genial! ¿Quieres crear un sitio nuevo o mejorar uno existente?')
   :say('Entendi! Seu objetivo principal é divulgar a empresa, vender ou receber contatos?','Got it! Is your main goal to showcase your business, sell or get enquiries?','¡Entendido! ¿El objetivo es presentar tu negocio, vender o recibir contactos?');
 if(/(autom|integr|api|ia|ai)/i.test(whole))
   return say('Dá para simplificar esse processo. Qual tarefa você gostaria de automatizar?','We can simplify that. Which task do you want to automate?','Podemos simplificarlo. ¿Qué tarea quieres automatizar?');
 if(/(app|sistema|system|saas|pwa|aplicativo)/i.test(whole))
   return say('Boa ideia! Que problema o aplicativo vai resolver no dia a dia?','Nice idea! What everyday problem will your app solve?','¡Buena idea! ¿Qué problema cotidiano resolverá la app?');
 return say('Entendi! Pode me contar um pouco mais do resultado que você espera?','Got it! Could you tell me a little more about the result you want?','¡Entendido! ¿Me cuentas un poco más sobre el resultado que buscas?');
}
async function gestarlinkApi({request:req,env}){
 const url=new URL(req.url),path=url.pathname;
 if(!env.DB) return fail('Banco de dados ainda não configurado.',503);
 if(!['GET','POST','PATCH'].includes(req.method))return fail('Método não permitido.',405);
 // Every mutating request must be same-origin (blocks cross-site forms / cookie CSRF).
 if(req.method!=='GET'){const origin=req.headers.get('origin');if(origin&&origin!==url.origin)return fail('Origem inválida.',403);}
 try{
 if(path==='/api/health'&&method(req,'GET'))return j({ok:true,ai:!!env.AI});
 if(path==='/api/config'&&method(req,'GET')){const s=await settings(env);return j({whatsapp:s.whatsapp||'',contact_email:s.contact_email||'',assistant_name:s.assistant_name||'Zai',ai:!!env.AI});}
 if(path==='/api/event'&&method(req,'POST')){
   const b=await payload(req);if(!b.consent)return j({ok:true,skipped:true});
   if(!validId(b.visitor_id)||!TYPES.has(b.type))return fail('Evento inválido');
   const id=b.visitor_id;const source=sourceFrom(req,b);
   await env.DB.prepare(`INSERT INTO visitors(id,source,campaign,landing,country,consent) VALUES(?,?,?,?,?,1) ON CONFLICT(id) DO UPDATE SET last_seen=datetime('now'),consent=1`).bind(id,source,clean(b.campaign,100),clean(b.landing,250),clean(req.cf?.country||'',3)).run();
   const lastDay=await env.DB.prepare("SELECT COUNT(*) n FROM events WHERE visitor_id=? AND created_at >= datetime('now','-1 day')").bind(id).first();if((lastDay?.n||0)>=150)return fail('Limite de eventos',429);
   await env.DB.prepare('INSERT INTO events(id,visitor_id,type,path,value) VALUES(?,?,?,?,?)').bind(uuid(),id,b.type,clean(b.path,250),clean(b.value,160)).run();return j({ok:true});
 }
 if(path==='/api/chat'&&method(req,'POST')){
   if(!await withinRateLimit(req,env,'chat',40,3600000))return fail('Limite de acesso atingido.',429);
   const b=await payload(req);if(!validId(b.thread_id)||!validId(b.visitor_id))return fail('Sessão inválida');
   const input=clean(b.message,1400),lang=ALLOWED_LANG.has(b.lang)?b.lang:'pt';if(input.length<2)return fail('Mensagem muito curta');
   const count=await env.DB.prepare("SELECT COUNT(*) total FROM messages WHERE thread_id=? AND role='user' AND created_at >= datetime('now','-1 hour')").bind(b.thread_id).first();if((count?.total||0)>50)return fail('Limite de mensagens atingido. Tente mais tarde.',429);
   const source=sourceFrom(req,b);await env.DB.prepare('INSERT OR IGNORE INTO visitors(id,source,landing,country,consent) VALUES(?,?,?,?,0)').bind(b.visitor_id,source,clean(b.path,220),'').run();
   await env.DB.prepare('INSERT OR IGNORE INTO threads(id,visitor_id,source,page,lang) VALUES(?,?,?,?,?)').bind(b.thread_id,b.visitor_id,source,clean(b.path,200),lang).run();
   const thread=await env.DB.prepare('SELECT visitor_id FROM threads WHERE id=?').bind(b.thread_id).first();if(thread?.visitor_id!==b.visitor_id)return fail('Sessão inválida',403);
   await env.DB.prepare('INSERT INTO messages(id,thread_id,role,body) VALUES(?,?,?,?)').bind(uuid(),b.thread_id,'user',input).run();
   const rows=await env.DB.prepare('SELECT role,body FROM messages WHERE thread_id=? ORDER BY created_at DESC, rowid DESC LIMIT 12').bind(b.thread_id).all();const context=(rows.results||[]).reverse();
   const answer=(await aiAnswer(env,context,lang))||fallback(input,lang,context);await env.DB.prepare('INSERT INTO messages(id,thread_id,role,body) VALUES(?,?,?,?)').bind(uuid(),b.thread_id,'assistant',answer).run();
   let intent='';if(/site|web|landing/i.test(input))intent='web';else if(/auto|api|integr|ia/i.test(input))intent='automation';else if(/app|saas|sistema/i.test(input))intent='mvp';
   await env.DB.prepare("UPDATE threads SET updated_at=datetime('now'),intent=CASE WHEN ?<>'' THEN ? ELSE intent END WHERE id=?").bind(intent,intent,b.thread_id).run();
   return j({reply:answer,ai:!!env.AI});
 }
 if(path==='/api/lead'&&method(req,'POST')){
   if(!await withinRateLimit(req,env,'lead',15,3600000))return fail('Limite de acesso atingido.',429);
   const b=await payload(req);if(!validId(b.thread_id)||!validId(b.visitor_id))return fail('Sessão inválida');
   const source=sourceFrom(req,b);
   // A visitor may leave contact information before sending their first chat message.
   await env.DB.prepare('INSERT OR IGNORE INTO visitors(id,source,landing,country,consent) VALUES(?,?,?,?,0)').bind(b.visitor_id,source,clean(b.path,220),'').run();
   await env.DB.prepare('INSERT OR IGNORE INTO threads(id,visitor_id,source,page,lang) VALUES(?,?,?,?,?)').bind(b.thread_id,b.visitor_id,source,clean(b.path,200),ALLOWED_LANG.has(b.lang)?b.lang:'pt').run();
   const thread=await env.DB.prepare('SELECT visitor_id FROM threads WHERE id=?').bind(b.thread_id).first();if(!thread||thread.visitor_id!==b.visitor_id)return fail('Conversa pertence a outra sessão',403);
   const email=clean(b.email,150),name=clean(b.name,100),phone=clean(b.phone,45);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&phone.length<8)return fail('Informe e-mail válido ou telefone');
   await env.DB.prepare(`INSERT INTO leads(id,thread_id,name,email,phone,company,service,summary) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(thread_id) DO UPDATE SET name=excluded.name,email=excluded.email,phone=excluded.phone,company=excluded.company,service=excluded.service,summary=excluded.summary,updated_at=datetime('now')`).bind(uuid(),b.thread_id,name,email,phone,clean(b.company,120),clean(b.service,100),clean(b.summary,1000)).run();
   return j({ok:true});
 }
 if(path==='/api/admin/login'&&method(req,'POST')){
   if(!env.ADMIN_PASSWORD||!env.SESSION_SECRET)return fail('Login administrativo não configurado.',503);
   const fp=await sign(clean(req.headers.get('cf-connecting-ip')||'unknown',60),env.SESSION_SECRET);
   const attempts=await env.DB.prepare('SELECT count,since FROM auth_attempts WHERE fingerprint=?').bind(fp).first();const now=Date.now();if(attempts?.count>=8&&now-attempts.since<3600000)return fail('Muitas tentativas. Tente novamente mais tarde.',429);
   const b=await payload(req);const given=await sign(clean(b.password,250),env.SESSION_SECRET),expected=await sign(env.ADMIN_PASSWORD,env.SESSION_SECRET);const ok=given.length===expected.length&&given.split('').reduce((n,c,i)=>n|(c.charCodeAt(0)^expected.charCodeAt(i)),0)===0;
   if(!ok){const cnt=now-(attempts?.since||0)>3600000?1:(attempts?.count||0)+1;await env.DB.prepare('INSERT INTO auth_attempts(fingerprint,count,since) VALUES(?,?,?) ON CONFLICT(fingerprint) DO UPDATE SET count=excluded.count,since=excluded.since').bind(fp,cnt,cnt===1?now:attempts.since).run();return fail('Senha incorreta.',401);}
   await env.DB.prepare('DELETE FROM auth_attempts WHERE fingerprint=?').bind(fp).run();const stamp=String(now),mac=await sign(`gestarlink-admin|${stamp}`,env.SESSION_SECRET);
   return j({ok:true},200,{'set-cookie':`gl_admin=${stamp}.${mac}; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`});
 }
 if(path.startsWith('/api/admin/')){
   if(!await adminAuthorized(req,env))return fail('Não autorizado.',401);
   if(path==='/api/admin/logout'&&method(req,'POST'))return j({ok:true},200,{'set-cookie':'gl_admin=; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=0'});
   if(path==='/api/admin/dashboard'&&method(req,'GET')){
     const [visits,events,leads,threads,sources,pages,leadRows,threadRows,visitorRows,s]=await Promise.all([
       env.DB.prepare("SELECT count(*) n FROM visitors WHERE consent=1 AND first_seen >= datetime('now','-30 days')").first(),
       env.DB.prepare("SELECT type,count(*) n FROM events WHERE created_at >= datetime('now','-30 days') GROUP BY type").all(),
       env.DB.prepare("SELECT stage,count(*) n FROM leads GROUP BY stage").all(),
       env.DB.prepare("SELECT count(*) n FROM threads").first(),
       env.DB.prepare("SELECT source,count(*) n FROM visitors WHERE consent=1 GROUP BY source ORDER BY n DESC LIMIT 10").all(),
       env.DB.prepare("SELECT path,count(*) n FROM events WHERE type='page_view' GROUP BY path ORDER BY n DESC LIMIT 10").all(),
       env.DB.prepare("SELECT l.*,t.source,t.lang FROM leads l LEFT JOIN threads t ON t.id=l.thread_id ORDER BY l.created_at DESC LIMIT 100").all(),
       env.DB.prepare("SELECT t.*, (SELECT count(*) FROM messages m WHERE m.thread_id=t.id) message_count FROM threads t ORDER BY updated_at DESC LIMIT 100").all(),
       env.DB.prepare("SELECT v.*, (SELECT count(*) FROM threads t WHERE t.visitor_id=v.id) chats FROM visitors v WHERE consent=1 ORDER BY v.last_seen DESC LIMIT 100").all(),settings(env)
     ]);
     return j({visitors:visits?.n||0,conversations:threads?.n||0,events:events.results||[],lead_counts:leads.results||[],sources:sources.results||[],pages:pages.results||[],leads:leadRows.results||[],threads:threadRows.results||[],visitors_list:visitorRows.results||[],settings:s});
   }
   if(path==='/api/admin/visitor'&&method(req,'GET')){const id=url.searchParams.get('id');if(!validId(id))return fail('ID inválido');const r=await env.DB.prepare('SELECT type,path,value,created_at FROM events WHERE visitor_id=? ORDER BY created_at DESC LIMIT 100').bind(id).all();return j({events:r.results||[]});}
   if(path==='/api/admin/thread'&&method(req,'GET')){const id=url.searchParams.get('id');if(!validId(id))return fail('ID inválido');const r=await env.DB.prepare('SELECT role,body,created_at FROM messages WHERE thread_id=? ORDER BY created_at,rowid LIMIT 200').bind(id).all();return j({messages:r.results||[]});}
   if(path==='/api/admin/lead'&&method(req,'PATCH')){const b=await payload(req);if(!validId(b.id)||!STAGES.has(b.stage))return fail('Dados inválidos');await env.DB.prepare("UPDATE leads SET stage=?,updated_at=datetime('now') WHERE id=?").bind(b.stage,b.id).run();return j({ok:true});}
   if(path==='/api/admin/settings'&&method(req,'POST')){const b=await payload(req);for(const k of ['whatsapp','contact_email','assistant_name']){if(b[k]!==undefined)await env.DB.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(k,clean(b[k],150)).run();}return j({ok:true});}
 }
 return fail('Rota não encontrada.',404);
 }catch(err){console.error('API',String(err));return fail('Falha ao processar solicitação. Tente novamente.',500);}
}


// Cloudflare Pages Advanced Mode for drag-and-drop uploads.
// The ASSETS binding is provided by Pages automatically.
export default {
  async fetch(request, env, context) {
    const path = new URL(request.url).pathname;
    if (path === '/api' || path.startsWith('/api/')) {
      return gestarlinkApi({request, env, context});
    }
    return env.ASSETS.fetch(request);
  },
};
