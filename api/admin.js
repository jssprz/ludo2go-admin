const app = require('../app');

// Vercel Node function handler
module.exports = (req, res) => {
  // Express app is a function (req, res, next), so this works:
  app(req, res);
};