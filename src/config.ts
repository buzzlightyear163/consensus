// Everything you may want to change before launch lives here.

export const CONFIG = {
  ticker: "CONSENSUS",
  /** pump.fun contract address. When set, the nav shows a buy link and a copy button. */
  ca: "",
  /** Full X profile URL, e.g. "https://x.com/yourhandle". Hidden when empty. */
  x: "",
  /**
   * Public Hyperliquid address of the fee wallet. When set, the fees section
   * reads its balance and open positions live from Hyperliquid.
   */
  feeWallet: "",

  /** Signal rules. The site text reads these, so the copy always matches. */
  rules: {
    /** Holders needed before a coin can signal. */
    quorum: 10,
    /** Share of holders on one side that triggers a trade. */
    enter: 0.7,
    /** Share that shows as leaning. */
    lean: 0.6,
    /** A trade closes when agreement falls below this. */
    exit: 0.55,
    /** Stop distance from entry. */
    stop: 0.06,
    maxLeverage: 3,
    /** Share of the fee wallet committed per signal. */
    sizePerSignal: 0.15,
  },

  /** How often positions and prices are re-read, in ms. 50 accounts cost 100 of Hyperliquid's 1200/min weight. */
  refreshMs: 60_000,
};
