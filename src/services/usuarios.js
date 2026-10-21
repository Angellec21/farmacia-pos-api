const crypto = require('crypto');
const { HttpError } = require('../errors');

const ROLES = ['admin', 'cajero'];
const PATRON_USUARIO = /^[a-z0-9._-]{3,30}$/;
const LARGO_MINIMO_PASSWORD = 8;

function hashPassword(password, sal = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, sal, 64).toString('hex');
  return `scrypt$${sal}$${hash}`;
}

function verificarPassword(password, guardado) {
  const [algoritmo, sal, hash] = String(guardado).split('$');
  if (algoritmo !== 'scrypt' || !sal || !hash) return false;
  const esperado = Buffer.from(hash, 'hex');
  const calculado = crypto.scryptSync(password, sal, esperado.length);
  return crypto.timingSafeEqual(esperado, calculado);
}

function publico({ hash, ...resto }) {
  return resto;
}

/**
 * Usuarios del sistema. Las contraseñas nunca se guardan en texto plano:
 * se derivan con scrypt y una sal aleatoria por usuario.
 */
function crearUsuarios() {
  const usuarios = [];
  let siguienteId = 1;

  function crear({ usuario, nombre, password, rol } = {}) {
    const login = typeof usuario === 'string' ? usuario.trim().toLowerCase() : '';
    if (!PATRON_USUARIO.test(login)) {
      throw new HttpError(400, 'usuario debe tener 3 a 30 caracteres: minúsculas, números, punto, guion');
    }
    if (!nombre || typeof nombre !== 'string') throw new HttpError(400, 'nombre es obligatorio');
    if (typeof password !== 'string' || password.length < LARGO_MINIMO_PASSWORD) {
      throw new HttpError(400, `password debe tener al menos ${LARGO_MINIMO_PASSWORD} caracteres`);
    }
    if (!ROLES.includes(rol)) throw new HttpError(400, `rol debe ser uno de: ${ROLES.join(', ')}`);
    if (usuarios.some((u) => u.usuario === login)) throw new HttpError(409, `El usuario ${login} ya existe`);

    const nuevo = { id: siguienteId++, usuario: login, nombre: nombre.trim(), rol, activo: true, hash: hashPassword(password) };
    usuarios.push(nuevo);
    return publico(nuevo);
  }

  function buscar(id) {
    const u = usuarios.find((x) => x.id === Number(id));
    if (!u) throw new HttpError(404, 'Usuario no encontrado');
    return u;
  }

  /** Devuelve el usuario si las credenciales son correctas y está activo; si no, null. */
  function verificarCredenciales(usuario, password) {
    const login = typeof usuario === 'string' ? usuario.trim().toLowerCase() : '';
    const u = usuarios.find((x) => x.usuario === login);
    if (!u || !u.activo || typeof password !== 'string') return null;
    return verificarPassword(password, u.hash) ? publico(u) : null;
  }

  function cambiarEstado(id, activo) {
    if (typeof activo !== 'boolean') throw new HttpError(400, 'activo debe ser true o false');
    const u = buscar(id);
    if (!activo && u.rol === 'admin' && usuarios.filter((x) => x.rol === 'admin' && x.activo).length === 1) {
      throw new HttpError(409, 'No se puede desactivar al único administrador activo');
    }
    u.activo = activo;
    return publico(u);
  }

  return {
    crear,
    verificarCredenciales,
    cambiarEstado,
    obtener: (id) => publico(buscar(id)),
    listar: () => usuarios.map(publico),
    cantidad: () => usuarios.length,
    // Se exporta el hash (nunca la contraseña) para poder restaurar las sesiones de acceso.
    exportar: () => ({ siguienteId, usuarios: structuredClone(usuarios) }),
    importar(estado) {
      usuarios.splice(0, usuarios.length, ...structuredClone(estado.usuarios || []));
      siguienteId = estado.siguienteId || usuarios.length + 1;
    },
  };
}

module.exports = { crearUsuarios, hashPassword, verificarPassword, ROLES };
