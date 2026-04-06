/**
 * Vercel serverless entry: forwards to the Nest app built at backend/dist/serverless.js
 */
module.exports = require("../backend/dist/serverless.js").default;
