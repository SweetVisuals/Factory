const fs = require('fs');

async function run() {
    const { default: postgres } = await import('postgres');
    const sql = postgres('postgresql://postgres:Longlonglong1!@db.lvqmlvbclglalcnfowwc.supabase.co:5432/postgres');

    try {
        console.log("Restoring admin user...");
        await sql.unsafe(`
            INSERT INTO auth.users (
                instance_id, id, aud, role, email, encrypted_password, 
                email_confirmed_at, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
            ) VALUES (
                '00000000-0000-0000-0000-000000000000', 
                'c5f44ad2-63d1-43c2-8e17-0333d12e8643', 
                'authenticated', 
                'authenticated', 
                'ptnmgmt@gmail.com', 
                crypt('ColdSpark123!', gen_salt('bf')), 
                now(), now(), now(), '', '', '', ''
            )
            ON CONFLICT (id) DO UPDATE SET 
                encrypted_password = EXCLUDED.encrypted_password,
                email_confirmed_at = now();
            
            INSERT INTO auth.identities (
                id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, provider_id
            ) VALUES (
                gen_random_uuid(), 
                'c5f44ad2-63d1-43c2-8e17-0333d12e8643', 
                '{"sub": "c5f44ad2-63d1-43c2-8e17-0333d12e8643", "email": "ptnmgmt@gmail.com"}'::jsonb, 
                'email', 
                now(), now(), now(),
                'c5f44ad2-63d1-43c2-8e17-0333d12e8643'
            )
            ON CONFLICT DO NOTHING;
        `);
        console.log("Admin user restored. They can login with email: ptnmgmt@gmail.com, password: ColdSpark123!");

    } catch (e) {
        console.error("Fatal Error:", e);
    } finally {
        await sql.end();
    }
}

run();
