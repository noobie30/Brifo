# Production Readiness Checklist

## Completed in this codebase

- Environment validation with Joi at boot time
- Security middleware for API (`helmet`, `compression`)
- Rate limiting via `@nestjs/throttler`
- Global request id + response time headers
- Global exception filter with normalized API error format
- Health endpoint: `GET /api/health`
- Stricter DTO validation (`forbidUnknownValues: true`)
- Desktop renderer error boundary for crash fallback
- Desktop BrowserWindow hardening:
  - sandbox enabled
  - blocked untrusted navigation/window opening
  - renderer crash logging
- API client timeout + normalized error handling

## Required before public launch

- Replace all local secrets and rotate any exposed keys immediately
- Configure real Google OAuth token flow in desktop login
- Add observability stack (Sentry, metrics, uptime monitors)
- Add automated tests for critical flows (auth, meetings, notes generation)
- Configure code signing and notarization for Mac release
- Add backup/restore and disaster recovery docs
- Add privacy policy + terms + in-app consent UX
