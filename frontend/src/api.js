const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

function toHeaders({ role, name }) {
  return {
    "Content-Type": "application/json",
    "x-user-role": role,
    "x-user-name": name,
  };
}

async function handleJson(res) {
  if (!res.ok) {
    let details = "";
    try {
      const body = await res.json();
      details = body && body.error ? body.error : "";
    } catch {
      // ignore
    }
    const msg = details || `Request failed: ${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return res.json();
}

export async function getClients(user) {
  const res = await fetch(`${API_BASE}/api/clients`, {
    method: "GET",
    headers: toHeaders(user),
  });
  const json = await handleJson(res);
  return json.clients;
}

export async function createClient(user, payload) {
  const res = await fetch(`${API_BASE}/api/clients`, {
    method: "POST",
    headers: toHeaders(user),
    body: JSON.stringify(payload),
  });
  const json = await handleJson(res);
  return json.client;
}

export async function updateClient(user, id, payload) {
  const res = await fetch(`${API_BASE}/api/clients/${id}`, {
    method: "PUT",
    headers: toHeaders(user),
    body: JSON.stringify(payload),
  });
  const json = await handleJson(res);
  return json.client;
}

export async function getComments(user, clientId) {
  const res = await fetch(`${API_BASE}/api/clients/${clientId}/comments`, {
    method: "GET",
    headers: toHeaders(user),
  });
  const json = await handleJson(res);
  return json.comments;
}

export async function createComment(user, clientId, payload) {
  const res = await fetch(`${API_BASE}/api/clients/${clientId}/comments`, {
    method: "POST",
    headers: toHeaders(user),
    body: JSON.stringify(payload),
  });
  const json = await handleJson(res);
  return json.comment;
}

