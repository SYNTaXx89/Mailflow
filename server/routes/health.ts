import express from 'express';

const router = express.Router();
const isDevelopment = process.env.NODE_ENV !== 'production';

router.get('/', (_req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: isDevelopment ? 'development' : 'production'
  });
});

export default router;