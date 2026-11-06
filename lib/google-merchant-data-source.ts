export function getGoogleMerchantDataSourceName(
  accountName: string,
  contentLanguage: string,
  env: NodeJS.ProcessEnv = process.env
): string {
  const id = contentLanguage === 'en'
    ? env.GOOGLE_MERCHANT_DATASOURCE_EN_ID || '10791684150'
    : env.GOOGLE_MERCHANT_DATASOURCE_ID;
  if (!id) throw new Error('GOOGLE_MERCHANT_DATASOURCE_ID env var is not set');
  return `${accountName}/dataSources/${id}`;
}