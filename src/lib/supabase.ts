import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://bkwspibjypklsrbvyfrn.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_Tdk6wZWQ6S5HrDVeho3boQ_vmtwP6LZ';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = true;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
