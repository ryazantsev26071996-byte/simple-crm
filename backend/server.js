const express = require("express");
const cors = require("cors");

const clientsRouter = require("./routes/clients");
const commentsRouter = require("./routes/comments");

const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: false,
  })
);

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/api/clients", clientsRouter);
app.use("/api/clients", commentsRouter);

// Basic error handler (routes should return explicit JSON errors).
app.use((err, req, res, next) => {
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`CRM backend listening on http://localhost:${PORT}`);
});

