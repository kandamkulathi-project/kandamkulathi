-- Requires canonical booking clinic metadata in 0003 and commerce 0020–0022.
-- No clinic names, mappings or company approvals are seeded.
CREATE TABLE core.commerce_clinic_locations (
  clinic_id uuid PRIMARY KEY REFERENCES clinical.mathew_booking_clinic_metadata(clinic_id),
  location_id uuid NOT NULL UNIQUE REFERENCES core.commerce_locations(id),
  approved_by uuid NOT NULL REFERENCES core.identity_actors(id),
  approval_reference text NOT NULL CHECK(length(approval_reference) BETWEEN 1 AND 200),
  active boolean NOT NULL DEFAULT false
);
ALTER TABLE core.commerce_clinic_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.commerce_clinic_locations FORCE ROW LEVEL SECURITY;
GRANT SELECT ON core.commerce_clinic_locations TO k_core_runtime,k_backup_runtime;
CREATE POLICY clinic_mapping_read ON core.commerce_clinic_locations FOR SELECT TO k_core_runtime USING(active);
CREATE POLICY clinic_mapping_backup ON core.commerce_clinic_locations FOR SELECT TO k_backup_runtime USING(true);
CREATE POLICY clinic_mapping_owner ON core.commerce_clinic_locations TO CURRENT_USER USING(true) WITH CHECK(true);
-- Staff grant clinic IDs are canonical clinic identities, never warehouse identifiers.
ALTER TABLE core.commerce_staff_grants DROP CONSTRAINT commerce_staff_grants_clinic_id_fkey;
ALTER TABLE core.commerce_staff_grants ADD FOREIGN KEY(clinic_id) REFERENCES clinical.mathew_booking_clinic_metadata(clinic_id);
DROP POLICY orders_staff_read ON core.commerce_orders;
CREATE POLICY orders_staff_read ON core.commerce_orders FOR SELECT TO k_core_runtime USING(
  EXISTS(SELECT 1 FROM core.commerce_staff_grants g JOIN core.commerce_clinic_locations m ON m.clinic_id=g.clinic_id
    WHERE m.location_id=commerce_orders.location_id AND m.active
    AND g.action='orders:read' AND g.revoked_at IS NULL
    AND g.valid_from<=statement_timestamp() AND g.expires_at>statement_timestamp())
);
DROP POLICY batches_staff_read ON core.commerce_batches;
CREATE POLICY batches_staff_read ON core.commerce_batches FOR SELECT TO k_core_runtime USING(
  EXISTS(SELECT 1 FROM core.commerce_staff_grants g JOIN core.commerce_clinic_locations m ON m.clinic_id=g.clinic_id
    WHERE m.location_id=commerce_batches.location_id AND m.active
    AND g.action='stock:read' AND g.revoked_at IS NULL
    AND g.valid_from<=statement_timestamp() AND g.expires_at>statement_timestamp())
);
