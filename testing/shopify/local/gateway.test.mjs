import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';

let child;
before(async()=>{
  const script=`globalThis.fetch=async(url,init)=>{
    const headers=new Headers({'content-type':'application/json'});
    headers.append('set-cookie','state=synthetic; HttpOnly; SameSite=Lax');
    headers.append('set-cookie','app=synthetic; HttpOnly; SameSite=Lax');
    return new Response(JSON.stringify({url,forwardedHost:init.headers['x-forwarded-host'],origin:init.headers.origin}),{headers});
  };await import(${JSON.stringify(new URL('./gateway.mjs',import.meta.url).href)});console.log('ready');`;
  child=spawn(process.execPath,['--input-type=module','-e',script],{stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{
    child.once('error',reject);child.once('exit',()=>reject(new Error('local gateway fixture exited')));
    child.stdout.once('data',resolve);
  });
});
after(()=>child?.kill('SIGKILL'));
async function request(path,port=8000,headers={}){
  return new Promise((resolve,reject)=>{
    const req=http.get({hostname:'127.0.0.1',port,path,headers},res=>{
      let body='';res.on('data',x=>body+=x);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body}));
    });req.on('error',reject);
  });
}
test('unknown/absolute request targets cannot choose a remote upstream',async()=>{
  assert.equal((await request('http://attacker.invalid/rest/v1/')).status,404);
  assert.equal((await request('/unknown?url=https://attacker.invalid')).status,404);
  const result=await request('/rest/v1/tryon_jobs?select=id',8000,{host:'attacker.invalid'});
  assert.equal(JSON.parse(result.body).url,'http://rest:3000/tryon_jobs?select=id');
});
test('multiple OAuth cookies are forwarded separately, not joined into one cookie',async()=>{
  const result=await request('/rest/v1/');
  assert.deepEqual(result.headers['set-cookie'],[
    'state=synthetic; HttpOnly; SameSite=Lax','app=synthetic; HttpOnly; SameSite=Lax']);
});
test('app upstream and forwarded host are fixed; hostile Origin is preserved for auth checks',async()=>{
  const result=await request('/api/shopify/oauth/start',8001,{host:'attacker.invalid',origin:'https://attacker.invalid','x-forwarded-host':'attacker.invalid'});
  const data=JSON.parse(result.body);
  assert.equal(data.url,'http://app:3000/api/shopify/oauth/start');
  assert.equal(data.forwardedHost,'127.0.0.1:3102');
  assert.equal(data.origin,'https://attacker.invalid');
});
