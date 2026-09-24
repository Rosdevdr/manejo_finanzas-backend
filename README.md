# 💰 AUREUS · Dedicated Backend & Data Engineering Service

Backend desacoplado y de alta disponibilidad para el sistema financiero **AUREUS Wealth Advisor**. Diseñado bajo principios de Clean Architecture, validación estricta de contratos API (QA), orquestación de IA generativa (Google Gemini), pasarela de pagos (Stripe) y capas analíticas para agregación financiera (Data Engineering).

---

## 🏛️ Arquitectura del Sistema

```
backend/
├── .github/workflows/
│   └── ci.yml                   # CI automatizado en ramas develop, qa y main
├── database/
│   ├── migrations/              # DDL modular en PostgreSQL
│   │   ├── 001_core_schema.sql  # Tablas maestras e índices de rendimiento
│   │   ├── 002_rls_security.sql # Multi-tenancy RLS y GDPR Art. 17
│   │   ├── 003_audit_and_realtime.sql # Trazabilidad inmutable y CDC
│   │   └── 004_analytics_views.sql    # Vistas analíticas de Data Engineering
│   └── seeds/
│       └── 001_mock_financial_data.sql # Fixtures de prueba QA
├── src/
│   ├── config/                  # Variables de entorno validadas con Zod
│   ├── controllers/             # Controladores desacoplados de capa HTTP
│   ├── middleware/              # Validación Zod, CORS, Error Handling
│   ├── routes/                  # Enrutador centralizado
│   ├── services/                # Lógica de negocio (Gemini, Stripe, Analytics)
│   ├── validators/              # Contratos de interfaz API (QA)
│   ├── app.ts                   # Aplicación Express testeable con Supertest
│   └── server.ts                # Bootstrap de servidor HTTP
├── tests/                       # Suite automatizada Vitest / Supertest
└── Dockerfile                   # Contenedorización multi-stage
```

---

## 🔬 Pilares de Ingeniería

### 1. ⚙️ Backend Engineering
- **Express + TypeScript**: Tipado estricto de punta a punta, sin `any` sueltos en lógica de negocio.
- **Orquestador Gemini AI**: Cascada con tolerancia a fallos entre múltiples modelos (`gemini-flash-latest`, `gemini-3.1-flash-lite`, `gemma-4-31b-it`, `gemini-pro-latest`) para garantizar disponibilidad continua.
- **Ciclo de Vida Stripe**: Soporte completo de suscripciones con verificación criptográfica de firmas mediante buffer sin procesar (`raw body`).
- **Resiliencia y Graceful Shutdown**: Manejo de señales `SIGTERM` y `SIGINT` para drenar conexiones activas.

### 2. 🧪 QA & Software Testing
- **Validación de Contratos**: Middleware de validación con **Zod** que rechaza solicitudes malformadas antes de tocar la lógica de negocio.
- **Suite de Pruebas Automatizadas**:
  - `tests/health.test.ts`: Pruebas de integración HTTP para diagnóstico de servidor y monitoreo de memoria.
  - `tests/analytics.test.ts`: Pruebas unitarias de cálculos financieros (flujo neto, tasa de ahorro, ratios de endeudamiento).
  - `tests/contracts.test.ts`: Pruebas de contratos de esquemas y validaciones de seguridad.
- **Integración Continua (CI)**: Pipeline de GitHub Actions ejecutado en cada `push` o `pull_request` a `develop`, `qa` y `main`.

### 3. 📊 Data Engineering
- **Esquema Relacional Estructurado**: Migraciones SQL modulares con claves foráneas, restricciones `CHECK` y políticas de integridad referencial.
- **Vistas Analíticas Materializadas**:
  - `v_monthly_financial_summary`: Agregación de ingresos, gastos fijos/variables y retiros en efectivo.
  - `v_category_spending_distribution`: Distribución y cálculo de ticket promedio por categoría.
  - `v_credit_card_utilization`: Monitoreo de exposición y utilización crediticia para scoring de riesgo.
- **Change Data Capture (CDC)**: Publicación en réplica completa para sincronización en tiempo real vía WebSockets.

---

## 🌿 Estrategia de Ramas (Git Flow)

Este repositorio mantiene paridad exacta con el repositorio de Frontend:

| Rama | Propósito | Despliegue Automático |
|---|---|---|
| `develop` | Desarrollo activo, integración de features y PRs. | Desactivado / Sandbox |
| `qa` | Entorno de pruebas de calidad, regresión y validación. | Staging / Manual |
| `main` | Código estable y verificado listo para producción. | Solo tags / Manual |

---

## 🚀 Inicio Rápido Local

### 1. Requisitos
- Node.js 20+
- npm 10+

### 2. Instalación de dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
```bash
cp .env.example .env
```

### 4. Ejecutar en desarrollo
```bash
npm run dev
```
El servidor arrancará en `http://localhost:3001`.

### 5. Ejecutar la suite de pruebas QA
```bash
npm test
```

### 6. Compilación de producción
```bash
npm run build
npm start
```
