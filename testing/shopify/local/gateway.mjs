// Local Supabase URL router. Authentication/RLS stay in actual PostgREST and
// Storage API. No fake database/storage responses, external forwarding or logs.
import http from 'node:http';
const server = http.createServer(async (req, res) => {
  const prefix = req.url?.startsWith('/rest/v1/') ? '/rest/v1/'
    : req.url?.startsWith('/storage/v1/') ? '/storage/v1/' : null;
  if (!prefix) { res.writeHead(404).end(); return; }
  const target = prefix === '/rest/v1/' ? 'http://rest:3000/' : 'http://storage:5000/';
  // Concatenation cannot turn a path/Host header into another upstream origin.
  const url = target + req.url.slice(prefix.length);
  const headers = { ...req.headers }; delete headers.host; delete headers.connection;
  try {
    const response = await fetch(url, { method: req.method, headers,
      ...(req.method === 'GET' || req.method === 'HEAD' ? {} : { body: req, duplex: 'half' }),
      redirect: 'manual', signal: AbortSignal.timeout(30000) });
    const out = Object.fromEntries(response.headers);
    if(response.headers.getSetCookie().length)out['set-cookie']=response.headers.getSetCookie();
    delete out['transfer-encoding']; delete out['content-encoding']; delete out['content-length'];
    res.writeHead(response.status, out);
    if (response.body) for await (const chunk of response.body) res.write(chunk);
    res.end();
  } catch { res.writeHead(502).end('local_upstream_unavailable'); }
});
// A separate loopback-published port serves only the actual local app. The
// application itself has no external Docker network or published port.
const appServer=http.createServer(async(req,res)=>{
  const headers={...req.headers};delete headers.host;delete headers.connection;
  headers['x-forwarded-host']='127.0.0.1:3102';headers['x-forwarded-proto']='http';
  try{
    const response=await fetch('http://app:3000'+req.url,{method:req.method,headers,
      ...(req.method==='GET'||req.method==='HEAD'?{}:{body:req,duplex:'half'}),
      redirect:'manual',signal:AbortSignal.timeout(30000)});
    const out=Object.fromEntries(response.headers);
    if(response.headers.getSetCookie().length)out['set-cookie']=response.headers.getSetCookie();
    delete out['transfer-encoding'];delete out['content-encoding'];delete out['content-length'];
    res.writeHead(response.status,out);
    if(response.body)for await(const chunk of response.body)res.write(chunk);
    res.end();
  }catch{res.writeHead(502).end('local_app_unavailable');}
});
// Import completion is a real readiness barrier for the local router fixture.
await Promise.all([server,appServer].map((s,i)=>new Promise((resolve,reject)=>{
  s.once('error',reject);s.listen(8000+i,'0.0.0.0',resolve);
})));
