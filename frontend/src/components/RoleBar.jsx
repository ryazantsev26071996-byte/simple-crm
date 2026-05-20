export default function RoleBar({ role, authorName }) {
  return (
    <div className="topBar">
      <div className="topBarTitle">Simple CRM</div>
      <div style={{ fontSize: 13, color: "#666" }}>
        {authorName} · {role}
      </div>
    </div>
  );
}
