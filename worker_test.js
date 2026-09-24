addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request, event));
});

async function handleRequest(request, env) {
  const secret = env.ADMIN_SECRET || "NO_SECRET";
  const response = new Response(JSON.stringify({ secret_preview: secret.substring(0, 4) + "..." }), {
    headers: { "Content-Type": "application/json" }
  });
  return response;
}
