import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mlwjpkhakqgfrmshakqe.supabase.co';
const supabaseAnonKey = 'sb_publishable_l6QlTBUuWhU2Sv6bvtxn_A_fxEVIbJj';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);