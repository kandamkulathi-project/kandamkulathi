-- Expired opaque handles confer only a narrowly bound revocation capability.
-- No authentication, enrollment, expiry extension, grants or provider-success assertion.
CREATE FUNCTION core.native_auth_revoke_expired(p_handle text,p_actor uuid,p_session uuid,p_key text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
BEGIN
  IF p_handle IS NULL OR p_key IS NULL OR p_handle !~ '^[A-Za-z0-9_-]{43}$'
    OR p_key !~ '^[A-Za-z0-9_-]{43}$' THEN RETURN false; END IF;
  -- Preserve the actor -> identity session -> native session lock order.
  PERFORM id FROM core.identity_actors WHERE id=p_actor FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  PERFORM id FROM core.identity_sessions WHERE id=p_session AND actor_id=p_actor FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE core.identity_native_sessions n
    SET revoked_at=clock_timestamp(),pending=true,logout_key_hash=p_key,access_ciphertext='purged'
    WHERE n.handle_hash=p_handle AND n.actor_id=p_actor AND n.session_id=p_session
      AND n.revoked_at IS NULL AND n.expires_at<=clock_timestamp()
      AND EXISTS (SELECT 1 FROM core.identity_actors a
        WHERE a.id=p_actor AND a.provider_user_id=n.provider_user_id)
      AND EXISTS (SELECT 1 FROM core.identity_sessions s
        WHERE s.id=p_session AND s.actor_id=p_actor
          AND s.provider_user_id=n.provider_user_id AND s.provider_session_id=n.provider_session_id);
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE core.identity_sessions SET revoked_at=coalesce(revoked_at,clock_timestamp())
    WHERE id=p_session AND actor_id=p_actor;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION core.native_auth_revoke_expired(text,uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.native_auth_revoke_expired(text,uuid,uuid,text) TO k_core_runtime;
