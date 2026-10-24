import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const read = path => readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
test('main page contains supported pages and lead widget',()=>{
 const html=read('public/index.html');
 for (const id of ['gl-fab','gl-widget','glw-form','glw-lead','gl-consent','open-chat-contact']) assert.ok(html.includes(`id="${id}"`),id);
 assert.equal((html.match(/class="service-card/g)||[]).length,4);
 assert.equal((html.match(/class="project-card/g)||[]).length,6);
 assert.equal((html.match(/class="brand-mark"/g)||[]).length,2);
 assert.ok(existsSync(new URL('../public/assets/gestarlink-logo-reference.png', import.meta.url)));
});
test('panel and API endpoints present',()=>{
 const html=read('public/admin.html'),fn=read('functions/api/[[path]].js');
 for(const id of ['login-form','overview','leads','threads','traffic','settings','transcript'])assert.ok(html.includes(`id="${id}"`),id);
 for(const endpoint of ['/api/chat','/api/event','/api/lead','/api/admin/login','/api/admin/dashboard','/api/admin/thread','/api/admin/lead','/api/admin/settings'])assert.ok(fn.includes(endpoint));
 assert.ok(fn.includes('HttpOnly; Secure; SameSite=Strict'));
});
test('public files do not contain server secrets',()=>{
 for(const file of ['public/index.html','public/widget.js','public/admin.js']){
  const s=read(file);assert.ok(!s.includes('YOUR_SECRET'));assert.ok(!s.includes('ADMIN_PASSWORD='));
 }
});
