// The native SDK's fetch exposes the streamed body required by the response byte cap.

import { technicalVideoSignaling } from "@kandamkulathi/client/private-video-http";
import { fetch as expoFetch } from "expo/fetch";

export const nativeStreamingSignaling = (endpoint: string) =>
  technicalVideoSignaling(endpoint, expoFetch);
