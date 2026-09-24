addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request, event));
});

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Debug endpoint
  if (path === "/_debug") {
    return json({ secret_set: !!env.ADMIN_SECRET, has_kv: !!env.USERS_KV }, 200, corsHeaders);
  }

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };

  if (method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const kv = env.USERS_KV;
  const ADMIN_SECRET = env.ADMIN_SECRET;

  async function getUsers() {
    try {
      const raw = await kv.get("users");
      if (!raw) return {};
      return JSON.parse(raw);
    } catch (e) {
      return {};
    }
  }

  async function saveUsers(users) {
    await kv.put("users", JSON.stringify(users));
  }

  if (method === "GET" && path.startsWith("/user/")) {
    const id = path.split("/user/")[1];
    try {
      const users = await getUsers();
      const linkB64 = users[id];
      if (!linkB64) {
        return json({ error: "User not found" }, 404, corsHeaders);
      }
      const link = atob(linkB64);
      return json({ id, link }, 200, corsHeaders);
    } catch (e) {
      return json({ error: e.message }, 500, corsHeaders);
    }
  }

  if (method === "GET" && path === "/users") {
    try {
      const users = await getUsers();
      const list = Object.keys(users).filter(id => users[id]);
      return json({ users: list }, 200, corsHeaders);
    } catch (e) {
      return json({ error: e.message }, 500, corsHeaders);
    }
  }

  const auth = request.headers.get("Authorization");
  const isAdmin = auth === `Bearer ${ADMIN_SECRET}`;

  if (method === "POST" && path === "/admin/user") {
    if (!isAdmin) return json({ error: "Unauthorized" }, 401, corsHeaders);
    try {
      const { id, link } = await request.json();
      if (!id || !link) return json({ error: "id and link required" }, 400, corsHeaders);
      const users = await getUsers();
      users[String(id)] = btoa(link);
      await saveUsers(users);
      return json({ ok: true, id }, 200, corsHeaders);
    } catch (e) {
      return json({ error: e.message }, 500, corsHeaders);
    }
  }

  if (method === "DELETE" && path.startsWith("/admin/user/")) {
    if (!isAdmin) return json({ error: "Unauthorized" }, 401, corsHeaders);
    try {
      const id = path.split("/admin/user/")[1];
      const users = await getUsers();
      delete users[id];
      await saveUsers(users);
      return json({ ok: true }, 200, corsHeaders);
    } catch (e) {
      return json({ error: e.message }, 500, corsHeaders);
    }
  }

  if (method === "GET" && path === "/admin/users") {
    if (!isAdmin) return json({ error: "Unauthorized" }, 401, corsHeaders);
    try {
      const users = await getUsers();
      const full = {};
      for (const [id, b64] of Object.entries(users)) {
        if (b64) full[id] = atob(b64);
      }
      return json({ users: full }, 200, corsHeaders);
    } catch (e) {
      return json({ error: e.message }, 500, corsHeaders);
    }
  }

  return json({ error: "Not found" }, 404, corsHeaders);
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders }
  });
}
