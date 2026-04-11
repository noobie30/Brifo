/**
 * Vercel serverless entry: forwards to the Nest app.
 * The _backend/ directory is copied from backend/dist/ during vercel-build.
 *
 * IMPORTANT: the explicit require() calls below are a workaround for
 * Vercel's Node File Tracer, which was trimming every submodule under
 * api/_backend/ out of the Lambda bundle (only serverless.js and
 * app.module.js survived). Cold start then threw
 *   "Cannot find module './auth/auth.module'"
 * from app.module.js and every route returned FUNCTION_INVOCATION_FAILED.
 * Referencing each feature module directly from this entry file forces
 * NFT to see them as first-level dependencies and include them in the
 * bundle. The references are assigned to a module-scoped array purely to
 * keep the intent obvious; the side-effect we actually care about is the
 * require() call itself getting picked up by the static dep-trace.
 */
// eslint-disable-next-line no-unused-vars
const _ensureNftBundles = [
  require("./_backend/auth/auth.module"),
  require("./_backend/users/users.module"),
  require("./_backend/transcripts/transcripts.module"),
  require("./_backend/notes/notes.module"),
  require("./_backend/tasks/tasks.module"),
  require("./_backend/ai/ai.module"),
  require("./_backend/calendar/calendar.module"),
  require("./_backend/search/search.module"),
  require("./_backend/audit/audit.module"),
  require("./_backend/health/health.module"),
  require("./_backend/integrations/integrations.module"),
];

module.exports = require("./_backend/serverless.js").default;
