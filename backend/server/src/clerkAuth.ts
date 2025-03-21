import { clerkClient } from '@clerk/clerk-sdk-node';
import { Socket } from "socket.io";

/**
 * Middleware for verifying Clerk JWT tokens in socket connections.
 * This runs before the existing socketAuth and enhances security.
 */
export const socketClerkAuth = async (socket: Socket, next: Function) => {
  try {
    // Get token from auth object (sent by the client)
    const token = socket.handshake.auth?.token;
    
    if (!token) {
      // If no token is provided, proceed to the next middleware
      // This maintains backward compatibility and allows the existing auth to handle it
      return next();
    }
    
    try {
      // Verify the token using Clerk's official method
      const decoded = await clerkClient.verifyToken(token);
      
      // Get the user from Clerk API
      const user = await clerkClient.users.getUser(decoded.sub);
      
      if (!user) {
        return next(new Error("Unauthorized: User not found"));
      }
      
      // Store Clerk user data in socket for later use
      socket.data.clerkUser = user;
      
      // Continue to the next middleware
      return next();
    } catch (err) {
      // Log authentication errors but continue to next middleware
      // This allows the existing auth to still work even if Clerk auth fails
      const error = err as Error;
      console.warn("Clerk auth failed, falling back to standard auth:", error.message);
      return next();
    }
  } catch (err) {
    // Handle any unexpected errors and pass to the next middleware
    const error = err as Error;
    console.error("Unexpected error in Clerk auth middleware:", error.message);
    return next();
  }
}; 