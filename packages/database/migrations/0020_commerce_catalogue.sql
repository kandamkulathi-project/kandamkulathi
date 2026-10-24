-- Additive candidate: register in Drizzle journal during coordinator integration.
GRANT USAGE ON SCHEMA core TO k_core_runtime,k_jobs_runtime,k_backup_runtime;
CREATE TABLE core.commerce_locations (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE core.commerce_tax_policies (
 id uuid PRIMARY KEY, rate_bps integer NOT NULL CHECK(rate_bps BETWEEN 0 AND 10000),
 basis text NOT NULL CHECK(basis='exclusive'), rounding text NOT NULL CHECK(rounding='half_up_line'),
 approved_by uuid NOT NULL, active boolean NOT NULL DEFAULT false
);
CREATE TABLE core.commerce_import_grants (
 actor_id uuid NOT NULL, location_id uuid NOT NULL REFERENCES core.commerce_locations,
 PRIMARY KEY(actor_id,location_id)
);
CREATE TABLE core.commerce_checkout_policies (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 hold_seconds integer NOT NULL CHECK(hold_seconds BETWEEN 1 AND 86400),
 approved_by uuid NOT NULL, approval_reference text NOT NULL CHECK(length(approval_reference) BETWEEN 1 AND 200),
 active boolean NOT NULL DEFAULT false
);
CREATE TABLE core.commerce_skus (
 id uuid PRIMARY KEY, sku text NOT NULL UNIQUE CHECK(length(sku) BETWEEN 1 AND 80),
 name text NOT NULL, variant text NOT NULL, description text NOT NULL, image_url text NOT NULL,
 concerns text[] NOT NULL, approved_by uuid NOT NULL, published boolean NOT NULL DEFAULT true,
 consult_only boolean NOT NULL, unit_paise bigint NOT NULL CHECK(unit_paise BETWEEN 0 AND 9007199254740991),
 tax_policy_id uuid NOT NULL REFERENCES core.commerce_tax_policies,
 minimum_shelf_life_days integer NOT NULL CHECK(minimum_shelf_life_days BETWEEN 0 AND 3650),
 version integer NOT NULL DEFAULT 1 CHECK(version>0)
);
CREATE TABLE core.commerce_batches (
 id uuid PRIMARY KEY, sku_id uuid NOT NULL REFERENCES core.commerce_skus,
 location_id uuid NOT NULL REFERENCES core.commerce_locations, batch_code text NOT NULL,
 expires_on date NOT NULL, recalled boolean NOT NULL DEFAULT false,
 on_hand integer NOT NULL CHECK(on_hand>=0), reserved integer NOT NULL DEFAULT 0 CHECK(reserved>=0 AND reserved<=on_hand),
 UNIQUE(sku_id,location_id,batch_code), UNIQUE(id,sku_id)
);
CREATE INDEX commerce_fefo ON core.commerce_batches(sku_id,location_id,expires_on,id);
CREATE TABLE core.commerce_orders (
 id uuid PRIMARY KEY, operation_id uuid NOT NULL UNIQUE, actor_id uuid NOT NULL,
 location_id uuid NOT NULL REFERENCES core.commerce_locations, request_key text NOT NULL,
 amount_paise bigint NOT NULL CHECK(amount_paise BETWEEN 0 AND 9007199254740991),
 currency text NOT NULL DEFAULT 'INR' CHECK(currency='INR'),
 status text NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','paid','expired','cancelled','reconciliation_required')),
 version integer NOT NULL DEFAULT 1 CHECK(version>0), created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 source text NOT NULL DEFAULT 'web' CHECK(source IN ('web','native','phone','walk_in','whatsapp')),
 hold_policy_reference text NOT NULL,
 expires_at timestamptz NOT NULL CHECK(expires_at>created_at)
);
CREATE TABLE core.commerce_order_addresses (
 order_id uuid PRIMARY KEY REFERENCES core.commerce_orders,
 address jsonb NOT NULL CHECK(jsonb_typeof(address)='object'
  AND address ?& ARRAY['recipientName','line1','city','region','postalCode','country','contactPhone']
  AND jsonb_typeof(address->'recipientName')='string' AND jsonb_typeof(address->'line1')='string'
  AND jsonb_typeof(address->'city')='string' AND jsonb_typeof(address->'region')='string'
  AND jsonb_typeof(address->'postalCode')='string' AND jsonb_typeof(address->'country')='string'
  AND jsonb_typeof(address->'contactPhone')='string'
  AND (NOT address ? 'line2' OR (jsonb_typeof(address->'line2')='string' AND length(address->>'line2')<=200))
  AND address - ARRAY['recipientName','line1','line2','city','region','postalCode','country','contactPhone']='{}'::jsonb
  AND address->>'country'='IN' AND address->>'postalCode' ~ '^[1-9][0-9]{5}$'
  AND address->>'contactPhone' ~ '^[+][1-9][0-9]{7,14}$'
  AND length(address->>'recipientName') BETWEEN 1 AND 120
  AND length(address->>'line1') BETWEEN 1 AND 200
  AND length(address->>'city') BETWEEN 1 AND 100 AND length(address->>'region') BETWEEN 1 AND 100)
);
CREATE INDEX commerce_owner_orders ON core.commerce_orders(actor_id,created_at,id);
CREATE TABLE core.commerce_order_lines (
 order_id uuid NOT NULL REFERENCES core.commerce_orders, sku_id uuid NOT NULL REFERENCES core.commerce_skus,
 quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 1000), sku_version integer NOT NULL CHECK(sku_version>0),
 unit_paise bigint NOT NULL CHECK(unit_paise>=0), tax_paise bigint NOT NULL CHECK(tax_paise>=0),
 amount_paise bigint NOT NULL CHECK(amount_paise=unit_paise*quantity+tax_paise),
 tax_rate_bps integer NOT NULL CHECK(tax_rate_bps BETWEEN 0 AND 10000),
 tax_policy_id uuid NOT NULL REFERENCES core.commerce_tax_policies, PRIMARY KEY(order_id,sku_id)
);
CREATE TABLE core.commerce_reservations (
 order_id uuid NOT NULL, sku_id uuid NOT NULL, batch_id uuid NOT NULL,
 quantity integer NOT NULL CHECK(quantity>0), PRIMARY KEY(order_id,batch_id),
 FOREIGN KEY(order_id,sku_id) REFERENCES core.commerce_order_lines,
 FOREIGN KEY(batch_id,sku_id) REFERENCES core.commerce_batches(id,sku_id)
);
CREATE TABLE core.commerce_imports (
 operation_id uuid PRIMARY KEY, actor_id uuid NOT NULL, request_key text NOT NULL,
 row_count integer NOT NULL CHECK(row_count>0), units bigint NOT NULL CHECK(units>0),
 base_value_paise bigint NOT NULL CHECK(base_value_paise>=0), created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- Runtime gets no price/catalogue/tax/grant mutation privileges.
GRANT SELECT ON core.commerce_locations,core.commerce_tax_policies,core.commerce_skus,core.commerce_batches TO k_core_runtime;
GRANT UPDATE(id) ON core.commerce_skus,core.commerce_tax_policies TO k_core_runtime;
GRANT UPDATE(reserved) ON core.commerce_batches TO k_core_runtime;
GRANT SELECT,INSERT ON core.commerce_orders,core.commerce_order_lines,core.commerce_reservations TO k_core_runtime;
GRANT SELECT,INSERT ON core.commerce_order_addresses TO k_core_runtime;
GRANT SELECT,UPDATE(singleton) ON core.commerce_checkout_policies TO k_core_runtime;
GRANT SELECT ON core.commerce_imports TO k_core_runtime;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['commerce_locations','commerce_tax_policies','commerce_import_grants','commerce_checkout_policies','commerce_skus','commerce_batches','commerce_orders','commerce_order_addresses','commerce_order_lines','commerce_reservations','commerce_imports'] LOOP
 EXECUTE format('ALTER TABLE core.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE core.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('GRANT SELECT ON core.%I TO k_backup_runtime',t);
 EXECUTE format('CREATE POLICY backup ON core.%I FOR SELECT TO k_backup_runtime USING(true)',t);
 -- Controlled owner supports the import definer even on Neon non-superuser migration owners.
 -- Runtime role proof forbids inheritance/reachability of any application object owner.
 EXECUTE format('CREATE POLICY controlled_owner ON core.%I TO CURRENT_USER USING(true) WITH CHECK(true)',t);
 END LOOP;
END $$;
CREATE POLICY locations_read ON core.commerce_locations FOR SELECT TO k_core_runtime USING(true);
CREATE POLICY checkout_policy_read ON core.commerce_checkout_policies FOR SELECT TO k_core_runtime USING(active);
CREATE POLICY checkout_policy_lock ON core.commerce_checkout_policies FOR UPDATE TO k_core_runtime USING(active) WITH CHECK(active);
CREATE POLICY tax_read ON core.commerce_tax_policies FOR SELECT TO k_core_runtime USING(true);
CREATE POLICY tax_lock ON core.commerce_tax_policies FOR UPDATE TO k_core_runtime USING(active) WITH CHECK(active);
CREATE POLICY sku_read ON core.commerce_skus FOR SELECT TO k_core_runtime USING(published);
CREATE POLICY sku_lock ON core.commerce_skus FOR UPDATE TO k_core_runtime USING(published) WITH CHECK(published);
CREATE POLICY batch_read ON core.commerce_batches FOR SELECT TO k_core_runtime USING(
 nullif(current_setting('app.actor_id',true),'') IS NOT NULL AND current_setting('app.commerce_mode',true)='checkout');
CREATE POLICY batch_reserve ON core.commerce_batches FOR UPDATE TO k_core_runtime USING(
 nullif(current_setting('app.actor_id',true),'') IS NOT NULL AND current_setting('app.commerce_mode',true)='checkout') WITH CHECK(
 nullif(current_setting('app.actor_id',true),'') IS NOT NULL AND current_setting('app.commerce_mode',true)='checkout');
CREATE POLICY orders_owner ON core.commerce_orders TO k_core_runtime
 USING(actor_id=nullif(current_setting('app.actor_id',true),'')::uuid)
 WITH CHECK(actor_id=nullif(current_setting('app.actor_id',true),'')::uuid AND status='reserved' AND version=1);
CREATE POLICY lines_owner ON core.commerce_order_lines TO k_core_runtime
 USING(EXISTS(SELECT 1 FROM core.commerce_orders o WHERE o.id=order_id))
 WITH CHECK(EXISTS(SELECT 1 FROM core.commerce_orders o WHERE o.id=order_id));
CREATE POLICY reservations_owner ON core.commerce_reservations TO k_core_runtime
 USING(EXISTS(SELECT 1 FROM core.commerce_orders o WHERE o.id=order_id))
 WITH CHECK(EXISTS(SELECT 1 FROM core.commerce_orders o WHERE o.id=order_id));
CREATE POLICY imports_owner ON core.commerce_imports FOR SELECT TO k_core_runtime
 USING(actor_id=nullif(current_setting('app.actor_id',true),'')::uuid);
CREATE POLICY addresses_owner ON core.commerce_order_addresses TO k_core_runtime
 USING(EXISTS(SELECT 1 FROM core.commerce_orders o WHERE o.id=order_id
   AND o.actor_id=nullif(current_setting('app.actor_id',true),'')::uuid))
 WITH CHECK(EXISTS(SELECT 1 FROM core.commerce_orders o WHERE o.id=order_id
   AND o.actor_id=nullif(current_setting('app.actor_id',true),'')::uuid));

CREATE FUNCTION core.commerce_stock_visible(sku uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,core AS $$
 SELECT EXISTS(SELECT 1 FROM core.commerce_batches b JOIN core.commerce_skus s ON s.id=b.sku_id
 WHERE s.id=$1 AND s.published AND NOT b.recalled AND b.on_hand>b.reserved
 AND b.expires_on>(clock_timestamp() AT TIME ZONE 'UTC')::date+s.minimum_shelf_life_days)
$$;
REVOKE ALL ON FUNCTION core.commerce_stock_visible(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.commerce_stock_visible(uuid) TO k_core_runtime;

CREATE FUNCTION core.commerce_sku_matches(entry core.commerce_skus, item jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,core AS $$
 SELECT jsonb_build_object('skuId',(entry).id,'sku',(entry).sku,'name',(entry).name,'variant',(entry).variant,
  'description',(entry).description,'imageUrl',(entry).image_url,'concerns',(entry).concerns,
  'approvedBy',(entry).approved_by,'consultOnly',(entry).consult_only,'unitPaise',(entry).unit_paise,
  'taxPolicyId',(entry).tax_policy_id,'minimumShelfLifeDays',(entry).minimum_shelf_life_days)
 = item - ARRAY['locationId','batchId','batchCode','expiresOn','quantity']
$$;
REVOKE ALL ON FUNCTION core.commerce_sku_matches(core.commerce_skus,jsonb) FROM PUBLIC;

-- Controlled import, fixed search path; owner-only provisioning remains separate.
CREATE FUNCTION core.commerce_opening_import(op uuid, payload jsonb, controls jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,core AS $$
DECLARE r jsonb; actor uuid; prior core.commerce_imports; n integer; units bigint; val numeric; errors jsonb;
BEGIN
 actor := nullif(current_setting('app.actor_id',true),'')::uuid;
 IF actor IS NULL OR jsonb_array_length(payload) NOT BETWEEN 1 AND 10000 THEN RAISE EXCEPTION 'import denied'; END IF;
 -- Opening imports are rare control-plane operations. Serialize them so conflict reports
 -- remain authoritative even when two operations introduce the same SKU or batch.
 PERFORM pg_advisory_xact_lock(871295,20);
 SELECT * INTO prior FROM core.commerce_imports WHERE operation_id=op;
 IF FOUND THEN
  IF prior.actor_id<>actor OR prior.request_key<>payload::text THEN RAISE EXCEPTION 'operation conflict'; END IF;
  RETURN '[]'::jsonb;
 END IF;
 SELECT count(*),sum((x->>'quantity')::bigint),sum((x->>'quantity')::numeric*(x->>'unitPaise')::numeric)
 INTO n,units,val FROM jsonb_array_elements(payload) x;
 IF n<>(controls->>'rows')::int OR units<>(controls->>'units')::bigint OR val<>(controls->>'baseValuePaise')::numeric THEN RAISE EXCEPTION 'control totals'; END IF;
 PERFORM 1 FROM core.commerce_import_grants g WHERE g.actor_id=actor
 AND g.location_id IN (SELECT (x->>'locationId')::uuid FROM jsonb_array_elements(payload) x)
 ORDER BY g.location_id FOR SHARE;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(payload) x JOIN core.commerce_locations l ON l.id=(x->>'locationId')::uuid
  WHERE NOT EXISTS(SELECT 1 FROM core.commerce_import_grants g WHERE g.actor_id=actor AND g.location_id=l.id)) THEN RAISE EXCEPTION 'import denied'; END IF;
 PERFORM 1 FROM core.commerce_locations l WHERE l.id IN (SELECT (x->>'locationId')::uuid FROM jsonb_array_elements(payload) x) ORDER BY l.id FOR KEY SHARE;
 PERFORM 1 FROM core.commerce_tax_policies p WHERE p.id IN (SELECT (x->>'taxPolicyId')::uuid FROM jsonb_array_elements(payload) x) ORDER BY p.id FOR SHARE;
 PERFORM 1 FROM core.commerce_skus s WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(payload) x WHERE s.id=(x->>'skuId')::uuid OR s.sku=x->>'sku') ORDER BY s.id FOR SHARE;
 SELECT coalesce(jsonb_agg(jsonb_build_object('row',ordinal,'code',code) ORDER BY ordinal),'[]'::jsonb) INTO errors FROM (
  SELECT ordinal,CASE WHEN l.id IS NULL THEN 'unknown_location' WHEN p.id IS NULL THEN 'unapproved_tax'
   WHEN (s.id IS NOT NULL AND NOT core.commerce_sku_matches(s,item)) OR EXISTS(SELECT 1 FROM core.commerce_skus other WHERE other.sku=item->>'sku' AND other.id<>(item->>'skuId')::uuid) THEN 'conflicting_sku'
   WHEN EXISTS(SELECT 1 FROM core.commerce_batches b WHERE b.id=(item->>'batchId')::uuid OR (b.sku_id=(item->>'skuId')::uuid AND b.location_id=(item->>'locationId')::uuid AND b.batch_code=item->>'batchCode')) THEN 'duplicate_batch'
   ELSE NULL END AS code
  FROM jsonb_array_elements(payload) WITH ORDINALITY data(item,ordinal)
  LEFT JOIN core.commerce_locations l ON l.id=(item->>'locationId')::uuid
  LEFT JOIN core.commerce_tax_policies p ON p.id=(item->>'taxPolicyId')::uuid AND p.active
  LEFT JOIN core.commerce_skus s ON s.id=(item->>'skuId')::uuid
 ) issues WHERE code IS NOT NULL;
 IF jsonb_array_length(errors)>0 THEN RETURN errors; END IF;
 FOR r IN SELECT * FROM jsonb_array_elements(payload) LOOP
   IF (r->>'expiresOn')::date<=CURRENT_DATE OR (r->>'quantity')::int<=0 THEN RAISE EXCEPTION 'invalid expiry or quantity'; END IF;
   IF NOT EXISTS(SELECT 1 FROM core.commerce_skus WHERE id=(r->>'skuId')::uuid) THEN
    INSERT INTO core.commerce_skus(id,sku,name,variant,description,image_url,concerns,approved_by,consult_only,unit_paise,tax_policy_id,minimum_shelf_life_days)
    VALUES((r->>'skuId')::uuid,r->>'sku',r->>'name',r->>'variant',r->>'description',r->>'imageUrl',ARRAY(SELECT jsonb_array_elements_text(r->'concerns')),(r->>'approvedBy')::uuid,(r->>'consultOnly')::boolean,(r->>'unitPaise')::bigint,(r->>'taxPolicyId')::uuid,(r->>'minimumShelfLifeDays')::int);
   ELSIF NOT EXISTS(SELECT 1 FROM core.commerce_skus s WHERE s.id=(r->>'skuId')::uuid AND core.commerce_sku_matches(s,r)) THEN
    RAISE EXCEPTION 'conflicting SKU metadata';
   END IF;
  INSERT INTO core.commerce_batches(id,sku_id,location_id,batch_code,expires_on,on_hand)
  VALUES((r->>'batchId')::uuid,(r->>'skuId')::uuid,(r->>'locationId')::uuid,r->>'batchCode',(r->>'expiresOn')::date,(r->>'quantity')::int);
 END LOOP;
 INSERT INTO core.commerce_imports VALUES(op,actor,payload::text,n,units,val,clock_timestamp());
 RETURN '[]'::jsonb;
END $$;
REVOKE ALL ON FUNCTION core.commerce_opening_import(uuid,jsonb,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.commerce_opening_import(uuid,jsonb,jsonb) TO k_core_runtime;
