const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Generate VAPID key pair
function generateVAPIDKeys() {
  // Generate a 256-bit private key
  const privateKeyBuffer = crypto.randomBytes(32);
  const privateKey = privateKeyBuffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  // Create public key from private key
  const ec = crypto.createECDH('prime256v1');
  ec.setPrivateKey(privateKeyBuffer);
  const publicKeyBuffer = ec.getPublicKey();
  const publicKey = publicKeyBuffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  return { publicKey, privateKey };
}

// Add or update env variables
function updateEnvFile() {
  const { publicKey, privateKey } = generateVAPIDKeys();
  
  const envPath = path.join(process.cwd(), '.env.local');
  let envContent = '';

  // Read existing env file if it exists
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8');
    // Remove existing VAPID keys
    envContent = envContent
      .split('\n')
      .filter(line => !line.startsWith('NEXT_PUBLIC_VAPID_PUBLIC_KEY') && !line.startsWith('VAPID_PRIVATE_KEY'))
      .join('\n');
  }

  // Add new VAPID keys
  const newEnvContent = envContent.trimEnd() + '\n' + 
    `NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}\n` +
    `VAPID_PRIVATE_KEY=${privateKey}\n`;

  fs.writeFileSync(envPath, newEnvContent);

  console.log('\n✅ VAPID keys generated successfully!\n');
  console.log('Public Key (NEXT_PUBLIC_VAPID_PUBLIC_KEY):');
  console.log(publicKey);
  console.log('\nPrivate Key (VAPID_PRIVATE_KEY):');
  console.log(privateKey);
  console.log('\n✅ Keys saved to .env.local');
  console.log('🔄 Restart your dev server to apply changes.\n');
}

try {
  updateEnvFile();
} catch (error) {
  console.error('❌ Error generating VAPID keys:', error.message);
  process.exit(1);
}
