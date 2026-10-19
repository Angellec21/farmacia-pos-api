const jwt = require('jsonwebtoken');
const { HttpError } = require('./errors');

/**
 * Autenticación con JWT (HS256). El token lleva el id y el rol del usuario;
 * en cada petición se confirma que el usuario siga activo, así desactivar a un
 * cajero le corta el acceso aunque su token no haya expirado.
 */
function crearAuth({ usuarios, secreto, expiraEn = '8h' }) {
  if (!secreto) throw new Error('Falta el secreto para firmar los JWT');

  function login({ usuario, password } = {}) {
    const u = usuarios.verificarCredenciales(usuario, password);
    if (!u) throw new HttpError(401, 'Usuario o contraseña incorrectos');
    const token = jwt.sign({ sub: String(u.id), rol: u.rol }, secreto, { algorithm: 'HS256', expiresIn: expiraEn });
    return { token, tipo: 'Bearer', expiraEn, usuario: u };
  }

  function requerirSesion(req, res, next) {
    const [esquema, token] = (req.get('authorization') || '').split(' ');
    if (esquema !== 'Bearer' || !token) return next(new HttpError(401, 'Falta el token de acceso (Authorization: Bearer ...)'));
    let datos;
    try {
      datos = jwt.verify(token, secreto, { algorithms: ['HS256'] });
    } catch (e) {
      const msg = e.name === 'TokenExpiredError' ? 'La sesión expiró, vuelva a iniciar sesión' : 'Token inválido';
      return next(new HttpError(401, msg));
    }
    let u;
    try {
      u = usuarios.obtener(datos.sub);
    } catch {
      return next(new HttpError(401, 'Token inválido'));
    }
    if (!u.activo) return next(new HttpError(401, 'Usuario desactivado'));
    req.usuario = u;
    return next();
  }

  /** Middleware que deja pasar solo a los roles indicados (usar después de requerirSesion). */
  function permitir(...roles) {
    return (req, res, next) => {
      if (!req.usuario || !roles.includes(req.usuario.rol)) {
        return next(new HttpError(403, `Acción permitida solo para: ${roles.join(', ')}`));
      }
      return next();
    };
  }

  return { login, requerirSesion, permitir };
}

module.exports = { crearAuth };
