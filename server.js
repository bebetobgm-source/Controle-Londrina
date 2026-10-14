import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Servir os arquivos estáticos gerados pelo Vite (pasta dist)
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// Fallback SPA: qualquer requisição retorna o index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor Express rodando com sucesso na porta ${PORT}`);
});
