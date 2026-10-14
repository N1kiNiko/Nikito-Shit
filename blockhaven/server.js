/* Blockhaven LAN host. Node.js 18+; no packages needed. */
'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),crypto=require('node:crypto');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const context={};vm.createContext(context);vm.runInContext(html.match(/<script id="world-source">([\s\S]*?)<\/script>/)[1],context);
const {SIZE,HEIGHT,key,generate}=context.VoxelWorld,world=generate(),edits=new Map(),clients=new Map();
function broadcast(message){const data=`data: ${JSON.stringify(message)}\n\n`;for(const c of clients.values())c.res.write(data)}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
const server=http.createServer(async(req,res)=>{
const pathname=new URL(req.url,'http://localhost').pathname;
if(req.method==='GET'&&pathname==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache'});res.end(html);return}
if(req.method==='GET'&&pathname==='/favicon.ico'){res.writeHead(204);res.end();return}
if(req.method==='GET'&&pathname==='/api/events'){
if(clients.size>=24){json(res,503,{error:'This world is full (24 explorers)'});return}
res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','X-Accel-Buffering':'no'});res.write('retry: 2000\n\n');
const id=crypto.randomUUID(),players=Object.fromEntries([...clients].map(([id,c])=>[id,c.player]));
clients.set(id,{res,player:{x:15.5,y:10,z:29.5,name:'Explorer',yaw:0,pitch:0,health:20,life:0},lastState:0,lastBlock:0,lastChat:0,lastAttack:0,invulnerableUntil:0});
res.write(`data: ${JSON.stringify({type:'welcome',id,self:clients.get(id).player,players,edits:[...edits.values()]})}\n\n`);
const timer=setInterval(()=>res.write(': keepalive\n\n'),15000);req.on('close',()=>{clearInterval(timer);clients.delete(id);broadcast({type:'leave',id})});return}
if(req.method!=='POST'||!['/api/state','/api/block','/api/chat','/api/attack'].includes(pathname)){json(res,404,{error:'Not found'});return}
// Only same-origin pages may send edits. There is no remote discovery or Internet relay.
if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`){json(res,403,{error:'Open the game from this host address'});return}
let body='',size=0;try{for await(const chunk of req){size+=chunk.length;if(size>4096){json(res,413,{error:'Message too large'});return}body+=chunk}body=JSON.parse(body)}catch{json(res,400,{error:'Invalid message'});return}
const client=clients.get(body.id);if(!client){json(res,409,{error:'Reconnecting to world'});return}
const now=Date.now();
if(pathname==='/api/state'){
if(!['x','y','z','yaw'].every(k=>typeof body[k]==='number'&&Number.isFinite(body[k]))){json(res,400,{error:'Invalid position'});return}
if(body.life!==client.player.life){json(res,409,{error:'Position update from an old life'});return}
if(now-client.lastState<45){json(res,429,{error:'Too many updates'});return}client.lastState=now;
client.player={...client.player,x:Math.max(.3,Math.min(SIZE-.3,body.x)),y:Math.max(1.7,Math.min(HEIGHT+7,body.y)),z:Math.max(.3,Math.min(SIZE-.3,body.z)),yaw:body.yaw,pitch:Number.isFinite(body.pitch)?Math.max(-1.5,Math.min(1.5,body.pitch)):0,name:String(body.name||'Explorer').trim().slice(0,20)};
broadcast({type:'player',id:body.id,player:client.player});json(res,200,{ok:true});
}else if(pathname==='/api/attack'){
const victim=clients.get(body.target);
if(!victim||victim===client){json(res,400,{error:'No explorer to hit'});return}
if(body.life!==client.player.life){json(res,409,{error:'You have respawned'});return}
if(now-client.lastAttack<450){json(res,429,{error:'Your next hit is almost ready'});return}
const p=client.player,q=victim.player;
if(Number.isFinite(body.yaw))p.yaw=body.yaw;
if(Number.isFinite(body.pitch))p.pitch=Math.max(-1.5,Math.min(1.5,body.pitch));
if(now<client.invulnerableUntil||now<victim.invulnerableUntil){json(res,409,{error:'Respawn protection lasts two seconds'});return}
// Aim comes from the last server-accepted position, not a claimed victim or damage amount.
const d=[Math.sin(p.yaw)*Math.cos(p.pitch),Math.sin(p.pitch),-Math.cos(p.yaw)*Math.cos(p.pitch)];let hit=false;
for(let t=0;t<=3.5;t+=.04){const x=p.x+d[0]*t,y=p.y+d[1]*t,z=p.z+d[2]*t;if(world.get(Math.floor(x),Math.floor(y),Math.floor(z)))break;
if(x>=q.x-.3&&x<=q.x+.3&&y>=q.y-1.6&&y<=q.y+.15&&z>=q.z-.3&&z<=q.z+.3){hit=true;break}}
if(!hit){json(res,400,{error:'Aim at a nearby explorer with no blocks in the way'});return}
client.lastAttack=now;q.health=Math.max(0,q.health-4);const respawn=q.health===0;
if(respawn){q.health=20;q.life++;q.x=4.5+Math.floor(Math.random()*23);q.z=4.5+Math.floor(Math.random()*23);let floor=HEIGHT-1;while(floor>0&&!world.get(Math.floor(q.x),floor,Math.floor(q.z)))floor--;q.y=floor+2.7;victim.invulnerableUntil=now+2000}
broadcast({type:'hit',attacker:body.id,victim:body.target,attackerName:p.name,victimName:q.name,player:{...q},respawn});json(res,200,{ok:true});
}else if(pathname==='/api/block'){
const {x,y,z,t}=body;
if(![x,y,z,t].every(Number.isInteger)||x<0||z<0||y<0||x>=SIZE||z>=SIZE||y>=HEIGHT||t<0||t>7){json(res,400,{error:'Invalid block'});return}
if(y===0&&t===0){json(res,400,{error:'The bottom layer holds the world together'});return}
if(now-client.lastBlock<70){json(res,429,{error:'Build a little slower'});return}client.lastBlock=now;
const p=client.player;if(Math.hypot(x+.5-p.x,y+.5-p.y,z+.5-p.z)>8){json(res,400,{error:'That block is too far away'});return}
if(t&&[...clients.values()].some(({player:p})=>p.x+.28>x&&p.x-.28<x+1&&p.y+.15>y&&p.y-1.6<y+1&&p.z+.28>z&&p.z-.28<z+1)){json(res,409,{error:'An explorer is in the way'});return}
if(t&&world.get(x,y,z)){json(res,409,{error:'There is already a block here'});return}
const edit={x,y,z,t};world.set(x,y,z,t);edits.set(key(x,y,z),edit);broadcast({type:'block',edit});json(res,200,{ok:true});
}else{
if(now-client.lastChat<700){json(res,429,{error:'Wait a moment before another message'});return}client.lastChat=now;
const text=String(body.text||'').trim().slice(0,160);if(text)broadcast({type:'chat',name:client.player.name,text});json(res,200,{ok:true});
}
});
server.headersTimeout=10000;server.requestTimeout=10000;
const port=Number(process.env.PORT||8080);
server.listen(port,'0.0.0.0',()=>{console.log(`\nBlockhaven is ready. Keep this terminal open.\nOn this computer: http://localhost:${port}\nOn other devices on the same Wi-Fi:`);for(const entries of Object.values(os.networkInterfaces()))for(const entry of entries||[])if(entry.family==='IPv4'&&!entry.internal)console.log(`  http://${entry.address}:${port}`);console.log('\nAllow Node.js through the firewall on your private network if prompted.\nThe shared world stays in memory until you stop the server. Ctrl+C stops it.\n')});
server.on('error',e=>{console.error(`Could not start the LAN host: ${e.message}`);process.exitCode=1});
