// Errors whose message is safe and useful to show to the user (Telegram / dashboard).
export class UserFacingError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}
