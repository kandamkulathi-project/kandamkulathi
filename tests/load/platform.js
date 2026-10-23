import { check, sleep } from "k6";
import http from "k6/http";

// Foundation smoke only. The final mixed business workload is defined in the phase plan.
const base = __ENV.PLATFORM_LOAD_BASE_URL;
if (!/^http:\/\/127\.0\.0\.1:\d{2,5}$/.test(base ?? "")) {
  throw new Error("P1 load smoke requires an explicit loopback synthetic target.");
}
export const options = {
  vus: 5,
  duration: "30s",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500"],
    checks: ["rate==1"],
  },
};
export default function () {
  const response = http.get(`${base}/health/live`, { tags: { journey: "platform-liveness" } });
  check(response, { "Worker is alive": (result) => result.status === 200 });
  sleep(1);
}
