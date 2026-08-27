require("dotenv").config();
const path = require("path");
const express = require("express");
const aggregate = require("./aggregate");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "..", "public")));

function isDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

app.get("/api/members", async (req, res) => {
  try {
    const members = await aggregate.getMembers();
    res.json({ members });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/activities/delivered", async (req, res) => {
  try {
    const date = req.query.date;
    if (date && !isDateKey(date)) {
      return res.status(400).json({ error: "Parâmetro 'date' deve estar no formato YYYY-MM-DD." });
    }
    const result = await aggregate.getDelivered(date);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/activities/all", async (req, res) => {
  try {
    const result = await aggregate.getAllActivities();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/activities/overdue", async (req, res) => {
  try {
    const result = await aggregate.getOverdue();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Fyre Performance rodando em http://localhost:${PORT}`);
});
