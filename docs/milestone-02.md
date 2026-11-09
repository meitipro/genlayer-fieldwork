# Milestone 02: the reward is real money, held on Base Sepolia

Baseline: `0f769eb0c0ec97cdc4b9770239c0425a720e0fa7` (Milestone 01 closed, 2026-10-12).

## What it adds

On Studio a payout is a call the network cannot settle into a wallet, so a Fieldwork
verdict moved no money. This milestone puts the money on Base Sepolia, in USDC, and
makes the GenLayer verdict the only thing that releases it.

- `contracts/evm/src/FieldworkEscrow.sol`: the poster locks reward plus fee in USDC for a
  task id (the id the GenLayer contract gave it) and an optional deadline.
- A verdict reaches Base as an EIP-712 signature from an attestor: `Settle(taskId, worker,
  outcome, expiry)`. `PAY` sends the reward to the worker and the fee to the treasury.
  `REFUND` returns reward plus fee to the poster. Anyone may submit the signature.
- `expire(taskId)` is the Base side of Milestone 01's deadlines: after the deadline and a
  one day grace period with no verdict, anyone returns the money to the poster. The grace
  period exists so a worker who delivered in time cannot lose the payout to someone calling
  `expire` first.
- `scripts/attest.mjs` is the attestor. It reads the task from the GenLayer contract and
  signs `PAY` only for `paid` (to the worker GenLayer recorded) and `REFUND` only for
  `cancelled` or `expired`. A `rejected` or open task is refused, and so is a task the
  escrow does not hold as funded.

## The trust boundary

The attestor is one key. It can send a task's money to the poster or to the worker it
signs, and to nobody else. It cannot move an unfunded task, change an amount, sign twice
for one task (the state moves on first use) or touch fees already paid out. The owner
rotates the attestor and sets the fee for future tasks, and has no function that moves
task funds. What is not trustless is the step from GenLayer's verdict to the signature:
that is the attestor reading a public view, and it is stated here rather than hidden.

## Money is conserved

For every reward and fee rate, a `PAY` leaves worker plus treasury equal to what the poster
paid in, and a `REFUND` leaves the poster whole. A 0.100 USDC reward at 5% moves 0.105 in,
0.100 to the worker and 0.005 to the treasury, and the escrow ends at zero. The fee floors,
so it never exceeds the rate, and a funded task keeps the fee it was funded with.

## Checked

| | Result |
| --- | --- |
| `forge test` in `contracts/evm` | 27 pass: 26 unit and fuzz (1,000 runs each), 1 stateful invariant (the escrow holds exactly what is still funded, over random fund, settle and expire sequences) |
| Adversarial cases | wrong signer, another task, another worker, another outcome, another expiry, another deployment, the high-s twin of a signature, malformed signatures, expired signature, replay, failing token, settle after expiry, expire inside the grace period |
| Fork of Base Sepolia, Circle USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | 3 pass (`BASE_SEPOLIA_RPC_URL=https://sepolia.base.org forge test --match-contract Fork`) |
| End to end on the fork | deploy script, then the attestor against the real GenLayer verdicts of the previous contract: task 1 `paid` settled `PAY` (worker +100,000, treasury +5,000), task 0 `cancelled` settled `REFUND` (poster whole), task 2 `rejected` refused; the escrow kept task 2's 105,000 |

Source digest: `FieldworkEscrow.sol` sha256
`c31741fee4d1fe47fc951c1419a2b5b06ca1982fe774ec1946d97c4c3854b957`.

## Live on Base Sepolia

| | |
| --- | --- |
| Contract | [`0x35fd00ec5BDdda631509282Cdcb1FD731891C079`](https://sepolia.basescan.org/address/0x35fd00ec5BDdda631509282Cdcb1FD731891C079) |
| Deploy transaction | [`0x76307f1bcc4fbc4f0b29e93e37a879126a3929e95ef0134049afa42c0022d520`](https://sepolia.basescan.org/tx/0x76307f1bcc4fbc4f0b29e93e37a879126a3929e95ef0134049afa42c0022d520), block 56,303,035, status success |
| Settings read back from the chain | token `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (Circle USDC), attestor `0x8af42979334844B0Dce47D48F7C232A10be373d1`, fee 500 bps, owner and treasury `0x34D0Bbf474cF8D1CB01230F7eB1E0f512DeA32f1`, 4,729 bytes of code |

Deployed with `forge script script/Deploy.s.sol --rpc-url https://sepolia.base.org --broadcast`
from the deployer key kept outside the repository. The address is the same as in the fork
rehearsal above because both were the deployer's first transaction.

Two things are not done. The source is not verified on an explorer: the Blockscout
submission answered "Unable to verify" twice, so the bytecode is on chain but its source is
not yet published there. And no task has been funded or settled on the live chain, because
that needs test USDC and the deployer holds none; Circle's faucet (https://faucet.circle.com)
sits behind a login. The funded and settled flows are proven on the fork above, not here.
