# Maarif Schools Cup — secure Firebase admin setup

This version does **not** contain an administrator email address or a client-side admin allow-list. The browser checks a Firebase ID token's `admin: true` custom claim. Firestore Rules independently enforce that claim on every write.

## 1. Enable Firebase Authentication

In Firebase Console → Authentication → Sign-in method, enable **Email/Password**. Create your normal administrator user in Authentication → Users if it does not already exist. The email is entered only into the login form; it is not configured or hard-coded in the website source.

## 2. Grant the admin claim from a trusted environment

1. In Firebase Console → Authentication → Users, open your administrator user and copy its **User UID**.
2. In Google Cloud Console, select project `maarif-football-project`, create/download a service-account key for a principal with Firebase Authentication user-management permissions. Keep the JSON key private and **never put it in the website folder, Git repository, or public hosting**.
3. On your own computer, put the key somewhere private (outside the website project).
4. Open a terminal in this `firebase-admin` folder and run `npm install`.
5. Set the environment variables below, replacing the example paths/UID with your own values.

### Windows PowerShell

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\private\firebase-service-account.json"
$env:GCLOUD_PROJECT = "maarif-football-project"
$env:ADMIN_UID = "PASTE_YOUR_FIREBASE_USER_UID"
$env:ADMIN_ACTION = "grant"
npm run grant-admin
```

### macOS / Linux

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/private/path/firebase-service-account.json"
export GCLOUD_PROJECT="maarif-football-project"
export ADMIN_UID="PASTE_YOUR_FIREBASE_USER_UID"
export ADMIN_ACTION="grant"
npm run grant-admin
```

To revoke the permission, set `ADMIN_ACTION` to `revoke` and run `npm run revoke-admin`.

## 3. Publish Firestore Rules

Firebase Console → Firestore Database → Rules. Replace the rules with the contents of `firestore.rules`, then click **Publish**. These rules allow public reads of the tournament document but allow writes only when the verified Firebase ID token contains `admin: true`.

## 4. Deploy the website and sign in

Upload the updated `app.js` and `index.html`. Sign out of Firebase and sign back in using the Firebase Authentication account that was granted the claim. The browser will refresh the ID token and reveal admin controls only when the server-issued claim is present.

## Security notes

- `app.js` contains no configured admin email and no admin password.
- Firebase web config (including the API key) is a client identifier, not an admin credential. Firestore Rules are the actual data-write boundary.
- Never ship the service-account JSON key or this setup script's credentials to the browser.
- If your Firebase project has other Firestore collections, merge the provided rule with the rules those collections need before publishing; unmatched paths are denied by default.
- The tournament document remains publicly readable because the site displays public league data. If that is not intended, change the read rule and implement the required public-data access pattern.
