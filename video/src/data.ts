// EXAMPLE DATA. Every address, hash, balance and time below is made up for the
// video. Nothing here comes from a real user, wallet or key.

export const EX = {
  wallet: "0x7a3F5e0c9D1b2A48c6E7f9012B3d4C5e6F7a9c21",
  savings: "0x4b1E8d2C7a9F03b6E5d1C2a8B7f4E9d0A3c6D2a8",
  tx: "0x9c4e7b21d3a8f6052e1b9c7d4a6f8e3b2c1d0a9f8e7b6c5d4a3f2e1b0c9d8e7f",
  timezone: "Africa/Lagos",
  firstRun: "Fri 9 Oct 2026, 18:00",
  historyDate: "Oct 9, 2026, 6:00 PM",
  clockMorning: "9:41",
  clockFriday: "18:00"
};

export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
