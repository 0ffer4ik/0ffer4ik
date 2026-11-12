// Supabase publishable key is intended for browser use. Protect data with RLS.
window.SUDOKU_SUPABASE_URL = 'https://hcryixvtlysiyrzsdgyz.supabase.co';
window.SUDOKU_SUPABASE_KEY = 'sb_publishable_pMtWTGmEe_oX-3SG1Q0yTQ_hnaw3yHl';
window.SUDOKU_EMAIL_REDIRECT_URL = 'https://0ffer4ik.github.io/sudoku.html';
window.sudokuSupabase = window.supabase?.createClient
    ? window.supabase.createClient(window.SUDOKU_SUPABASE_URL, window.SUDOKU_SUPABASE_KEY)
    : null;
