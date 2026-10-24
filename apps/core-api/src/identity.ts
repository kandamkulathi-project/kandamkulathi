import { createService, type ServiceOptions } from "@kandamkulathi/server";
import {
  type IdentityDependencies,
  registerIdentityRoutes,
  unavailableIdentityDependencies,
} from "@kandamkulathi/server/identity";

export function createCoreApi(
  dependencies: IdentityDependencies = unavailableIdentityDependencies,
  registerFeatures?: ServiceOptions["registerRoutes"],
  registerBeforeIdentity?: ServiceOptions["registerRoutes"],
) {
  return createService("core-api", undefined, {
    registerRoutes: (app) => {
      registerBeforeIdentity?.(app);
      registerIdentityRoutes(app, dependencies);
      registerFeatures?.(app);
    },
  });
}
