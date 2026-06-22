import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { FieldValue, Firestore } from "@google-cloud/firestore";

const app = express();
const port = Number(process.env.PORT) || 8080;
const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
const firebaseApiKey = process.env.FIREBASE_API_KEY || "AIzaSyDxgAqWLSBYm08wQdya7YsqtjALs2tEs2Q";
const firestore = new Firestore(projectId ? { projectId } : undefined);
const scenarioDocument = firestore.collection("dashboardScenarios").doc("dm2drefranqueado");
const usersCollection = firestore.collection("dashboardUsers");
const snapshotCollection = firestore.collection("dashboardScenarioSnapshots");
const root = path.dirname(fileURLToPath(import.meta.url));
const allowedDomain = "@doutordm2franquias.com.br";

app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

function hasAllowedDomain(email = "") {
  return email.toLowerCase().endsWith(allowedDomain);
}

async function authenticate(request, response, next) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) {
    response.status(401).json({ error: "Login obrigatorio" });
    return;
  }

  try {
    const lookupResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseApiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token }),
    });
    const lookupPayload = await lookupResponse.json().catch(() => ({}));
    const firebaseUser = lookupPayload.users?.[0];
    if (!lookupResponse.ok || !firebaseUser) throw new Error(lookupPayload.error?.message || "Token invalido");
    const decoded = {
      uid: firebaseUser.localId,
      email: firebaseUser.email,
      name: firebaseUser.displayName,
    };
    if (!hasAllowedDomain(decoded.email)) {
      response.status(403).json({ error: "Dominio nao autorizado" });
      return;
    }

    request.authUser = decoded;
    next();
  } catch (error) {
    console.error("Token Firebase invalido", error);
    response.status(401).json({ error: "Sessao invalida" });
  }
}

async function ensureUserProfile(decoded) {
  const userRef = usersCollection.doc(decoded.uid);
  const userSnapshot = await userRef.get();
  const approvedSnapshot = await usersCollection.where("status", "==", "approved").limit(1).get();
  const isFirstApprovedUser = approvedSnapshot.empty;

  if (!userSnapshot.exists) {
    const profile = {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name || decoded.email?.split("@")[0] || "Usuario",
      status: isFirstApprovedUser ? "approved" : "pending",
      role: isFirstApprovedUser ? "admin" : "user",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    await userRef.set(profile);
    return { ...profile, createdAt: null, updatedAt: null };
  }

  const profile = userSnapshot.data();
  await userRef.set(
    {
      email: decoded.email,
      name: decoded.name || profile.name || decoded.email?.split("@")[0] || "Usuario",
      lastSeenAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return { ...profile, uid: decoded.uid, email: decoded.email };
}

async function requireAdmin(request, response, next) {
  const profile = await ensureUserProfile(request.authUser);
  if (profile.status !== "approved" || profile.role !== "admin") {
    response.status(403).json({ error: "Acesso restrito a gestao" });
    return;
  }

  request.userProfile = profile;
  next();
}

function publicUser(profile) {
  return {
    uid: profile.uid,
    email: profile.email,
    name: profile.name,
    status: profile.status,
    role: profile.role,
    createdAt: profile.createdAt?.toDate?.()?.toISOString?.() || null,
    updatedAt: profile.updatedAt?.toDate?.()?.toISOString?.() || null,
  };
}

app.get("/api/me", authenticate, async (request, response) => {
  try {
    const profile = await ensureUserProfile(request.authUser);
    response.json({ user: publicUser(profile), allowedDomain });
  } catch (error) {
    console.error("Falha ao carregar perfil", error);
    response.status(503).json({ error: "Perfil temporariamente indisponivel" });
  }
});

app.post("/api/register-profile", authenticate, async (request, response) => {
  try {
    const profile = await ensureUserProfile(request.authUser);
    response.json({ user: publicUser(profile), allowedDomain });
  } catch (error) {
    console.error("Falha ao registrar perfil", error);
    response.status(503).json({ error: "Cadastro temporariamente indisponivel" });
  }
});

app.get("/api/users", authenticate, requireAdmin, async (_request, response) => {
  try {
    const snapshot = await usersCollection.orderBy("createdAt", "desc").limit(100).get();
    response.json({ users: snapshot.docs.map((doc) => publicUser({ uid: doc.id, ...doc.data() })) });
  } catch (error) {
    console.error("Falha ao listar usuarios", error);
    response.status(503).json({ error: "Usuarios temporariamente indisponiveis" });
  }
});

app.patch("/api/users/:uid", authenticate, requireAdmin, async (request, response) => {
  const status = request.body?.status;
  const role = request.body?.role;
  if (!["approved", "pending", "rejected"].includes(status) && !["admin", "user"].includes(role)) {
    response.status(400).json({ error: "Atualizacao invalida" });
    return;
  }

  try {
    const update = { updatedAt: FieldValue.serverTimestamp() };
    if (["approved", "pending", "rejected"].includes(status)) update.status = status;
    if (["admin", "user"].includes(role)) update.role = role;
    await usersCollection.doc(request.params.uid).set(update, { merge: true });
    response.json({ ok: true });
  } catch (error) {
    console.error("Falha ao atualizar usuario", error);
    response.status(503).json({ error: "Usuario temporariamente indisponivel" });
  }
});

app.get("/api/scenarios", authenticate, async (request, response) => {
  try {
    const profile = await ensureUserProfile(request.authUser);
    if (profile.status !== "approved") {
      response.status(403).json({ error: "Usuario pendente de aprovacao" });
      return;
    }
    const snapshot = await scenarioDocument.get();
    response.json(snapshot.exists ? snapshot.data() : { scenarios: null });
  } catch (error) {
    console.error("Falha ao carregar cenarios", error);
    response.status(503).json({ error: "Persistencia temporariamente indisponivel" });
  }
});

app.put("/api/scenarios", authenticate, async (request, response) => {
  if (!request.body?.scenarios || typeof request.body.scenarios !== "object") {
    response.status(400).json({ error: "Cenarios invalidos" });
    return;
  }

  try {
    const profile = await ensureUserProfile(request.authUser);
    if (profile.status !== "approved") {
      response.status(403).json({ error: "Usuario pendente de aprovacao" });
      return;
    }
    await scenarioDocument.set({
      scenarios: request.body.scenarios,
      updatedBy: request.authUser.email,
      updatedAt: FieldValue.serverTimestamp(),
    });
    response.json({ ok: true });
  } catch (error) {
    console.error("Falha ao salvar cenarios", error);
    response.status(503).json({ error: "Persistencia temporariamente indisponivel" });
  }
});

app.get("/api/scenario-snapshots", authenticate, async (request, response) => {
  try {
    const profile = await ensureUserProfile(request.authUser);
    if (profile.status !== "approved") {
      response.status(403).json({ error: "Usuario pendente de aprovacao" });
      return;
    }

    const query = snapshotCollection.orderBy("createdAt", "desc").limit(80);
    const snapshot = await query.get();
    response.json({
      snapshots: snapshot.docs.map((doc) => {
        const item = doc.data();
        return {
          id: doc.id,
          title: item.title,
          scenario: item.scenario,
          createdBy: item.createdBy,
          createdAt: item.createdAt?.toDate?.()?.toISOString?.() || null,
          totals: item.totals || null,
          controls: item.controls || null,
          monthly: item.monthly || null,
          useExcelBase: Boolean(item.useExcelBase),
        };
      }),
    });
  } catch (error) {
    console.error("Falha ao buscar simulacoes", error);
    response.status(503).json({ error: "Simulacoes temporariamente indisponiveis" });
  }
});

app.post("/api/scenario-snapshots", authenticate, async (request, response) => {
  const { scenario, controls, monthly, totals, useExcelBase } = request.body || {};
  if (!scenario || !controls || !Array.isArray(monthly)) {
    response.status(400).json({ error: "Simulacao invalida" });
    return;
  }

  try {
    const profile = await ensureUserProfile(request.authUser);
    if (profile.status !== "approved") {
      response.status(403).json({ error: "Usuario pendente de aprovacao" });
      return;
    }

    const createdAt = new Date();
    const doc = await snapshotCollection.add({
      title: `${scenario} - ${createdAt.toLocaleDateString("pt-BR")}`,
      scenario,
      controls,
      monthly,
      totals: totals || null,
      useExcelBase: Boolean(useExcelBase),
      ownerUid: request.authUser.uid,
      createdBy: request.authUser.email,
      createdAt: FieldValue.serverTimestamp(),
    });
    response.json({ ok: true, id: doc.id });
  } catch (error) {
    console.error("Falha ao salvar simulacao", error);
    response.status(503).json({ error: "Simulacao temporariamente indisponivel" });
  }
});

app.use(express.static(path.join(root, "dist")));
app.use((_request, response) => {
  response.sendFile(path.join(root, "dist", "index.html"));
});

app.listen(port, "0.0.0.0", () => {
  console.log(`DM2 DRE disponivel na porta ${port}`);
});
