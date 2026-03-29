const express = require("express");
const { db } = require("../db");
const { requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/", (req, res) => {
  const clients = db
    .prepare("SELECT id, name, phone, source, stage, createdAt FROM clients ORDER BY id DESC")
    .all();
  res.json({ clients });
});

router.post("/", requireRole("Manager"), (req, res) => {
  const { name, phone, source, stage } = req.body || {};
  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "Field `name` is required" });
  }

  const stmt = db.prepare(
    "INSERT INTO clients (name, phone, source, stage) VALUES (@name, @phone, @source, @stage)"
  );
  const info = stmt.run({
    name: name.trim(),
    phone: phone ? String(phone).trim() : null,
    source: source ? String(source).trim() : null,
    stage: stage ? String(stage).trim() : null,
  });

  const created = db
    .prepare("SELECT id, name, phone, source, stage, createdAt FROM clients WHERE id = ?")
    .get(info.lastInsertRowid);

  res.status(201).json({ client: created });
});

router.put("/:id", requireRole("Manager"), (req, res) => {
  const { id } = req.params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) {
    return res.status(400).json({ error: "Invalid client id" });
  }

  const { name, phone, source, stage } = req.body || {};
  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "Field `name` is required" });
  }

  const stmt = db.prepare(
    "UPDATE clients SET name = @name, phone = @phone, source = @source, stage = @stage WHERE id = @id"
  );
  const info = stmt.run({
    id: numericId,
    name: name.trim(),
    phone: phone ? String(phone).trim() : null,
    source: source ? String(source).trim() : null,
    stage: stage ? String(stage).trim() : null,
  });

  if (info.changes === 0) {
    return res.status(404).json({ error: "Client not found" });
  }

  const updated = db
    .prepare("SELECT id, name, phone, source, stage, createdAt FROM clients WHERE id = ?")
    .get(numericId);
  res.json({ client: updated });
});

module.exports = router;

