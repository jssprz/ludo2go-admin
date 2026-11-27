import { prisma } from '@jssprz/ludo2go-database';
import { z } from 'zod';
import {
  CUSTOMER_EMAIL_KEYS,
  emailTemplateUpdateSchema
} from '@/lib/email-templates';
import { validateEmailTemplateSyntax } from '@/lib/email-template-rendering';
import {
  authorizeEmailTemplates,
  emailTemplateFailure,
  emailTemplateResponse,
  readEmailTemplateBody
} from '@/lib/email-template-api';

export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Context) {
  const denied = await authorizeEmailTemplates(request, true);
  if (denied) return denied;
  try {
    const id = z
      .string()
      .uuid()
      .parse((await params).id);
    const { updatedAt, ...data } = emailTemplateUpdateSchema.parse(
      await readEmailTemplateBody(request)
    );
    validateEmailTemplateSyntax(data);
    const nextRevision = new Date(
      Math.max(Date.now(), new Date(updatedAt).getTime() + 1)
    );
    const template = await prisma.$transaction(async (tx) => {
      const result = await tx.emailTemplate.updateMany({
        where: {
          id,
          key: { in: [...CUSTOMER_EMAIL_KEYS] },
          updatedAt: new Date(updatedAt)
        },
        data: { ...data, updatedAt: nextRevision }
      });
      return result.count
        ? tx.emailTemplate.findUniqueOrThrow({ where: { id } })
        : null;
    });
    return template
      ? emailTemplateResponse(template)
      : emailTemplateResponse({ error: 'conflict' }, 409);
  } catch (error) {
    return emailTemplateFailure(error);
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const denied = await authorizeEmailTemplates(request, true);
  if (denied) return denied;
  try {
    const id = z
      .string()
      .uuid()
      .parse((await params).id);
    const { updatedAt } = z
      .object({ updatedAt: z.string().datetime() })
      .strict()
      .parse(await readEmailTemplateBody(request));
    const result = await prisma.emailTemplate.deleteMany({
      where: {
        id,
        key: { in: [...CUSTOMER_EMAIL_KEYS] },
        updatedAt: new Date(updatedAt)
      }
    });
    return result.count
      ? emailTemplateResponse({ success: true })
      : emailTemplateResponse({ error: 'conflict' }, 409);
  } catch (error) {
    return emailTemplateFailure(error);
  }
}
