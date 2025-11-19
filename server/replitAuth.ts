// Blueprint reference: javascript_log_in_with_replit
import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  
  // Use memory store if DATABASE_URL is not available (for frontend-only mode)
  let sessionStore: session.Store;
  if (process.env.DATABASE_URL) {
    try {
  const pgStore = connectPg(session);
      sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
    } catch (error) {
      console.warn('Failed to create PostgreSQL session store, using memory store:', error instanceof Error ? error.message : String(error));
      const MemoryStore = require('memorystore')(session);
      sessionStore = new MemoryStore({
        checkPeriod: 86400000, // prune expired entries every 24h
      });
    }
  } else {
    // Use memory store when DATABASE_URL is not set
    const MemoryStore = require('memorystore')(session);
    sessionStore = new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    });
  }
  
  return session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
): Promise<string> {
  const email = claims["email"];
  
  // Try to find existing user by email to preserve data from Clerk migration
  if (email) {
    const existingUser = await storage.getUserByEmail(email);
    if (existingUser) {
      // Update existing user record, preserving their ID
      await storage.upsertUser({
        id: existingUser.id, // Keep existing ID to preserve FK relationships
        email: email,
        firstName: claims["first_name"],
        lastName: claims["last_name"],
        profileImageUrl: claims["profile_image_url"],
      });
      // Return the existing database ID for session storage
      return existingUser.id;
    }
  }
  
  // No existing user found, create new one with Replit subject as ID
  await storage.upsertUser({
    id: claims["sub"],
    email: email,
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
  
  // Return the new user's ID (Replit subject)
  return claims["sub"];
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // Local development bypass - create a mock user if ENABLE_LOCAL_AUTH is set
  if (process.env.ENABLE_LOCAL_AUTH === "true") {
    // Create or get a local dev user (only if DB is available)
    try {
    const localDevUserId = "local-dev-user";
    const localDevUser = await storage.getUserById(localDevUserId).catch(() => null);
    if (!localDevUser) {
      await storage.upsertUser({
        id: localDevUserId,
        email: "dev@localhost",
        firstName: "Local",
        lastName: "Developer",
        }).catch((err) => {
          console.warn('Could not create local dev user (DB may be unavailable):', err.message);
      });
      }
    } catch (err) {
      console.warn('Local auth setup skipped (DB unavailable):', err instanceof Error ? err.message : String(err));
    }

    // Middleware to auto-authenticate in local dev - must run before routes
    app.use(async (req, res, next) => {
      // Always authenticate for local dev
      const user: any = {
        dbUserId: localDevUserId,
        expires_at: Math.floor(Date.now() / 1000) + 86400, // 24 hours
      };
      
      // If user is already authenticated, continue
      if (req.isAuthenticated() && (req.user as any)?.dbUserId === localDevUserId) {
        return next();
      }
      
      // Set user directly on request for immediate use
      (req as any).user = user;
      
      // Override isAuthenticated to return true for local dev
      (req as any).isAuthenticated = () => true;
      
      // Login via passport for session persistence (async)
      if (!req.session?.passport?.user) {
        req.login(user, (err) => {
          if (err) {
            console.error("[Local Auth] Login error:", err);
          }
          next();
        });
      } else {
        next();
      }
    });

    passport.serializeUser((user: Express.User, cb) => cb(null, user));
    passport.deserializeUser((user: Express.User, cb) => cb(null, user));
    return; // Skip Replit auth setup
  }

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user: any = {};
    updateUserSession(user, tokens);
    // Get the actual database user ID (handles both new users and Clerk migrations)
    user.dbUserId = await upsertUser(tokens.claims());
    verified(null, user);
  };

  const registeredStrategies = new Set<string>();

  const ensureStrategy = (domain: string) => {
    const strategyName = `replitauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`,
        },
        verify,
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};

// Optional authentication - populates req.user if authenticated, but doesn't block if not
export const optionalAuth: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  // If not authenticated, just continue
  if (!req.isAuthenticated() || !user?.expires_at) {
    return next();
  }

  const now = Math.floor(Date.now() / 1000);
  
  // Token still valid, continue
  if (now <= user.expires_at) {
    return next();
  }

  // Try to refresh if expired
  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    return next(); // Continue without auth
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
  } catch (error) {
    // Refresh failed, but continue anyway (user will be treated as unauthenticated)
  }
  
  next();
};
