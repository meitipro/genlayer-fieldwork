import { IS_STUDIO } from "@/lib/chain";

/**
 * Studio settles the verdict but not the money, and now we know exactly why.
 *
 * A payout is an emitted message from the contract to the payee, which Studio
 * delivers as a *contract call*. An ordinary wallet is not a contract, so the
 * message fails. Caught in full on transaction 0x62dfbbc8: contract
 * 0x1Ac28fab -> wallet 0x3e1D268c, value 1 GEN, `NO_MAJORITY`, and the leader's
 * refusal reads `contract 0x3e1D268c... not found`.
 *
 * The task itself was already `paid` and finalized by then, because
 * `emit_transfer` defaults to `on="finalized"` - the transfer is a separate
 * message that runs after the verdict, so its failure cannot roll the verdict
 * back. That is the whole shape of the problem: the grading half is real and
 * the paying half is not, and only on this network.
 *
 * "Paid" is therefore true about the verdict and false about the balance, and a
 * worker must never have to discover that for themselves. On any other network
 * this renders nothing.
 */
export function SettlementNotice({ compact = false }: { compact?: boolean }) {
  if (!IS_STUDIO) return null;

  if (compact) {
    return (
      <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
        On the Studio network the verdict is real but the coins do not move.
        Balances only change on a live network.
      </p>
    );
  }

  return (
    <div className="notice">
      <strong>This is the Studio development network.</strong> The grading, the
      verdict and the record are all real. The payment is not. Here a payout is
      delivered to the worker as a contract call, and a wallet is not a contract,
      so it fails with <span className="mono">not found</span> and the balance
      never moves. The verdict is already final by then and stands. On a live
      network the same transaction pays.
    </div>
  );
}
