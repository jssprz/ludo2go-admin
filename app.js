import express from 'express';
import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import session from 'express-session';
import { Database, Resource, getModelByName } from '@adminjs/prisma';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient(); // uses DATABASE_URL from env

// Register Prisma adapter
AdminJS.registerAdapter({ Database, Resource });

const DEFAULT_ADMIN = {
  email: 'admin@example.com',
  password: 'password',
};

const authenticate = async (email, password) => {
  if (email === DEFAULT_ADMIN.email && password === DEFAULT_ADMIN.password) {
    return DEFAULT_ADMIN;
  }
  return null;
};

const app = express();

// AdminJS setup
const admin = new AdminJS({
  rootPath: '/admin',
  resources: [
    {
      // Use Prisma adapter helper to get model metadata
      resource: { model: getModelByName('Product'), client: prisma },
      options: {
        navigation: 'Products',
      },
    },
  ],
});

// Simple session config (in-memory, fine for dev)
const sessionOptions = {
  secret: 'sessionsecret',
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: process.env.NODE_ENV === 'production',
    secure: process.env.NODE_ENV === 'production',
  },
  name: 'adminjs',
};

// This adds express-session middleware
app.use(session(sessionOptions));

const adminRouter = AdminJSExpress.buildAuthenticatedRouter(
  admin,
  {
    authenticate,
    cookieName: 'adminjs',
    cookiePassword: 'sessionsecret',
  },
  null,
  sessionOptions
);

app.use(admin.options.rootPath, adminRouter);

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'OK', message: 'AdminJS server is running' });
});

// Basic error handling middleware (after routes)
app.use((err, req, res, next) => {
  console.error('Error:', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Internal server error' });
});

// Local dev server
const PORT = process.env.PORT || 3001;

// Export the app for serverless deployment (Vercel)
export default app;

// Only start the server locally (Vercel will NOT run this)
if (!process.env.VERCEL && process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(
      `AdminJS is running at http://localhost:${PORT}${admin.options.rootPath}`
    );
  });
}
