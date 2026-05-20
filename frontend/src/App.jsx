import React from "react";
import RoleBar from "./components/RoleBar.jsx";
import ClientTable from "./components/ClientTable.jsx";
import ClientForm from "./components/ClientForm.jsx";
import CommentsWall from "./components/CommentsWall.jsx";
import { createClient, createComment, getClients, getComments, updateClient } from "./api.js";
import { useAuth } from "./AuthContext";
import { LoginPage } from "./LoginPage";
import { supabase } from "./supabase";

export default function App() {
  const { user, profile, loading } = useAuth();

  const [clients, setClients] = React.useState([]);
  const [selectedId, setSelectedId] = React.useState(null);
  const [comments, setComments] = React.useState([]);
  const [loadingClients, setLoadingClients] = React.useState(false);
  const [loadingComments, setLoadingComments] = React.useState(false);
  const [error, setError] = React.useState("");

  const role = profile?.role || "teacher";
  const authorName = profile?.full_name || user?.email || "";
  const apiUser = { role, name: authorName };
  const selectedClient = clients.find((c) => c.id === selectedId) || null;

  const reloadClients = React.useCallback(async () => {
    setError("");
    setLoadingClients(true);
    try {
      const list = await getClients(apiUser);
      setClients(list);
      if (!list.find((c) => c.id === selectedId)) {
        setSelectedId(list.length > 0 ? list[0].id : null);
      }
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoadingClients(false);
    }
  }, [role, selectedId]);

  const reloadComments = React.useCallback(async (clientId) => {
    if (!clientId) return;
    setLoadingComments(true);
    setError("");
    try {
      const list = await getComments(apiUser, clientId);
      setComments(list);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoadingComments(false);
    }
  }, [role]);

  React.useEffect(() => {
    if (user) reloadClients();
  }, [role, user]);

  React.useEffect(() => {
    if (selectedId) reloadComments(selectedId);
    else setComments([]);
  }, [selectedId]);

  if (loading) return <div style={{ padding: 40 }}>Загрузка...</div>;
  if (!user) return <LoginPage />;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", borderBottom: "1px solid #eee" }}>
        <RoleBar role={role} authorName={authorName} />
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: "#666" }}>{user.email} ({role})</span>
          <button onClick={() => supabase.auth.signOut()} style={{ fontSize: 12 }}>Выйти</button>
        </div>
      </div>

      {error && <div style={{ color: "red", padding: "8px 16px" }}>{error}</div>}

      <div style={{ display: "flex" }}>
        <div style={{ width: 300, borderRight: "1px solid #eee" }}>
          <ClientForm
            mode="Add client"
            disabled={role !== "manager" && role !== "admin"}
            submitLabel="Add"
            onSubmit={async (payload) => {
              setError("");
              try {
                const newClient = await createClient(apiUser, payload);
                setClients((prev) => [...prev, newClient]);
                setSelectedId(newClient.id);
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
                    Phone: {selectedClient.phone || "−"} • Source: {selectedClient.source || "−"} • Stage: {selectedClient.stage || "−"}
                  </div>
                </div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {role === "manager" || role === "admin" ? "Client editing enabled" : "Client editing disabled"}
                </div>
              </div>

              <ClientForm
                mode="Edit client"
                initialValue={selectedClient}
                disabled={role !== "manager" && role !== "admin"}
                submitLabel="Save"
                onSubmit={async (payload) => {
                  setError("");
                  try {
                    const updated = await updateClient(apiUser, selectedClient.id, payload);
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
                  await createComment(apiUser, selectedClient.id, { message });
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
