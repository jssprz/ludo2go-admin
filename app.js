import express from 'express';
import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';

const app = express();

const admin = new AdminJS({
  rootPath: '/admin',
  // resources: [...]
});

const adminRouter = AdminJSExpress.buildRouter(admin);

app.use(admin.options.rootPath, adminRouter);

const PORT = process.env.PORT || 3001;

// ⚠️ Local dev only – don't do this on Vercel
app.listen(PORT, () => {
  console.log(`AdminJS is running at http://localhost:${PORT}${admin.options.rootPath}`);
});