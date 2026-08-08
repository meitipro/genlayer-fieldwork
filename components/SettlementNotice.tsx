import { IS_STUDIO } from "@/lib/chain";

/**
 * Studio settles the verdict but not the money.
 *
 * Measured with scripts/check-payout.mjs against the deployed contract: funding
 * a task moves GEN into the contract correctly, and on the way out the contract
 * is debited by exactly the right amount while the payee's balance does not
 * change. The contract is right; Studio's ledger does not apply an emitted
 * transfer to an ordinary account.
 *
 * That makes "paid" true about the verdict and false about the balance, and a
 * worker must never have to discover that for themselves. On any other network
 * this renders nothing.
 */
export function SettlementNotice({ compact = false }: { compact?: boolean }) {
  if (!IS_STUDIO) return null;

  if (compact) {
    return (
      <p className="muted" style={{ margin: 0, fontSize: "var(--s-14)" }}>
        On the Studio network the verdict is real but the coins do not move.
        Balances only change on a live network.
      </p>
    );
  }

  return (
    <div className="notice">
      <strong>This is the Studio development network.</strong> The grading, the
      verdict and the record are all real. The transfer is not: Studio debits the
      contract but never credits the account, so no balance will change here. On
      a live network the same transaction pays.
    </div>
  );
}
