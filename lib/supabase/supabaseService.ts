'use server'
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function createInvitation(email: string, name?: string, referral?: string, expiresInDays = 7) {
  const inviteCode = generateInviteCode();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const { data, error } = await supabase
    .from('invitations')
    .insert([{ email, name, referral, invite_code: inviteCode, expires_at: expiresAt }]);

  if (error) throw error;

  return inviteCode;
}

export async function getInvitationByCode(inviteCode: string) {
  const { data, error } = await supabase
    .from('invitations')
    .select('*')
    .eq('invite_code', inviteCode)
    .single();

  if (error) throw error;

  console.log(inviteCode)
  return data;
}

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 10); // Generates a random 8-character string
}
