import React from "react";

export default function ClientTable({ clients, selectedId, onSelect }) {
  return (
    <div className="clientsTableWrap">
      <table>
        <thead>
          <tr>
            <th style={{ width: 170 }}>Name</th>
            <th style={{ width: 130 }}>Phone</th>
            <th style={{ width: 110 }}>Source</th>
            <th style={{ width: 120 }}>Stage</th>
          </tr>
        </thead>
        <tbody>
          {clients.length === 0 ? (
            <tr>
              <td colSpan={4} className="muted">
                No clients yet
              </td>
            </tr>
          ) : (
            clients.map((c) => (
              <tr key={c.id} className={c.id === selectedId ? "rowActive" : ""}>
                <td colSpan={4} style={{ padding: 0, borderBottom: "1px solid var(--border)" }}>
                  <button
                    className="rowBtn"
                    onClick={() => onSelect(c.id)}
                    aria-label={`Select client ${c.name}`}
                    style={{ padding: "10px 10px", width: "100%" }}
                  >
                    <div style={{ display: "grid", gridTemplateColumns: "170px 130px 110px 120px" }}>
                      <div style={{ fontWeight: 700 }}>{c.name}</div>
                      <div className="muted">{c.phone || "-"}</div>
                      <div className="muted">{c.source || "-"}</div>
                      <div className="muted">{c.stage || "-"}</div>
                    </div>
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

