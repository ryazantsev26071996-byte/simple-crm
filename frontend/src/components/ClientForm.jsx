import React from "react";

export default function ClientForm({
  mode,
  initialValue,
  disabled,
  onSubmit,
  submitLabel,
}) {
  const [form, setForm] = React.useState({
    name: initialValue?.name || "",
    phone: initialValue?.phone || "",
    source: initialValue?.source || "",
    stage: initialValue?.stage || "",
  });

  React.useEffect(() => {
    setForm({
      name: initialValue?.name || "",
      phone: initialValue?.phone || "",
      source: initialValue?.source || "",
      stage: initialValue?.stage || "",
    });
  }, [initialValue]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          name: form.name.trim(),
          phone: form.phone.trim(),
          source: form.source.trim(),
          stage: form.stage.trim(),
        });
      }}
    >
      <div className="grid2">
        <div className="formGroup">
          <div className="fieldLabel">Name</div>
          <input
            className="input"
            value={form.name}
            disabled={disabled}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Client name"
            required
          />
        </div>
        <div className="formGroup">
          <div className="fieldLabel">Phone</div>
          <input
            className="input"
            value={form.phone}
            disabled={disabled}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="+7..."
          />
        </div>
      </div>
      <div style={{ height: 10 }} />
      <div className="grid2">
        <div className="formGroup">
          <div className="fieldLabel">Source</div>
          <input
            className="input"
            value={form.source}
            disabled={disabled}
            onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
            placeholder="e.g. Referral"
          />
        </div>
        <div className="formGroup">
          <div className="fieldLabel">Stage</div>
          <input
            className="input"
            value={form.stage}
            disabled={disabled}
            onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value }))}
            placeholder="e.g. Trial / Active"
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center" }}>
        <button className="btn btnPrimary" type="submit" disabled={disabled}>
          {submitLabel}
        </button>
        <div className="muted" style={{ fontSize: 13 }}>
          {mode}
        </div>
      </div>
    </form>
  );
}

