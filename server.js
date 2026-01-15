import express from "express";

const app = express();

const XI_API_KEY = process.env.XI_API_KEY;
const AGENT_ID = process.env.AGENT_ID;

if (!XI_API_KEY || !AGENT_ID) {
  throw new Error("Faltan variables de entorno: XI_API_KEY o AGENT_ID");
}

// Health check simple (opcional pero recomendado)
app.get("/", (req, res) => {
  res.json({ status: "backend_agent OK" });
});

// Token para WebRTC (Agents Platform)
app.get("/api/token", async (req, res) => {
  try {
    const url = new URL(
      "https://api.elevenlabs.io/v1/convai/conversation/token"
    );
    url.searchParams.set("agent_id", AGENT_ID);

    const r = await fetch(url, {
      headers: {
        "xi-api-key": XI_API_KEY,
      },
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).send(text);
    }

    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Metadata del agente (nombre + avatar)
app.get("/api/agent", async (req, res) => {
  try {
    const r = await fetch(
      `https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}`,
      {
        headers: {
          "xi-api-key": XI_API_KEY,
        },
      }
    );

    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).send(text);
    }

    const data = await r.json();

    res.json({
      name: data?.name || "AGENTE",
      avatar_url:
        data?.avatar_url ||
        data?.widget?.avatar_url ||
        null,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`backend_agent escuchando en puerto ${PORT}`);
});
