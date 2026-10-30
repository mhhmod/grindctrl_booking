import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createGateway, publicAddress } from './egress.mjs';

test('gateway rejects private, loopback, link-local and IPv4-mapped addresses',()=>{
  for(const ip of ['127.0.0.1','10.0.0.1','192.168.1.1','169.254.169.254','100.64.0.1','172.16.0.1',
    '::1','fc00::1','fe80::1','::ffff:127.0.0.1','::ffff:7f00:1']) assert.equal(publicAddress(ip),false,ip);
  assert.equal(publicAddress('93.184.216.34'),true);
  assert.equal(publicAddress('2606:4700::1111'),true);
});
async function gateway(t,options={}) {
  const server=createGateway({drain_until:new Date(Date.now()+60000).toISOString(),hosts:new Set(['allowed.example'])},options);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>{server.closeAllConnections();server.close();});
  return server.address().port;
}
async function tunnel(port,authority) {
  return new Promise((resolve,reject)=>{
    const socket=net.connect(port,'127.0.0.1',()=>socket.write(`CONNECT ${authority} HTTP/1.1\r\nHost: ${authority}\r\n\r\n`));
    socket.setTimeout(2000,()=>{socket.destroy();reject(new Error('local_test_timeout'));});
    socket.on('error',reject);
    socket.once('data',data=>{socket.destroy();resolve(data.toString().split('\r\n')[0]);});
  });
}
test('CONNECT refuses providers, unknown hosts and non-443 ports before DNS or TCP',async t=>{
  let resolved=0,connected=0;
  const port=await gateway(t,{resolveHost:async()=>{resolved++;return[];},connect:()=>{connected++;throw new Error('unexpected');}});
  for(const host of ['openrouter.ai:443','api.openai.com:443','evil.example:443','allowed.example:80','127.0.0.1:443']) {
    assert.match(await tunnel(port,host),/403/);
  }
  assert.equal(resolved,0);assert.equal(connected,0);
});
test('allowed DNS resolving to private addresses never connects',async t=>{
  let connected=0;
  const port=await gateway(t,{resolveHost:async()=>[{address:'127.0.0.1'}],connect:()=>{connected++;throw new Error('unexpected');}});
  assert.match(await tunnel(port,'allowed.example:443'),/403/);assert.equal(connected,0);
});
test('approved public resolution is pinned for the CONNECT socket',async t=>{
  let destination;
  const port=await gateway(t,{resolveHost:async()=>[{address:'93.184.216.34'}],connect:opts=>{destination=opts;throw new Error('synthetic_stop_before_external_connection');}});
  assert.match(await tunnel(port,'allowed.example:443'),/403/);
  assert.deepEqual(destination,{host:'93.184.216.34',port:443});
});
test('Node 24 built-in fetch honors environment proxy and provider denial before any external connection',async t=>{
  let resolved=0;
  const port=await gateway(t,{resolveHost:async()=>{resolved++;throw new Error('must_not_resolve_provider');}});
  const code=`fetch('https://openrouter.ai/api/v1/images',{method:'POST',signal:AbortSignal.timeout(2000)}).then(()=>process.exit(2),()=>process.exit(0))`;
  await promisify(execFile)(process.execPath,['--use-env-proxy','-e',code],{
    env:{HTTPS_PROXY:`http://127.0.0.1:${port}`,HTTP_PROXY:`http://127.0.0.1:${port}`,NO_PROXY:''},timeout:4000,
  });
  assert.equal(resolved,0);
});
