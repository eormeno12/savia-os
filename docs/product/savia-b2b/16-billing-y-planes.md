# 15 — Billing y planes de organización

> Estado: 📝 esqueleto — pendiente de completar
> Responde a: ¿cómo se cobra una organización, y qué pasa con el billing individual que ya existe?

## Por qué existe este documento

El billing actual (`docs/plan/mercadopago-subscriptions.md`, `apps/api/src/
modules/billing/`) es 100% individual — un plan fijo, un suscriptor por
tarjeta, sin ningún concepto de organización/seats, ni siquiera como roadmap
mencionado. Es uno de los bloqueadores concretos para monetizar B2B (no solo
un tema de documentación).

## Insumos existentes a revisar

- `docs/plan/mercadopago-subscriptions.md` — plan end-to-end completo del
  billing individual actual (planes, webhook, `BillingService`,
  reconciliación, prueba gratuita, prorrateo, reintentos).
- `apps/api/src/modules/billing/billing.service.ts`.
- `apps/app/src/components/cuenta/plan-section.tsx` y `billing-history.tsx`.

## Temas a cubrir

### Modelo de precios de organización
- [ ] ¿Por seat (precio × cantidad de miembros), plano por organización, o
      híbrido (base + seats)?
- [ ] ¿Escala con uso (volumen de memoria ingestada, skills sintetizados,
      llamadas MCP) o es plano independiente del uso?

### Transición individual → organización
- [ ] Alguien que ya paga el plan individual y su organización se formaliza
      (ver [13-adopcion-bottom-up.md](13-adopcion-bottom-up.md)) — ¿su
      suscripción se cancela, se absorbe en el plan de organización, sigue en
      paralelo?
- [ ] ¿Quién paga cuando una organización recién se forma — el admin asume
      todos los seats, o cada miembro sigue pagando su plan individual hasta
      que alguien "upgradea"?

### Proveedor de pagos
- [ ] ¿Sigue siendo Mercado Pago para B2B, o hace falta un proveedor con mejor
      soporte de facturación empresarial (contratos anuales, factura fiscal,
      múltiples métodos de pago corporativos)?
- [ ] Requisitos de facturación B2B (razón social, CUIT/RFC/equivalente,
      términos de pago NET-30, etc.) que hoy no existen en el modelo
      individual.

### Gestión de seats
- [ ] Qué pasa cuando se agrega/quita un miembro a mitad de ciclo de
      facturación (prorrateo — el modelo individual ya lo resuelve para
      upgrades, evaluar si aplica igual).
- [ ] Límites de plan (¿cuántos seats/conectores/GB de memoria incluye cada
      tier?).

## Preguntas abiertas

- ¿Existe un tier gratuito para organizaciones chicas (paralelo al freemium
  individual mencionado en `mockup-v2.md`), o B2B arranca siempre pago?

## Decisiones tomadas

_(vacío)_
