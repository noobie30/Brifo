import Joi from "joi";

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid("development", "production", "test")
    .default("development"),
  PORT: Joi.number().integer().min(1).max(65535).default(3001),
  MONGODB_URI: Joi.string()
    .uri({ scheme: ["mongodb", "mongodb+srv"] })
    .required(),
  JWT_SECRET: Joi.when("NODE_ENV", {
    is: "production",
    then: Joi.string().min(16).required(),
    otherwise: Joi.string().min(8).default("brifo-dev-secret"),
  }),
  DEEPGRAM_API_KEY: Joi.string().allow("").optional(),
  OPENAI_API_KEY: Joi.string().allow("").optional(),
  OPENAI_MODEL_NOTES: Joi.string().allow("").optional(),
  MASTRA_MODEL: Joi.string().allow("").optional(),
  GOOGLE_CLIENT_ID: Joi.string().allow("").optional(),
  GOOGLE_CLIENT_SECRET: Joi.string().allow("").optional(),
  JIRA_CLIENT_ID: Joi.string().allow("").optional(),
  JIRA_CLIENT_SECRET: Joi.string().allow("").optional(),
  JIRA_DEFAULT_PROJECT_KEY: Joi.string().allow("").optional(),
  CORS_ORIGINS: Joi.string().allow("").optional(),
  THROTTLE_TTL: Joi.number().integer().min(1).default(60),
  THROTTLE_LIMIT: Joi.number().integer().min(1).default(120),
});
