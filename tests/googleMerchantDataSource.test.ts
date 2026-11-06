import assert from 'node:assert/strict';
import test from 'node:test';
import { getGoogleMerchantDataSourceName } from '../lib/google-merchant-data-source';

test('English products use the new Chile API source, not the default source', () => {
  const env = { GOOGLE_MERCHANT_DATASOURCE_ID: 'spanish-source' };
  assert.equal(
    getGoogleMerchantDataSourceName('accounts/5745887023', 'en', env),
    'accounts/5745887023/dataSources/10791684150'
  );
  assert.equal(
    getGoogleMerchantDataSourceName('accounts/5745887023', 'es', env),
    'accounts/5745887023/dataSources/spanish-source'
  );
});

test('English source can be overridden without changing the default source', () => {
  assert.equal(
    getGoogleMerchantDataSourceName('accounts/5745887023', 'en', {
      GOOGLE_MERCHANT_DATASOURCE_EN_ID: 'english-source'
    }),
    'accounts/5745887023/dataSources/english-source'
  );
  assert.throws(
    () => getGoogleMerchantDataSourceName('accounts/5745887023', 'es', {}),
    /GOOGLE_MERCHANT_DATASOURCE_ID/
  );
});