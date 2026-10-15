// One-off script: registers this GCP project as a developer with the Merchant Center account.
// Run once with real credentials loaded, e.g.:
//   vercel env pull .env.production.local && node --env-file=.env.production.local scripts/register-merchant-gcp.mjs
import { google } from 'googleapis';

const developerEmail = process.argv[2];
if (!developerEmail) {
  console.error('Usage: node scripts/register-merchant-gcp.mjs <developer-email>');
  process.exit(1);
}

const credentialsJson = process.env.GOOGLE_MERCHANT_SERVICE_ACCOUNT_JSON;
const merchantId = process.env.GOOGLE_MERCHANT_ID;
if (!credentialsJson || !merchantId) {
  console.error('GOOGLE_MERCHANT_SERVICE_ACCOUNT_JSON and GOOGLE_MERCHANT_ID must be set');
  process.exit(1);
}

const authClient = new google.auth.GoogleAuth({
  credentials: JSON.parse(credentialsJson),
  scopes: ['https://www.googleapis.com/auth/content'],
});

const merchantapi = google.merchantapi({ version: 'accounts_v1', auth: authClient });
const accountName = `accounts/${merchantId}`;

const res = await merchantapi.accounts.developerRegistration.registerGcp({
  name: `${accountName}/developerRegistration`,
  requestBody: { developerEmail },
});

console.log(JSON.stringify(res.data, null, 2));
