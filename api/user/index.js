const cfAccountId = process.env.CF_ACCOUNT_ID;
const cfToken = process.env.CF_API_TOKEN;
const kvNamespaceId = process.env.KV_NAMESPACE_ID;

if (!cfAccountId || !cfToken || !kvNamespaceId) {
  throw new Error('Missing required environment variables');
}

const cfApi = `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/storage/kv/namespaces/${kvNamespaceId}`;

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return json({});
  }

  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname;

  // Get all users
  if (req.method === 'GET' && path === '/api/users') {
    try {
      const response = await fetch(`${cfApi}/keys`, {
        headers: { Authorization: `Bearer ${cfToken}` },
      });
      const data = await response.json();
      const keys = data.result.map(k => k.name);
      return json({ users: keys });
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  }

  // Get user by ID
  if (req.method === 'GET' && path.startsWith('/api/user/')) {
    const id = path.split('/api/user/')[1];
    try {
      const value = await fetch(`${cfApi}/values/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${cfToken}` },
      });
      if (!value.ok) {
        return json({ error: 'User not found' }, 404);
      }
      const linkB64 = await value.text();
      const link = atob(linkB64);
      return json({ id, link });
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  }

  // Admin: add/update user
  if (req.method === 'POST' && path === '/api/admin/user') {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${process.env.ADMIN_SECRET}`) {
      return json({ error: 'Unauthorized' }, 401);
    }
    let body;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }
    const { id, link } = body;
    if (!id || !link) {
      return json({ error: 'id and link required' }, 400);
    }
    try {
      const linkB64 = btoa(link);
      const response = await fetch(`${cfApi}/values/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${cfToken}`, 'Content-Type': 'text/plain' },
        body: linkB64,
      });
      if (!response.ok) {
        throw new Error('Failed to save');
      }
      return json({ ok: true, id });
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  }

  // Admin: delete user
  if (req.method === 'DELETE' && path.startsWith('/api/admin/user/')) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${process.env.ADMIN_SECRET}`) {
      return json({ error: 'Unauthorized' }, 401);
    }
    const id = path.split('/api/admin/user/')[1];
    try {
      const response = await fetch(`${cfApi}/values/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${cfToken}` },
      });
      if (!response.ok) {
        throw new Error('Failed to delete');
      }
      return json({ ok: true });
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  }

  // Admin: list all users with decoded links
  if (req.method === 'GET' && path === '/api/admin/users') {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${process.env.ADMIN_SECRET}`) {
      return json({ error: 'Unauthorized' }, 401);
    }
    try {
      const keysResponse = await fetch(`${cfApi}/keys`, {
        headers: { Authorization: `Bearer ${cfToken}` },
      });
      const keysData = await keysResponse.json();
      const users = {};
      for (const key of keysData.result) {
        const valueResp = await fetch(`${cfApi}/values/${encodeURIComponent(key.name)}`, {
          headers: { Authorization: `Bearer ${cfToken}` },
        });
        const value = await valueResp.text();
        users[key.name] = atob(value);
      }
      return json({ users });
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  }

  return json({ error: 'Not found' }, 404);
}
