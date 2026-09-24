// Cloudflare Worker — хранилище ссылок пользователей
// Деплой: workers.cloudflare.com → Create Worker → вставь код → Save and Deploy
// В Settings → Bindings → KV Namespace Binding: имя USERS_KV, выбери namespace

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS для GitHub Pages
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };

    if (method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Хелперы для KV
    const kv = env.USERS_KV;
    async function getUsers() {
      const data = await kv.get("users", "json");
      return data || {};
    }
    async function saveUsers(users) {
      await kv.put("users", JSON.stringify(users));
    }

    // GET /user/:id — получить ссылку пользователя
    if (method === "GET" && path.startsWith("/user/")) {
      const id = path.split("/user/")[1];
      const users = await getUsers();
      const linkB64 = users[id];

      if (!linkB64) {
        return json({ error: "User not found" }, 404, corsHeaders);
      }

      try {
        const link = atob(linkB64);
        return json({ id, link }, 200, corsHeaders);
      } catch {
        return json({ error: "Invalid link format" }, 500, corsHeaders);
      }
    }

    // GET /users — список всех ID
    if (method === "GET" && path === "/users") {
      const users = await getUsers();
      const list = Object.keys(users).filter(id => users[id]);
      return json({ users: list }, 200, corsHeaders);
    }

    // --- Админка (требует секрет) ---
    const auth = request.headers.get("Authorization");
    const isAdmin = auth === `Bearer ${env.ADMIN_SECRET}`;

    // POST /admin/user — добавить/обновить пользователя
    if (method === "POST" && path === "/admin/user") {
      if (!isAdmin) return json({ error: "Unauthorized" }, 401, corsHeaders);

      const { id, link } = await request.json();
      if (!id || !link) return json({ error: "id and link required" }, 400, corsHeaders);

      const users = await getUsers();
      users[String(id)] = btoa(link);
      await saveUsers(users);
      return json({ ok: true, id }, 200, corsHeaders);
    }

    // DELETE /admin/user/:id — удалить пользователя
    if (method === "DELETE" && path.startsWith("/admin/user/")) {
      if (!isAdmin) return json({ error: "Unauthorized" }, 401, corsHeaders);

      const id = path.split("/admin/user/")[1];
      const users = await getUsers();
      delete users[id];
      await saveUsers(users);
      return json({ ok: true }, 200, corsHeaders);
    }

    // GET /admin/users — полный список с ссылками (админ)
    if (method === "GET" && path === "/admin/users") {
      if (!isAdmin) return json({ error: "Unauthorized" }, 401, corsHeaders);

      const users = await getUsers();
      const full = {};
      for (const [id, b64] of Object.entries(users)) {
        if (b64) full[id] = atob(b64);
      }
      return json({ users: full }, 200, corsHeaders);
    }

    return json({ error: "Not found" }, 404, corsHeaders);
  }
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders }
  });
}
