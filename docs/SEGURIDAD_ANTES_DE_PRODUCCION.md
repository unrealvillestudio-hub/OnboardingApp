# Seguridad — ANTES de que OnboardingApp vea tráfico real

> **Estado (2026-11-05):** maqueta. Proyecta una ventana de sesión con Claude; hoy **no**
> consume keys (no funciona). Hay un proyecto iniciado para darle vida. Esta nota es la
> **advertencia mapeada** para ese momento: una ventana de chat con el modelo, abierta a
> usuarios, es la superficie de **más riesgo** del ecosistema. No se despliega a producción
> sin cerrar esta lista.

## Por qué es delicada

- Da a un usuario una **ventana directa a un modelo** pagado con nuestros fondos.
- Hoy `api/claude.ts` **fija el modelo en código** (`claude-sonnet-4-20250514`) y no tiene
  auth: con una key activa y sin los controles de abajo, es un **proxy LLM abierto** — el
  mismo patrón que drenó la key compartida el 2026-11-04 (ver los PR de hardening de
  WebLab `/api/generate`, CopyLab `/api/claude` y lanzadera-cv `/api/claude`).

## Lista obligatoria antes de producción

1. **Auth por usuario/sesión.** Nada anónimo. El endpoint exige un token de sesión válido;
   401 si falta o no corresponde.
2. **Modelo como DATO, no en código.** Leer el allowlist de la EF pública
   `modelos-permitidos` (los `model_id` activos de `ops_lab_models`), con **piso seguro**
   si la EF no responde (fail-closed). El cliente **no** elige modelo. **Nunca Opus**
   (queda fuera por ausencia en la DB, no por denylist). Patrón idéntico al de los 3 proxies
   ya endurecidos.
3. **Tope de `max_tokens`** server-side (hoy el cliente puede pedir cualquiera).
4. **Rate-limit + protección a nivel Vercel** (Firewall + Deployment Protection): un endpoint
   de chat público necesita límite por IP/usuario.
5. **Atribución de gasto por usuario** en el ledger, para que el watcher pueda señalar al
   culpable y cortar por umbral diario.
6. **Key en workspace con límite** (no scope *Organization*), marcada **Sensitive**. La del
   watcher de gasto debe cubrir esta key.
7. **Blindaje contra inyección.** El usuario (o lo que pegue en la ventana) **no** debe poder
   hacer que la app ejecute acciones, cambie de modelo, suba el tope de tokens ni filtre
   datos. La entrada del usuario es **dato, jamás instrucción**.

## Referencia

El patrón server-side (modelo desde `modelos-permitidos`, piso fail-closed, tope de tokens,
secreto opcional `PROXY_SHARED_SECRET`) está implementado en WebLab, CopyLab y lanzadera-cv.
Reusar ese mismo guard aquí cuando el endpoint deje de ser maqueta.
