import { clerkMiddleware, getAuth, requireAuth } from '@clerk/express';
import type { Express, RequestHandler } from "express";
import { storage } from "./storage";

export async function setupAuth(app: Express) {
  // Apply Clerk middleware globally - adds auth to all requests
  app.use(clerkMiddleware());
}

// Authentication middleware - requires user to be authenticated
export const isAuthenticated: RequestHandler = requireAuth();

// Optional authentication - populates req.auth if authenticated, but doesn't block if not
export const optionalAuth: RequestHandler = (req, res, next) => {
  // Clerk middleware already populates req.auth, so we just continue
  next();
};

// Helper to sync Clerk user to database
export async function syncClerkUser(userId: string, email: string | null, firstName: string | null, lastName: string | null, imageUrl: string | null) {
  await storage.upsertUser({
    id: userId,
    email: email || undefined,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    profileImageUrl: imageUrl || undefined,
  });
}
