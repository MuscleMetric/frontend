import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cpzgnhchdpkxnebjsyyi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwemduaGNoZHBreG5lYmpzeXlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwMzU1NTYsImV4cCI6MjA3NTYxMTU1Nn0.hmDtqnRzofHJ2Zg2AMyF1jY1Et6MPocJehZAfJYHzK8';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
