import { z } from "zod";

/** Canonical internal UUID identity; spelling must not change authorization or conflicts. */
export const canonicalUuidSchema = z.uuid().transform((value) => value.toLowerCase());
