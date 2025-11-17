import express from 'express';
import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import session from 'express-session';
import { Database, Resource, getModelByName } from '@adminjs/prisma';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient(); // uses DATABASE_URL from env

// Register Prisma adapter
AdminJS.registerAdapter({ Database, Resource });

const DEFAULT_ADMIN = {
  email: 'admin',
  password: '123',
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
      resource: { model: getModelByName('Product'), client: prisma },
      options: {
        navigation: 'Products',
      },
    },
    {
      resource: { model: getModelByName('GameDetails'), client: prisma },
      options: {
        navigation: 'Games',
      },
    },
    {
      resource: { model: getModelByName('AccessoryDetails'), client: prisma },
      options: {
        navigation: 'Accessories',
      },
    },
    {
      resource: { model: getModelByName('GameTimeline'), client: prisma },
      options: {
        navigation: 'Timelines',
      },
    },
    {
      resource: { model: getModelByName('Publisher'), client: prisma },
      options: {
        navigation: 'Publishers',
      },
    },
    {
      resource: { model: getModelByName('GameplayComplexityTier'), client: prisma },
      options: {
        navigation: 'Game Complexity tiers',
      },
    }
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

// Handle AdminJS static assets explicitly for serverless environment
app.get('/admin/frontend/assets/*', (req, res) => {
  try {
    const assetPath = req.path.replace('/admin/frontend/assets/', '');
    
    // Map AdminJS asset requests to actual bundle files
    let fullPath;
    if (assetPath.includes('components.bundle.js') || assetPath.includes('app.bundle.js')) {
      fullPath = path.join(process.cwd(), 'node_modules/adminjs/bundle/app-bundle.production.js');
    } else if (assetPath.includes('design-system.bundle.js') || assetPath.includes('global.bundle.js')) {
      fullPath = path.join(process.cwd(), 'node_modules/adminjs/bundle/global-bundle.production.js');
    } else {
      // Fallback to lib/frontend for other assets
      fullPath = path.join(process.cwd(), 'node_modules/adminjs/lib/frontend', assetPath);
    }
    
    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      console.error('AdminJS asset not found:', req.path, '-> File:', fullPath);
      return res.status(404).send('Asset not found');
    }
    
    // Set appropriate content type
    if (fullPath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    } else if (fullPath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    }
    
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.sendFile(fullPath);
  } catch (error) {
    console.error('Error serving AdminJS asset:', error);
    res.status(500).send('Error serving asset: ' + error.message);
  }
});

// Fallback for other AdminJS frontend files
app.use('/admin/frontend', express.static(path.join(process.cwd(), 'node_modules/adminjs/lib/frontend'), {
  maxAge: '1y',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

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
