// Shared local-only target validation. These are generated disposable runtime
// credentials, never management or Production credentials.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
export const stateFile=process.env.M1_LOCAL_STATE;
if(!stateFile)throw new Error('explicit local target required');
export const state=JSON.parse(readFileSync(stateFile,'utf8'));
export const config=JSON.parse(readFileSync(join(dirname(stateFile),'redis-state.json'),'utf8'));
if(state.kind!=='disposable-local-only'||state.url!=='http://127.0.0.1:54380'
 ||Date.now()/1000>=state.expires_at||config.kind!=='disposable-local-redis'
 ||config.prefix!==state.prefix||config.expires_at!==state.expires_at
 ||config.url!=='http://127.0.0.1:54380/redis'||typeof config.token!=='string'||config.token.length<32){
 throw new Error('invalid or expired disposable Redis target');
}
export const checkpointFile=join(dirname(stateFile),'redis-checkpoint.json');
