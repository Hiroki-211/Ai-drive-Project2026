import { Router } from 'express';

const todoViewRouter = Router();

// GET /todo: TODO画面を表示する
todoViewRouter.get('/', (req, res) => {
  res.render('todo/index');
});

export default todoViewRouter;
