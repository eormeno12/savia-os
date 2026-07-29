# FASE 7 — Pagos (Mercado Pago, freemium server-side)

> **Objetivo:** freemium **enforced en el backend** (no en el modal). Cobros recurrentes con Mercado Pago Subscriptions.
> **Hito:** monetización. · **Depende de:** FASE-0 (config/ports), FASE-2 (`$transaction`/outbox). Va **en paralelo**. · **Esfuerzo:** L.
> **Referencia:** [`09`](09-modulo-pagos.md) (autocontenido: modelo, contrato, webhook, enforcement, implementación). Decisión **D4**: $11.99/mes · USD o moneda local por país · **sin plan anual**.

## Alcance
- **Modelo**: `Plan/Subscription/Payment/WebhookEvent` + `User.plan`.
- **Contrato HTTP** (5 endpoints + webhook) en `@savia-os/contracts`.
- **Webhook firmado/idempotente/transaccional** + reconciliación con MP.
- **Enforcement** `RequirePlan('pro')` server-side — lo que hoy falta.

## Arquitectura / decisiones (de `0A`)
- **`MercadoPagoPort`** (F8): esconde las URLs de MP; el dominio no las conoce.
- **`WebhookProcessor` = reducer PURO** `applyMpEvent(state, event)` → testeable sin HTTP/DB (table-driven `authorized→approved→recycling→recycling→failed`) + un applier transaccional (F17).
- **`idemKey(event)` explícito** (`type:dataId:rid`, F20); MP es at-least-once.
- **Webhook usa el `$transaction`/outbox de F2** (no replicar el P0-2).
- **`RequirePlan('pro')`** guard en: `POST /connections`, **MCP gateway (por dueño de la conexión)**, feed de Pulso. Caer a `free` corta el acceso de las IAs, **no** borra data.

## Tickets
| Ticket | Qué | Aceptación | Dep | Tam |
|---|---|---|---|---|
| **F7.1** Modelo + setup MP | `Plan/Subscription/Payment/WebhookEvent` + `User.plan`; crear plan(es) mensual(es) por moneda en MP (D4) | migración + IDs de plan en env | F0.6 | M |
| **F7.2** MercadoPagoPort + SubscriptionService | port (preapproval/get/update/search) + `create/getStatus(reconcilia)/cancel/reactivate/pause` | `getStatus` reconcilia con MP (no confía en DB) | F0.1 | M |
| **F7.3** Webhook (reducer puro) | HMAC + `idemKey` + `WebhookProcessor` puro + applier `$transaction` | **unit table-driven** del reducer (recycling no degrada; 3 fallos→free); firma inválida→401; duplicado no re-procesa | F2·F7.2 | M |
| **F7.4** Enforcement `RequirePlan('pro')` | guard en conectar-IA, MCP gateway (por dueño), Pulso | usuario `free` **no** conecta IA ni su IA lee vía MCP (test = "el P0-1 de billing") | F1·F7.2 | M |
| **F7.5** Contrato + sandbox | `SubscriptionDto`/`BillingRow` en `@savia-os/contracts`; flujo completo en sandbox MP | front lee el estado autoritativo; sandbox e2e verde | F6.1 | S |

## Definition of Done
- [ ] El reducer del webhook tiene tests de secuencia sin infra (la lógica bug-prone).
- [ ] Idempotencia probada (webhook duplicado no re-procesa).
- [ ] **Un usuario `free` no puede conectar IA ni que su IA lea** (enforcement server-side, no modal).
- [ ] Caer a `free` no borra data.
- [ ] Flujo completo validado en sandbox antes de prod.
