import React from "react";
import { supabase } from "./supabase";
import { useAuth } from "./AuthContext";

function getInitials(name) {
  if (!name) return "?";
  return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

function isOnline(lastSeen) {
  if (!lastSeen) return false;
  return (Date.now() - new Date(lastSeen).getTime()) < 2 * 60 * 1000;
}

function formatLastSeen(lastSeen) {
  if (!lastSeen) return "не был(а) в сети";
  const diff = Math.floor((Date.now() - new Date(lastSeen).getTime()) / 1000);
  if (diff < 10) return "только что";
  if (diff < 60) return `${diff} сек назад`;
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  return new Date(lastSeen).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const ROLE_LABELS = { admin: "Админ", manager: "Менеджер", teacher: "Педагог" };
const ROLE_COLORS = { admin: "#4a90e2", manager: "#27ae60", teacher: "#e67e22" };

export default function TeamOnline() {
  const { user } = useAuth();
  const [profiles, setProfiles] = React.useState([]);
  const [presence, setPresence] = React.useState({});
  const [, setTick] = React.useState(0);

  async function upsertPresence() {
    if (!user) return;
    await supabase.from("user_presence").upsert({ user_id: user.id, last_seen: new Date().toISOString() }, { onConflict: "user_id" });
  }

  async function fetchData() {
    const [{ data: profs }, { data: pres }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, role"),
      supabase.from("user_presence").select("user_id, last_seen"),
    ]);
    if (profs) setProfiles(profs);
    if (pres) {
      const map = {};
      pres.forEach(p => { map[p.user_id] = p.last_seen; });
      setPresence(map);
    }
  }

  React.useEffect(() => {
    upsertPresence();
    fetchData();

    const presenceInterval = setInterval(upsertPresence, 30_000);
    const fetchInterval = setInterval(fetchData, 30_000);
    const tickInterval = setInterval(() => setTick(t => t + 1), 15_000);

    return () => {
      clearInterval(presenceInterval);
      clearInterval(fetchInterval);
      clearInterval(tickInterval);
    };
  }, [user?.id]);

  const sorted = [...profiles].sort((a, b) => {
    const aOnline = isOnline(presence[a.id]);
    const bOnline = isOnline(presence[b.id]);
    if (aOnline && !bOnline) return -1;
    if (!aOnline && bOnline) return 1;
    return (a.full_name || "").localeCompare(b.full_name || "", "ru");
  });

  const onlineCount = sorted.filter(p => isOnline(presence[p.id])).length;

  return (
    <div style={{ padding: 20, maxWidth: 700 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>Команда</div>
        <div style={{ fontSize: 12, color: "#888", background: "#f0f7ff", borderRadius: 12, padding: "2px 10px" }}>
          <span style={{ color: "#27ae60", fontWeight: 600 }}>{onlineCount}</span> онлайн · {profiles.length} всего
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sorted.map(p => {
          const online = isOnline(presence[p.id]);
          const lastSeen = presence[p.id];
          const color = ROLE_COLORS[p.role] || "#888";
          return (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "white", borderRadius: 10, border: "1px solid #eee", boxShadow: online ? "0 1px 4px rgba(39,174,96,0.08)" : "none" }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: color + "22", color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 15 }}>
                  {getInitials(p.full_name)}
                </div>
                <div style={{ position: "absolute", bottom: 1, right: 1, width: 10, height: 10, borderRadius: "50%", background: online ? "#27ae60" : "#ccc", border: "2px solid white" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <span style={{ fontWeight: 500, fontSize: 14 }}>{p.full_name || "—"}</span>
                  <span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 8, background: color + "18", color, fontWeight: 500 }}>{ROLE_LABELS[p.role] || p.role}</span>
                </div>

              </div>
              <div style={{ fontSize: 11, color: online ? "#27ae60" : "#bbb", whiteSpace: "nowrap", flexShrink: 0 }}>
                {online ? "онлайн" : formatLastSeen(lastSeen)}
              </div>
            </div>
          );
        })}
        {profiles.length === 0 && (
          <div style={{ color: "#aaa", fontSize: 13, padding: 16, textAlign: "center" }}>Загрузка...</div>
        )}
      </div>
    </div>
  );
}
