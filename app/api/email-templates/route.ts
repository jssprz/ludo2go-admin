import { prisma } from '@jssprz/ludo2go-database';
import {
  CUSTOMER_EMAIL_KEYS,
  emailTemplateSchema
} from '@/lib/email-templates';
import { validateEmailTemplateSyntax } from '@/lib/email-template-rendering';
import {
  authorizeEmailTemplates,
  emailTemplateFailure,
  emailTemplateResponse,
  readEmailTemplateBody
} from '@/lib/email-template-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const denied = await authorizeEmailTemplates(request);
  if (denied) return denied;
  try {
    const templates = await prisma.emailTemplate.findMany({
      where: { key: { in: [...CUSTOMER_EMAIL_KEYS] } },
      orderBy: [{ key: 'asc' }, { locale: 'asc' }]
    });
    return emailTemplateResponse({ templates });
  } catch (error) {
    return emailTemplateFailure(error);
  }
}

export async function POST(request: Request) {
  const denied = await authorizeEmailTemplates(request, true);
  if (denied) return denied;
  try {
    const data = emailTemplateSchema.parse(
      await readEmailTemplateBody(request)
    );
    validateEmailTemplateSyntax(data);
    return emailTemplateResponse(
      await prisma.emailTemplate.create({ data }),
      201
    );
  } catch (error) {
    return emailTemplateFailure(error);
  }
}
