import express, { type Request, type Response } from 'express';
import cors from 'cors';
import swaggerJsDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import * as dotenv from 'dotenv'; // 1. Import dotenv

dotenv.config(); // 2. Kích hoạt dotenv

const app = express();
// 3. Sử dụng PORT từ file .env, nếu không có thì mặc định là 3000
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Cập nhật Swagger dùng PORT từ môi trường
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BE-HCMSIU-SSPS API',
      version: '1.0.0',
    },
    servers: [{ url: `http://localhost:${PORT}` }],
  },
  apis: ['./src/index.ts'],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

app.listen(PORT, () => {
  console.log(`[server]: Server is running at http://localhost:${PORT}`);
  console.log(`[swagger]: Docs available at http://localhost:${PORT}/api-docs`);
});