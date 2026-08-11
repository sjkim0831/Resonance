-- Account recovery must revoke every access token immediately on every pod.
-- The existing login contract already replaces a user's row; make that invariant
-- database-enforced so concurrent logins cannot leave two accepted token hashes.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM COMTNAUTHTOKENSTORE
        WHERE USER_ID IS NULL OR BTRIM(USER_ID) = ''
           OR TOKEN_KEY IS NULL OR BTRIM(TOKEN_KEY) = ''
    ) THEN
        RAISE EXCEPTION 'COMTNAUTHTOKENSTORE contains a null or blank user/token key';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM COMTNAUTHTOKENSTORE
        GROUP BY LOWER(USER_ID)
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'COMTNAUTHTOKENSTORE contains duplicate active users';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM COMTNAUTHTOKENSTORE
        GROUP BY TOKEN_KEY
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'COMTNAUTHTOKENSTORE contains duplicate token keys';
    END IF;
END
$$;

ALTER TABLE COMTNAUTHTOKENSTORE ALTER COLUMN USER_ID SET NOT NULL;
ALTER TABLE COMTNAUTHTOKENSTORE ALTER COLUMN TOKEN_KEY SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS UX_AUTHTOKENSTORE_USER_ID_CI
    ON COMTNAUTHTOKENSTORE (LOWER(USER_ID));

CREATE UNIQUE INDEX IF NOT EXISTS UX_AUTHTOKENSTORE_TOKEN_KEY
    ON COMTNAUTHTOKENSTORE (TOKEN_KEY);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_index index_state
        JOIN pg_class index_class ON index_class.oid = index_state.indexrelid
        WHERE index_state.indrelid = 'comtnauthtokenstore'::regclass
          AND index_class.relname = 'ux_authtokenstore_user_id_ci'
          AND index_state.indisunique
          AND index_state.indisvalid
          AND index_state.indisready
          AND pg_get_indexdef(index_state.indexrelid, 1, TRUE) = 'lower(user_id::text)'
    ) THEN
        RAISE EXCEPTION 'UX_AUTHTOKENSTORE_USER_ID_CI is missing or has the wrong definition';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_index index_state
        JOIN pg_class index_class ON index_class.oid = index_state.indexrelid
        WHERE index_state.indrelid = 'comtnauthtokenstore'::regclass
          AND index_class.relname = 'ux_authtokenstore_token_key'
          AND index_state.indisunique
          AND index_state.indisvalid
          AND index_state.indisready
          AND pg_get_indexdef(index_state.indexrelid, 1, TRUE) = 'token_key'
    ) THEN
        RAISE EXCEPTION 'UX_AUTHTOKENSTORE_TOKEN_KEY is missing or has the wrong definition';
    END IF;
END
$$;
