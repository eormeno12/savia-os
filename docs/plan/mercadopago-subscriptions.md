# Integración de Suscripciones con MercadoPago — Plan End to End

> **Consolidado en [`docs/audit/backend/2026-06-27/09-modulo-pagos.md`](../audit/backend/2026-06-27/09-modulo-pagos.md)** — ese doc es ahora la **fuente canónica** del módulo de pagos de Savia (definición + implementación + enforcement + integración en el plan). Este how-to queda como **referencia** de la API de MP.

## Resumen

Integrar cobros recurrentes usando MercadoPago Subscriptions (API `/preapproval`).
El usuario elige un plan, se redirige a MercadoPago para pagar, vuelve al sitio y los cobros
siguientes ocurren automáticamente sin intervención del usuario.

### Features activadas para Savia

| Feature | Estado | Motivo |
|---|---|---|
| Plan mensual | ✅ | Cobro base |
| Plan anual (descuento) | ✅ | Aumenta LTV, reduce churn |
| Medio de pago secundario | ✅ | Fallback automático si falla la tarjeta principal |
| Billing day dinámico | ✅ | Se cobra el día que el usuario se suscribe, recurrente desde ahí |
| Prorrateo | ❌ | Se cobra el monto completo desde el primer día |
| Reintentos automáticos | ✅ (automático) | MP hace 4 reintentos en 10 días; manejar webhook |
| Free trial | ❌ | No aplica para Savia |
| Suscripción sin plan | ❌ | Precio fijo, no se necesita |

---

## Arquitectura

```
apps/app (Next.js)          apps/api (NestJS)           MercadoPago
      │                           │                           │
      │  POST /api/subscription   │  POST /preapproval_plan  │
      │ ─────────────────────────►│ ─────────────────────────►│
      │                           │◄─────────────────────────┤
      │                           │        { id: plan_id }   │
      │                           │                           │
      │  click "Suscribirse"      │  POST /preapproval        │
      │ ─────────────────────────►│ ─────────────────────────►│
      │                           │◄─────────────────────────┤
      │◄─────────────────────────┤│    { init_point: url }   │
      │    redirect init_point    │                           │
      │ ──────────────────────────────────────────────────────►
      │                           │     usuario paga          │
      │◄──────────────────────────────────────────────────────┤
      │    back_url (/gracias)    │                           │
      │                           │◄── webhook (cobro auto) ──┤
      │                           │  activa/renueva acceso    │
```

---

## Variables de entorno

```env
# apps/api/.env
MP_ACCESS_TOKEN=APP_USR-...        # token de producción (o TEST- para sandbox)
MP_PUBLIC_KEY=APP_USR-...          # clave pública (frontend si se necesita)
MP_WEBHOOK_SECRET=...              # secret para validar firma de webhooks
MP_PLAN_MONTHLY_ID=2c938084...     # ID del plan mensual (guardar tras el setup)
MP_PLAN_ANNUAL_ID=3d049195...      # ID del plan anual  (guardar tras el setup)
```

---

## Paso 1 — Crear los planes (una sola vez, al hacer deploy)

Se crean dos planes: mensual y anual. Cada uno tiene billing day fijo (día 1) y prorrateo
activado. Los IDs se guardan en variables de entorno.

```ts
// scripts/create-mp-plans.ts  (correr una sola vez con ts-node)
async function createPlan(body: object) {
  const res = await fetch('https://api.mercadopago.com/preapproval_plan', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  return res.json()
}

// Plan mensual
// Sin billing_day → MercadoPago cobra el día que el usuario se suscribe
// y repite cada mes en esa misma fecha. Monto completo desde el día 1.
const monthly = await createPlan({
  reason: 'Plan Pro — Mensual',
  auto_recurring: {
    frequency: 1,
    frequency_type: 'months',
    transaction_amount: 9.99,
    currency_id: 'ARS',   // ajustar por país
  },
  back_url: 'https://app.savia.ai/billing/success',
})
console.log('MP_PLAN_MONTHLY_ID=', monthly.id)

// Plan anual (~17% de descuento respecto al mensual × 12)
// Cobra el monto completo el día de suscripción, renueva al año siguiente.
const annual = await createPlan({
  reason: 'Plan Pro — Anual',
  auto_recurring: {
    frequency: 12,
    frequency_type: 'months',
    transaction_amount: 99.99,
    currency_id: 'ARS',
  },
  back_url: 'https://app.savia.ai/billing/success',
})
console.log('MP_PLAN_ANNUAL_ID=', annual.id)
```

---

## Paso 2 — Endpoint para iniciar suscripción

El frontend pasa el tipo de plan (`monthly` | `annual`). El endpoint crea una suscripción
pendiente y devuelve el `init_point` de MercadoPago.

```ts
// apps/api/src/modules/billing/billing.controller.ts
@Post('subscription/create')
@UseGuards(JwtAuthGuard)
async createSubscription(
  @Req() req: Request,
  @Body('plan') plan: 'monthly' | 'annual',
) {
  const user = req.user
  const planId = plan === 'annual'
    ? process.env.MP_PLAN_ANNUAL_ID
    : process.env.MP_PLAN_MONTHLY_ID

  const res = await fetch('https://api.mercadopago.com/preapproval', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      preapproval_plan_id: planId,
      payer_email: user.email,
      external_reference: user.id,   // ID interno para reconciliar en webhooks
      back_url: 'https://app.savia.ai/billing/success',
      status: 'pending',
    }),
  })

  const sub = await res.json()
  return { init_point: sub.init_point }
}
```

---

## Paso 3 — Botón de suscripción en el frontend

```tsx
// apps/app/src/components/billing/SubscribeButton.tsx
'use client'

import { useState } from 'react'

type Plan = 'monthly' | 'annual'

export function SubscribeButton({ plan }: { plan: Plan }) {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    const res = await fetch('/api/subscription/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    })
    const { init_point } = await res.json()
    window.location.href = init_point
  }

  const label = plan === 'annual'
    ? 'Suscribirse — $99.99/año  (ahorrás 17%)'
    : 'Suscribirse — $9.99/mes'

  return (
    <button onClick={handleClick} disabled={loading}>
      {loading ? 'Redirigiendo...' : label}
    </button>
  )
}
```

---

## Paso 4 — Medio de pago secundario (fallback)

Después de que el usuario completa la suscripción, se le puede ofrecer agregar una tarjeta
de respaldo. Si el cobro mensual falla con la tarjeta principal, MercadoPago lo reintenta
automáticamente con la secundaria, sin intervención del usuario.

### Flujo

```
1. Usuario llega a /billing/success con la suscripción activa
2. UI muestra "Agrega una tarjeta de respaldo para evitar interrupciones"
3. Frontend tokeniza la tarjeta secundaria con el SDK de MP
4. Frontend llama a PATCH /subscription/secondary-payment
5. Backend hace PUT /preapproval/{id} con card_token_id_secondary
```

### Tokenizar la tarjeta en el frontend

```ts
// Requiere MercadoPago JS SDK  (script: https://sdk.mercadopago.com/js/v2)
const mp = new MercadoPago(process.env.NEXT_PUBLIC_MP_PUBLIC_KEY)
const cardToken = await mp.createCardToken({
  cardNumber: '4111111111111111',
  cardholderName: 'JUAN PEREZ',
  cardExpirationMonth: '12',
  cardExpirationYear: '2028',
  securityCode: '123',
})
// cardToken.id → enviar al backend
```

### Endpoint backend

```ts
@Patch('subscription/secondary-payment')
@UseGuards(JwtAuthGuard)
async addSecondaryPayment(
  @Req() req: Request,
  @Body('cardTokenId') cardTokenId: string,
  @Body('paymentMethodId') paymentMethodId: string, // 'visa', 'master', etc.
) {
  const user = await this.prisma.user.findUniqueOrThrow({
    where: { id: req.user.id },
  })

  await fetch(`https://api.mercadopago.com/preapproval/${user.subscriptionId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      card_token_id_secondary: cardTokenId,
      payment_method_id_secondary: paymentMethodId,
    }),
  })

  return { ok: true }
}
```

---

## Paso 5 — Webhook (cobros automáticos)

MercadoPago llama a este endpoint cada vez que ocurre un evento de suscripción.
Debe responder en menos de 22 segundos con HTTP 200.

```ts
// apps/api/src/modules/billing/billing.webhook.ts
import crypto from 'crypto'

@Post('webhooks/mercadopago')
async handleWebhook(
  @Headers('x-signature') xSignature: string,
  @Headers('x-request-id') xRequestId: string,
  @Query('data.id') dataId: string,
  @Body() body: any,
) {
  // 1. Verificar firma
  const ts = xSignature.match(/ts=([^,]+)/)?.[1]
  const v1 = xSignature.match(/v1=(.+)/)?.[1]
  const template = `id:${dataId};request-id:${xRequestId};ts:${ts};`
  const expected = crypto
    .createHmac('sha256', process.env.MP_WEBHOOK_SECRET)
    .update(template)
    .digest('hex')

  if (expected !== v1) throw new UnauthorizedException()

  // 2. Procesar evento
  const { type, data } = body

  switch (type) {
    case 'subscription_preapproval':
      // usuario completó el flujo → activar acceso Pro
      await this.billingService.activateSubscription(data.id)
      break

    case 'subscription_authorized_payment': {
      // cobro automático: puede ser exitoso, en reintento, o fallido definitivo
      const payment = await fetch(
        `https://api.mercadopago.com/authorized_payments/${data.id}`,
        { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` } },
      ).then(r => r.json())

      if (payment.status === 'processed' && payment.payment?.status === 'approved') {
        // cobro exitoso → renovar acceso
        await this.billingService.renewSubscription(payment.preapproval_id)
      } else if (payment.status === 'recycling') {
        // en reintento (MP reintentará hasta 4 veces en 10 días)
        // NO degradar el acceso todavía — solo loguear
        await this.billingService.logPaymentRetry(payment.preapproval_id)
      } else {
        // cuota rechazada definitivamente (4 reintentos agotados)
        // tras 3 cuotas así, MP cancela la suscripción automáticamente
        await this.billingService.handleFailedPayment(payment.preapproval_id)
      }
      break
    }
  }
}
```

### Registrar la URL del webhook

Con el MCP de MercadoPago (herramienta `save_webhook`) o manualmente en
[developers.mercadopago.com](https://developers.mercadopago.com) → Tu aplicación → Webhooks.

URL a registrar: `https://api.savia.ai/webhooks/mercadopago`

Tópicos a activar:
- `subscription_preapproval_plan`
- `subscription_preapproval`
- `subscription_authorized_payment`
- `payment`

---

## Paso 5 — Página de retorno

```tsx
// apps/app/src/app/(app)/billing/success/page.tsx
export default function BillingSuccess() {
  return (
    <div>
      <h1>¡Suscripción activada!</h1>
      <p>Tu cuenta Pro ya está activa. Los cobros se realizan automáticamente cada mes.</p>
    </div>
  )
}
```

---

## Paso 6 — BillingService (reconciliación)

```ts
// apps/api/src/modules/billing/billing.service.ts
async activateSubscription(preapprovalId: string) {
  // Consultar el estado real en MP
  const res = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
  })
  const sub = await res.json()

  // sub.external_reference es el userId guardado al crear la suscripción
  if (sub.status === 'authorized') {
    await this.prisma.user.update({
      where: { id: sub.external_reference },
      data: {
        plan: 'pro',
        subscriptionId: preapprovalId,
        subscribedAt: new Date(),
      },
    })
  }
}

async renewSubscription(authorizedPaymentId: string) {
  const res = await fetch(
    `https://api.mercadopago.com/authorized_payments/${authorizedPaymentId}`,
    { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` } },
  )
  const payment = await res.json()
  // Actualizar fecha de próximo cobro, registrar en historial, etc.
}
```

---

## Endpoints de consulta útiles

| Propósito | Endpoint |
|---|---|
| Estado de una suscripción | `GET /preapproval/{id}` |
| Buscar suscripciones por usuario | `GET /preapproval/search?external_reference={userId}` |
| Detalle de un plan | `GET /preapproval_plan/{id}` |
| Pago recurrente | `GET /authorized_payments/{id}` |
| Historial de pagos de una suscripción | `GET /v1/payments/search?external_reference={userId}` |

---

## Gestión del ciclo de vida desde la API

Todas las acciones de gestión usan `PUT /preapproval/{id}` con el `subscriptionId` guardado en tu base de datos.

### Referencia rápida

| Acción | Body del PUT |
|---|---|
| Pausar | `{ "status": "paused" }` |
| Reactivar | `{ "status": "authorized" }` |
| Cancelar | `{ "status": "cancelled" }` |
| Cambiar monto | `{ "auto_recurring": { "transaction_amount": 19.99, "currency_id": "ARS" } }` |
| Cambiar tarjeta | `{ "card_token_id": "nuevo_token" }` |
| Agregar medio secundario | `{ "card_token_id_secondary": "token", "payment_method_id_secondary": "visa" }` |
| Cambiar fecha de facturación | No aplica — el billing day es dinámico (día de suscripción) |
| Cambiar fecha de fin | `{ "auto_recurring": { "end_date": "2026-12-31T00:00:00Z" } }` |

> **Importante**: cancelar es irreversible. Una vez cancelado, el usuario no puede reactivar esa suscripción — debe crear una nueva.

### BillingService — métodos de gestión

```ts
// apps/api/src/modules/billing/billing.service.ts

private async updateSubscription(subscriptionId: string, body: object) {
  const res = await fetch(`https://api.mercadopago.com/preapproval/${subscriptionId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`MP error: ${await res.text()}`)
  return res.json()
}

async pauseSubscription(userId: string) {
  const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } })
  await this.updateSubscription(user.subscriptionId, { status: 'paused' })
  await this.prisma.user.update({ where: { id: userId }, data: { plan: 'paused' } })
}

async cancelSubscription(userId: string) {
  const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } })
  await this.updateSubscription(user.subscriptionId, { status: 'cancelled' })
  await this.prisma.user.update({
    where: { id: userId },
    data: { plan: 'free', subscriptionId: null },
  })
}

async reactivateSubscription(userId: string) {
  const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } })
  await this.updateSubscription(user.subscriptionId, { status: 'authorized' })
  await this.prisma.user.update({ where: { id: userId }, data: { plan: 'pro' } })
}

async changeAmount(userId: string, newAmount: number) {
  const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } })
  await this.updateSubscription(user.subscriptionId, {
    auto_recurring: { transaction_amount: newAmount, currency_id: 'ARS' },
  })
  // MercadoPago notifica al usuario por email automáticamente
}

// changeBillingDay: no aplica — el día de cobro es el mismo día en que
// el usuario se suscribió y MercadoPago lo gestiona automáticamente.
```

### Endpoints del controller

```ts
// apps/api/src/modules/billing/billing.controller.ts

@Post('subscription/pause')
@UseGuards(JwtAuthGuard)
async pause(@Req() req: Request) {
  await this.billingService.pauseSubscription(req.user.id)
  return { ok: true }
}

@Post('subscription/cancel')
@UseGuards(JwtAuthGuard)
async cancel(@Req() req: Request) {
  await this.billingService.cancelSubscription(req.user.id)
  return { ok: true }
}

@Post('subscription/reactivate')
@UseGuards(JwtAuthGuard)
async reactivate(@Req() req: Request) {
  await this.billingService.reactivateSubscription(req.user.id)
  return { ok: true }
}

@Patch('subscription/amount')
@UseGuards(JwtAuthGuard)
async changeAmount(@Req() req: Request, @Body('amount') amount: number) {
  await this.billingService.changeAmount(req.user.id, amount)
  return { ok: true }
}
```

### Consultar estado real desde MercadoPago

Antes de mostrar el estado de suscripción en el perfil del usuario, siempre reconcilia
con el estado real en MP (no confíes solo en tu base de datos):

```ts
async getSubscriptionStatus(userId: string) {
  const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } })
  if (!user.subscriptionId) return { status: 'none' }

  const res = await fetch(
    `https://api.mercadopago.com/preapproval/${user.subscriptionId}`,
    { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` } },
  )
  const sub = await res.json()

  // Posibles valores: authorized | paused | cancelled | pending
  return {
    status: sub.status,
    nextPaymentDate: sub.auto_recurring?.start_date,
    amount: sub.auto_recurring?.transaction_amount,
    currency: sub.auto_recurring?.currency_id,
  }
}
```

### Buscar suscripción de un usuario por email o referencia

```ts
// Útil si no guardaste el subscriptionId en tu DB
const res = await fetch(
  `https://api.mercadopago.com/preapproval/search?external_reference=${userId}`,
  { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` } },
)
const { results } = await res.json()
const activeSub = results.find((s: any) => s.status === 'authorized')
```

### Historial de pagos de una suscripción

```ts
const res = await fetch(
  `https://api.mercadopago.com/v1/payments/search?external_reference=${userId}&sort=date_created&criteria=desc`,
  { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` } },
)
const { results } = await res.json()
// results: lista de pagos con status, amount, date_approved, etc.
```

---

## Funcionalidades avanzadas

### Período de prueba gratuita (free trial)

Se configura en el plan. El suscriptor no es cobrado durante ese período; el primer cobro real ocurre al terminar el trial.

```ts
// Al crear o actualizar el plan (PUT /preapproval_plan/{id})
{
  auto_recurring: {
    frequency: 1,
    frequency_type: 'months',
    transaction_amount: 9.99,
    currency_id: 'ARS',
    free_trial: {
      frequency: 7,          // duración del trial
      frequency_type: 'days' // 'days' o 'months'
    }
  }
}
```

---

### Prorrateo (monto proporcional)

Cuando el usuario se suscribe en un día distinto al día de facturación del plan, MercadoPago cobra un monto proporcional por los días restantes hasta el primer ciclo completo.

**Solo aplica a suscripciones mensuales** (`frequency: 1`, `frequency_type: 'months'`).

```ts
// En el plan: día de facturación fijo + prorrateo activado
{
  auto_recurring: {
    frequency: 1,
    frequency_type: 'months',
    billing_day: 10,                  // cobra el día 10 de cada mes (1–28)
    billing_day_proportional: true,   // cobra proporcional al suscribirse
    transaction_amount: 9.99,
    currency_id: 'ARS'
  }
}
```

Ejemplo: usuario se suscribe el 25 de enero con `billing_day: 10`. Paga proporcional por los días 25–10/feb, luego $9.99 completo el 10 de cada mes.

---

### Medio de pago secundario (fallback automático)

Si el cobro con la tarjeta principal falla, MercadoPago intenta automáticamente con el medio secundario. Aumenta la tasa de aprobación sin intervención del usuario.

```ts
// PUT /preapproval/{id}
// Opción A: tarjeta secundaria
{
  card_token_id_secondary: 'token_de_tarjeta_secundaria',
  payment_method_id_secondary: 'visa'
}

// Opción B: otro medio de pago (ej. saldo MP)
{
  payment_method_id_secondary: 'account_money'
}
```

Para obtener el token de la tarjeta secundaria usás el mismo flujo de tokenización que con la tarjeta principal.

---

### Reintentos automáticos de cobro fallido

MercadoPago gestiona los reintentos sin intervención tuya:

| Dato | Valor |
|---|---|
| Máximo de reintentos | **4 intentos** |
| Ventana de reintento | **10 días** desde el fallo |
| Acreditación del primer pago | **1 hora** después de suscribirse |
| Cancelación automática | Tras **3 cuotas consecutivas** con todos sus reintentos fallidos |

**Estados de una cuota durante el ciclo de reintento:**

```
pago rechazado → estado "recycling"
  ├── reintento 1 (dentro de los 10 días)
  ├── reintento 2
  ├── reintento 3
  └── reintento 4 → si falla: cuota queda como "processed" con pago rechazado

Si 3 cuotas consecutivas quedan rechazadas
  → suscripción cancelada automáticamente
  → vendedor notificado por email
```

**Webhook que llega en cada intento:** `subscription_authorized_payment` — revisá `status` del pago para saber si fue aprobado o rechazado.

```ts
case 'subscription_authorized_payment': {
  const res = await fetch(
    `https://api.mercadopago.com/authorized_payments/${data.id}`,
    { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` } }
  )
  const payment = await res.json()
  if (payment.status === 'processed' && payment.payment?.status === 'approved') {
    // cobro exitoso → renovar acceso
  } else if (payment.status === 'recycling') {
    // en reintento → no hacer nada, esperar próximo webhook
  } else {
    // cuota rechazada definitivamente → notificar al usuario
  }
  break
}
```

---

### Cargo de verificación de tarjeta

Al crear una suscripción, MercadoPago realiza un **cargo mínimo** para validar que la tarjeta es real y tiene fondos. El monto se **reembolsa automáticamente** al pagador una vez confirmada la validez. No requiere configuración extra.

---

### Suscripción sin plan (precio variable por usuario)

Útil cuando cada suscriptor paga un monto distinto (ej. planes a medida, donaciones). Se omite `preapproval_plan_id` y se define todo en el body:

```ts
// POST /preapproval  (sin preapproval_plan_id)
{
  reason: 'Savia OS — Plan Personalizado',
  payer_email: usuario.email,
  external_reference: usuario.id,
  card_token_id: cardToken,          // token obtenido en el frontend
  status: 'authorized',
  auto_recurring: {
    frequency: 1,
    frequency_type: 'months',
    start_date: new Date().toISOString(),
    end_date: '2027-01-01T00:00:00Z', // opcional
    transaction_amount: montoNegociado,
    currency_id: 'ARS'
  },
  back_url: 'https://app.savia.ai/billing/success'
}
```

**Diferencia clave**: en la suscripción con plan, el usuario elige suscribirse desde tu UI y paga en el formulario de MercadoPago. En la suscripción sin plan, tu backend tokeniza la tarjeta con el SDK de MP y crea la suscripción directamente — el usuario no sale de tu sitio.

---

### Sincronización automática de tarjetas

MercadoPago actualiza automáticamente el estado de las tarjetas cuando las renueva la entidad emisora (ej. vencimiento, reemplazo por robo). No requiere que el usuario actualice sus datos manualmente.

---

## Testing con sandbox

1. Crear usuario de prueba con el MCP (`create_test_user`)
2. Agregarle saldo con `add_money_test_user`
3. Usar credenciales `TEST-...` en lugar de `APP_USR-...`
4. Completar el flujo con el usuario de prueba
5. Validar que el webhook llega correctamente

---

## Checklist de salida a producción

**Setup inicial**
- [ ] Planes mensual y anual creados — `MP_PLAN_MONTHLY_ID` y `MP_PLAN_ANNUAL_ID` guardados en prod
- [ ] `back_url` apunta a la URL real del sitio (no localhost)
- [ ] `external_reference` del usuario coincide con el ID en la base de datos
- [ ] Sin `billing_day` en los planes — el cobro ocurre el día de suscripción, monto completo

**Webhooks**
- [ ] Webhook registrado en el panel de MercadoPago con la URL de producción
- [ ] `MP_WEBHOOK_SECRET` configurado y validación de firma HMAC activa
- [ ] Respuesta al webhook en menos de 22 segundos (usar cola Bull/Redis si el procesamiento es lento)
- [ ] Lógica de `recycling` implementada (no degradar acceso hasta agotar los 4 reintentos)
- [ ] Lógica de cancelación automática implementada (3 cuotas rechazadas → bajar a free)

**Medio de pago secundario**
- [ ] UI post-suscripción ofrece agregar tarjeta de respaldo
- [ ] SDK de MercadoPago JS cargado en la página de billing
- [ ] Endpoint `PATCH /subscription/secondary-payment` funcional

**Calidad**
- [ ] Flujo completo probado con usuario de prueba en sandbox
- [ ] Ejecutar `quality_evaluation` con el MCP de MercadoPago antes de habilitar en producción
