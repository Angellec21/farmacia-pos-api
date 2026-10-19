const { crearUsuarios, hashPassword, verificarPassword } = require('../src/services/usuarios');

describe('servicio de usuarios', () => {
  let usuarios;
  beforeEach(() => {
    usuarios = crearUsuarios();
    usuarios.crear({ usuario: 'Rosa.G', nombre: 'Rosa Gutiérrez', password: 'clave-segura', rol: 'admin' });
  });

  test('guarda el usuario en minúsculas y nunca expone el hash', () => {
    const u = usuarios.listar()[0];
    expect(u).toEqual({ id: 1, usuario: 'rosa.g', nombre: 'Rosa Gutiérrez', rol: 'admin', activo: true });
  });

  test('hash con sal aleatoria: misma clave, hashes distintos, ambos válidos', () => {
    const a = hashPassword('farmacia123');
    const b = hashPassword('farmacia123');
    expect(a).not.toBe(b);
    expect(verificarPassword('farmacia123', a)).toBe(true);
    expect(verificarPassword('otra-clave', a)).toBe(false);
    expect(verificarPassword('x', 'texto-plano')).toBe(false);
  });

  test('verifica credenciales', () => {
    expect(usuarios.verificarCredenciales('ROSA.G', 'clave-segura')).toMatchObject({ id: 1, rol: 'admin' });
    expect(usuarios.verificarCredenciales('rosa.g', 'mala-clave')).toBeNull();
    expect(usuarios.verificarCredenciales('nadie', 'clave-segura')).toBeNull();
  });

  test('validaciones al crear', () => {
    const base = { usuario: 'luis', nombre: 'Luis Vaca', password: 'clave-cajero', rol: 'cajero' };
    expect(() => usuarios.crear({ ...base, usuario: 'a b' })).toThrow(/usuario/);
    expect(() => usuarios.crear({ ...base, password: 'corta' })).toThrow(/8 caracteres/);
    expect(() => usuarios.crear({ ...base, rol: 'gerente' })).toThrow(/rol/);
    expect(() => usuarios.crear({ ...base, usuario: 'rosa.g' })).toThrow(/ya existe/);
    expect(usuarios.crear(base).rol).toBe('cajero');
  });

  test('un usuario desactivado no puede entrar y no se desactiva al único admin', () => {
    const cajero = usuarios.crear({ usuario: 'luis', nombre: 'Luis Vaca', password: 'clave-cajero', rol: 'cajero' });
    usuarios.cambiarEstado(cajero.id, false);
    expect(usuarios.verificarCredenciales('luis', 'clave-cajero')).toBeNull();
    expect(() => usuarios.cambiarEstado(1, false)).toThrow(/único administrador/);
    expect(() => usuarios.cambiarEstado(1, 'no')).toThrow(/true o false/);
  });
});
