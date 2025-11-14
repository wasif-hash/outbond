import * as zlib from "node:zlib"

const isNodeRuntime = typeof process !== "undefined" && Boolean(process.versions?.node)

if (isNodeRuntime) {
  const zlibModule = zlib as Record<string, unknown>

  const shimFlag = Symbol.for("outbond.zlibBytesReadShimApplied")
  const globalScope = globalThis as typeof globalThis & Record<symbol, boolean>

  if (!globalScope[shimFlag]) {
    globalScope[shimFlag] = true

    const moduleDescriptor = Object.getOwnPropertyDescriptor(zlibModule, "bytesRead")
    if (moduleDescriptor && typeof moduleDescriptor.get === "function") {
      Object.defineProperty(zlibModule, "bytesRead", {
        configurable: true,
        enumerable: false,
        get() {
          const written = (zlibModule as { bytesWritten?: number }).bytesWritten
          return typeof written === "number" ? written : 0
        },
      })
    }

    const constructors = [
      "Zlib",
      "InflateRaw",
      "Inflate",
      "Gunzip",
      "Unzip",
      "BrotliDecompress",
      "Gzip",
      "Deflate",
      "DeflateRaw",
      "BrotliCompress",
    ]

    for (const name of constructors) {
      const ctor = zlibModule[name]
      if (typeof ctor !== "function") {
        continue
      }

      const prototype = (ctor as { prototype?: object }).prototype
      if (!prototype) {
        continue
      }

      const descriptor = Object.getOwnPropertyDescriptor(prototype, "bytesRead")
      if (!descriptor || typeof descriptor.get !== "function") {
        continue
      }

      Object.defineProperty(prototype, "bytesRead", {
        configurable: true,
        enumerable: false,
        get() {
          const written = (this as { bytesWritten?: number }).bytesWritten
          return typeof written === "number" ? written : 0
        },
      })
    }
  }
}

export {}
