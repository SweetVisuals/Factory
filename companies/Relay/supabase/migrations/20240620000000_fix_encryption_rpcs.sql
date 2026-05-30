
-- Redefine encryption functions to use a stable master key
-- This fixes the 'Wrong key or corrupt data' error in decrypt_password

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Redefine encrypt_password
CREATE OR REPLACE FUNCTION public.encrypt_password(password text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Using a stable key for Relay Solutions
  RETURN encode(pgp_sym_encrypt(password, 'RelaySolutions_Secure_Key_2024'), 'base64');
END;
$$;

-- Redefine decrypt_password
CREATE OR REPLACE FUNCTION public.decrypt_password(encrypted_password text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN pgp_sym_decrypt(decode(encrypted_password, 'base64'), 'RelaySolutions_Secure_Key_2024');
END;
$$;

-- Grant access to authenticated users and service role
GRANT EXECUTE ON FUNCTION public.encrypt_password(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.encrypt_password(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrypt_password(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrypt_password(text) TO service_role;
