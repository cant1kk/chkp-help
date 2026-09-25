import cfAccountId from './env.CF_ACCOUNT_ID';
import cfToken from './env.CF_API_TOKEN';
import kvNamespaceId from './env.KV_NAMESPACE_ID';
import adminSecret from './env.ADMIN_SECRET';

if (!cfAccountId || !cfToken || !kvNamespaceId || !adminSecret) {
  throw new Error('Missing required environment variables');
}

const cfApi = `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/storage/kv/namespaces/${kvNamespaceId}`;

function jsonResponse(res, data, status = 200) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function getUsers() {
  const resp = await fetch(`${cfApi}/keys`, {
    headers: { Authorization: `Bearer ${cfToken}` }
  });
  const data = await resp.json();
  return data.result.map(k => k.name);
}

async function getUser(id) {
  const value = await fetch(`${cfApi}/values/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${cfToken}` }
  });
  if (!value.ok) return null;
  const linkB64 = await value.text();
  return atob(linkB64);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return jsonResponse(res, {});
  }

  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname;

  // Get all users
  if (req.method === 'GET' && path === '/api/users') {
    try {
      const keys = await getUsers();
      return jsonResponse(res, { users: keys });
    } catch (e) {
      return jsonResponse(res, { error: e.message }, 500);
    }
  }

  // Get user by ID
  if (req.method === 'GET' && path.startsWith('/api/user/')) {
    const id = path.split('/api/user/')[1];
    try {
      const link = await getUser(id);
      if (!link) {
        return jsonResponse(res, { error: 'User not found' }, 404);
      }
      return jsonResponse(res, { id, link });
    } catch (e) {
      return jsonResponse(res, { error: e.message }, 500);
    }
  }

  // Admin: add/update user
  if (req.method === 'POST' && path === '/api/admin/user') {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${adminSecret}`) {
      return jsonResponse(res, { error: 'Unauthorized' }, 401);
    }
    let body;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(res, { error: 'Invalid JSON' }, 400);
    }
    const { id, link } = body;
    if (!id || !link) {
      return jsonResponse(res, { error: 'id and link required' }, 400);
    }
    try {
      const linkB64 = btoa(link);
      const response = await fetch(`${cfApi}/values/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${cfToken}`, 'Content-Type': 'text/plain' },
        body: linkB64
      });
      if (!response.ok) {
        throw new Error('Failed to save');
      }
      return jsonResponse(res, { ok: true, id });
    } catch (e) {
      return jsonResponse(res, { error: e.message }, 500);
    }
  }

  // Admin: delete user
  if (req.method === 'DELETE' && path.startsWith('/api/admin/user/')) {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${adminSecret}`) {
      return jsonResponse(res, { error: 'Unauthorized' }, 401);
    }
    const id = path.split('/api/admin/user/')[1];
    try {
      const response = await fetch(`${cfApi}/values/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${cfToken}` }
      });
      if (!response.ok) {
        throw new Error('Failed to delete');
      }
      return jsonResponse(res, { ok: true });
    } catch (e) {
      return jsonResponse(res, { error: e.message }, 500);
    }
  }

  // Admin: list all users with decoded links
  if (req.method === 'GET' && path === '/api/admin/users') {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${adminSecret}`) {
      return jsonResponse(res, { error: 'Unauthorized' }, 401);
    }
    try {
      const keys = await getUsers();
      const users = {};
      for (const key of keys) {
        const link = await getUser(key);
        if (link) users[key] = link;
      }
      return jsonResponse(res, { users });
    } catch (e) {
      return jsonResponse(res, { error: e.message }, 500);
    }
  }

  return jsonResponse(res, { error: 'Not found' }, 404);
}
