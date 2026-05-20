import express, { Router } from 'express';
import authRouter from './auth.route';
import tradeRouter from './trade.route';
import balanceRouter from './balance.route';
import fundingRouter from './funding.route';

const mainRouter: Router = express.Router();

mainRouter.use('/auth', authRouter);
mainRouter.use('/trade', tradeRouter);
mainRouter.use('/balance', balanceRouter);
mainRouter.use('/', fundingRouter);

export default mainRouter;
