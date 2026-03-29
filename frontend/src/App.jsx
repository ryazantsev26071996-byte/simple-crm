import React from "react";
import RoleBar from "./components/RoleBar.jsx";
import ClientTable from "./components/ClientTable.jsx";
import ClientForm from "./components/ClientForm.jsx";
import CommentsWall from "./components/CommentsWall.jsx";
import { createClient, createComment, getClients, getComments, updateClient } from "./api.js";

function loadFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export default function App() {
  const [role, setRole] = React.useState(loadFromStorage("crm.role", "Manager"));
  const [authorName, setAuthorName] = React.useState(loadFromStorage("crm.authorName", "Ivan"));

  const [clients, setClients] = React.useState([]);
  const [selectedId, setSelectedId] = React.useState(null);
  const [comments, setComments] = React.useState([]);

  const [loadingClients, setLoadingClients] = React.useState(false);
  const [loadingComments, setLoadingComments] = React.useState(false);
  const [error, setError] = React.useState("");

  const user = React.useMemo(() => ({ role, name: authorName }), [role, authorName]);

  React.useEffect(() => {
    saveToStorage("crm.role", role);
  }, [role]);

  React.useEffect(() => {
    saveToStorage("crm.authorName", authorName);
  }, [authorName]);

  // Загружаем список клиентов
  const reloadClients = React.useCallback(async () => {
    setError("");
    setLoadingClients(true);
    try {
      const list = await getClients(user);
      setClients(list);
      // Если выбранный клиент отсутствует или null, выбираем первый
      if (!list.find(c => c.id === selectedId)) {
        setSelectedId(list.length > 0 ? list[0].id : null);
      }
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoadingClients(false);
    }
  }, [user, selectedId]);

  // Загружаем комментарии для выбранного клиента
  const reloadComments = React.useCallback(
    async (clientId) => {
      if (!clientId) return;
      setLoadingComments(true);
      setError("");
      try {
        const list = await getComments(user, clientId);
        setComments(list);
      } catch (err) {
        setError(err.message || String(err));
      } finally {
        setLoadingComments(false);
      }
    },
    [user]
  );

  React.useEffect(() => {
    reloadClients();
  }, []);

  React.useEffect(() => {
    reloadComments(selectedId);
  }, [selectedId, reloadComments]);

  const selectedClient = clients.find((c) => c.id === selectedId) || null;
  const [addKey, setAddKey] = React.useState(0);

  return (
    <div className="appShell">
      <RoleBar
        role={role}
        authorName={authorName}
        onChange={({ role: nextRole, authorName: nextName }) => {
          if (typeof nextRole === "string") setRole(nextRole);
          if (typeof nextName === "string") setAuthorName(nextName);
        }}
      />

      <div className="page">
        <div className="panel">
          <div className="panelHeader">
            <div className="panelTitle">Clients</div>
            <div className="muted" style={{ fontSize: 13 }}>
              {role === "Manager" ? "Add/edit is enabled." : "Switch to Manager to add clients."}
            </div>
          </div>

          {error && (
            <div className="hint" style={{ color: "var(--danger)" }}>
              {error}
            </div>
          )}

          <ClientForm
            key={addKey}
            mode="Add client"
            initialValue={{ name: "", phone: "", source: "", stage: "" }}
            disabled={role !== "Manager"}
            submitLabel="Add"
            onSubmit={async (payload) => {
              setError("");
              try {
                const newClient = await createClient(user, payload);
                setAddKey((k) => k + 1); // очистка формы
                await reloadClients();   // обновляем список
                setSelectedId(newClient.id); // сразу выбираем нового клиента
              } catch (err) {
                setError(err.message || String(err));
              }
            }}
          />

          <div style={{ height: 12 }} />

          {loadingClients ? <div className="hint">Loading clients...</div> : null}

          <ClientTable
            clients={clients}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId(id)}
          />
        </div>

        <div className="panel">
          {!selectedClient ? (
            <div className="hint">Select a client to view details.</div>
          ) : (
            <>
              <div className="detailsTop">
                <div>
                  <div className="detailsName">{selectedClient.name}</div>
                  <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                    Phone: {selectedClient.phone || "-"} • Source: {selectedClient.source || "-"} • Stage:{" "}
                    {selectedClient.stage || "-"}
                  </div>
                </div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {role === "Manager" ? "Client editing enabled" : "Client editing disabled"}
                </div>
              </div>

              <ClientForm
                mode="Edit client"
                initialValue={selectedClient}
                disabled={role !== "Manager"}
                submitLabel="Save"
                onSubmit={async (payload) => {
                  setError("");
                  try {
                    const updated = await updateClient(user, selectedClient.id, payload);
                    setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
                  } catch (err) {
                    setError(err.message || String(err));
                  }
                }}
              />

              <div style={{ height: 12 }} />

              {loadingComments ? <div className="hint">Loading comments...</div> : null}

              <CommentsWall
                role={role}
                authorName={authorName}
                comments={comments}
                onCreate={async (message) => {
                  await createComment(user, selectedClient.id, { message });
                  await reloadComments(selectedClient.id);
                }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}