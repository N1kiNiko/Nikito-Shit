// In-memory protocol verification. No ports, browser, or external packages.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
let handler;const intervals=[];let timeOffset=0;
class TestDate extends Date{static now(){return Date.now()+timeOffset}}
const fakeHttp={createServer(fn){handler=fn;return{listen(){},on(){}}}};
const sandbox={Date:TestDate,URL,require:n=>n==='node:http'?fakeHttp:require(n),__dirname:__dirname,console,process:{env:{},exitCode:0},setInterval:fn=>{intervals.push(fn);return intervals.length},clearInterval:()=>{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'server.js'),'utf8'),sandbox);
function response(){return{status:0,data:'',writeHead(s){this.status=s},write(s){this.data+=s},end(s=''){this.data+=s}}}
async function join(){const req={method:'GET',url:'/api/events',headers:{},on(){}};const res=response();await handler(req,res);assert.equal(res.status,200);const event=JSON.parse(res.data.split('\n').find(s=>s.startsWith('data: ')).slice(6));return{id:event.id,res,event}}
async function send(route,body){const req={method:'POST',url:route,headers:{host:'localhost:8080',origin:'http://localhost:8080'},async *[Symbol.asyncIterator](){yield JSON.stringify(body)}};const res=response();await handler(req,res);return res}
(async()=>{
const a=await join(),b=await join();assert.notEqual(a.id,b.id);assert.ok(b.event.players[a.id]);
assert.equal((await send('/api/state',{id:a.id,x:15.5,y:10,z:29.5,yaw:0,life:0,name:'Alice'})).status,200);
assert.match(b.res.data,/Alice/);
const edit={x:16,y:8,z:29,t:7};assert.equal((await send('/api/block',{id:a.id,...edit})).status,200);
assert.match(a.res.data,/"type":"block"/);assert.match(b.res.data,/"type":"block"/);
const c=await join();assert.deepEqual(c.event.edits,[edit]);
assert.equal((await send('/api/chat',{id:a.id,text:'Hello, world!'})).status,200);assert.match(b.res.data,/Hello, world!/);
assert.equal((await send('/api/block',{id:b.id,x:2,y:0,z:2,t:0})).status,400);
assert.equal((await send('/api/block',{id:b.id,x:999,y:5,z:2,t:1})).status,400);
assert.equal((await send('/api/state',{id:'missing',x:1,y:10,z:1,yaw:0})).status,409);
assert.equal((await send('/api/state',{id:b.id,x:15.5,y:10,z:27.5,yaw:0,pitch:0,life:0,name:'Bob',health:999})).status,200);
assert.equal((await join()).event.players[b.id].health,20,'Client cannot choose its health');
timeOffset+=500;
assert.equal((await send('/api/block',{id:a.id,x:15,y:10,z:28,t:3})).status,200);
assert.equal((await send('/api/attack',{id:a.id,target:b.id,life:0})).status,400,'Blocks stop attacks');
timeOffset+=500;
assert.equal((await send('/api/block',{id:a.id,x:15,y:10,z:28,t:0})).status,200);
for(let i=0;i<5;i++){
 timeOffset+=500;
 assert.equal((await send('/api/attack',{id:a.id,target:b.id,life:0})).status,200);
 if(i===0){assert.equal((await send('/api/attack',{id:a.id,target:b.id,life:0})).status,429,'Cooldown enforced');assert.equal((await join()).event.players[b.id].health,16)}
}
const respawned=(await join()).event.players[b.id];assert.equal(respawned.health,20);assert.equal(respawned.life,1);
assert.match(b.res.data,/"respawn":true/);
timeOffset+=500;
assert.equal((await send('/api/attack',{id:a.id,target:b.id,life:0})).status,409,'Respawn protection enforced');
assert.equal((await send('/api/state',{id:b.id,x:15.5,y:10,z:27.5,yaw:0,life:0})).status,409,'Old movement cannot undo respawn');
timeOffset+=2500;
assert.equal((await send('/api/state',{id:b.id,x:2.5,y:18,z:2.5,yaw:0,life:1})).status,200);
assert.equal((await send('/api/attack',{id:a.id,target:b.id,life:0})).status,400,'Distant players cannot be hit');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');for(const m of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new Function(m[1]);
console.log('PASS: presence, blocks, chat, health authority, damage, cooldown, wall obstruction, respawn, protection, stale movement, attack range, HTML parsing.');
})().catch(e=>{console.error(e);process.exitCode=1});
