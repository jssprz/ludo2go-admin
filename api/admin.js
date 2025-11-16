import app from '../app.js';

// Vercel Node function handler
export default function handler(req, res) {
  return app(req, res);
}