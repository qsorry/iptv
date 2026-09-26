import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/infrastructure/database/client";
import { auditLogs, contentProviders, providerServers, providerUsernamePrefixes } from "@/infrastructure/database/schema";
import { ConflictError, NotFoundError } from "@/core/errors";
import type { Actor } from "@/modules/providers";
import { parseInput } from "@/modules/providers/validations";
import { serverSchema } from "../validations";
import { toLatinDigits } from "../domain/codes";

/** سجلات التدقيق تُربط بالمزوّد لتظهر في سجل صفحة مراجعته. */
export async function auditProvider(executor: DbExecutor, actor: Actor, action: string, providerId: string, newValues: Record<string, unknown>) {
  await executor.insert(auditLogs).values({
    storeId: null,
    userId: actor.userId,
    action,
    entityType: "content_provider",
    entityId: providerId,
    newValues: { ...newValues, by: actor.email },
  });
}

async function loadServer(executor: DbExecutor, id: string) {
  const [server] = await executor.select().from(providerServers).where(eq(providerServers.id, id));
  if (!server) throw new NotFoundError("الخادم", id);
  return server;
}

/** يرفض بادئة يملكها خادم آخر، ويذكر المزوّد المالك ليعرف المدير أين يعدّلها. */
async function assertPrefixesFree(executor: DbExecutor, prefixes: string[], serverId: string | null) {
  const taken = await executor
    .select({ prefix: providerUsernamePrefixes.prefix, provider: contentProviders.name, server: providerServers.label })
    .from(providerUsernamePrefixes)
    .innerJoin(providerServers, eq(providerServers.id, providerUsernamePrefixes.serverId))
    .innerJoin(contentProviders, eq(contentProviders.id, providerServers.providerId))
    .where(serverId ? and(inArray(providerUsernamePrefixes.prefix, prefixes), ne(providerUsernamePrefixes.serverId, serverId)) : inArray(providerUsernamePrefixes.prefix, prefixes));
  if (taken.length > 0) {
    const t = taken[0];
    throw new ConflictError(`البادئة «${t.prefix}» مستخدمة لدى ${t.provider} (${t.server})`);
  }
}

async function replacePrefixes(executor: DbExecutor, serverId: string, prefixes: string[]) {
  await executor.delete(providerUsernamePrefixes).where(eq(providerUsernamePrefixes.serverId, serverId));
  await executor.insert(providerUsernamePrefixes).values(prefixes.map((prefix) => ({ serverId, prefix })));
}

/** خوادم المزوّد مع بادئاتها (لصفحة الإدارة). */
export async function listProviderServers(providerId: string) {
  const servers = await db.select().from(providerServers).where(eq(providerServers.providerId, providerId)).orderBy(asc(providerServers.createdAt));
  if (servers.length === 0) return [];
  const prefixes = await db
    .select()
    .from(providerUsernamePrefixes)
    .where(inArray(providerUsernamePrefixes.serverId, servers.map((s) => s.id)))
    .orderBy(asc(providerUsernamePrefixes.prefix));
  return servers.map((s) => ({ ...s, prefixes: prefixes.filter((p) => p.serverId === s.id).map((p) => p.prefix) }));
}

export async function createProviderServer(providerId: string, input: unknown, actor: Actor) {
  const data = parseInput(serverSchema, input);
  return db.transaction(async (tx) => {
    const provider = await tx.query.contentProviders.findFirst({ where: eq(contentProviders.id, providerId) });
    if (!provider) throw new NotFoundError("المزوّد", providerId);
    await assertPrefixesFree(tx, data.prefixes, null);
    const [server] = await tx.insert(providerServers).values({ providerId, label: data.label, baseUrl: data.baseUrl, isActive: data.isActive }).returning();
    await replacePrefixes(tx, server.id, data.prefixes);
    await auditProvider(tx, actor, "player.server_created", providerId, { label: data.label, baseUrl: data.baseUrl, prefixes: data.prefixes });
    return { ...server, prefixes: data.prefixes };
  });
}

export async function updateProviderServer(serverId: string, input: unknown, actor: Actor) {
  const data = parseInput(serverSchema, input);
  return db.transaction(async (tx) => {
    const server = await loadServer(tx, serverId);
    await assertPrefixesFree(tx, data.prefixes, serverId);
    await tx
      .update(providerServers)
      .set({ label: data.label, baseUrl: data.baseUrl, isActive: data.isActive, updatedAt: new Date() })
      .where(eq(providerServers.id, serverId));
    await replacePrefixes(tx, serverId, data.prefixes);
    await auditProvider(tx, actor, "player.server_updated", server.providerId, { label: data.label, baseUrl: data.baseUrl, prefixes: data.prefixes, isActive: data.isActive });
  });
}

/** حذف الخادم يحذف بادئاته وأكواد التفعيل المرتبطة به. */
export async function deleteProviderServer(serverId: string, actor: Actor) {
  return db.transaction(async (tx) => {
    const server = await loadServer(tx, serverId);
    await tx.delete(providerServers).where(eq(providerServers.id, serverId));
    await auditProvider(tx, actor, "player.server_deleted", server.providerId, { label: server.label });
  });
}

export interface DetectedServer {
  provider: { id: string; name: string };
  server: { id: string; label: string; url: string };
}

/**
 * يتعرّف على المزوّد والخادم من أطول بادئة يبدأ بها اسم المستخدم.
 * لا يُرجع إلا خوادم مفعّلة لمزوّدين مقبولين (approved).
 */
export async function detectServer(username: string, executor: DbExecutor = db): Promise<DetectedServer | null> {
  const u = toLatinDigits(username).trim().toLowerCase();
  if (u.length < 2) return null;
  const [row] = await executor
    .select({
      providerId: contentProviders.id,
      providerName: contentProviders.name,
      serverId: providerServers.id,
      label: providerServers.label,
      url: providerServers.baseUrl,
    })
    .from(providerUsernamePrefixes)
    .innerJoin(providerServers, eq(providerServers.id, providerUsernamePrefixes.serverId))
    .innerJoin(contentProviders, eq(contentProviders.id, providerServers.providerId))
    .where(and(sql`starts_with(${u}, ${providerUsernamePrefixes.prefix})`, eq(providerServers.isActive, true), eq(contentProviders.status, "approved")))
    .orderBy(desc(sql`length(${providerUsernamePrefixes.prefix})`))
    .limit(1);
  if (!row) return null;
  return { provider: { id: row.providerId, name: row.providerName }, server: { id: row.serverId, label: row.label, url: row.url } };
}
