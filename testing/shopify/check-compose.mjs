// Render/inspect configuration ONLY. Never build/pull/create/start a container.
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const dir=mkdtempSync(join(tmpdir(),'gc-compose-contract-'));
try {
  const file=join(dir,'synthetic.env');writeFileSync(file,'# no credentials\n');
  const env={...process.env,GRINDCTRL_PREVIEW_IMAGE:`controlled-preview@sha256:${'0'.repeat(64)}`,
    GRINDCTRL_GATEWAY_IMAGE:`controlled-gateway@sha256:${'1'.repeat(64)}`,
    GRINDCTRL_TEST_ENV_FILE:file,GRINDCTRL_TEST_CONFIG_DIR:dir,GRINDCTRL_TEST_STATE_DIR:dir};
  for(const key of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'])delete env[key];
  const r=spawnSync('docker',['--host=unix:///var/run/docker.sock','compose','-f',resolve('testing/shopify/compose.yml'),'config','--format','json'],{env,encoding:'utf8'});
  if(r.status!==0)throw new Error('controlled_compose_render_failed');
  const c=JSON.parse(r.stdout),a=c.services.app,g=c.services.egress;
  assert.equal(c.networks.isolated.internal,true);
  assert.deepEqual(Object.keys(a.networks),['isolated']);
  assert.deepEqual(Object.keys(g.networks).sort(),['isolated','outbound']);
  assert.equal(a.network_mode,undefined);assert.equal(a.privileged,undefined);
  assert.equal(a.ports.length,1);assert.equal(a.ports[0].host_ip,'127.0.0.1');assert.equal(a.ports[0].target,3000);
  assert.equal(g.ports,undefined);assert.equal(a.read_only,true);assert.equal(g.read_only,true);
  assert.deepEqual(a.cap_drop,['ALL']);assert.deepEqual(g.cap_drop,['ALL']);
  assert.equal(a.volumes.find(x=>x.target==='/run/controlled').read_only,true);
  assert.equal(a.volumes.find(x=>x.target==='/run/controlled-state').read_only,undefined);
  assert.ok(!JSON.stringify(c).includes('docker.sock'));
  console.info('Compose topology contract passed; nothing built, pulled, created or started.');
} finally {rmSync(dir,{recursive:true,force:true});}
