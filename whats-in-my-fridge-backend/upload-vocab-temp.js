const admin = require('./functions/node_modules/firebase-admin');
const fs = require('fs');
const path = require('path');

// Inicializar Firebase Admin
const serviceAccount = require('./service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'what-s-in-my-fridge-a2a07.appspot.com'
});

const bucket = admin.storage().bucket();

async function uploadVocabulary() {
  try {
    const vocabularyPath = path.join(__dirname, 'data/normalized-ingredients.json');
    const destination = 'normalized-ingredients.json';

    console.log('📤 Subiendo vocabulario normalizado a Firebase Storage...');

    await bucket.upload(vocabularyPath, {
      destination: destination,
      metadata: {
        contentType: 'application/json',
        metadata: {
          uploadedAt: new Date().toISOString()
        }
      }
    });

    console.log('✅ Vocabulario subido exitosamente!');
    console.log(`   Archivo: ${destination}`);

    // Verificar el tamaño del archivo
    const data = JSON.parse(fs.readFileSync(vocabularyPath, 'utf-8'));
    console.log(`   Total de ingredientes: ${Object.keys(data.ingredients).length}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error al subir vocabulario:', error);
    process.exit(1);
  }
}

uploadVocabulary();
