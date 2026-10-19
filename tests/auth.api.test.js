const request = require('supertest');
const jwt = require('jsonwebtoken');
const { crearAppDePrueba } = require('./helpers/sesion');

describe('API /auth y /usuarios', () => {
  let ctx;
  beforeEach(async () => {
    ctx = await crearAppDePrueba();
  });

  test('login correcto devuelve token y datos del usuario sin hash', async () => {
    const res = await request(ctx.app).post('/auth/login').send({ usuario: 'cajero', password: 'clave-cajero-1' });
    expect(res.status).toBe(200);
    expect(res.body.tipo).toBe('Bearer');
    expect(res.body.usuario).toEqual({ id: 2, usuario: 'cajero', nombre: 'Luis Vaca', rol: 'cajero', activo: true });
    expect(jwt.decode(res.body.token)).toMatchObject({ sub: '2', rol: 'cajero' });
  });

  test('login incorrecto responde 401 con el mismo mensaje para usuario o clave', async () => {
    const malaClave = await request(ctx.app).post('/auth/login').send({ usuario: 'admin', password: 'x' });
    const noExiste = await request(ctx.app).post('/auth/login').send({ usuario: 'pedro', password: 'x' });
    expect(malaClave.status).toBe(401);
    expect(noExiste.body.error).toBe(malaClave.body.error);
  });

  test('sin token, con token inválido o expirado responde 401', async () => {
    expect((await request(ctx.app).get('/productos')).status).toBe(401);
    const invalido = await request(ctx.app).get('/productos').set('Authorization', 'Bearer abc.def.ghi');
    expect(invalido.status).toBe(401);
    const otroSecreto = jwt.sign({ sub: '1', rol: 'admin' }, 'otro-secreto');
    expect((await request(ctx.app).get('/productos').set('Authorization', `Bearer ${otroSecreto}`)).status).toBe(401);
    const vencido = jwt.sign({ sub: '1', rol: 'admin', exp: Math.floor(Date.now() / 1000) - 60 }, 'secreto-de-pruebas');
    const res = await request(ctx.app).get('/productos').set('Authorization', `Bearer ${vencido}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/expiró/);
  });

  test('GET /auth/yo devuelve el usuario de la sesión', async () => {
    const res = await ctx.cajero.get('/auth/yo');
    expect(res.body).toMatchObject({ usuario: 'cajero', rol: 'cajero' });
  });

  test('el admin gestiona usuarios; el cajero no puede', async () => {
    const nuevo = await ctx.admin.post('/usuarios')
      .send({ usuario: 'carla', nombre: 'Carla Suárez', password: 'clave-carla-1', rol: 'cajero' });
    expect(nuevo.status).toBe(201);
    expect(nuevo.body.hash).toBeUndefined();
    expect((await ctx.admin.get('/usuarios')).body).toHaveLength(3);
    expect((await ctx.cajero.get('/usuarios')).status).toBe(403);
    expect((await ctx.cajero.post('/usuarios').send({})).status).toBe(403);
  });

  test('desactivar a un cajero le corta el acceso aunque su token siga vigente', async () => {
    expect((await ctx.cajero.get('/auth/yo')).status).toBe(200);
    const res = await ctx.admin.patch('/usuarios/2').send({ activo: false });
    expect(res.body.activo).toBe(false);
    const despues = await ctx.cajero.get('/auth/yo');
    expect(despues.status).toBe(401);
    expect(despues.body.error).toMatch(/desactivado/);
  });
});
