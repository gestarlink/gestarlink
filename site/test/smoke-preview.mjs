// Production-safe synthetic smoke test, executed ONLY on the preview environment.
// Does not print tokens, credentials, session cookies or customer data.
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

const base=process.env.SMOKE_URL||'https://preview.gestarlink.pages.dev';
const password=process.env.SMOKE_ADMIN_PASSWORD;
if(!password)throw new Error('Missing protected administrator password');

async function query(path,{method='GET',body,headers={}}={}){
 const response=await fetch(base+path,{method,headers:{...(body?{'content-type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined,redirect:'manual',signal:AbortSignal.timeout(15000)});
 const raw=await response.text();
 let json;try{json=JSON.parse(raw)}catch{throw new Error(path+': non-JSON response status '+response.status);}
 return {response,json};
}
async function waitForBackend(){
 for(let attempt=0;attempt<16;attempt++){
   try {const {response,json}=await query('/api/health');
     if(response.ok&&json.ok===true)return;
   }catch{}
   await new Promise(resolve=>setTimeout(resolve,4000));
 }
 throw new Error('Preview API did not become healthy within timeout');
}
await waitForBackend();
console.log('Preview health OK');
// Cloudflare Pages canonicalizes /admin.html to /admin; both must be reachable, never a loop.
let adminReady=false;
for(let attempt=0;attempt<12;attempt++){
 try{
  const adminPage=await fetch(base+'/admin',{redirect:'follow',signal:AbortSignal.timeout(15000)});
  const adminHtml=await adminPage.text();
  if(adminPage.status===200&&adminHtml.includes('id="login-form"')){adminReady=true;break;}
 }catch{}
 await new Promise(resolve=>setTimeout(resolve,3000));
}
assert.ok(adminReady,'Admin page must become reachable after deployment propagation');
console.log('Preview private login page OK');
const config=await query('/api/config');
assert.equal(config.response.status,200);
const visitor=randomUUID(),thread=randomUUID();
const session={visitor_id:visitor,thread_id:thread,source:'github-preview-smoke',path:'/'};
const chat=await query('/api/chat',{method:'POST',body:{...session,message:'Quero criar um site para minha empresa',lang:'pt'}});
assert.equal(chat.response.status,200,'Chat must accept and persist synthetic message');
assert.equal(typeof chat.json.reply,'string');
assert.equal(chat.json.mode,'guided','Offline Zai should use guided responses without paid AI');
assert.ok(chat.json.reply.length>10);
console.log('Preview chat OK');
const email='smoke-'+visitor.slice(0,8)+'@example.invalid';
const lead=await query('/api/lead',{method:'POST',body:{...session,name:'TESTE AUTOMATICO (PREVIEW)',email,summary:'Contato sintético de verificação do GitHub Actions'}});
assert.equal(lead.response.status,200,'Lead should be saved after chat');
assert.equal(lead.json.ok,true);
console.log('Preview lead capture OK');
const unauth=await query('/api/admin/dashboard');
assert.equal(unauth.response.status,401,'Private dashboard must reject public requests');
const login=await query('/api/admin/login',{method:'POST',body:{password}});
assert.equal(login.response.status,200,'Admin login must succeed with configured secret');
const setCookie=login.response.headers.get('set-cookie')||'';
const cookie=setCookie.split(';')[0];
assert.ok(cookie.startsWith('gl_admin='),'Login must set signed session cookie');
const dash=await query('/api/admin/dashboard',{headers:{cookie}});
assert.equal(dash.response.status,200,'Dashboard session must be authenticated');
assert.ok(Array.isArray(dash.json.leads));
assert.ok(dash.json.leads.some(l=>l.email===email),'Synthetic lead must be visible in dashboard');
console.log('Preview private dashboard, session and lead funnel OK');
// Simulate the owner taking over: Zai must not generate an automatic answer when human service is active.
const live=await query('/api/admin/presence',{method:'POST',headers:{cookie},body:{online:true}});
assert.equal(live.response.status,200);
assert.equal(live.json.online,true);
try{
 const message=await query('/api/chat',{method:'POST',body:{...session,message:'Posso conversar com a equipe GestarLink?',lang:'pt'}});
 assert.equal(message.response.status,200);
 assert.equal(message.json.mode,'human');
 assert.equal(message.json.reply,null,'No automatic bot reply when an operator is online');
 const human=await query('/api/admin/reply',{method:'POST',headers:{cookie},body:{thread_id:thread,message:'Claro! Aqui é a equipe GestarLink. Como posso ajudar?'}});
 assert.equal(human.response.status,200,'Operator must be able to respond from CRM');
 const timeline=await query('/api/thread?visitor_id='+visitor+'&thread_id='+thread);
 assert.equal(timeline.response.status,200);
 assert.ok(timeline.json.messages.some(m=>m.sender==='human'&&m.body.includes('Aqui é a equipe')),'Visitor must receive operator reply');
 const unauthorized=await query('/api/admin/reply',{method:'POST',body:{thread_id:thread,message:'unauthorized'}});
 assert.equal(unauthorized.response.status,401,'Public must not impersonate operator');
 console.log('Preview human takeover, messaging and security OK');
}finally{
 await query('/api/admin/presence',{method:'POST',headers:{cookie},body:{online:false}});
}
const virtual=await query('/api/chat',{method:'POST',body:{...session,message:'Obrigado pelo atendimento',lang:'pt'}});
assert.equal(virtual.response.status,200);
assert.equal(virtual.json.mode,'guided','Zai must resume virtual service when operator is offline');
console.log('Preview offline Zai handoff OK');
console.log('ALL PREVIEW SMOKE TESTS PASSED');
