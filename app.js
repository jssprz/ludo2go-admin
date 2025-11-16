import express from 'express';
import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';

const app = express();

// Basic error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const admin = new AdminJS({
  rootPath: '/admin',
  // resources: [...]
});

const adminRouter = AdminJSExpress.buildRouter(admin);

app.use(admin.options.rootPath, adminRouter);

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'OK', message: 'AdminJS server is running' });
});

// For local development
const PORT = process.env.PORT || 3001;

// Export the app for serverless deployment
export default app;

// Only start the server in local development
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`AdminJS is running at http://localhost:${PORT}${admin.options.rootPath}`);
  });
}