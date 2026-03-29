const express = require("express");
const { db } = require("../db");
const { requireRole } = require("../middleware/auth");

const router = express.Router({ mergeParams: true });

router.get("/:id/comments", (req, res) => {
  const numericId = Number(req.params.id);
  if (!Number.isFinite(numericId)) {
    return res.status(400).json({ error: "Invalid client id" });
  }

  const comments = db
    .prepare(
      "SELECT id, clientId, author, message, createdAt FROM comments WHERE clientId = ? ORDER BY createdAt DESC"
    )
    .all(numericId);

  res.json({ comments });
});

router.post("/:id/comments", requireRole("Teacher"), (req, res) => {
  const numericId = Number(req.params.id);
  if (!Number.isFinite(numericId)) {
    return res.status(400).json({ error: "Invalid client id" });
  }

  const { message } = req.body || {};
  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Field `message` is required" });
  }

  const clientExists = db.prepare("SELECT id FROM clients WHERE id = ?").get(numericId);
  if (!clientExists) {
    return res.status(404).json({ error: "Client not found" });
  }

  const info = db
    .prepare("INSERT INTO comments (clientId, author, message) VALUES (@clientId, @author, @message)")
    .run({
      clientId: numericId,
      author: req.user.name,
      message: message.trim(),
    });

  const created = db
    .prepare("SELECT id, clientId, author, message, createdAt FROM comments WHERE id = ?")
    .get(info.lastInsertRowid);

  res.status(201).json({ comment: created });
});

module.exports = router;

