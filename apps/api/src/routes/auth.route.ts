import express, { Router } from 'express';
import { signInVerify, signupHandler, getMeHandler } from '../controller/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const authRouter: Router = express.Router();

authRouter.get('/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    service: 'api-auth',
  });
});

authRouter.post('/signup', signupHandler);
authRouter.post('/signin', signInVerify);
authRouter.get('/me', authMiddleware, getMeHandler);

export default authRouter;
