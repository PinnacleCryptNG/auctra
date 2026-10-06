// Browser stand-in for the two node:crypto calls in lib/services/hash.ts.
import { sha256 } from "@noble/hashes/sha256";

class Bytes {
  constructor(private readonly bytes: Uint8Array) {}
  toString(encoding: "hex" | "base64url") {
    if (encoding === "hex") return Array.from(this.bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    let binary = "";
    for (const b of this.bytes) binary += String.fromCharCode(b);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
}

export function createHash(algorithm: string) {
  if (algorithm !== "sha256") throw new Error(`Unsupported hash ${algorithm}`);
  const chunks: string[] = [];
  const hash = {
    update(value: string) {
      chunks.push(value);
      return hash;
    },
    digest(encoding: "hex") {
      return new Bytes(sha256(new TextEncoder().encode(chunks.join("")))).toString(encoding);
    }
  };
  return hash;
}

export function randomBytes(size: number) {
  return new Bytes(crypto.getRandomValues(new Uint8Array(size)));
}
