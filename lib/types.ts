export type TaskStatus =
  | "open"
  | "claimed"
  | "paid"
  | "rejected"
  | "cancelled";

export type Task = {
  id: number;
  title: string;
  place: string;
  /** The standard, in plain language, frozen before anyone spends time. */
  acceptanceTest: string;
  examplePass: string;
  exampleFail: string;
  latE6: number;
  lngE6: number;
  /** Whole GEN. */
  reward: number;
  minReputation: number;
  status: TaskStatus;
  /** Metres from the viewer. Computed off chain, display only. */
  distanceM: number;
  /** Unix ms. */
  expiresAt: number;
  poster: string;
  /**
   * The claimant's full address, not a shortened one. The task page has to be
   * able to answer "is this claim mine?" for whoever is looking at it, and a
   * truncated address cannot be compared.
   */
  claimedBy?: string;
  challengeCode?: string;
  /**
   * A code the poster published with the task, readable before anyone claims.
   * Empty for the normal one, which is issued at claim time and cannot be known
   * in advance. Set means the task is a test rig, and the site says so.
   */
  fixedCode?: string;
  reason?: string;
  beforeUrl?: string;
  afterUrl?: string;
  contentHash?: string;
  /** Recorded for human reviewers. Never decides a verdict - see /limits. */
  phash?: string;
  /** Consensus record, shown on the receipt. */
  agreement?: { agreed: number; of: number };
  paidAt?: number;
  verdict?: {
    codeVisible: boolean;
    samePlace: boolean;
    testPassed: boolean;
  };
};

export type NetworkStats = {
  tasksPaid: number;
  firstTryPassRate: number;
  medianMinutesToPayment: number;
};
