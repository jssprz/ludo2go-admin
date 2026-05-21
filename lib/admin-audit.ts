type SessionLike = {
  user?: {
    id?: string | null;
  } | null;
} | null | undefined;

export function getAdminUserIdFromSession(session: SessionLike): string | null {
  const id = session?.user?.id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

export function buildCreateAuditFields(adminUserId: string | null) {
  if (!adminUserId) {
    return {};
  }

  return {
    createdByAdminUserId: adminUserId,
    updatedByAdminUserId: adminUserId,
  };
}

export function buildUpdateAuditFields(adminUserId: string | null) {
  if (!adminUserId) {
    return {};
  }

  return {
    updatedByAdminUserId: adminUserId,
  };
}