// Vite's `?raw` imports (file contents as a string), used by test/deploy-config.test.ts.
declare module "*?raw" {
  const text: string;
  export default text;
}
