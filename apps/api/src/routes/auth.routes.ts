import type { FastifyInstance, FastifyRequest } from "fastify";
import { createUserSchema, loginSchema, registerUserSchema, updateUserPreferencesSchema, updateUserSchema } from "@tfex/shared";
import type { Db } from "../db/client.js";
import { errors } from "../lib/errors.js";
import { rateLimit } from "../lib/rateLimit.js";
import { createSession, createUser, deleteSession, getUserPreferences, listUsers, resetUserPassword, toUserDto, updateUser, updateUserPreferences, userCount, type AuthUser } from "../services/auth.service.js";

declare module "fastify" {
  interface FastifyRequest { authUser?: AuthUser; authToken?: string }
}

export function requireUser(request: FastifyRequest): AuthUser {
  if (!request.authUser) throw errors.unauthorized();
  return request.authUser;
}

export function requireAdmin(request: FastifyRequest): AuthUser {
  const user = requireUser(request);
  if (user.role !== "ADMIN") throw errors.forbidden();
  return user;
}

export function registerAuthRoutes(app: FastifyInstance, db: Db) {
  app.get("/api/auth/status", async () => ({ data: { needsBootstrap: userCount(db) === 0 } }));

  app.post("/api/auth/bootstrap", async (request) => {
    if (userCount(db) !== 0) throw errors.forbidden("Administrator already exists");
    const input = createUserSchema.omit({ role: true }).parse(request.body);
    createUser(db, { ...input, role: "ADMIN" });
    return { data: createSession(db, input.email, input.password) };
  });

  app.post("/api/auth/login", async (request) => {
    const input = loginSchema.parse(request.body);
    return { data: createSession(db, input.email, input.password) };
  });

  app.post("/api/auth/register", async (request) => {
    rateLimit(`register:${request.ip}`, 5, 15 * 60 * 1000);
    const input = registerUserSchema.parse(request.body);
    const user = createUser(db, { email: input.email, displayName: input.displayName, password: input.password, role: "USER", isActive: false });
    return { data: toUserDto(user) };
  });

  app.get("/api/auth/me", async (request) => ({ data: requireUser(request) }));
  app.post("/api/auth/logout", async (request) => {
    requireUser(request);
    if (request.authToken) deleteSession(db, request.authToken);
    return { data: { success: true } };
  });

  app.get("/api/admin/users", async (request) => {
    requireAdmin(request);
    return { data: listUsers(db) };
  });
  app.post("/api/admin/users", async (request) => {
    requireAdmin(request);
    return { data: toUserDto(createUser(db, createUserSchema.parse(request.body))) };
  });
  app.patch<{ Params: { id: string } }>("/api/admin/users/:id", async (request) => {
    requireAdmin(request);
    const input = updateUserSchema.parse(request.body);
    return { data: updateUser(db, Number(request.params.id), input) };
  });

  app.post<{ Params: { id: string } }>("/api/admin/users/:id/reset-password", async (request) => {
    requireAdmin(request);
    const temporaryPassword = resetUserPassword(db, Number(request.params.id));
    return { data: { temporaryPassword } };
  });

  app.get("/api/me/preferences", async (request) => ({ data: getUserPreferences(db, requireUser(request).id) }));
  app.put("/api/me/preferences", async (request) => {
    const user = requireUser(request);
    const input = updateUserPreferencesSchema.parse(request.body);
    return { data: updateUserPreferences(db, user.id, input.brokerIds, input.instrumentIds) };
  });
}
