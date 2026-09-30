import { SMTPServer } from 'smtp-server';
import { createServer } from 'node:http';
// Loopback-only development inbox. Never deployed with the application.
const messages=[];
const smtp=new SMTPServer({authOptional:true,disabledCommands:['AUTH','STARTTLS'],onData(stream,session,callback){let raw='';stream.on('data',chunk=>{raw+=chunk.toString();});stream.on('end',()=>{messages.unshift({to:session.envelope.rcptTo.map(r=>r.address),raw,at:new Date().toISOString()});messages.splice(50);callback();});}});
smtp.listen(1025,'127.0.0.1');
createServer((req,res)=>{res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(messages,null,2));}).listen(8025,'127.0.0.1',()=>console.log('Development inbox: http://127.0.0.1:8025'));
