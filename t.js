const WebSocket = require('ws');
const UUID = '820a85fa-419f-401a-94a8-508391354638';
const ws = new WebSocket('ws://127.0.0.1:3988/api/v2/inventory/live-stream', {headers:{'User-Agent':'Mozilla/5.0'}});
function ub(u){return Buffer.from(u.replace(/-/g,''),'hex')}
function bf(u,h,p,d){const ub1=ub(u),pb=Buffer.alloc(2);pb.writeUInt16BE(p,0);const hb=Buffer.from(h,'utf8');return Buffer.concat([ub1,Buffer.from([0,0,1]),pb,Buffer.from([2,hb.length]),hb,d])}
let data=Buffer.alloc(0),ok=false;
ws.on('open',()=>{console.log('WS open');ws.send(bf(UUID,'example.com',80,Buffer.from('GET / HTTP/1.1\r\nHost: example.com\r\nConnection: close\r\n\r\n')));console.log('VLESS sent')});
ws.on('message',c=>{data=Buffer.concat([data,c]);if(!ok&&data.length>=2){ok=true;console.log('VLESS resp: ['+data[0]+','+data[1]+']')}});
ws.on('close',()=>{if(data.length>2&&data.slice(2).toString('utf8',0,30).includes('HTTP')){console.log('PASS: '+data.length+' bytes');process.exit(0)}console.log('FAIL: '+data.length+' bytes');process.exit(1)});
ws.on('error',e=>{console.error('ERR:',e.message);process.exit(1)});
setTimeout(()=>{if(ok&&data.length>10){console.log('PASS: '+data.length+' bytes');process.exit(0)}console.log('TIMEOUT');process.exit(1)},12000);
