/** One explicit call signature so Vitest does not select React Native's last global overload. */
export type TestFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
