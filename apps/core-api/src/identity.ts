import { createService } from "@kandamkulathi/server";
import {
  type IdentityDependencies,
  registerIdentityRoutes,
  unavailableIdentityDependencies,
} from "@kandamkulathi/server/identity";

export function createCoreApi(
  dependencies: IdentityDependencies = unavailableIdentityDependencies,
) {
  return createService("core-api", undefined, {
    registerRoutes: (app) => registerIdentityRoutes(app, dependencies),
  });
}
