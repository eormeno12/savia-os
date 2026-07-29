# 09 — Módulo de pagos (Mercado Pago Subscriptions): qué definir en el backend

> **Propósito:** el blueprint de lo que el backend **debe definir** para cerrar el gap
> `Suscripción / freemium (Mercado Pago)` del [README §3](README.md) — hoy 100%
> `localStorage` falsificable ([use-subscription.ts](../../../../apps/app/src/lib/use-subscription.ts)).
> **Doc autocontenido — todo el módulo está acá:** la **definición en el contexto de Savia** (modelo
> de datos, contrato HTTP, máquina de estados, **enforcement server-side**, garantías de integridad:
> idempotencia, firma, atomicidad, default-deny) **+ la implementación de referencia (MP API)
> consolidada en §9**. Absorbe el how-to de
> [`mercadopago-subscriptions.md`](../../../plan/mercadopago-subscriptions.md), que queda como
> referencia histórica.
>
> **Encaja con `05`:** el modelo objetivo de [05-rediseno-estructural.md](05-rediseno-estructural.md)
> ya reserva *billing + outbox*; este doc lo aterriza.

---

## 0. La tesis de seguridad (no negociable)

> **El freemium se enforced en el backend, no en el modal.** Hoy el único gate es el frontend
> ([subscription-gate.tsx](../../../../apps/app/src/components/billing/subscription-gate.tsx)). Un
> usuario que saltee el modal y pegue directo a `POST /connections` o al gateway MCP **conecta su IA
> gratis**. Igual que el [P0-1 IDOR](README.md#2-top-riesgos-p0-seguridadintegridad) del audit: la
> autorización vive en el servidor o no existe. **El plan se verifica en cada capacidad gateada.**

Tres principios:

1. **El estado del plan es del backend, reconciliado con MP.** El frontend nunca decide si pagaste;
   solo refleja `GET /billing/subscription`. Borrar el flag `localStorage` es parte del entregable.
2. **El webhook es la fuente de verdad de los cobros.** El front jamás se entera de un cobro
   recurrente; el backend lo recibe, valida la firma, y actualiza el plan.
3. **Idempotencia y atomicidad** como en el resto del backend: MP entrega webhooks *at-least-once*
   (duplicados garantizados) y la actualización del plan toca varias filas — debe ser transaccional
   y deduplicada por `event id`.

---

## 1. Modelo de datos (Prisma) — qué agregar

El `User` actual ([schema.prisma:32](../../../../apps/api/prisma/schema.prisma#L32)) **no tiene
ningún campo de plan**. Definir:

```prisma
enum Plan {
  free
  pro
}

enum SubscriptionStatus {
  none        // nunca se suscribió
  pending     // creó la preapproval, aún no pagó (init_point emitido)
  active      // authorized en MP → acceso pro
  paused      // pausada (reintentos / pausa manual)
  cancelled   // cancelada (gracia hasta nextPaymentAt; luego free)
  failed      // pago fallido definitivo
}

model User {
  // …campos existentes…
  plan         Plan          @default(free)   // el booleano de acceso que leen los guards
  subscription Subscription?
}

model Subscription {
  id              String              @id @default(uuid())
  userId          String              @unique
  user            User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  mpPreapprovalId String?             @unique   // preapproval id de MP (external_reference = userId)
  status          SubscriptionStatus  @default(none)
  planType        String              // 'monthly' | 'annual'
  amount          Decimal             @db.Decimal(10, 2)
  currency        String              // 'ARS' | 'USD' | …
  startedAt       DateTime?
  nextPaymentAt   DateTime?           // próximo cobro (de MP); fin de gracia si cancelled
  cancelledAt     DateTime?
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt
  payments        Payment[]

  @@index([status])
}

model Payment {
  id             String       @id @default(uuid())
  subscriptionId String
  subscription   Subscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)
  mpPaymentId    String       @unique           // dedup de cobros
  status         String       // approved | rejected | refunded | pending
  amount         Decimal      @db.Decimal(10, 2)
  currency       String
  paidAt         DateTime?
  createdAt      DateTime     @default(now())
}

/// Idempotencia de webhooks: MP entrega at-least-once. Antes de procesar un
/// evento, insertar su id aquí; si ya existe, descartar (no reprocesar).
model WebhookEvent {
  id          String   @id              // data.id / x-request-id del evento MP
  type        String
  processedAt DateTime @default(now())
}
```

**Decisiones a tomar** (no las cierra este doc):
- ¿`plan` derivado de `Subscription.status` (single source) o columna materializada? → recomiendo
  **columna materializada en `User.plan`** (lectura O(1) en los guards) que el webhook mantiene en
  sync dentro de la transacción.
- ¿Guardar `Payment` siempre o solo para el historial de CT2? → recomiendo guardarlos (CT2 lo pide).
- **Precio (decisión D4):** **$11.99/mes**, cobrable en **USD o moneda local por país**, **sin plan anual**.
  → crear **un plan mensual por moneda/país** en MP con ese monto (no usar los $9.99/$99.99 del how-to ni el plan anual). El front ya no necesita `planType: 'annual'`.

---

## 2. El contrato HTTP que el frontend consume (la frontera)

Esto es el **único acoplamiento** front↔back. El frontend ya se va a construir contra esto; el
refactor del backend debe exponerlo **tal cual**. Todos `@UseGuards(JwtAuthGuard)`.

| Método | Ruta | Body → Respuesta | Para qué (pantalla) |
|---|---|---|---|
| `POST` | `/billing/subscription` | `{ plan: 'monthly' \| 'annual' }` → `{ initPoint: string }` | SB1 gate → `window.location.href = initPoint` |
| `GET` | `/billing/subscription` | → `SubscriptionDto` | SB1 (¿gateado?) + CT2 (estado) |
| `POST` | `/billing/subscription/cancel` | → `{ ok: true }` | CT2 cancelar |
| `POST` | `/billing/subscription/reactivate` | → `{ ok: true }` | CT2 reactivar |
| `GET` | `/billing/payments` | → `BillingRow[]` | CT2 historial de facturación |
| `POST` | `/webhooks/mercadopago` | (firma HMAC) → `200` | cobros MP — **público, sin JWT, no lo toca el front** |

```ts
// Contrato a publicar en @savia-os/contracts (el front lo importa, no lo redeclara —
// evita el drift que el audit marcó en SpaceDto, README §3).
type SubscriptionStatus = 'none' | 'pending' | 'active' | 'paused' | 'cancelled' | 'failed';

interface SubscriptionDto {
  status: SubscriptionStatus;
  planType: 'monthly' | 'annual' | null;
  amount: number | null;
  currency: string | null;
  nextPaymentAt: string | null;   // ISO; en 'cancelled' = fin de la gracia
  paymentMethod: { brand: string; last4: string } | null;
}

interface BillingRow {
  id: string;
  date: string;        // ISO
  period: string;      // 'jun 2026'
  amount: number;
  currency: string;
  status: 'approved' | 'rejected' | 'refunded' | 'pending';
  receiptUrl: string | null;
}
```

> `status` mapea 1:1 a los **5 estados de CT2** del [mockup-v2](../../../plan/savia-redesign/mockup-v2.md)
> (sin suscripción / activa / cancelada-con-gracia / cancelada-sin-gracia / pago-fallido). El front
> ya está diseñado para esos estados.

---

## 3. El `BillingService` — responsabilidades

El **código de referencia** está consolidado abajo en **§9**. Lo que el módulo **debe garantizar**:

| Método | Responsabilidad | Garantía |
|---|---|---|
| `createSubscription(userId, plan)` | `POST /preapproval` con `preapproval_plan_id`, `payer_email`, `external_reference=userId`, `back_url`. Persiste `Subscription{status:pending}`. Devuelve `initPoint`. | `external_reference = userId` para reconciliar. |
| `getStatus(userId)` | **Reconcilia con MP** (`GET /preapproval/{id}`) antes de responder — no confíes solo en la DB. | El audit: "reconcilia con el estado real en MP". |
| `cancel(userId)` | `PUT /preapproval/{id} {status:'cancelled'}` + `User.plan=free` al fin de gracia. | Irreversible en MP (nueva suscripción para volver). |
| `reactivate(userId)` | `PUT /preapproval/{id} {status:'authorized'}`. | Solo si la gracia no venció. |
| `listPayments(userId)` | `GET /v1/payments/search?external_reference=userId` o lee `Payment[]`. | Para CT2. |
| `handleWebhook(event)` | **El corazón** — §4. | Idempotente, firmado, transaccional. |

---

## 4. El webhook (lo crítico) — qué definir

`POST /webhooks/mercadopago`, **público** (sin JWT), responde `200` en <22s. Debe definir, en orden:

1. **Verificación de firma HMAC** (`x-signature` + `x-request-id` + `MP_WEBHOOK_SECRET`). Si no
   valida → `401`. *(El audit ya marcó "seguridad opt-in"; este endpoint es público, la firma es la
   única defensa.)*
2. **Idempotencia**: `INSERT WebhookEvent{id}` dentro de la transacción; si choca el PK → ya
   procesado, descartar y `200`. MP reenvía duplicados garantizado.
3. **Switch por `type`** → mutación **transaccional** de `Subscription` + `User.plan` + `Payment`:
   - `subscription_preapproval` (status `authorized`) → `status:active`, `User.plan:pro`, `startedAt`.
   - `subscription_authorized_payment`:
     - `approved` → `renew`: `nextPaymentAt`, push `Payment`.
     - `recycling` (reintento) → **no degradar acceso**; solo loguear. *(4 reintentos / 10 días.)*
     - rechazo definitivo → tras **3 cuotas** consecutivas, MP cancela → `status:failed`, `plan:free`.
   - `subscription_preapproval` (status `cancelled`/`paused`) → reflejar estado.
4. **Procesamiento pesado a cola** si pasa de ~22s: el audit ya recomienda Bull/Redis y marcó la
   falta de `worker.close()` ([README §1 ingest](README.md)). El webhook ack-ea rápido y encola.

> **Atomicidad (P0-2 del audit):** la mutación `Subscription + User.plan + Payment` debe ser una
> `$transaction` (o el patrón **outbox** que `05` propone). No replicar el problema de
> "Qdrant primero, Postgres después sin reconciliación".

---

## 5. Enforcement server-side — dónde gatea el plan (lo que falta hoy)

El freemium gatea **conectar IAs + actividad en vivo + que las IAs lean/recuerden**
([mockup-v2 §modelo de negocio](../../../plan/savia-redesign/mockup-v2.md)). Eso son endpoints
reales, no el modal. **Definir un `RequirePlan('pro')` (guard/decorator) y aplicarlo en:**

| Capacidad gateada | Endpoint / punto | Hoy |
|---|---|---|
| Crear una conexión de IA | `POST /connections` ([connections.service.ts](../../../../apps/api/src/modules/connections/connections.service.ts)) | ❌ sin check de plan |
| Que la IA use la memoria (MCP) | gateway MCP `savia_search` / `savia_remember` ([mcp.tools.ts](../../../../apps/api/src/modules/mcp/mcp.tools.ts)) | ❌ sin check de plan del dueño |
| Actividad en vivo (Pulso) | `GET /growth/access-activity` y feed | ❌ |

**Decisión clave — ¿qué se desactiva al caer a `free`?** Recomendado (coherente con "tus IAs se
desconectarán" del copy):
- El **MCP gateway** verifica el `plan` del **dueño de la conexión** en cada llamada → si `free`,
  rechaza (las IAs dejan de leer/recordar al instante, incluso conexiones ya creadas).
- Crear conexión nueva requiere `pro`.
- La data del usuario **nunca se borra** al caer a free (el copy lo promete: "tu memoria está
  intacta") — solo se corta el acceso de las IAs.

> Sin esto, el paywall es decorativo. Este punto es el equivalente, para billing, del P0-1 del audit.

---

## 6. Configuración y setup (ops, no código)

```env
# apps/api/.env  (validar al boot con Joi — el audit marcó la falta, README §1 config)
MP_ACCESS_TOKEN=        # secreto, server-only (TEST- en sandbox)
MP_WEBHOOK_SECRET=      # firma de webhooks
MP_PLAN_MONTHLY_ID=     # de crear el plan, una sola vez
MP_PLAN_ANNUAL_ID=
MP_BACK_URL=            # https://app.savia.ai/billing/success
```

Pasos one-time (fuera del código de la app):
- [ ] Crear planes mensual/anual (`POST /preapproval_plan`) → guardar los IDs.
- [ ] Registrar la URL del webhook en el panel MP (`https://api.savia.ai/webhooks/mercadopago`),
      tópicos `subscription_preapproval`, `subscription_authorized_payment`, `payment`.
- [ ] `MP_BACK_URL` apunta al sitio real (no localhost).
- [ ] Validación de env al boot (no `OPENAI_API_KEY`-style silenciosa — README §1 config).

---

## 7. Checklist de "qué definir" antes de codear

**Modelo**
- [ ] `Plan` enum + `User.plan` materializado + `Subscription`, `Payment`, `WebhookEvent`.
- [ ] Migración Prisma + decisión de `onDelete` (cascade) coherente con la del resto del schema.

**Contrato**
- [ ] Los 5 endpoints REST + el webhook con los shapes de §2, publicados en `@savia-os/contracts`
      (que el front importe, no redeclare).

**Servicio**
- [ ] `BillingService` con reconciliación contra MP (no confiar en la DB).
- [ ] Webhook: firma + idempotencia (`WebhookEvent`) + transacción + lógica `recycling`/cancelación.

**Enforcement**
- [ ] `RequirePlan('pro')` aplicado en crear-conexión, MCP gateway (por dueño), y feed de Pulso.
- [ ] Comportamiento definido al caer a `free` (cortar acceso IA, **no** borrar data).

**Decisiones de producto**
- [ ] Precio y moneda(s) unificados ($11.99 SB1 vs $9.99 ARS del how-to).
- [ ] ¿Plan anual sí/no en V1? (el front ya soporta `planType: 'annual'`).
- [ ] Período de gracia al cancelar (hasta `nextPaymentAt`).

**Calidad**
- [ ] Probar el flujo completo en sandbox (usuario de prueba MP) antes de prod.
- [ ] El webhook responde <22s (encolar si es lento).

---

## 8. Lo que el frontend ya espera (referencia para el refactor)

Cuando el frontend de billing esté hecho (en paralelo a este backend), va a:
- Llamar `api.subscription.create(plan)` → redirigir a `initPoint`.
- Leer `api.subscription.status()` para el gate (SB1) y la pantalla de plan (CT2).
- **Borrar** `use-subscription.ts` (localStorage) y el `activate()` falso de `subscription-gate.tsx`.
- Tener una página `/billing/success` (el `back_url`).

El front falla **con gracia** (toast "no disponible aún") si el endpoint no existe todavía —
desacoplado de tu timeline. Cuando el refactor exponga §2, el front funciona sin cambios.

---

## 9. Implementación de referencia (MP API) — consolidada acá

> Absorbe el how-to de [`mercadopago-subscriptions.md`](../../../plan/mercadopago-subscriptions.md) para que **todo el módulo esté en este doc**. Scope V1 = plan mensual + anual; lo avanzado (trial, prorrateo, tarjeta secundaria, suscripción-sin-plan) en §9.7. *(Código de referencia; usa `mpFetch`/`env` como shorthands.)*

### 9.1 Crear los planes (one-time, fuera de la app)
```ts
// scripts/create-mp-plans.ts — correr UNA vez; guardar los IDs en .env
const createPlan = (body) => fetch('https://api.mercadopago.com/preapproval_plan', {
  method: 'POST',
  headers: { Authorization: `Bearer ${env.MP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
}).then(r => r.json());

const monthly = await createPlan({ reason: 'Plan Pro — Mensual',
  auto_recurring: { frequency: 1,  frequency_type: 'months', transaction_amount: 9.99,  currency_id: 'ARS' },
  back_url: env.MP_BACK_URL });   // → MP_PLAN_MONTHLY_ID
const annual  = await createPlan({ reason: 'Plan Pro — Anual',
  auto_recurring: { frequency: 12, frequency_type: 'months', transaction_amount: 99.99, currency_id: 'ARS' },
  back_url: env.MP_BACK_URL });   // → MP_PLAN_ANNUAL_ID
```
> Sin `billing_day` → MP cobra el día de suscripción y repite mensual/anual desde ahí, monto completo (sin prorrateo). **Unificar el precio** con SB1 ($11.99) antes de crearlos.

### 9.2 Iniciar suscripción — `POST /billing/subscription`
```ts
@Post('subscription') @UseGuards(JwtAuthGuard)
async create(@CurrentUser() u, @Body('plan') plan: 'monthly'|'annual') {
  const planId = plan === 'annual' ? env.MP_PLAN_ANNUAL_ID : env.MP_PLAN_MONTHLY_ID;
  const sub = await mpFetch('/preapproval', 'POST', {
    preapproval_plan_id: planId, payer_email: u.email,
    external_reference: u.id,               // ← reconcilia en el webhook
    back_url: env.MP_BACK_URL, status: 'pending',
  });
  await this.prisma.subscription.upsert({ where: { userId: u.id },
    create: { userId: u.id, mpPreapprovalId: sub.id, status: 'pending', planType: plan },
    update: { mpPreapprovalId: sub.id, status: 'pending', planType: plan } });
  return { initPoint: sub.init_point };
}
```

### 9.3 Webhook — firma + idempotencia + switch (transaccional)
```ts
@Post('webhooks/mercadopago')              // PÚBLICO (sin JWT) · responder 200 en <22s
async webhook(@Headers('x-signature') sig, @Headers('x-request-id') rid,
              @Query('data.id') dataId, @Body() body) {
  // 1) firma HMAC
  const ts = sig.match(/ts=([^,]+)/)?.[1], v1 = sig.match(/v1=(.+)/)?.[1];
  const expected = crypto.createHmac('sha256', env.MP_WEBHOOK_SECRET)
    .update(`id:${dataId};request-id:${rid};ts:${ts};`).digest('hex');
  if (expected !== v1) throw new UnauthorizedException();

  await this.prisma.$transaction(async (tx) => {
    // 2) idempotencia: PK choca ⇒ ya procesado ⇒ descartar
    try { await tx.webhookEvent.create({ data: { id: `${dataId}:${rid}`, type: body.type } }); }
    catch { return; }
    // 3) switch transaccional: Subscription + User.plan + Payment
    if (body.type === 'subscription_preapproval') {
      const sub = await mpFetch(`/preapproval/${body.data.id}`);            // reconcilia con MP
      await applyPreapprovalStatus(tx, sub);   // authorized→active/plan:pro · cancelled/paused→reflejar
    }
    if (body.type === 'subscription_authorized_payment') {
      const p = await mpFetch(`/authorized_payments/${body.data.id}`);
      if (p.status === 'processed' && p.payment?.status === 'approved') await renew(tx, p);   // nextPaymentAt + Payment
      else if (p.status === 'recycling') await logRetry(tx, p);            // NO degradar (4 reintentos/10d)
      else await maybeFail(tx, p);             // tras 3 cuotas consecutivas → status:failed, plan:free
    }
  });
  return { ok: true };
}
```
> Si el procesamiento pasa de ~22s → ack rápido y **encolar en BullMQ** (`Job`/outbox de la base, `08 §7`). La mutación es **una `$transaction`** — no replicar el P0-2 del audit ("Qdrant primero, Postgres después").

### 9.4 BillingService — reconciliación + ciclo de vida (`PUT /preapproval/{id}`)
| Acción | Método | Body del PUT a MP | Efecto local |
|---|---|---|---|
| **Estado** | `getStatus` (reconcilia con `GET /preapproval/{id}`) | — | nunca confiar solo en la DB |
| **Cancelar** | `cancel` | `{status:'cancelled'}` | `plan:free` al fin de gracia (irreversible en MP) |
| **Reactivar** | `reactivate` | `{status:'authorized'}` | solo si la gracia no venció |
| **Pausar** | `pause` | `{status:'paused'}` | `plan:paused` |
| **Cambiar monto** | `changeAmount` | `{auto_recurring:{transaction_amount, currency_id}}` | MP notifica al usuario |
| **Tarjeta secundaria** | `addSecondaryPayment` | `{card_token_id_secondary, payment_method_id_secondary}` | fallback de cobro automático |

```ts
private updateSub = (id, body) => mpFetch(`/preapproval/${id}`, 'PUT', body);   // base de todas
async cancel(userId) {
  const s = await this.prisma.subscription.findUniqueOrThrow({ where: { userId } });
  await this.updateSub(s.mpPreapprovalId, { status: 'cancelled' });
  await this.prisma.$transaction([ /* User.plan=free al fin de gracia · Subscription.status=cancelled */ ]);
}
async getStatus(userId) {                          // SIEMPRE reconcilia, no confíes en la DB
  const s = await this.prisma.subscription.findUnique({ where: { userId } });
  if (!s?.mpPreapprovalId) return { status: 'none' };
  const mp = await mpFetch(`/preapproval/${s.mpPreapprovalId}`);
  return toSubscriptionDto(s, mp);                 // status/nextPaymentAt/amount/currency
}
```

### 9.5 Endpoints MP de consulta
`GET /preapproval/{id}` (estado) · `GET /preapproval/search?external_reference={userId}` · `GET /authorized_payments/{id}` · `GET /v1/payments/search?external_reference={userId}` (historial CT2).

### 9.6 Sandbox + salida a producción
- **Sandbox:** usuario de prueba (`create_test_user`) + `add_money_test_user`; credenciales `TEST-`; validar que el webhook llega y la firma valida.
- **Prod:** planes creados (IDs en env) · `back_url` real (no localhost) · webhook registrado en el panel MP (tópicos `subscription_preapproval`, `subscription_authorized_payment`, `payment`) · `MP_WEBHOOK_SECRET` + firma activa · respuesta <22s (encolar si lento) · lógica `recycling`/cancelación · **env validado al boot (Joi)** — el audit marcó la falta (`02-OBS-1`).

### 9.7 Avanzado (fuera del V1 — referencia)
Free trial (`auto_recurring.free_trial`) · prorrateo (`billing_day` + `billing_day_proportional`, solo mensual) · tarjeta secundaria (tokenizar con el MP JS SDK en el front) · suscripción sin plan (precio variable, el back tokeniza) · sync automática de tarjetas · cargo de verificación reembolsable. Snippets en el how-to original.

---

## Resumen en una línea

Definir: **3 tablas + `User.plan`** · **5 endpoints + 1 webhook** (contrato §2) ·
**`BillingService` reconciliado** · **webhook firmado/idempotente/transaccional** ·
y —lo más importante— **`RequirePlan('pro')` server-side** en conectar-IA / MCP / Pulso. Sin lo
último, el paywall es solo un modal.
