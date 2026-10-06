// The sandbox asks Claude through the artifact runtime instead of the Anthropic SDK.
export default class Anthropic {
  constructor() {
    throw new Error("The Anthropic SDK is not available in the sandbox.");
  }
}
export function betaZodOutputFormat() {
  throw new Error("The Anthropic SDK is not available in the sandbox.");
}
