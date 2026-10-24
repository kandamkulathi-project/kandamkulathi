export function verificationFixture(): {
  folder: string;
  runGit(args: string[]): string;
  cleanup(): void;
};
