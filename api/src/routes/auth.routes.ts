import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { authLimiter } from '../middlewares/rate-limit.js';
import { requireAuth } from '../middlewares/require-auth.js';
import {
  signupSchema,
  preloginSchema,
  loginSchema,
  twoFactorSchema,
  verifyEmailSchema,
  refreshSchema,
  logoutSchema,
  setTwoFactorSchema,
  recoveryStartSchema,
  recoveryVerifySchema,
  recoveryResetSchema,
} from '../validators/auth.validators.js';
import * as auth from '../controllers/auth.controller.js';

export const authRouter = Router();

// Brute-force protection is applied ONLY to secret-guessing / OTP endpoints, and
// only failed attempts count (see authLimiter). The rest ride the global
// apiLimiter (100 / 15 min), so a normal login (prelogin + login) or signup
// onboarding never trips the strict budget.
authRouter.post('/signup', validate({ body: signupSchema }), auth.signup);
authRouter.post('/prelogin', validate({ body: preloginSchema }), auth.prelogin);
authRouter.post('/login', authLimiter, validate({ body: loginSchema }), auth.login);
authRouter.post('/2fa', authLimiter, validate({ body: twoFactorSchema }), auth.twoFactor);
authRouter.post('/verify-email', authLimiter, validate({ body: verifyEmailSchema }), auth.verifyEmail);
authRouter.post('/refresh', validate({ body: refreshSchema }), auth.refresh);
authRouter.post('/logout', validate({ body: logoutSchema }), auth.logout);

authRouter.post('/recovery/start', validate({ body: recoveryStartSchema }), auth.recoveryStart);
authRouter.post('/recovery/verify', authLimiter, validate({ body: recoveryVerifySchema }), auth.recoveryVerify);
authRouter.post('/recovery/reset', validate({ body: recoveryResetSchema }), auth.recoveryReset);

// Authenticated
export const meRouter = Router();
meRouter.use(requireAuth);
meRouter.get('/', auth.getMe);
meRouter.post('/2fa', validate({ body: setTwoFactorSchema }), auth.setTwoFactor);
