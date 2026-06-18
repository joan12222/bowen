// wa-sqlite ships its example VFS implementations as plain .js files with no
// type declarations. Declare the module so TypeScript stops erroring on the
// dynamic import in lib/sqlite/worker.ts.
declare module 'wa-sqlite/src/examples/AccessHandlePoolVFS.js' {
  export class AccessHandlePoolVFS {
    constructor(directoryPath: string)
    isReady: Promise<void>
    close(): Promise<void>
  }
}
