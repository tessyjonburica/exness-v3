import express, { Router } from 'express';
import {
  createMockDeposit,
  createMockWithdrawal,
  fetchTransactions,
} from '../controller/funding.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const fundingRouter: Router = express.Router();

fundingRouter.get('/transactions', authMiddleware, fetchTransactions);
fundingRouter.post('/deposits/mock', authMiddleware, createMockDeposit);
fundingRouter.post('/withdrawals/mock', authMiddleware, createMockWithdrawal);

export default fundingRouter;
