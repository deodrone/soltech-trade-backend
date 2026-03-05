const admin = require('firebase-admin');

const initFirebase = () => {
  if (admin.apps.length) return;

  const serviceAccount = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf8')
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  console.log('Firebase Admin initialized');
};

module.exports = { admin, initFirebase };
