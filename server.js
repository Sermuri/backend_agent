import express from "express";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "8kb" }));

app.use((req, res, next) => {
  const allowedOrigins = [
    "https://sergiomurillo.com.ar",
    "https://www.sergiomurillo.com.ar",
    "https://cv.sergiomurillo.com.ar",
    "https://inteliautomake.com",
    "https://www.inteliautomake.com",
    "http://127.0.0.1:4173",
    "http://localhost:4173"
  ];

  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});


const XI_API_KEY = process.env.XI_API_KEY;
const AGENT_ID = process.env.AGENT_ID;
const TTS_VOICE_ID = process.env.TTS_VOICE_ID || "Mr9CoMsr8YQzDuHzbQlU";

const AGENTS = {
  portfolio: AGENT_ID,
  greicy: "86xXkvGitNjXvpc2dC9X",
  botcats: "m6PkabC0jHHHGnlxRkrQ",
  sky: "agent_2601kfb9qwrefqbvz67kqspsqevr"
};

const NARRATIONS = {
  intro: "Soy Sergio Enrique Murillo, arquitecto de soluciones y líder técnico. Integro agentes de voz, automatización, APIs, datos e infraestructura para llevar una necesidad de negocio desde la conversación inicial hasta una implementación verificable. Combino más de veintiséis años de experiencia tecnológica con desarrollo de productos, formación y liderazgo de proyectos de inteligencia artificial.",
  studio: "Studio Media Labs es una plataforma SaaS de innovación aplicada a la producción multimedia. Diseñé su arquitectura, los flujos de generación y las integraciones que conectan inteligencia artificial, datos, APIs y una experiencia de trabajo unificada.",
  parque: "Como CTO de Parque de la Paz, lideré la integración de Greicy, una agente de voz creada con ElevenLabs. Greicy se conecta mediante herramientas seguras y flujos de automatización para orientar a los clientes y responder consultas sobre su estado de cuenta.",
  aiqr: "AIQR es un producto SaaS diseñado para transformar operaciones empresariales mediante agentes, flujos inteligentes, datos estructurados e integraciones seguras. El proyecto reúne automatización, arquitectura web y capacidades de inteligencia artificial aplicadas a procesos reales.",
  sky: "Sky es una experiencia conversacional desarrollada para SkyOnline. El agente utiliza la plataforma de ElevenLabs y una interfaz integrada para ofrecer una interacción directa por voz dentro de un producto digital.",
  experience: "Mi trayectoria técnica comenzó mucho antes de la actual ola de inteligencia artificial. Desde mil novecientos noventa y ocho trabajo en infraestructura, telecomunicaciones, servidores, redes y soporte de sistemas críticos. Esa base me permite diseñar hoy agentes y productos de inteligencia artificial que se integran con seguridad a la operación real de una organización."
};

const audioCache = new Map();

function requestedAgent(req) {
  const key = String(req.query.agent || "portfolio").toLowerCase();
  return AGENTS[key] || null;
}

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
    const agentId = requestedAgent(req);
    if (!agentId) return res.status(400).json({ error: "Agente no permitido" });
    const url = new URL(
      "https://api.elevenlabs.io/v1/convai/conversation/token"
    );
    url.searchParams.set("agent_id", agentId);

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
    const agentId = requestedAgent(req);
    if (!agentId) return res.status(400).json({ error: "Agente no permitido" });
    const r = await fetch(
      `https://api.elevenlabs.io/v1/convai/agents/${agentId}`,
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
      description: data?.conversation_config?.agent?.prompt?.prompt
        ? "Agente conversacional personalizado"
        : "Asistente de inteligencia artificial",
      avatar_url:
        data?.avatar_url ||
        data?.widget?.avatar_url ||
        null,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get("/api/tts/:section", async (req, res) => {
  const section = String(req.params.section || "");
  const text = NARRATIONS[section];
  if (!text) return res.status(404).json({ error: "Narración no encontrada" });

  try {
    if (audioCache.has(section)) {
      res.setHeader("X-Audio-Cache", "HIT");
      res.type("audio/mpeg");
      return res.send(audioCache.get(section));
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${TTS_VOICE_ID}/stream?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": XI_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.55, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true }
        })
      }
    );

    if (!response.ok) {
      const detail = await response.text();
      console.error("ElevenLabs TTS error", response.status, detail);
      return res.status(response.status).json({ error: "No se pudo generar la narración" });
    }

    const audio = Buffer.from(await response.arrayBuffer());
    audioCache.set(section, audio);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("X-Audio-Cache", "MISS");
    res.type("audio/mpeg");
    return res.send(audio);
  } catch (error) {
    console.error("TTS failure", error);
    return res.status(502).json({ error: "Servicio de narración no disponible" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`backend_agent escuchando en puerto ${PORT}`);
});
