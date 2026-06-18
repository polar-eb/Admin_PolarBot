const axios = require("axios");
const express = require("express");
const app = express();
const PANEL_PASSWORD = "7221";
const COOKIE = process.env.ROBLOX_COOKIE;
const GROUP_ID = 510091211;

const RANKS = [
  { name: "[R] Recruta", rank: 1 },
  { name: "[SD] Soldado", rank: 2 },
  { name: "[SD1] Soldado de 1a Classe", rank: 3 },
  { name: "[CB] Cabo", rank: 5 },
  { name: "[SG] Sargento", rank: 7 },
  { name: "[3SG] 3 Sargento", rank: 8 },
  { name: "[2SG] 2 Sargento", rank: 9 },
  { name: "[1SG] 1 Sargento", rank: 10 },
  { name: "[ST] Subtenente", rank: 11 },
  { name: "[ASP] Aspirante a Oficial", rank: 12 },
  { name: "[ASP-EL] Aspirante de Elite", rank: 13 },
  { name: "[2T] 2 Tenente", rank: 14 },
  { name: "[1T] 1 Tenente", rank: 15 },
  { name: "[CAP] Capitao", rank: 16 },
  { name: "[CAP-EL] Capitao de Elite", rank: 17 },
  { name: "[MAJ] Major", rank: 18 },
  { name: "[TC] Tenente-Coronel", rank: 19 },
  { name: "[CEL] Coronel", rank: 20 },
  { name: "[CEL-EL] Coronel de Elite", rank: 21 },
  { name: "[GEN] General", rank: 22 },
  { name: "[GEN-BR] General de Brigada", rank: 23 },
  { name: "[GEN-DIV] General de Divisao", rank: 24 },
  { name: "[GEN-EX] General de Exercito", rank: 25 },
  { name: "[GEN-MAX] General Maximo", rank: 26 },
  { name: "[SCMD] Subcomandante", rank: 28 },
  { name: "[CMD] Comandante", rank: 29 },
  { name: "[CMD-X] Comandante Absoluto", rank: 30 },
  { name: "[STF] Staff", rank: 31 },
  { name: "[IMP] Imperador", rank: 33 },
  { name: "[DOM] Dominador Nacional", rank: 33 },
  { name: "[CR3] 3 Criador", rank: 230 },
  { name: "[YOU] Youtuber", rank: 235 },
  { name: "[CRE] Criador Evento", rank: 240 },
  { name: "[SB] Seguranca do EB", rank: 250 },
  { name: "[ARC] Arquiteto de Guerra", rank: 251 },
  { name: "[SCR] Sub Criador", rank: 252 },
  { name: "[CR] 2 Criador", rank: 254 },
  { name: "[CR] 1 Criador", rank: 255 },
];

const promotionLog = {};
let participantesEvento = [];

function getWeekKey() {
  const now = new Date();
  const week = Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000));
  return week.toString();
}

async function getCsrfToken() {
  try {
    await axios.post("https://auth.roblox.com/v2/logout", {}, {
      headers: { Cookie: `.ROBLOSECURITY=${COOKIE}` }
    });
  } catch (e) {
    return e.response?.headers?.["x-csrf-token"];
  }
}

async function getGroupMembers() {
  const res = await axios.get(
    `https://groups.roblox.com/v1/groups/${GROUP_ID}/users?limit=100&sortOrder=Asc`,
    { headers: { Cookie: `.ROBLOSECURITY=${COOKIE}` } }
  );
  return res.data.data || [];
}

async function getPendingMembers(csrf) {
  const res = await axios.get(
    `https://groups.roblox.com/v1/groups/${GROUP_ID}/join-requests?limit=100`,
    { headers: { Cookie: `.ROBLOSECURITY=${COOKIE}`, "X-CSRF-Token": csrf } }
  );
  return res.data.data || [];
}

async function acceptMember(userId, csrf) {
  await axios.post(
    `https://groups.roblox.com/v1/groups/${GROUP_ID}/join-requests/users/${userId}`,
    {},
    { headers: { Cookie: `.ROBLOSECURITY=${COOKIE}`, "X-CSRF-Token": csrf } }
  );
}

async function getRoles() {
  const res = await axios.get(`https://groups.roblox.com/v1/groups/${GROUP_ID}/roles`);
  return res.data.roles;
}

async function setUserRank(userId, roleId, csrf) {
  await axios.patch(
    `https://groups.roblox.com/v1/groups/${GROUP_ID}/users/${userId}`,
    { roleId },
    { headers: { Cookie: `.ROBLOSECURITY=${COOKIE}`, "X-CSRF-Token": csrf } }
  );
}

async function monitorAndEnforce(csrf) {
  const members = await getGroupMembers();
  const roles = await getRoles();
  const week = getWeekKey();

  const recrutaRole = roles.find(r => r.rank === 1);
  if (!recrutaRole) return;

  for (const member of members) {
    const userId = member.user.userId;
    const currentRank = member.role.rank;

    if (!promotionLog[userId]) {
      promotionLog[userId] = { lastRank: currentRank, week: week, promoted: [], oldRanks: {} };
    }

    const log = promotionLog[userId];
    const lastRank = log.lastRank;

    // Detectou mudanca de patente feita por esse usuario
    if (currentRank > lastRank && currentRank >= 20 && currentRank <= 33) {
      if (log.week !== week) {
        log.week = week;
        log.promoted = [];
        log.oldRanks = {};
      }

      // Registra quem foi promovido por esse usuario (simulado — rastreamos quem mudou)
      log.promoted.push({ userId, oldRank: lastRank });
      log.oldRanks[userId] = lastRank;

      if (log.promoted.length > 4) {
        console.log(`VIOLACAO: usuario ${userId} promoveu mais de 4 pessoas! Rebaixando...`);

        // Rebaixa o infrator para Recruta
        await setUserRank(userId, recrutaRole.id, csrf);
        console.log(`Usuario ${userId} rebaixado para Recruta`);

        // Desfaz todas as promocoes
        for (const p of log.promoted) {
          const oldRole = roles.find(r => r.rank === p.oldRank);
          if (oldRole) {
            await setUserRank(p.userId, oldRole.id, csrf);
            console.log(`Revertido usuario ${p.userId} para rank ${p.oldRank}`);
          }
        }

        log.promoted = [];
        log.oldRanks = {};
      }
    }

    log.lastRank = currentRank;
  }
}

async function run() {
  console.log("Bot do EB iniciado!");

  const csrf = await getCsrfToken();
  if (!csrf) {
    console.log("Erro: cookie invalido!");
    return;
  }

  console.log("CSRF token obtido com sucesso!");

  // Aceitar membros pendentes a cada 30 segundos
  setInterval(async () => {
    try {
      const csrf = await getCsrfToken();
const pending = await getPendingMembers(csrf);
      for (const req of pending) {
        await acceptMember(req.requester.userId, csrf);
        console.log(`Aceito: ${req.requester.username}`);
        // Promover para Soldado
const roles = await getRoles();
const soldadoRole = roles.find(r => r.rank === 2);

if (soldadoRole) {
  await setUserRank(req.requester.userId, soldadoRole.id, csrf);
  console.log(`${req.requester.username} promovido para [SD] Soldado`);
}
      }
    } catch (e) {
     console.log("Erro ao aceitar membros:");
console.log("Status:", e.response?.status);
console.log("Data:", e.response?.data);
console.log("Mensagem:", e.message);
    }
  }, 30000);

  // Monitorar patentes a cada 2 minutos
  setInterval(async () => {
    try {
      await monitorAndEnforce(csrf);
    } catch (e) {
      console.log("Erro ao monitorar:");
console.log("Status:", e.response?.status);
console.log("Data:", e.response?.data);
console.log("Mensagem:", e.message);
    }
  }, 120000);
}

async function getUserId(username) {
  const res = await axios.post(
    "https://users.roblox.com/v1/usernames/users",
    {
      usernames: [username],
      excludeBannedUsers: true
    }
  );

  return res.data.data[0]?.id;
}
run();

app.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Painel do EB</title>
      </head>
      <body style="font-family: Arial; text-align:center; margin-top:50px;">
        <h1>🪖 Painel do EB</h1>

        <form action="/login" method="get">
          <input
            type="password"
            name="password"
            placeholder="Digite a senha"
            style="padding:10px;"
          >
          <br><br>
          <button type="submit">Entrar</button>
        </form>
      </body>
    </html>
  `);
});
app.get("/login", (req, res) => {
  if (req.query.password !== PANEL_PASSWORD) {
    return res.send(`
      <h1>❌ Senha incorreta</h1>
      <a href="/">Voltar</a>
    `);
  }

  res.send(`
<html>
<head>
<title>Painel do EB</title>
</head>

<body style="font-family: Arial; text-align:center; margin-top:50px;">

<h1>🪖 Sistema de Eventos EB</h1>

<form action="/adicionar" method="get">
  <p>Jogador:</p>

  <input
  type="text"
  name="jogador"
  placeholder="Digite o nome do jogador"
  style="padding:10px;"
  autofocus
>

  <br><br>

<p>Patentes para promover:</p>

<input
  type="number"
  name="quantidade"
  value="1"
  min="1"
  max="20"
  style="padding:10px;"
>

  <button type="submit">Enviar</button>
</form>

<hr style="width:50%;">

<h2>📋 Histórico de Eventos</h2>

<p>Nenhum evento registrado.</p>

<hr style="width:50%;">

<h3>🤖 Status</h3>
<p>Bot Online ✅</p>

</body>
</html>
`);
  });

app.get("/adicionar", (req, res) => {
  const jogador = req.query.jogador;

  if (jogador && jogador.trim() !== "") {
    participantesEvento.push(jogador.trim());
    console.log(`Adicionado ao evento: ${jogador}`);
  }

  res.send(`
    <h2>✅ ${jogador} adicionado!</h2>
    <a href="/login?password=${PANEL_PASSWORD}">Voltar ao painel</a>
  `);
});

app.get("/promoverEvento", async (req, res) => {
  try {
    const quantidade = parseInt(req.query.quantidade) || 1;

    const csrf = await getCsrfToken();
    const roles = await getRoles();
    const members = await getGroupMembers();

    for (const nome of participantesEvento) {

      const userId = await getUserId(nome);

      if (!userId) continue;

      const member = members.find(
        m => m.user.userId === userId
      );

      if (!member) continue;

      const rankAtual = member.role.rank;

      const rankDesejado = rankAtual + quantidade;

      let novaRole = roles.find(
        r => r.rank === rankDesejado
      );

      if (!novaRole) {
        novaRole = roles
          .filter(r => r.rank > rankDesejado)
          .sort((a, b) => a.rank - b.rank)[0];
      }

      if (!novaRole) continue;

      await setUserRank(userId, novaRole.id, csrf);

      console.log(
        `${nome}: ${rankAtual} -> ${novaRole.rank}`
      );
    }

    participantesEvento = [];

    res.send("✅ Evento finalizado! Todos promovidos.");
  } catch (e) {
    console.log(e);
    res.send("❌ Erro ao promover.");
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Painel online!");
});
