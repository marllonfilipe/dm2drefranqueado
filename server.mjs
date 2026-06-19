import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { FieldValue, Firestore } from "@google-cloud/firestore";

const app = express();
const port = Number(process.env.PORT) || 8080;
const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
const firestore = new Firestore(projectId ? { projectId } : undefined);
const scenarioDocument = firestore.collection("dashboardScenarios").doc("dm2drefranqueado");
const root = path.dirname(fileURLToPath(import.meta.url));

app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.get("/api/scenarios", async (_request, response) => {
  try {
    const snapshot = await scenarioDocument.get();
    response.json(snapshot.exists ? snapshot.data() : { scenarios: null });
  } catch (error) {
    console.error("Falha ao carregar cenarios", error);
    response.status(503).json({ error: "Persistencia temporariamente indisponivel" });
  }
});

app.put("/api/scenarios", async (request, response) => {
  if (!request.body?.scenarios || typeof request.body.scenarios !== "object") {
    response.status(400).json({ error: "Cenarios invalidos" });
    return;
  }

  try {
    await scenarioDocument.set({
      scenarios: request.body.scenarios,
      updatedAt: FieldValue.serverTimestamp(),
    });
    response.json({ ok: true });
  } catch (error) {
    console.error("Falha ao salvar cenarios", error);
    response.status(503).json({ error: "Persistencia temporariamente indisponivel" });
  }
});

app.use(express.static(path.join(root, "dist")));
app.use((_request, response) => {
  response.sendFile(path.join(root, "dist", "index.html"));
});

app.listen(port, "0.0.0.0", () => {
  console.log(`DM2 DRE disponivel na porta ${port}`);
});
