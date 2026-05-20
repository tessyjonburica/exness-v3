import express, { Router } from 'express';
import { getUserBalance } from '../controller/user.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const balanceRouter: Router = express.Router();

balanceRouter.get('/me', authMiddleware, getUserBalance);

export default balanceRouter;
