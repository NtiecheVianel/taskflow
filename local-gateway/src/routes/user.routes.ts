import { NextFunction, Request, Response, Router } from 'express';
import { dataService } from '../services/dataService';
import { requireEmail, requireName, requirePasswordHash, requireUuid } from '../validation';

const router = Router();

router.post('/by-email', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = requireEmail(req.body?.email);
    const user = await dataService.getUserByEmail(email);
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = requireUuid(req.params.id, 'Utilisateur');
    const user = await dataService.getUserById(id);
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await dataService.createUser({
      full_name: requireName(req.body?.full_name),
      email: requireEmail(req.body?.email),
      password_hash: requirePasswordHash(req.body?.password_hash),
    });
    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
});

export default router;
