import { NextFunction, Request, Response, Router } from 'express';
import { checkDatabase } from '../config/database';

const router = Router();

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await checkDatabase();
    res.status(200).json({ status: 'healthy', database: 'up' });
  } catch (error) {
    next(error);
  }
});

export default router;
