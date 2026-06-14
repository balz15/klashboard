import { supabase } from './supabase';

export type AppAdminStatus = {
  canSeeQueue: boolean;
  canApprove: boolean;
  setupHint: string | null;
};

/** App makers who can approve user-submitted templates. Requires profiles.is_app_admin in Supabase. */
export async function getAppAdminStatus(userId: string): Promise<AppAdminStatus> {
  const envEmails = (import.meta.env.VITE_APP_ADMIN_EMAILS as string | undefined)
    ?.split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, is_app_admin')
    .eq('id', userId)
    .maybeSingle();

  const dbAdmin = !!profile?.is_app_admin;
  const emailAdmin =
    !!envEmails?.length && !!profile?.email && envEmails.includes(profile.email.toLowerCase());

  if (dbAdmin) {
    return { canSeeQueue: true, canApprove: true, setupHint: null };
  }

  if (emailAdmin) {
    return {
      canSeeQueue: true,
      canApprove: false,
      setupHint:
        'Your email is listed as admin in the app, but Supabase still needs is_app_admin = true on your profile. Run: UPDATE profiles SET is_app_admin = true WHERE email = \'' +
        profile!.email +
        "';",
    };
  }

  return { canSeeQueue: false, canApprove: false, setupHint: null };
}

export async function isAppAdmin(userId: string): Promise<boolean> {
  const status = await getAppAdminStatus(userId);
  return status.canSeeQueue;
}

function formatSupabaseError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: string }).message);
  }
  return 'Something went wrong.';
}

export async function approveTemplateSubmission(submissionId: string, reviewerId: string) {
  const { data: templateId, error: rpcError } = await supabase.rpc('approve_user_template_submission', {
    p_submission_id: submissionId,
  });

  if (!rpcError && templateId) {
    return { error: null, templateId: templateId as string };
  }

  const rpcMessage = rpcError ? formatSupabaseError(rpcError) : '';
  const rpcMissing =
    rpcMessage.includes('Could not find the function') ||
    rpcMessage.includes('schema cache') ||
    rpcMessage.includes('approve_user_template_submission');

  if (!rpcMissing) {
    return { error: new Error(rpcMessage || 'Approval failed.') };
  }

  const { data: sub, error: fetchError } = await supabase
    .from('user_template_submissions')
    .select('*')
    .eq('id', submissionId)
    .eq('status', 'pending')
    .single();

  if (fetchError || !sub) {
    return { error: fetchError ?? new Error('Submission not found') };
  }

  const { data: template, error: insertError } = await supabase
    .from('challenge_templates')
    .insert({
      name: sub.name,
      description: sub.description,
      category: 'user_created',
      default_metrics: sub.default_metrics,
      suggested_duration_days: sub.suggested_duration_days,
      icon: sub.icon || 'target',
      icon_url: sub.icon_url ?? null,
      submitted_by: sub.submitted_by,
      source_contest_id: sub.contest_id,
    })
    .select('id')
    .single();

  if (insertError) {
    return {
      error: new Error(
        formatSupabaseError(insertError) +
          ' — ensure profiles.is_app_admin = true for your account (Supabase SQL editor).'
      ),
    };
  }

  const { error: updateError } = await supabase
    .from('user_template_submissions')
    .update({
      status: 'approved',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      published_template_id: template.id,
    })
    .eq('id', submissionId);

  if (updateError) {
    return {
      error: new Error(
        formatSupabaseError(updateError) +
          ' — ensure profiles.is_app_admin = true for your account (Supabase SQL editor).'
      ),
    };
  }

  return { error: null, templateId: template.id as string };
}

export async function rejectTemplateSubmission(
  submissionId: string,
  reviewerId: string,
  note?: string
) {
  const { error: rpcError } = await supabase.rpc('reject_user_template_submission', {
    p_submission_id: submissionId,
    p_review_note: note ?? null,
  });

  if (!rpcError) {
    return { error: null };
  }

  const rpcMessage = formatSupabaseError(rpcError);
  const rpcMissing =
    rpcMessage.includes('Could not find the function') ||
    rpcMessage.includes('schema cache') ||
    rpcMessage.includes('reject_user_template_submission');

  if (!rpcMissing) {
    return { error: new Error(rpcMessage || 'Reject failed.') };
  }

  const { error } = await supabase
    .from('user_template_submissions')
    .update({
      status: 'rejected',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      review_note: note ?? null,
    })
    .eq('id', submissionId);

  if (error) {
    return {
      error: new Error(
        formatSupabaseError(error) +
          ' — ensure profiles.is_app_admin = true for your account (Supabase SQL editor).'
      ),
    };
  }

  return { error: null };
}
