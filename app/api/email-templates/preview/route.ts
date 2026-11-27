import { renderEmailTemplatePreview } from '@/lib/email-template-rendering';
import {
  authorizeEmailTemplates,
  emailTemplateFailure,
  emailTemplateResponse,
  readEmailTemplateBody
} from '@/lib/email-template-api';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const denied = await authorizeEmailTemplates(request, true);
  if (denied) return denied;
  try {
    return emailTemplateResponse(
      renderEmailTemplatePreview(await readEmailTemplateBody(request))
    );
  } catch (error) {
    return emailTemplateFailure(error);
  }
}
