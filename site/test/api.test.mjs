import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/api/[[path]].js';
const id1='c6a631c4-616e-4c13-bbbe-e7fed955f000';
const id2='263c66ba-6438-4aca-9ae2-aae70bad0000';
function mkDB(){
 const threadMap=new Map(), counts=new Map(),logs=[];
 return { logs,prepare(sql){let vals=[];return {
  bind(...v){vals=v;return this},
  async first(){
   if(sql.includes('INSERT INTO api_limits')) {const k=vals[0],v=(counts.get(k)||0)+1;counts.set(k,v);return {count:v};}
   if(sql.startsWith('SELECT count,since FROM auth_attempts')) return null;
   if(sql.startsWith('SELECT COUNT(*) total FROM messages'))return {total:0};
   if(sql.startsWith('SELECT visitor_id FROM threads'))return {visitor_id:threadMap.get(vals[0])};
   return null;
  },
  async all(){ if(sql.includes('SELECT key,value FROM settings'))return {results:[]};if(sql.includes('SELECT role,body FROM messages'))return {results:[]}; return {results:[]}},
  async run(){logs.push([sql,vals]);if(sql.startsWith('INSERT OR IGNORE INTO threads'))threadMap.set(vals[0],vals[1]);return {success:true}}};}};
}
function req(path,method='GET',data,other={}){return new Request('https://gestarlink.com'+path,{method,headers:{...(data?{'content-type':'application/json'}:{}),...other},body:data?JSON.stringify(data):undefined});}
const ctx=(request,env)=>({request,env});
test('health/config work and disallowed method blocked',async()=>{
 const env={DB:mkDB()};
 const health=await onRequest(ctx(req('/api/health'),env));assert.equal(health.status,200);assert.equal((await health.json()).ok,true);
 const config=await onRequest(ctx(req('/api/config'),env));assert.equal((await config.json()).assistant_name,'GestarLink Assistente');
 const blocked=await onRequest(ctx(req('/api/health','DELETE'),env));assert.equal(blocked.status,405);
});
test('chat persists user & assistant and uses guided fallback',async()=>{
 const DB=mkDB(),env={DB,SESSION_SECRET:'test-only-secret'};
 const r=await onRequest(ctx(req('/api/chat','POST',{thread_id:id2,visitor_id:id1,message:'Quero criar um site',lang:'pt'}),env));
 assert.equal(r.status,200,await r.clone().text()); const j=await r.json();assert.match(j.reply,/site do zero/);
 assert.equal(DB.logs.filter(([sql])=>sql.startsWith('INSERT INTO messages')).length,2);
});
test('admin session login issues secure HttpOnly cookie',async()=>{
 const env={DB:mkDB(),ADMIN_PASSWORD:'temporary-test-password',SESSION_SECRET:'temporary-test-secret'};
 const r=await onRequest(ctx(req('/api/admin/login','POST',{password:'temporary-test-password'}),env));
 assert.equal(r.status,200);assert.match(r.headers.get('set-cookie')||'',/HttpOnly; Secure; SameSite=Strict/);
});
test('cross-origin mutation and unconfigured DB blocked',async()=>{
 const db=mkDB();
 const cross=await onRequest(ctx(req('/api/chat','POST',{visitor_id:id1,thread_id:id2,message:'teste'},{origin:'https://malicious.example'}),{DB:db,SESSION_SECRET:'secret'}));assert.equal(cross.status,403);
 const unavailable=await onRequest(ctx(req('/api/health'),{}));assert.equal(unavailable.status,503);
});

test('lead can be received without a prior chat message',async()=>{
 const DB=mkDB(),env={DB,SESSION_SECRET:'test-only-secret'};
 const r=await onRequest(ctx(req('/api/lead','POST',{thread_id:id2,visitor_id:id1,email:'cliente@example.com',name:'Cliente',lang:'pt'}),env));
 assert.equal(r.status,200,await r.clone().text());
 assert.equal(DB.logs.some(([sql])=>sql.startsWith('INSERT INTO leads')),true);
});
