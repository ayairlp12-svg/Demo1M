#!/usr/bin/env node

const db = require('./db');
const bcrypt = require('bcryptjs');

(async () => {
  try {
    const nuevaContraseña = 'admin123456';
    const hash = await bcrypt.hash(nuevaContraseña, 10);
    
    await db('admin_users')
      .where('username', 'admin')
      .update({ password_hash: hash });
    
    console.log('\n✅ CONTRASEÑA ACTUALIZADA\n');
    console.log('════════════════════════════════');
    console.log('Usuario: admin');
    console.log('Contraseña: admin123456');
    console.log('════════════════════════════════\n');
    console.log('Ahora puedes entrar en:');
    console.log('http://localhost:5001/admin-configuracion.html');
    console.log('(O tu URL de Cloudflare admin-configuracion.html)\n');
    
    await db.destroy();
    process.exit(0);
  } catch(err) {
    console.error('❌ Error:', err.message);
    await db.destroy();
    process.exit(1);
  }
})();
