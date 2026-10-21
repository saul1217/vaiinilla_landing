# Workflows de seguridad de CI (QA-051)

El GitHub App no puede crear archivos en `.github/workflows`. Copiar a mano:

    cp docs/ci-workflows/security.yml docs/ci-workflows/e2e.yml .github/workflows/

Antes: crear el Environment `develop-e2e` con `E2E_USER_EMAIL` y `E2E_USER_PASSWORD`
(cuenta dedicada, contraseña única; sin llaves de servicio de Supabase ni secretos de producción).

Nota: `npm audit --omit=dev --audit-level=high` hoy falla por `@grpc/grpc-js <=1.13.5` (transitiva de firebase).
