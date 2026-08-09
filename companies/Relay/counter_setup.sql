CREATE TABLE IF NOT EXISTS public.signup_counter (
    id SERIAL PRIMARY KEY,
    spots_left INTEGER DEFAULT 900
);

INSERT INTO public.signup_counter (id, spots_left)
VALUES (1, 900)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION decrement_signup_counter()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.signup_counter
    SET spots_left = GREATEST(0, spots_left - 9)
    WHERE id = 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_account_settings ON public.account_settings;
CREATE TRIGGER on_new_account_settings
AFTER INSERT ON public.account_settings
FOR EACH ROW
EXECUTE FUNCTION decrement_signup_counter();
