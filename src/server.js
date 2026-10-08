const { createApp } = require('./app');

const PORT = process.env.PORT || 3000;

createApp().listen(PORT, () => {
  console.log(`farmacia-pos-api escuchando en http://localhost:${PORT}`);
});
