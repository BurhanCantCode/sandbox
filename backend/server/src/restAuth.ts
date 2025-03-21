import { clerkClient, User as ClerkUser } from '@clerk/clerk-sdk-node';
import { NextFunction, Request, Response } from 'express';

/**
 * Type declarations to extend Express Request
 */
declare global {
  namespace Express {
    interface Request {
      user?: ClerkUser;
      auth?: {
        userId: string;
        sessionId?: string;
      };
    }
  }
}

/**
 * Middleware for requiring authentication with Clerk.
 * Verifies the JWT token in the Authorization header and attaches
 * the user to the request object.
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }
    
    const token = authHeader.substring(7);
    
    try {
      // Verify token with Clerk
      const decoded = await clerkClient.verifyToken(token);
      
      // Get user from Clerk
      const user = await clerkClient.users.getUser(decoded.sub);
      
      // Attach user info to request
      req.user = user;
      req.auth = {
        userId: user.id,
        sessionId: decoded.sid
      };
      
      next();
    } catch (err) {
      return res.status(401).json({
        error: 'Invalid token'
      });
    }
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(500).json({
      error: 'Server error'
    });
  }
};

/**
 * Middleware for optional authentication with Clerk.
 * Will attach the user to the request if a valid token is provided,
 * but will not block the request if no token is provided or the token is invalid.
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Continue without authentication
    }
    
    const token = authHeader.substring(7);
    
    try {
      // Verify token with Clerk
      const decoded = await clerkClient.verifyToken(token);
      
      // Get user from Clerk
      const user = await clerkClient.users.getUser(decoded.sub);
      
      // Attach user info to request
      req.user = user;
      req.auth = {
        userId: user.id,
        sessionId: decoded.sid
      };
    } catch (err) {
      // Token verification failed, but we continue anyway (it's optional)
      console.warn('Optional auth failed:', (err as Error).message);
    }
    
    next();
  } catch (err) {
    // We still continue with the request even if there's an unexpected error
    console.error('Unexpected error in optional auth middleware:', err);
    next();
  }
}; 