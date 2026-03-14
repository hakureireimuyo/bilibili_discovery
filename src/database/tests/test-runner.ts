/**
 * Minimal test runner utilities.
 */

export type TestCase = {
  name: string;
  run: () => Promise<void> | void;
};

const tests: TestCase[] = [];

export function test(name: string, run: TestCase["run"]): void {
  tests.push({ name, run });
}

export function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

export async function runTests(): Promise<void> {
  let passed = 0;
  for (const t of tests) {
    try {
      await t.run();
      console.log(`[Test] PASS ${t.name}`);
      passed += 1;
    } catch (error) {
      console.error(`[Test] FAIL ${t.name}`, error);
    }
  }
  console.log(`[Test] Done ${passed}/${tests.length}`);
}
