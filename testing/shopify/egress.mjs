import http from 'node:http';
import net from 'node:net';
import { lookup } from 'node:dns/promises';
import { pathToFileURL } from 'node:url';
import { readManifest, forbiddenHost } from './config.mjs';

const blocked = new net.BlockList();
const blocked6 = new net.BlockList();
for (const [host, bits] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],
  ['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.168.0.0',16],
  ['198.18.0.0',15],['224.0.0.0',4],['240.0.0.0',4]]) blocked.addSubnet(host,bits,'ipv4');
for (const [host, bits] of [['::',128],['::1',128],['::ffff:0:0',96],['fc00::',7],['fe80::',10],['ff00::',8]]) blocked6.addSubnet(host,bits,'ipv6');
export function publicAddress(address) {
  const family = net.isIP(address);
  return Boolean(family && !(family === 4 ? blocked.check(address,'ipv4') : blocked6.check(address,'ipv6')));
}

export function createGateway(c, { resolveHost = lookup, connect = net.connect } = {}) {
  const server = http.createServer((_req, res) => { res.writeHead(405); res.end(); });
  server.on('connect', async (req, socket, head) => {
    let upstream;
    const deny = () => { socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); };
    socket.on('error', () => upstream?.destroy());
    socket.setTimeout(125_000, () => socket.destroy());
    try {
      if (Date.parse(c.drain_until) <= Date.now()) return deny();
      const match = /^([a-z0-9.-]+):443$/.exec(req.url ?? '');
      if (!match || forbiddenHost(match[1]) || !c.hosts.has(match[1])) return deny();
      const addresses = await resolveHost(match[1], { all: true, verbatim: true });
      if (!addresses.length || addresses.some(a => !publicAddress(a.address))) return deny();
      if (socket.destroyed) return;
      upstream = connect({ host: addresses[0].address, port: 443 });
      upstream.setTimeout(125_000, () => upstream.destroy());
      upstream.once('error', () => socket.destroy());
      upstream.once('connect', () => {
        socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        if (head.length) upstream.write(head);
        socket.pipe(upstream); upstream.pipe(socket);
      });
      socket.on('close', () => upstream.destroy());
    } catch { deny(); }
  });
  server.on('clientError', (_error, socket) => socket.destroy());
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createGateway(readManifest('/run/controlled/manifest.json')).listen(3128, '0.0.0.0');
}
