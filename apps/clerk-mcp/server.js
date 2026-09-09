import http from 'node:http';
import { URL } from 'node:url';
import { timingSafeEqual } from 'node:crypto';

const PORT = Number(process.env.PORT || 3031);
const API_BASE = process.env.CLERK_MCP_API_BASE || 'https://api.clerk.com';
const SECRET_KEY = process.env.CLERK_SECRET_KEY || '';
const ALLOW_MUTATIONS = process.env.CLERK_MCP_ALLOW_MUTATIONS === 'true';
const ACCESS_TOKEN = process.env.CLERK_MCP_ACCESS_TOKEN || '';

const JSON_RPC_VERSION = '2.0';

const tools = [
  {
    name: 'clerk_api_request',
    description:
      'Full-access Clerk Backend API request. Use this for any Clerk endpoint. Mutating methods require CLERK_MCP_ALLOW_MUTATIONS=true.',
    inputSchema: {
      type: 'object',
      properties: {
        method: {
          type: 'string',
          enum: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']
        },
        path: {
          type: 'string',
          description: 'Clerk API path, for example /v1/users or /v1/organizations'
        },
        query: {
          type: 'object',
          additionalProperties: true
        },
        body: {
          type: 'object',
          additionalProperties: true
        }
      },
      required: ['method', 'path']
    }
  },
  {
    name: 'clerk_list_users',
    description: 'List Clerk users.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', minimum: 1, maximum: 500 },
        offset: { type: 'number', minimum: 0 },
        email_address: { type: 'array', items: { type: 'string' } },
        user_id: { type: 'array', items: { type: 'string' } },
        query: { type: 'string' }
      }
    }
  },
  {
    name: 'clerk_get_user',
    description: 'Get a Clerk user by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' }
      },
      required: ['user_id']
    }
  },
  {
    name: 'clerk_list_organizations',
    description: 'List Clerk organizations.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', minimum: 1, maximum: 500 },
        offset: { type: 'number', minimum: 0 },
        query: { type: 'string' }
      }
    }
  },
  {
    name: 'clerk_delete_user',
    description: 'Delete a Clerk user by ID. Requires CLERK_MCP_ALLOW_MUTATIONS=true.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' }
      },
      required: ['user_id']
    }
  }
];

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function text(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function rpcResult(id, result) {
  return { jsonrpc: JSON_RPC_VERSION, id, result };
}

function rpcError(id, code, message, data) {
  return { jsonrpc: JSON_RPC_VERSION, id, error: { code, message, data } };
}

function requireSecret() {
  if (!SECRET_KEY) {
    throw new Error('CLERK_SECRET_KEY is not configured.');
  }
}

/* Fail closed: a server with no access token configured refuses every MCP
   call rather than falling open to unauthenticated public access. */
function checkAccessToken(req) {
  if (!ACCESS_TOKEN) return false;
  const header = req.headers.authorization || '';
  const presented = header.startsWith('Bearer ') ? header.slice(7) : '';
  const expected = Buffer.from(ACCESS_TOKEN);
  const actual = Buffer.from(presented);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function assertPath(path) {
  if (typeof path !== 'string' || !path.startsWith('/v1/')) {
    throw new Error('Path must start with /v1/.');
  }
  if (path.includes('..') || path.includes('//')) {
    throw new Error('Path is not valid.');
  }
}

function assertMutationAllowed(method) {
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method) && !ALLOW_MUTATIONS) {
    throw new Error('Mutating Clerk requests are disabled. Set CLERK_MCP_ALLOW_MUTATIONS=true to enable full access.');
  }
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks).toString('utf8');
  return body ? JSON.parse(body) : {};
}

async function clerkRequest({ method = 'GET', path, query, body }) {
  requireSecret();
  const normalizedMethod = String(method).toUpperCase();
  assertPath(path);
  assertMutationAllowed(normalizedMethod);

  const url = new URL(path, API_BASE);
  if (query && typeof query === 'object') {
    for (const [key, value] of Object.entries(query)) {
      if (Array.isArray(value)) {
        for (const item of value) url.searchParams.append(key, String(item));
      } else if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const response = await fetch(url, {
    method: normalizedMethod,
    headers: {
      Authorization: `Bearer ${SECRET_KEY}`,
      'Content-Type': 'application/json'
    },
    body: normalizedMethod === 'GET' ? undefined : JSON.stringify(body || {})
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const error = new Error(`Clerk API returned ${response.status}.`);
    error.data = payload;
    throw error;
  }

  return payload;
}

async function callTool(name, args = {}) {
  if (name === 'clerk_api_request') {
    return clerkRequest(args);
  }
  if (name === 'clerk_list_users') {
    return clerkRequest({ method: 'GET', path: '/v1/users', query: args });
  }
  if (name === 'clerk_get_user') {
    return clerkRequest({ method: 'GET', path: `/v1/users/${encodeURIComponent(args.user_id)}` });
  }
  if (name === 'clerk_list_organizations') {
    return clerkRequest({ method: 'GET', path: '/v1/organizations', query: args });
  }
  if (name === 'clerk_delete_user') {
    return clerkRequest({ method: 'DELETE', path: `/v1/users/${encodeURIComponent(args.user_id)}` });
  }
  throw new Error(`Unknown tool: ${name}`);
}

async function handleRpc(message) {
  const id = message.id ?? null;

  if (message.method === 'initialize') {
    return rpcResult(id, {
      protocolVersion: message.params?.protocolVersion || '2025-03-26',
      capabilities: { tools: {} },
      serverInfo: { name: 'grindctrl-clerk-mcp', version: '1.0.0' }
    });
  }

  if (message.method === 'notifications/initialized') {
    return null;
  }

  if (message.method === 'tools/list') {
    return rpcResult(id, { tools });
  }

  if (message.method === 'tools/call') {
    const result = await callTool(message.params?.name, message.params?.arguments || {});
    return rpcResult(id, {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
    });
  }

  return rpcError(id, -32601, `Method not found: ${message.method}`);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && (url.pathname === '/healthz' || url.pathname === '/')) {
      return json(res, 200, {
        ok: true,
        name: 'grindctrl-clerk-mcp',
        mutationsEnabled: ALLOW_MUTATIONS
      });
    }

    if (url.pathname !== '/mcp' && url.pathname !== '/clerk') {
      return text(res, 404, 'Not found');
    }

    if (!checkAccessToken(req)) {
      return json(res, 401, rpcError(null, -32001, 'Unauthorized.'));
    }

    if (req.method !== 'POST') {
      return json(res, 405, rpcError(null, -32000, 'Only POST is supported for this MCP endpoint.'));
    }

    const payload = await readBody(req);
    const messages = Array.isArray(payload) ? payload : [payload];
    const responses = [];

    for (const message of messages) {
      const response = await handleRpc(message);
      if (response) responses.push(response);
    }

    return json(res, 200, Array.isArray(payload) ? responses : responses[0] || {});
  } catch (error) {
    return json(res, 500, rpcError(null, -32000, error.message, error.data));
  }
});

server.listen(PORT, () => {
  console.log(`grindctrl-clerk-mcp listening on ${PORT}`);
});
