declare module 'vitest' {
    type TestCallback = () => void | Promise<void>
    type TestFn = (name: string, fn: TestCallback) => void

    type MockFn = ((...args: unknown[]) => unknown) & {
        mockResolvedValue: (value: unknown) => MockFn;
        mockReturnValue: (value: unknown) => MockFn;
        mockImplementation: (fn: (...args: unknown[]) => unknown) => MockFn;
    }

    interface ExpectMatchers {
        toBe: (expected: unknown) => void;
        toBeDefined: () => void;
        toHaveBeenCalledWith: (...args: unknown[]) => void;
    }

    interface ExpectStatic {
        (value: unknown): ExpectMatchers;
    }

    interface Vi {
        fn: () => MockFn;
        importActual: <T = unknown>(path: string) => Promise<T>;
        mock: (path: string, factory: () => unknown | Promise<unknown>) => void;
    }

    const describe: TestFn
    const it: TestFn
    const expect: ExpectStatic
    const vi: Vi

    export { describe, it, expect, vi }
}
