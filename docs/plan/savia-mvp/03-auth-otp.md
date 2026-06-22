# Step 03 — Auth por OTP (backend + frontend)

**Objetivo**: login end-to-end por código OTP enviado por email (AWS SES), con
sesión JWT en cookies httpOnly y rutas protegidas.

**Depende de**: 01, 02.

---

## Flujo

```
1. Usuario ingresa email          → POST /auth/request-otp
   - genera código 6 dígitos, guarda HASH + expiresAt(10min) + attempts=0
   - rate-limit por email+IP (Redis)
   - envía código por SES
2. Usuario ingresa código         → POST /auth/verify-otp
   - valida hash, no expirado, attempts < 5, no consumido
   - upsert User por email
   - emite JWT access(15min) + refresh(30d) en cookies httpOnly
3. Rutas protegidas               → JwtAuthGuard valida access cookie
4. Refresh                        → POST /auth/refresh (rota access)
5. Logout                         → POST /auth/logout (limpia cookies)
```

## Entregables backend (`apps/api/src/modules/auth/`)

```
auth.module.ts
auth.controller.ts        # request-otp, verify-otp, refresh, logout, me
auth.service.ts           # generación/validación OTP, emisión JWT
otp.service.ts            # genera código, hash argon2, expiry, attempts
mail.service.ts           # AWS SES (SendEmailCommand) — plantilla del código
jwt.service.ts            # firma/verifica con jose (access + refresh)
guards/jwt-auth.guard.ts  # lee cookie access, valida, inyecta user
decorators/current-user.decorator.ts
```

Detalles:

- **OTP**: `crypto.randomInt(100000, 999999)`; hash con `argon2`. Guardar en
  `OtpCode`. Al verificar: buscar el último no consumido por email, comparar hash,
  incrementar `attempts`, marcar `consumedAt`.
- **Rate-limit** (Redis): key `otp:req:{email}` y `otp:req:ip:{ip}`, máx p.ej.
  5/hora con `INCR`+`EXPIRE`. Reusar patrón de `@upstash/ratelimit` solo si se
  quiere; aquí Redis self-host basta con ioredis.
- **JWT** con `jose`: access (15m) y refresh (30d) firmados con `JWT_SECRET` /
  `JWT_REFRESH_SECRET`. Payload mínimo: `{ sub: userId, email }`.
- **Cookies**: `access_token`, `refresh_token` con
  `HttpOnly; Secure; SameSite=Lax; Domain=${COOKIE_DOMAIN}; Path=/`.
  En local `COOKIE_DOMAIN=localhost`; en prod `.savia.com`.
- **SES**: `@aws-sdk/client-ses`. `mail.service.sendOtp(email, code)`. Plantilla
  simple en español con el código y validez de 10 min.

## Entregables frontend (`apps/app/src/`)

```
app/(auth)/login/page.tsx       # paso 1: email → paso 2: código (6 inputs)
lib/api.ts                      # fetch wrapper con credentials: 'include'
components/auth/OtpForm.tsx
middleware.ts                   # protege rutas privadas (chequea cookie/redirect)
```

- UI en dos pasos (email → código), estilo coherente con landing (Chakra v3).
- `fetch` con `credentials: 'include'` hacia `http://localhost:4400`.
- Manejo de errores: rate-limit, código inválido, expirado.

## CORS

`apps/api` debe permitir origin `http://127.0.0.1:4345` (y prod `app.savia.com`)
con `credentials: true`. Configurar en `main.ts` (`app.enableCors`).

## Contracts (`packages/contracts/src/auth.ts`)

```ts
export const RequestOtpSchema = z.object({ email: z.string().email() })
export const VerifyOtpSchema  = z.object({ email: z.string().email(), code: z.string().length(6) })
export const MeSchema         = z.object({ id: z.string(), email: z.string() })
export type RequestOtpDto = z.infer<typeof RequestOtpSchema>
export type VerifyOtpDto  = z.infer<typeof VerifyOtpSchema>
export type MeResponse    = z.infer<typeof MeSchema>
```

En `apps/api`: `createZodDto(RequestOtpSchema)` / `createZodDto(VerifyOtpSchema)` en
el controller; `ZodValidationPipe` global ya configurado (step 01).
En `apps/app`: importar tipos directamente para tipar el fetch.

## Variables de entorno nuevas

`JWT_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_DOMAIN`, `AWS_REGION`, `AWS_SES_FROM`
(+ credenciales AWS vía perfil/role o `AWS_ACCESS_KEY_ID`/`SECRET`).

## Archivos clave

- `apps/api/src/modules/auth/*`
- `apps/api/src/main.ts` (CORS + cookie-parser)
- `apps/app/src/app/(auth)/login/page.tsx`, `apps/app/src/middleware.ts`
- `packages/contracts/src/auth.ts`

## Verificación

1. `POST /auth/request-otp {email}` → llega email vía SES con código (en dev se
   puede loguear el código si SES no está configurado todavía).
2. `POST /auth/verify-otp {email, code}` → setea cookies; `GET /auth/me` devuelve
   el usuario.
3. Rate-limit: 6ª petición en la hora → 429.
4. Código inválido/expirado → 401 con mensaje claro; `attempts` se incrementa.
5. UI: login completo desde `http://127.0.0.1:4345/login`; rutas privadas
   redirigen a login sin sesión.
