import { pgSchema } from "drizzle-orm/pg-core";
// Namespaces only. Tables, non-owner roles, RLS and transactional repositories are P1 work.
// Do not expose these namespaces to API routes before their access policies are reviewed.
export const core = pgSchema("core");
export const clinical = pgSchema("clinical");
export const engagement = pgSchema("engagement");
