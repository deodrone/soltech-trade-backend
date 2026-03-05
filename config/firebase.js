const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

const initFirebase = () => {
  if (getApps().length) return;

  const serviceAccount = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf8')
  );

  initializeApp({ credential: cert(serviceAccount) });

  console.log(JSON.stringify({ event: 'firebase_initialized' }));
};

// Compatibility shim so existing callers keep working as admin.auth().verifyIdToken(...)
const admin = { auth: () => getAuth() };

module.exports = { admin, initFirebase };
