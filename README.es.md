# AUREUS · Asistente de Finanzas del Hogar sin Fricción

> 🇬🇧 English version: [README.md](./README.md)

AUREUS es un backend que permite a una familia registrar gastos y nunca olvidar un pago, **sin abrir ninguna app**. El usuario envía un texto, un audio o (más adelante) una foto de una factura por un chat. AUREUS extrae los datos, los guarda en un libro contable consistente y envía recordatorios antes de los vencimientos.

> **Estado: en transición.** AUREUS nació como un dashboard fintech clásico y ahora se reconstruye con un flujo centrado en el chat. La versión anterior se conserva en la rama [`legacy-aureus`](../../tree/legacy-aureus). Este documento describe el **diseño objetivo**; consulta la hoja de ruta para ver qué ya está construido.

---

## El problema

La mayoría de las apps de finanzas personales fallan por una razón: piden al usuario cambiar sus hábitos. Nadie registra cada café en un formulario. Pero sí enviamos mensajes todos los días y sí olvidamos pagar una factura a tiempo.

AUREUS elimina la fricción:

1. **Asistente**: registra un gasto conversando: *"1,200 de gasolina y 300 de cena"*.
2. **Centinela**: controla fechas de vencimiento y envía recordatorios escalonados para evitar recargos y cortes de servicio.

## Funciones principales (MVP)

- Captura de gastos por **texto** y **audio** (primero Telegram, luego WhatsApp).
- **Ledger de solo inserción** con ingesta idempotente (los reintentos del webhook no duplican datos).
- Extracción estructurada con validación de esquema y nivel de confianza.
- Correcciones del usuario guardadas como datos de entrenamiento para un clasificador futuro.
- **Centinela de pagos**: vencimientos, recordatorios escalonados y máquina de estados (`pendiente → recordado → pagado | vencido`).
- Resumen semanal de tres líneas.
- Panel React opcional para reportes y correcciones.

## Arquitectura

**Monolito modular** con **arquitectura hexagonal (puertos y adaptadores)**, más un worker separado para tareas en segundo plano.

El webhook solo valida la petición, guarda el evento crudo y responde `200` rápido. El trabajo pesado ocurre en el worker. El diagrama completo está en el [README en inglés](./README.md#architecture).

### Estructura de carpetas objetivo

```
src/
├── domain/            # Entidades, reglas de negocio, máquinas de estado
├── application/       # Casos de uso: RegistrarGasto, ProgramarRecordatorio, ResumenSemanal
├── infrastructure/
│   ├── messaging/     # TelegramProvider implementa MessageProvider
│   ├── ai/            # Adaptadores de transcripción y extracción
│   ├── persistence/   # Repositorios PostgreSQL
│   └── queue/         # Cola de trabajos con pg-boss
└── interfaces/http/   # Webhook y API del panel
```

### Patrones de diseño

| Patrón | Para qué sirve |
|---|---|
| Puertos y Adaptadores | Cambiar Telegram por WhatsApp, o un LLM por otro, sin tocar el dominio. |
| Clave de idempotencia / Inbox | Una restricción `UNIQUE` en el ID del mensaje hace seguros los reintentos. |
| Transactional Outbox | Los cambios de estado y los mensajes salientes se guardan de forma atómica. |
| Máquina de estados | Transiciones válidas y explícitas para los pagos. |
| Ledger de solo inserción | Auditoría completa; las correcciones son entradas nuevas, nunca ediciones. |
| Pipeline con validación de esquema | `audio → texto → LLM → JSON → Zod → control de confianza`. |

### Decisiones clave

- **Monolito modular**, no microservicios: un desarrollador, un despliegue.
- **PostgreSQL en Supabase**, usado como Postgres administrado con migraciones SQL para evitar dependencia del proveedor.
- **`pg-boss`** para colas sobre la misma base de datos (sin operar Redis).
- Dinero guardado como **enteros (unidad menor)**, nunca punto flotante.
- Fechas en **UTC**, mostradas en `America/Santo_Domingo`.
- **Telegram primero**, detrás de una interfaz `MessageProvider`, para evitar el riesgo de baneo de librerías no oficiales de WhatsApp.

## Stack tecnológico

TypeScript · Node.js · Express · Zod · PostgreSQL (Supabase) · pg-boss · Vitest · Supertest · GitHub Actions · Docker

## Hoja de ruta

- [x] Base Express + TypeScript, validación con Zod, CI, Dockerfile
- [x] Migraciones PostgreSQL con RLS y auditoría
- [ ] Reestructuración hexagonal de `src/`
- [ ] Webhook de Telegram con ingesta idempotente
- [ ] Cola de trabajos y extracción de gastos por texto
- [ ] Transcripción de audios
- [ ] Centinela de pagos y recordatorios
- [ ] Resumen semanal
- [ ] Fotos de facturas (OCR, soporte de NCF/ITBIS dominicano)
- [ ] Piloto con 3 o 4 familiares reales

## Privacidad y control de costos

- Nunca se guardan números de tarjeta ni de cuentas bancarias.
- Las imágenes de facturas se eliminan después de procesarlas.
- Límite diario de llamadas a IA por usuario.

## Estrategia de ramas

| Rama | Propósito |
|---|---|
| `develop` | Desarrollo activo |
| `qa` | Pruebas de calidad y regresión |
| `main` | Código estable listo para producción |
| `legacy-aureus` | Copia congelada de la versión fintech original |

## Inicio rápido

Requisitos: Node.js 20+ y npm 10+.

```bash
npm install
cp .env.example .env
npm run dev        # http://localhost:3001
npm test           # ejecutar las pruebas
npm run build && npm start
```
