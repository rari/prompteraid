import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://zombhezaleuudlaqnzvn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvbWJoZXphbGV1dWRsYXFuenZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MDQyNDIsImV4cCI6MjA2NzQ4MDI0Mn0.cxzX62FCJxOWnJ0_7mlrmNqCII9fttg51fnxvpUp9qU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY); 