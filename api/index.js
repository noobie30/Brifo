/**
 * Vercel serverless entry: forwards to the Nest app.
 * The _backend/ directory is copied from backend/dist/ during vercel-build.
 */
module.exports = require("./_backend/serverless.js").default;
