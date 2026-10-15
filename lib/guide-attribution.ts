import type { Prisma } from '@prisma/client';

export type GuideActor = { id: string; name: string };

export async function resolveGuideActor(
  database: Pick<Prisma.TransactionClient, 'adminUser'>,
  adminUserId: string
): Promise<GuideActor | null> {
  const admin = await database.adminUser.findUnique({
    where: { id: adminUserId },
    select: { id: true, firstName: true, lastName: true, username: true, email: true }
  });
  if (!admin) return null;
  return {
    id: admin.id,
    name: [admin.firstName, admin.lastName].filter(Boolean).join(' ') || admin.username || admin.email
  };
}

export function guideCreateAttribution(actor: GuideActor) {
  return { authorId: actor.id, authorName: actor.name, ...guideEditAttribution(actor) };
}

export function guideEditAttribution(actor: GuideActor) {
  return { editorId: actor.id, editorName: actor.name };
}