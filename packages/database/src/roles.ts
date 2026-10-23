/** Shared by runtime and controlled backup checks. Only the login and its single profile may be reachable. */
export const roleProofSql = `SELECT pg_has_role(current_user,$1::name,'MEMBER') AS permitted,
  (r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication OR
    EXISTS (SELECT 1 FROM pg_roles d WHERE pg_has_role(current_user,d.oid,'MEMBER') AND
      (d.rolsuper OR d.rolbypassrls OR d.rolcreaterole OR d.rolcreatedb OR d.rolreplication OR
       d.rolname NOT IN (current_user,$1::name)))) AS privileged,
  (EXISTS (SELECT 1 FROM pg_namespace n WHERE n.nspname IN ('core','clinical','engagement','platform')
      AND pg_has_role(current_user,n.nspowner,'MEMBER')) OR
   EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname IN ('core','clinical','engagement','platform') AND pg_has_role(current_user,c.relowner,'MEMBER')) OR
   EXISTS (SELECT 1 FROM pg_database d WHERE d.datname=current_database() AND pg_has_role(current_user,d.datdba,'MEMBER')))
    AS owns_objects,
  current_setting('server_version_num')::integer / 10000 AS major
  FROM pg_roles r WHERE r.rolname=current_user`;
