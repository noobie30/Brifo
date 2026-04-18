import { Controller, Get, Header } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";

const API_ORIGIN = "https://api.brifo.in";
const WEBSITE_ORIGIN = "https://brifo.in";

@ApiExcludeController()
@Controller(".well-known")
export class WellKnownController {
  @Get("oauth-protected-resource")
  @Header("Content-Type", "application/json; charset=utf-8")
  @Header("Cache-Control", "public, max-age=300")
  @Header("Access-Control-Allow-Origin", "*")
  getProtectedResourceMetadata() {
    return {
      resource: API_ORIGIN,
      authorization_servers: [API_ORIGIN, "https://accounts.google.com"],
      bearer_methods_supported: ["header"],
      resource_documentation: `${API_ORIGIN}/api/docs`,
      resource_name: "Brifo API",
      scopes_supported: [],
      resource_signing_alg_values_supported: ["HS256"],
      resource_policy_uri: WEBSITE_ORIGIN,
      resource_tos_uri: WEBSITE_ORIGIN,
    };
  }

  @Get("oauth-authorization-server")
  @Header("Content-Type", "application/json; charset=utf-8")
  @Header("Cache-Control", "public, max-age=300")
  @Header("Access-Control-Allow-Origin", "*")
  getAuthorizationServerMetadata() {
    return {
      issuer: API_ORIGIN,
      token_endpoint: `${API_ORIGIN}/api/auth/google`,
      token_endpoint_auth_methods_supported: ["none"],
      grant_types_supported: [
        "urn:brifo:params:oauth:grant-type:google-id-token",
      ],
      response_types_supported: [],
      scopes_supported: [],
      service_documentation: `${API_ORIGIN}/api/docs`,
      op_policy_uri: WEBSITE_ORIGIN,
      op_tos_uri: WEBSITE_ORIGIN,
      id_token_signing_alg_values_supported: ["HS256"],
      subject_types_supported: ["public"],
      code_challenge_methods_supported: [],
    };
  }
}
