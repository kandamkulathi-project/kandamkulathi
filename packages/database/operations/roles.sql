-- Controlled migration/restore runner only. No password or LOGIN privilege is stored here.
-- Roles are cluster-wide; per-database advisory locks cannot serialize creation.
-- Catch only CREATE collisions, then validate every profile below (including the winner's).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'k_core_runtime') THEN
    BEGIN
      CREATE ROLE k_core_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    EXCEPTION WHEN duplicate_object OR unique_violation THEN
      NULL;
    END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'k_jobs_runtime') THEN
    BEGIN
      CREATE ROLE k_jobs_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    EXCEPTION WHEN duplicate_object OR unique_violation THEN
      NULL;
    END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'k_backup_runtime') THEN
    BEGIN
      CREATE ROLE k_backup_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    EXCEPTION WHEN duplicate_object OR unique_violation THEN
      NULL;
    END;
  END IF;
  IF (SELECT count(*) FROM pg_roles WHERE rolname IN ('k_core_runtime','k_jobs_runtime','k_backup_runtime')) <> 3 THEN
    RAISE EXCEPTION 'Missing platform role after bootstrap';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('k_core_runtime','k_jobs_runtime','k_backup_runtime')
    AND (rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)) THEN
    RAISE EXCEPTION 'Unsafe existing platform role';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles r JOIN pg_roles d ON d.oid <> r.oid
    AND pg_has_role(r.oid,d.oid,'MEMBER')
    WHERE r.rolname IN ('k_core_runtime','k_jobs_runtime','k_backup_runtime')) THEN
    RAISE EXCEPTION 'Runtime profiles must not inherit other roles';
  END IF;
END $$;
