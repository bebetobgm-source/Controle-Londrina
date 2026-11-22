import express from 'express';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initializeApp, getApps, getApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carregar firestoreDatabaseId do firebase-applet-config.json
const firebaseAppletConfigPath = path.join(__dirname, 'firebase-applet-config.json');
const firebaseAppletConfig = JSON.parse(fs.readFileSync(firebaseAppletConfigPath, 'utf8'));
const databaseId = firebaseAppletConfig.firestoreDatabaseId;

function obterFirebaseAdmin() {
  if (getApps().length > 0) {
    const appExistente = getApp();
    return {
      adminApp: appExistente,
      adminDb: databaseId ? getFirestore(appExistente, databaseId) : getFirestore(appExistente),
      adminAuth: getAuth(appExistente)
    };
  }

  let adminApp;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    adminApp = initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id || firebaseAppletConfig.projectId
    });
  } else {
    adminApp = initializeApp({
      projectId: firebaseAppletConfig.projectId
    });
  }

  return {
    adminApp,
    adminDb: databaseId ? getFirestore(adminApp, databaseId) : getFirestore(adminApp),
    adminAuth: getAuth(adminApp)
  };
}

function mapearEventoKiwify(eventoRaw) {
  const ev = String(eventoRaw || '').trim().toLowerCase();
  if (
    [
      'compra_aprovada',
      'order_approved',
      'paid',
      'approved',
      'subscription_renewed'
    ].includes(ev)
  ) {
    return 'active';
  }
  if (['subscription_late', 'late'].includes(ev)) {
    return 'late';
  }
  if (['subscription_canceled', 'canceled'].includes(ev)) {
    return 'canceled';
  }
  if (
    [
      'compra_reembolsada',
      'order_refunded',
      'refunded',
      'chargeback',
      'chargedback'
    ].includes(ev)
  ) {
    return 'refunded';
  }
  return null;
}

function resolverEventoEStatusKiwify(body) {
  const webhookEvent = String(body?.webhook_event_type || '').trim().toLowerCase();
  const statusFromEvent = mapearEventoKiwify(webhookEvent);
  if (statusFromEvent) {
    return { evento: webhookEvent, statusMapeado: statusFromEvent };
  }

  const orderStatus = String(body?.order_status || '').trim().toLowerCase();
  const statusFromOrder = mapearEventoKiwify(orderStatus);
  if (statusFromOrder) {
    return { evento: orderStatus, statusMapeado: statusFromOrder };
  }

  return {
    evento: webhookEvent || orderStatus,
    statusMapeado: null
  };
}

function detectarPlanoKiwify(body) {
  const alvoAnual = String(process.env.KIWIFY_PLANO_ANUAL_ID || '').trim().toLowerCase();
  const candidatos = [
    body?.Subscription?.plan?.id,
    body?.Subscription?.plan?.name,
    body?.Subscription?.plan?.frequency,
    body?.Product?.product_id,
    body?.Product?.product_name,
    body?.plan_id,
    body?.plan_name
  ]
    .filter(Boolean)
    .map(v => String(v).trim().toLowerCase());

  if (alvoAnual && candidatos.some(c => c === alvoAnual || c.includes(alvoAnual))) {
    return 'anual';
  }
  if (!alvoAnual && candidatos.some(c => c.includes('anual') || c.includes('annual') || c.includes('year'))) {
    return 'anual';
  }
  return 'mensal';
}

function calcularCurrentPeriodEnd(proximaCobrancaRaw, plano, statusMapeado) {
  if (proximaCobrancaRaw) {
    const parsed = new Date(proximaCobrancaRaw);
    if (!isNaN(parsed.getTime())) {
      return Timestamp.fromDate(parsed);
    }
  }
  if (statusMapeado === 'active') {
    const dias = plano === 'anual' ? 366 : 31;
    return Timestamp.fromDate(new Date(Date.now() + dias * 24 * 60 * 60 * 1000));
  }
  return null;
}

async function aplicarEventoNaAssinatura(adminDb, familyId, dadosEvento) {
  const subRef = adminDb.collection('subscriptions').doc(familyId);
  const subSnap = await subRef.get();
  const existente = subSnap.exists ? subSnap.data() : {};

  const eventosAnteriores = Array.isArray(existente?.eventosProcessados)
    ? existente.eventosProcessados
    : [];

  const dataReferencia = String(dadosEvento.dataReferencia || '').trim();
  const chaveIdempotencia = `${dadosEvento.orderId}:${dadosEvento.evento}:${dataReferencia}`;
  if (dadosEvento.orderId && eventosAnteriores.includes(chaveIdempotencia)) {
    return { ignoradoPorIdempotencia: true };
  }

  const novosEventos = dadosEvento.orderId
    ? [...eventosAnteriores, chaveIdempotencia].slice(-30)
    : eventosAnteriores.slice(-30);

  const novoPeriodEnd =
    dadosEvento.currentPeriodEnd ||
    existente?.currentPeriodEnd ||
    null;

  const trialEndsAt =
    existente?.trialEndsAt ||
    Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

  await subRef.set(
    {
      status: dadosEvento.status,
      plano: dadosEvento.plano || existente?.plano || 'mensal',
      trialEndsAt,
      currentPeriodEnd: novoPeriodEnd,
      buyerEmail: dadosEvento.buyerEmail || existente?.buyerEmail || '',
      kiwifyOrderId: dadosEvento.orderId || existente?.kiwifyOrderId || '',
      kiwifySubscriptionId: dadosEvento.subscriptionId || existente?.kiwifySubscriptionId || '',
      eventosProcessados: novosEventos,
      updatedAt: Timestamp.now()
    },
    { merge: true }
  );

  return { ignoradoPorIdempotencia: false };
}

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// 1. ROTA WEBHOOK KIWIFY (ANTES do express.static e do fallback '*')
// ---------------------------------------------------------------------------
app.post(
  '/api/kiwify/webhook/:segredo',
  express.raw({ type: '*/*' }),
  async (req, res) => {
    try {
      const segredoEsperado = process.env.KIWIFY_WEBHOOK_SECRET;
      if (!segredoEsperado || req.params.segredo !== segredoEsperado) {
        return res.status(401).json({ ok: false, error: 'Segredo inválido' });
      }

      const rawBuffer = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}), 'utf8');

      // Validação HMAC-SHA1 opcional se vier ?signature= e existir KIWIFY_TOKEN
      const signatureQuery = req.query.signature ? String(req.query.signature) : '';
      if (signatureQuery && process.env.KIWIFY_TOKEN) {
        const hmacHex = crypto
          .createHmac('sha1', process.env.KIWIFY_TOKEN)
          .update(rawBuffer)
          .digest('hex');

        const sigBuf = Buffer.from(signatureQuery, 'utf8');
        const expBuf = Buffer.from(hmacHex, 'utf8');
        if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
          return res.status(401).json({ ok: false, error: 'Assinatura HMAC inválida' });
        }
      }

      let body = {};
      try {
        body = JSON.parse(rawBuffer.toString('utf8') || '{}');
      } catch {
        body = {};
      }

      const { adminDb } = obterFirebaseAdmin();

      const { evento, statusMapeado } = resolverEventoEStatusKiwify(body);
      const buyerEmail = String(body.Customer?.email || body.customer?.email || '').trim().toLowerCase();
      const srcFamilyId = String(body.TrackingParameters?.src || body.tracking_parameters?.src || '').trim();
      const orderId = String(body.order_id || body.id || `ord-${Date.now()}`).trim();
      const subscriptionId = String(body.Subscription?.id || body.subscription_id || '').trim();
      const proximaCobranca = body.Subscription?.next_payment || body.next_payment || null;
      const dataReferencia = String(
        body.Subscription?.next_payment || body.approved_date || body.updated_at || ''
      ).trim();

      // Gravar sempre o corpo recebido em webhookLog/{autoId} com data para depuração
      await adminDb.collection('webhookLog').add({
        data: Timestamp.now(),
        evento,
        orderId,
        buyerEmail,
        srcFamilyId,
        payload: body
      });

      if (!statusMapeado) {
        return res.status(200).json({ ok: true, ignored: true, reason: 'evento_nao_mapeado' });
      }

      const plano = detectarPlanoKiwify(body);
      const currentPeriodEnd = calcularCurrentPeriodEnd(proximaCobranca, plano, statusMapeado);

      // Localizar a família: 1º families/{src}; 2º users onde email == Customer.email
      let targetFamilyId = null;

      if (srcFamilyId) {
        const famSnap = await adminDb.collection('families').doc(srcFamilyId).get();
        if (famSnap.exists) {
          targetFamilyId = srcFamilyId;
        }
      }

      if (!targetFamilyId && buyerEmail) {
        const usersSnap = await adminDb
          .collection('users')
          .where('email', '==', buyerEmail)
          .limit(1)
          .get();

        if (!usersSnap.empty) {
          const userData = usersSnap.docs[0].data();
          if (userData?.familyId) {
            targetFamilyId = userData.familyId;
          }
        }
      }

      const dadosEvento = {
        status: statusMapeado,
        plano,
        currentPeriodEnd,
        buyerEmail,
        orderId,
        subscriptionId,
        evento,
        dataReferencia
      };

      if (!targetFamilyId) {
        await adminDb.collection('pendingPurchases').doc(orderId).set(
          {
            ...dadosEvento,
            createdAt: Timestamp.now()
          },
          { merge: true }
        );
        return res.status(200).json({ ok: true, pending: true, orderId });
      }

      const resultado = await aplicarEventoNaAssinatura(adminDb, targetFamilyId, dadosEvento);
      return res.status(200).json({
        ok: true,
        familyId: targetFamilyId,
        idempotentIgnored: resultado.ignoradoPorIdempotencia
      });
    } catch (err) {
      console.error('Erro no webhook Kiwify:', err);
      return res.status(500).json({ ok: false, error: 'Erro interno ao processar webhook' });
    }
  }
);

// ---------------------------------------------------------------------------
// 2. ROTA POST /api/claim (Valida ID token Firebase e aplica pendingPurchases)
// ---------------------------------------------------------------------------
app.post('/api/claim', express.json(), async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
      return res.status(401).json({ ok: false, error: 'Token ausente' });
    }

    const { adminDb, adminAuth } = obterFirebaseAdmin();
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const email = (decoded.email || '').trim().toLowerCase();

    if (!email) {
      return res.status(200).json({ ok: true, claimed: 0 });
    }

    // Descobrir familyId exclusivamente a partir de users/{uid} (ignora req.body.familyId)
    let familyId = null;
    const userRef = adminDb.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (userSnap.exists) {
      const uData = userSnap.data();
      if (uData?.familyId) {
        familyId = String(uData.familyId).trim();
      }
      if (uData?.email !== email) {
        await userRef.set({ email }, { merge: true });
      }
    }

    if (!familyId) {
      return res.status(200).json({ ok: true, claimed: 0, reason: 'sem_familia' });
    }

    const pendingSnap = await adminDb
      .collection('pendingPurchases')
      .where('buyerEmail', '==', email)
      .get();

    if (pendingSnap.empty) {
      return res.status(200).json({ ok: true, claimed: 0 });
    }

    let claimedCount = 0;
    for (const docSnap of pendingSnap.docs) {
      const pData = docSnap.data();
      await aplicarEventoNaAssinatura(adminDb, familyId, {
        status: pData.status || 'active',
        plano: pData.plano || 'mensal',
        currentPeriodEnd: pData.currentPeriodEnd || null,
        buyerEmail: email,
        orderId: pData.orderId || docSnap.id,
        subscriptionId: pData.kiwifySubscriptionId || pData.subscriptionId || '',
        evento: pData.evento || 'compra_aprovada',
        dataReferencia: pData.dataReferencia || ''
      });
      await docSnap.ref.delete();
      claimedCount++;
    }

    return res.status(200).json({ ok: true, claimed: claimedCount, familyId });
  } catch (err) {
    console.error('Erro em POST /api/claim:', err);
    return res.status(200).json({ ok: false, claimed: 0 });
  }
});

// Proxy do login do Google (Firebase Auth) pelo próprio domínio.
// Assim a tela do Google mostra "Prosseguir para casalnoazul.com.br" em vez do domínio firebaseapp.com.
// Requer no Google Cloud o redirect URI https://casalnoazul.com.br/__/auth/handler (já cadastrado).
const FIREBASE_AUTH_HOST = `https://${firebaseAppletConfig.authDomain}`;
app.all(['/__/auth/*', '/__/firebase/*'], async (req, res) => {
  try {
    const destino = FIREBASE_AUTH_HOST + req.originalUrl;
    const cabecalhos = { ...req.headers };
    delete cabecalhos.host;
    delete cabecalhos.connection;
    delete cabecalhos['content-length'];
    const temCorpo = !['GET', 'HEAD'].includes(req.method);
    const resposta = await fetch(destino, {
      method: req.method,
      headers: cabecalhos,
      body: temCorpo ? req : undefined,
      duplex: temCorpo ? 'half' : undefined,
      redirect: 'manual'
    });
    res.status(resposta.status);
    resposta.headers.forEach((valor, chave) => {
      const k = chave.toLowerCase();
      if (['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(k)) return;
      if (k === 'set-cookie') return;
      res.setHeader(chave, valor);
    });
    const cookies = typeof resposta.headers.getSetCookie === 'function' ? resposta.headers.getSetCookie() : [];
    if (cookies.length) res.setHeader('set-cookie', cookies);
    const corpo = Buffer.from(await resposta.arrayBuffer());
    res.end(corpo);
  } catch (err) {
    console.error('Erro no proxy de autenticação:', err);
    res.status(502).send('Falha temporária no login. Tente novamente.');
  }
});

// Servir os arquivos estáticos gerados pelo Vite (pasta dist)
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// Fallback SPA: qualquer requisição retorna o index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor Express rodando com sucesso na porta ${PORT}`);
});
