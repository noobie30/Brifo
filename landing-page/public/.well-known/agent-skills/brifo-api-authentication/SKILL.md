---
name: brifo-api-authentication
description: Use when integrating with the Brifo REST API. Explains Brifo's non-standard OAuth flow (Google ID token exchanged for a Brifo JWT) and how to send authenticated requests.
---

# Brifo API Authentication

The Brifo API is protected by a JWT bearer token. Brifo does **not** run a standard OAuth 2.0 authorization server — instead, it accepts a **Google ID token** and exchanges it for a Brifo-issued JWT.

## Base URL

`https://api.brifo.in`

All endpoints are under the `/api` prefix.

## Step 1 — Get a Google ID token

Sign the end-user in with Google OAuth 2.0 using client ID issued for Brifo. Use the standard Google OIDC flow (or Google Identity Services in the browser / `@google-cloud/iap` server-side). Request the `openid email profile` scopes at minimum. You will receive a Google **ID token** (JWT).

## Step 2 — Exchange for a Brifo JWT

```http
POST https://api.brifo.in/api/auth/google
Content-Type: application/json

{
  "idToken": "<Google ID token from step 1>"
}
```

Response:

```json
{
  "accessToken": "<Brifo JWT, 30-day expiry>",
  "user": { "id": "...", "email": "...", "name": "..." }
}
```

## Step 3 — Call protected endpoints

Send the Brifo JWT as a Bearer token:

```http
GET https://api.brifo.in/api/auth/me
Authorization: Bearer <Brifo JWT>
```

## Token expiry and refresh

Brifo JWTs are valid for **30 days**. There is no refresh endpoint — after expiry, repeat steps 1–2 with a fresh Google ID token.

## Rate limits

120 requests per minute per client (HTTP 429 on exceed).

## Discovery

- OpenAPI spec: <https://api.brifo.in/api/docs-json>
- Swagger UI: <https://api.brifo.in/api/docs>
- Health check: <https://api.brifo.in/api/health>
- Protected Resource Metadata: <https://api.brifo.in/.well-known/oauth-protected-resource>
- Authorization Server Metadata: <https://api.brifo.in/.well-known/oauth-authorization-server>

## Notes for agents

- This is a **custom grant**, not RFC-standard OAuth. Standard OAuth clients that only support `authorization_code` or `client_credentials` will not work directly.
- The `authorization_servers` field in the Protected Resource Metadata lists `https://accounts.google.com` (where the user authenticates) and `https://api.brifo.in` (which issues the session JWT).
- The supported grant type is a custom identifier: `urn:brifo:params:oauth:grant-type:google-id-token`.
