/**
 * Grant or revoke the Firebase custom claim used by this website.
 * Run ONLY in a trusted local/admin environment, never from the website.
 * The service-account key must stay outside the website and source repository.
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const uid = process.env.ADMIN_UID?.trim();
const action = (process.argv[2] || process.env.ADMIN_ACTION || 'grant').trim().toLowerCase();
const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;

if (!uid) {
  throw new Error('Set ADMIN_UID to the Firebase Authentication user UID.');
}
if (!['grant', 'revoke'].includes(action)) {
  throw new Error('ADMIN_ACTION must be either "grant" or "revoke".');
}

initializeApp({
  credential: applicationDefault(),
  ...(projectId ? { projectId } : {}),
});

const auth = getAuth();
const user = await auth.getUser(uid);
const existingClaims = user.customClaims || {};
const nextClaims = { ...existingClaims };

if (action === 'grant') {
  nextClaims.admin = true;
} else {
  delete nextClaims.admin;
}

await auth.setCustomUserClaims(uid, nextClaims);
// Force the user to obtain a fresh ID token before the new claim is relied on.
await auth.revokeRefreshTokens(uid);

console.log(`Admin claim ${action === 'grant' ? 'granted to' : 'revoked from'} UID ${uid}.`);
console.log('The user must sign out and sign in again to refresh their ID token.');
