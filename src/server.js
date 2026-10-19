const crypto = require('crypto');
const { createApp } = require('./app');
const { crearUsuarios } = require('./services/usuarios');

const PORT = process.env.PORT || 3000;

if (!process.env.JWT_SECRET) {
  console.warn('[aviso] JWT_SECRET no está definido: se usa un secreto temporal y las sesiones se pierden al reiniciar.');
}

// Primer administrador: desde variables de entorno o con contraseña temporal aleatoria.
const usuarios = crearUsuarios();
const adminUsuario = process.env.ADMIN_USUARIO || 'admin';
const adminPassword = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
usuarios.crear({ usuario: adminUsuario, nombre: 'Administrador', password: adminPassword, rol: 'admin' });
if (!process.env.ADMIN_PASSWORD) {
  console.log(`Administrador inicial: ${adminUsuario} / ${adminPassword} (defina ADMIN_PASSWORD para fijarla)`);
}

createApp({ usuarios }).listen(PORT, () => {
  console.log(`farmacia-pos-api escuchando en http://localhost:${PORT}`);
});
