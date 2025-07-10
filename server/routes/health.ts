import express from 'express';

export const createHealthRouter = () => {
  const router = express.Router();
  
  router.get('/', (_req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString()
    });
  });
  
  return router;
};

// Temporary backward compatibility
export default createHealthRouter;