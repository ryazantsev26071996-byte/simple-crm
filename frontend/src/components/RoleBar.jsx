import React from "react";

export default function RoleBar({ role, authorName, onChange }) {
  return (
    <div className="topBar">
      <div className="topBarTitle">Simple CRM</div>
      <div className="roleControls">
        <div className="muted" style={{ fontSize: 13 }}>
          Role:
        </div>
        <select
          className="select"
          value={role}
          onChange={(e) => onChange({ role: e.target.value })}
        >
          <option value="Manager">Manager</option>
          <option value="Teacher">Teacher</option>
        </select>
        <div className="muted" style={{ fontSize: 13 }}>
          Author:
        </div>
        <input
          className="input"
          value={authorName}
          onChange={(e) => onChange({ authorName: e.target.value })}
          placeholder="e.g. Ivan"
          style={{ width: 160 }}
        />
      </div>
    </div>
  );
}

