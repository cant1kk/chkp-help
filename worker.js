const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

async function getUsers(kv) {
  try {
    const raw = await kv.get("users");
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

async function saveUsers(kv, users) {
  await kv.put("users", JSON.stringify(users));
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const kv = env.USERS_KV;
    const ADMIN_SECRET = env.ADMIN_SECRET;

    if (method === "GET" && path.startsWith("/user/")) {
      const id = path.split("/user/")[1];
      try {
        const users = await getUsers(kv);
        const linkB64 = users[id];
        if (!linkB64) {
          return new Response(JSON.stringify({ error: "User not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }
        const link = atob(linkB64);
        return new Response(JSON.stringify({ id, link }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    if (method === "GET" && path === "/users") {
      try {
        const users = await getUsers(kv);
        const list = Object.keys(users).filter(id => users[id]);
        return new Response(JSON.stringify({ users: list }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    const auth = request.headers.get("Authorization");
    const isAdmin = auth === `Bearer ${ADMIN_SECRET}`;

    if (method === "POST" && path === "/admin/user") {
      if (!isAdmin) return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
      try {
        const { id, link } = await request.json();
        if (!id || !link) return new Response(JSON.stringify({ error: "id and link required" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
        const users = await getUsers(kv);
        users[String(id)] = btoa(link);
        await saveUsers(kv, users);
        return new Response(JSON.stringify({ ok: true, id }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    if (method === "DELETE" && path.startsWith("/admin/user/")) {
      if (!isAdmin) return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
      try {
        const id = path.split("/admin/user/")[1];
        const users = await getUsers(kv);
        delete users[id];
        await saveUsers(kv, users);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    if (method === "GET" && path === "/admin/users") {
      if (!isAdmin) return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
      try {
        const users = await getUsers(kv);
        const full = {};
        for (const [id, b64] of Object.entries(users)) {
          if (b64) full[id] = atob(b64);
        }
        return new Response(JSON.stringify({ users: full }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
};
