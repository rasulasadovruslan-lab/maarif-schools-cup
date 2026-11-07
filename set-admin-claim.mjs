/**
 * Grant or revoke the Firebase custom claim used by this website.
 * Run ONLY in a trusted local/admin environment, never from the website.
 * The service-account key must stay outside the website and source repository.
 *
 * Required environment variables:
 *   ADMIN_UID                       UID from Firebase Console -> Authentication -> Users
 *   GOOGLE_APPLICATION_CREDENTIALS  path to your service-account JSON key file
 * Optional:
 *   GCLOUD_PROJECT                  defaults to maarif-football-project
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const DEFAULT_PROJECT_ID = 'maarif-football-project'; // must match app.js firebaseConfig
const uid = process.env.ADMIN_UID?.trim();
const action = (process.argv[2] || process.env.ADMIN_ACTION || 'grant').trim().toLowerCase();
const projectId =
  process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || DEFAULT_PROJECT_ID;

if (!uid) {
  throw new Error('Set ADMIN_UID to the Firebase Authentication user UID.');
}
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  throw new Error(
    'Set GOOGLE_APPLICATION_CREDENTIALS to the full path of your service-account JSON key ' +
      '(Firebase Console -> Project settings -> Service accounts -> Generate new private key).',
  );
}
if (!['grant', 'revoke'].includes(action)) {
  throw new Error('ADMIN_ACTION must be either "grant" or "revoke".');
}

initializeApp({ credential: applicationDefault(), projectId });

const auth = getAuth();
const user = await auth.getUser(uid);
console.log(`Project: ${projectId}`);
console.log(`User:    ${user.email || '(no email)'}  (UID ${user.uid})`);

const nextClaims = { ...(user.customClaims || {}) };
if (action === 'grant') {
  nextClaims.admin = true;
} else {
  delete nextClaims.admin;
}

await auth.setCustomUserClaims(uid, nextClaims);
// Force the user to obtain a fresh ID token before the new claim is relied on.
await auth.revokeRefreshTokens(uid);

// Read it back so you can see it really stuck.
const verified = await auth.getUser(uid);
console.log('Claims now:', JSON.stringify(verified.customClaims || {}));
console.log(`Admin claim ${action === 'grant' ? 'granted to' : 'revoked from'} ${user.email || uid}.`);
console.log('Now sign in again on the website (hard-refresh the page first).');
