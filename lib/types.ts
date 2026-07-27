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
  claimedBy?: string;
  challengeCode?: string;
  reason?: string;
  beforeUrl?: string;
  afterUrl?: string;
  contentHash?: string;
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
