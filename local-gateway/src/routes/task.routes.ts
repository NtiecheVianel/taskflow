import { NextFunction, Request, Response, Router } from 'express';
import { dataService } from '../services/dataService';
import {
  optionalDueDate,
  optionalPriority,
  optionalStatus,
  optionalText,
  requirePriority,
  requireStatus,
  requireTitle,
  requireUuid,
} from '../validation';

const router = Router();

function userIdFrom(req: Request): string {
  return requireUuid(req.query.userId || req.body?.userId || req.body?.user_id, 'Utilisateur');
}

router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await dataService.getTaskStats(userIdFrom(req));
    res.status(200).json(stats);
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tasks = await dataService.getTasks(userIdFrom(req));
    res.status(200).json(tasks);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const task = await dataService.getTaskById(requireUuid(req.params.id, 'Tâche'), userIdFrom(req));
    res.status(200).json(task);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const task = await dataService.createTask({
      user_id: requireUuid(req.body?.user_id, 'Utilisateur'),
      title: requireTitle(req.body?.title),
      description: optionalText(req.body?.description) ?? null,
      status: requireStatus(req.body?.status),
      priority: requirePriority(req.body?.priority),
      due_date: optionalDueDate(req.body?.due_date) ?? null,
    });
    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const task = await dataService.updateTask(requireUuid(req.params.id, 'Tâche'), userIdFrom(req), {
      title: req.body?.title !== undefined ? requireTitle(req.body.title) : undefined,
      description: optionalText(req.body?.description),
      status: optionalStatus(req.body?.status),
      priority: optionalPriority(req.body?.priority),
      due_date: optionalDueDate(req.body?.due_date),
    });
    res.status(200).json(task);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const success = await dataService.deleteTask(requireUuid(req.params.id, 'Tâche'), userIdFrom(req));
    res.status(200).json({ success });
  } catch (error) {
    next(error);
  }
});

export default router;
