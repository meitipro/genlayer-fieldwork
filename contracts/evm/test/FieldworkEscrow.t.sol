// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {FieldworkEscrow, IERC20} from "../src/FieldworkEscrow.sol";

/// @dev A 6 decimal token that behaves like USDC where it matters here: a bool from both transfers.
contract MockUSDC is IERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    bool public failTransfers;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function setFail(bool fail) external {
        failTransfers = fail;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        if (failTransfers) return false;
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (failTransfers) return false;
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract EscrowBase is Test {
    FieldworkEscrow internal escrow;
    MockUSDC internal usdc;

    uint256 internal attestorKey = 0xA77E5;
    address internal attestor;
    address internal poster = address(0xB0B);
    address internal worker = address(0xCAFE);
    address internal treasury = address(0x7EA5);
    address internal stranger = address(0xBAD);

    // Constants rather than calls on the escrow: an external call used as an argument would consume
    // the vm.expectRevert set just before the call under test.
    uint8 internal constant PAY = 1;
    uint8 internal constant REFUND = 2;
    uint64 internal constant GRACE = 1 days;

    uint16 internal constant FEE_BPS = 500; // 5%
    uint128 internal constant REWARD = 100_000; // 0.100 USDC

    function setUp() public virtual {
        attestor = vm.addr(attestorKey);
        usdc = new MockUSDC();
        escrow = new FieldworkEscrow(address(usdc), attestor, treasury, FEE_BPS);
        usdc.mint(poster, 10_000_000);
        vm.prank(poster);
        usdc.approve(address(escrow), type(uint256).max);
    }

    function _sign(uint256 pk, uint256 taskId, address who, uint8 outcome, uint256 expiry)
        internal
        view
        returns (bytes memory)
    {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, escrow.settlementDigest(taskId, who, outcome, expiry));
        return abi.encodePacked(r, s, v);
    }

    function _fund(uint256 taskId, uint128 reward, uint64 deadline) internal {
        vm.prank(poster);
        escrow.fund(taskId, reward, deadline);
    }

    function _state(uint256 taskId) internal view returns (FieldworkEscrow.State st) {
        (,,,, st) = escrow.tasks(taskId);
    }
}

contract FieldworkEscrowTest is EscrowBase {
    event Funded(uint256 indexed taskId, address indexed poster, uint256 reward, uint256 fee, uint64 deadline);
    event Paid(uint256 indexed taskId, address indexed worker, uint256 reward, uint256 fee);
    event Refunded(uint256 indexed taskId, address indexed poster, uint256 amount, bool expired);

    // ------------------------------------------------------------- funding

    function test_fundLocksRewardAndFee() public {
        vm.expectEmit(true, true, false, true);
        emit Funded(7, poster, REWARD, 5_000, 0);
        _fund(7, REWARD, 0);
        assertEq(usdc.balanceOf(address(escrow)), 105_000);
        assertEq(usdc.balanceOf(poster), 10_000_000 - 105_000);
        (address p, uint128 reward, uint128 fee, uint64 deadline, FieldworkEscrow.State st) = escrow.tasks(7);
        assertEq(p, poster);
        assertEq(reward, REWARD);
        assertEq(fee, 5_000);
        assertEq(deadline, 0);
        assertEq(uint8(st), uint8(FieldworkEscrow.State.Funded));
    }

    function test_feeFloorsAndNeverExceedsTheRate() public view {
        assertEq(escrow.feeFor(1), 0);
        assertEq(escrow.feeFor(19), 0);
        assertEq(escrow.feeFor(20), 1);
        assertEq(escrow.feeFor(100_000), 5_000);
    }

    function test_cannotFundTwiceOrWithZero() public {
        _fund(1, REWARD, 0);
        vm.prank(poster);
        vm.expectRevert(FieldworkEscrow.AlreadyFunded.selector);
        escrow.fund(1, REWARD, 0);
        vm.prank(poster);
        vm.expectRevert(FieldworkEscrow.ZeroAmount.selector);
        escrow.fund(2, 0, 0);
    }

    function test_deadlineMustBeAnHourAway() public {
        vm.prank(poster);
        vm.expectRevert(FieldworkEscrow.DeadlineTooSoon.selector);
        escrow.fund(1, REWARD, uint64(block.timestamp + 59 minutes));
        _fund(1, REWARD, uint64(block.timestamp + 1 hours));
    }

    function test_fundRevertsWhenTheTokenRefuses() public {
        usdc.setFail(true);
        vm.prank(poster);
        vm.expectRevert(FieldworkEscrow.TransferFailed.selector);
        escrow.fund(1, REWARD, 0);
        // The failed call left nothing behind.
        assertEq(uint8(_state(1)), uint8(FieldworkEscrow.State.None));
    }

    // ---------------------------------------------------------- settlement

    function test_payConservesEveryUnit() public {
        _fund(1, REWARD, 0);
        uint256 total = usdc.balanceOf(address(escrow));
        uint256 expiry = block.timestamp + 1 days;
        bytes memory sig = _sign(attestorKey, 1, worker, PAY, expiry);

        vm.expectEmit(true, true, false, true);
        emit Paid(1, worker, REWARD, 5_000);
        vm.prank(stranger);
        escrow.settle(1, worker, PAY, expiry, sig);

        // 0.100 USDC to the worker, 0.005 to the treasury, nothing left behind.
        assertEq(usdc.balanceOf(worker), 100_000);
        assertEq(usdc.balanceOf(treasury), 5_000);
        assertEq(usdc.balanceOf(address(escrow)), 0);
        assertEq(usdc.balanceOf(worker) + usdc.balanceOf(treasury), total);
        assertEq(uint8(_state(1)), uint8(FieldworkEscrow.State.Paid));
    }

    function test_refundReturnsRewardAndFeeToThePoster() public {
        _fund(1, REWARD, 0);
        uint256 before = usdc.balanceOf(poster);
        uint256 expiry = block.timestamp + 1 days;
        bytes memory sig = _sign(attestorKey, 1, address(0), REFUND, expiry);
        escrow.settle(1, address(0), REFUND, expiry, sig);
        assertEq(usdc.balanceOf(poster), before + 105_000);
        assertEq(usdc.balanceOf(address(escrow)), 0);
        assertEq(usdc.balanceOf(treasury), 0);
        assertEq(uint8(_state(1)), uint8(FieldworkEscrow.State.Refunded));
    }

    function test_aVerdictCannotBeUsedTwice() public {
        _fund(1, REWARD, 0);
        uint256 expiry = block.timestamp + 1 days;
        bytes memory sig = _sign(attestorKey, 1, worker, PAY, expiry);
        escrow.settle(1, worker, PAY, expiry, sig);
        vm.expectRevert(FieldworkEscrow.NotFunded.selector);
        escrow.settle(1, worker, PAY, expiry, sig);
        assertEq(usdc.balanceOf(worker), 100_000);
    }

    function test_aSignatureIsBoundToItsTaskWorkerOutcomeAndExpiry() public {
        _fund(1, REWARD, 0);
        _fund(2, REWARD, 0);
        uint256 expiry = block.timestamp + 1 days;
        bytes memory sig = _sign(attestorKey, 1, worker, PAY, expiry);

        // Another task.
        vm.expectRevert(FieldworkEscrow.BadSignature.selector);
        escrow.settle(2, worker, PAY, expiry, sig);
        // Another worker, so a relayer cannot redirect the payout.
        vm.expectRevert(FieldworkEscrow.BadSignature.selector);
        escrow.settle(1, stranger, PAY, expiry, sig);
        // Another outcome, so a PAY cannot be replayed as a REFUND.
        vm.expectRevert(FieldworkEscrow.BadSignature.selector);
        escrow.settle(1, worker, REFUND, expiry, sig);
        // Another expiry.
        vm.expectRevert(FieldworkEscrow.BadSignature.selector);
        escrow.settle(1, worker, PAY, expiry + 1, sig);
    }

    function test_onlyTheAttestorCanSign() public {
        _fund(1, REWARD, 0);
        uint256 expiry = block.timestamp + 1 days;
        bytes memory forged = _sign(0xBADBAD, 1, stranger, PAY, expiry);
        vm.expectRevert(FieldworkEscrow.BadSignature.selector);
        escrow.settle(1, stranger, PAY, expiry, forged);
        assertEq(usdc.balanceOf(stranger), 0);
    }

    function test_expiredSignatureIsRefused() public {
        _fund(1, REWARD, 0);
        uint256 expiry = block.timestamp + 1 hours;
        bytes memory sig = _sign(attestorKey, 1, worker, PAY, expiry);
        vm.warp(expiry + 1);
        vm.expectRevert(FieldworkEscrow.SignatureExpired.selector);
        escrow.settle(1, worker, PAY, expiry, sig);
    }

    function test_theUpperHalfTwinOfASignatureIsRefused() public {
        _fund(1, REWARD, 0);
        uint256 expiry = block.timestamp + 1 days;
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(attestorKey, escrow.settlementDigest(1, worker, PAY, expiry));
        uint256 n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;
        bytes memory twin = abi.encodePacked(r, bytes32(n - uint256(s)), v == 27 ? uint8(28) : uint8(27));
        vm.expectRevert(FieldworkEscrow.BadSignature.selector);
        escrow.settle(1, worker, PAY, expiry, twin);
    }

    function test_malformedSignaturesAreRefused() public {
        _fund(1, REWARD, 0);
        uint256 expiry = block.timestamp + 1 days;
        vm.expectRevert(FieldworkEscrow.BadSignature.selector);
        escrow.settle(1, worker, PAY, expiry, hex"1234");
        vm.expectRevert(FieldworkEscrow.BadSignature.selector);
        escrow.settle(1, worker, PAY, expiry, new bytes(65));
    }

    function test_badOutcomeAndUnfundedTasksAreRefused() public {
        _fund(1, REWARD, 0);
        uint256 expiry = block.timestamp + 1 days;
        bytes memory sig = _sign(attestorKey, 1, worker, 3, expiry);
        vm.expectRevert(FieldworkEscrow.BadOutcome.selector);
        escrow.settle(1, worker, 3, expiry, sig);
        bytes memory sig9 = _sign(attestorKey, 9, worker, PAY, expiry);
        vm.expectRevert(FieldworkEscrow.NotFunded.selector);
        escrow.settle(9, worker, PAY, expiry, sig9);
    }

    function test_payToTheZeroAddressIsRefused() public {
        _fund(1, REWARD, 0);
        uint256 expiry = block.timestamp + 1 days;
        bytes memory sig = _sign(attestorKey, 1, address(0), PAY, expiry);
        vm.expectRevert(FieldworkEscrow.ZeroAddress.selector);
        escrow.settle(1, address(0), PAY, expiry, sig);
    }

    function test_aSignatureForAnotherDeploymentIsRefused() public {
        _fund(1, REWARD, 0);
        FieldworkEscrow other = new FieldworkEscrow(address(usdc), attestor, treasury, FEE_BPS);
        uint256 expiry = block.timestamp + 1 days;
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(attestorKey, other.settlementDigest(1, worker, PAY, expiry));
        vm.expectRevert(FieldworkEscrow.BadSignature.selector);
        escrow.settle(1, worker, PAY, expiry, abi.encodePacked(r, s, v));
    }

    function test_aFailingPayoutRevertsAndLeavesTheTaskFunded() public {
        _fund(1, REWARD, 0);
        uint256 expiry = block.timestamp + 1 days;
        bytes memory sig = _sign(attestorKey, 1, worker, PAY, expiry);
        usdc.setFail(true);
        vm.expectRevert(FieldworkEscrow.TransferFailed.selector);
        escrow.settle(1, worker, PAY, expiry, sig);
        assertEq(uint8(_state(1)), uint8(FieldworkEscrow.State.Funded));
        usdc.setFail(false);
        escrow.settle(1, worker, PAY, expiry, sig);
        assertEq(usdc.balanceOf(worker), 100_000);
    }

    // -------------------------------------------------------------- expiry

    function test_expireNeedsADeadlineAndTheGracePeriod() public {
        uint64 deadline = uint64(block.timestamp + 2 hours);
        _fund(1, REWARD, deadline); // with a deadline
        _fund(2, REWARD, 0); // without one

        vm.warp(deadline + 1);
        vm.expectRevert(FieldworkEscrow.NotExpired.selector);
        escrow.expire(1); // inside the grace period: only a verdict can move it

        vm.warp(uint256(deadline) + GRACE + 1);
        vm.expectRevert(FieldworkEscrow.NotExpired.selector);
        escrow.expire(2); // no deadline, so it can never expire

        uint256 before = usdc.balanceOf(poster);
        vm.expectEmit(true, true, false, true);
        emit Refunded(1, poster, 105_000, true);
        vm.prank(stranger);
        escrow.expire(1);
        assertEq(usdc.balanceOf(poster), before + 105_000);
        assertEq(uint8(_state(1)), uint8(FieldworkEscrow.State.Refunded));

        vm.expectRevert(FieldworkEscrow.NotFunded.selector);
        escrow.expire(1);
    }

    function test_aWorkerWhoDeliveredInTimeStillGetsPaidAfterTheDeadline() public {
        uint64 deadline = uint64(block.timestamp + 2 hours);
        _fund(1, REWARD, deadline);
        uint256 expiry = block.timestamp + 3 days;
        bytes memory sig = _sign(attestorKey, 1, worker, PAY, expiry);
        vm.warp(uint256(deadline) + 6 hours);
        // Nobody can expire it from under the verdict.
        vm.expectRevert(FieldworkEscrow.NotExpired.selector);
        escrow.expire(1);
        escrow.settle(1, worker, PAY, expiry, sig);
        assertEq(usdc.balanceOf(worker), 100_000);
    }

    function test_anExpiredTaskCannotBeSettled() public {
        uint64 deadline = uint64(block.timestamp + 2 hours);
        _fund(1, REWARD, deadline);
        uint256 expiry = block.timestamp + 10 days;
        bytes memory sig = _sign(attestorKey, 1, worker, PAY, expiry);
        vm.warp(uint256(deadline) + GRACE + 1);
        escrow.expire(1);
        vm.expectRevert(FieldworkEscrow.NotFunded.selector);
        escrow.settle(1, worker, PAY, expiry, sig);
        assertEq(usdc.balanceOf(worker), 0);
    }

    // --------------------------------------------------------------- admin

    function test_aFundedTaskKeepsTheFeeItWasFundedWith() public {
        _fund(1, REWARD, 0);
        escrow.setFeeBps(1000);
        _fund(2, REWARD, 0);
        (, , uint128 fee1,,) = escrow.tasks(1);
        (, , uint128 fee2,,) = escrow.tasks(2);
        assertEq(fee1, 5_000);
        assertEq(fee2, 10_000);
        uint256 expiry = block.timestamp + 1 days;
        escrow.settle(1, worker, PAY, expiry, _sign(attestorKey, 1, worker, PAY, expiry));
        assertEq(usdc.balanceOf(treasury), 5_000);
    }

    function test_adminIsOwnerOnlyAndBounded() public {
        vm.startPrank(stranger);
        vm.expectRevert(FieldworkEscrow.NotOwner.selector);
        escrow.setAttestor(stranger);
        vm.expectRevert(FieldworkEscrow.NotOwner.selector);
        escrow.setTreasury(stranger);
        vm.expectRevert(FieldworkEscrow.NotOwner.selector);
        escrow.setFeeBps(0);
        vm.expectRevert(FieldworkEscrow.NotOwner.selector);
        escrow.transferOwnership(stranger);
        vm.stopPrank();

        vm.expectRevert(FieldworkEscrow.FeeTooHigh.selector);
        escrow.setFeeBps(1001);
        vm.expectRevert(FieldworkEscrow.ZeroAddress.selector);
        escrow.setAttestor(address(0));
        vm.expectRevert(FieldworkEscrow.ZeroAddress.selector);
        escrow.setTreasury(address(0));
        vm.expectRevert(FieldworkEscrow.ZeroAddress.selector);
        escrow.transferOwnership(address(0));
    }

    function test_rotatingTheAttestorInvalidatesTheOldKey() public {
        _fund(1, REWARD, 0);
        uint256 expiry = block.timestamp + 1 days;
        bytes memory oldSig = _sign(attestorKey, 1, worker, PAY, expiry);
        escrow.setAttestor(address(0xFEED));
        vm.expectRevert(FieldworkEscrow.BadSignature.selector);
        escrow.settle(1, worker, PAY, expiry, oldSig);
    }

    function test_theOwnerCannotMoveTaskFunds() public {
        _fund(1, REWARD, 0);
        // Owner is this test contract. There is no function that moves funds for it.
        assertEq(escrow.owner(), address(this));
        assertEq(usdc.balanceOf(address(escrow)), 105_000);
    }

    // ---------------------------------------------------------------- fuzz

    function testFuzz_payConservesFunds(uint128 reward, uint16 feeBps) public {
        reward = uint128(bound(reward, 1, 1_000_000_000_000));
        feeBps = uint16(bound(feeBps, 0, 1000));
        escrow.setFeeBps(feeBps);
        usdc.mint(poster, uint256(reward) * 2);
        uint256 posterBefore = usdc.balanceOf(poster);
        _fund(1, reward, 0);
        uint256 expiry = block.timestamp + 1 days;
        escrow.settle(1, worker, PAY, expiry, _sign(attestorKey, 1, worker, PAY, expiry));

        uint256 fee = (uint256(reward) * feeBps) / 10_000;
        assertEq(usdc.balanceOf(worker), reward);
        assertEq(usdc.balanceOf(treasury), fee);
        assertEq(usdc.balanceOf(address(escrow)), 0);
        assertEq(posterBefore - usdc.balanceOf(poster), uint256(reward) + fee);
    }

    function testFuzz_refundReturnsEverything(uint128 reward, uint16 feeBps) public {
        reward = uint128(bound(reward, 1, 1_000_000_000_000));
        feeBps = uint16(bound(feeBps, 0, 1000));
        escrow.setFeeBps(feeBps);
        usdc.mint(poster, uint256(reward) * 2);
        uint256 posterBefore = usdc.balanceOf(poster);
        _fund(1, reward, 0);
        uint256 expiry = block.timestamp + 1 days;
        escrow.settle(
            1, address(0), REFUND, expiry, _sign(attestorKey, 1, address(0), REFUND, expiry)
        );
        assertEq(usdc.balanceOf(poster), posterBefore);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }
}

/// @dev Drives the escrow through arbitrary sequences so the invariant below is checked, not assumed.
contract EscrowHandler is Test {
    FieldworkEscrow public escrow;
    MockUSDC public usdc;
    uint256 internal attestorKey;
    address internal poster;
    address internal worker = address(0xCAFE);

    uint256 public nextId;
    uint256 public outstanding; // what the escrow should hold: reward + fee of every task still Funded
    mapping(uint256 => uint256) public held;
    uint256[] public open;

    constructor(FieldworkEscrow e, MockUSDC u, uint256 key, address poster_) {
        escrow = e;
        usdc = u;
        attestorKey = key;
        poster = poster_;
    }

    function fund(uint128 reward, uint64 span) external {
        reward = uint128(bound(reward, 1, 10_000_000));
        uint64 deadline = span % 3 == 0 ? 0 : uint64(block.timestamp + 1 hours + (span % 5 days));
        uint256 id = nextId++;
        vm.prank(poster);
        escrow.fund(id, reward, deadline);
        uint256 amount = uint256(reward) + escrow.feeFor(reward);
        held[id] = amount;
        outstanding += amount;
        open.push(id);
    }

    function settle(uint256 pick, bool pay) external {
        if (open.length == 0) return;
        uint256 i = pick % open.length;
        uint256 id = open[i];
        uint8 outcome = pay ? escrow.PAY() : escrow.REFUND();
        address who = pay ? worker : address(0);
        uint256 expiry = block.timestamp + 1 days;
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(attestorKey, escrow.settlementDigest(id, who, outcome, expiry));
        escrow.settle(id, who, outcome, expiry, abi.encodePacked(r, s, v));
        _close(i, id);
    }

    function expire(uint256 pick) external {
        if (open.length == 0) return;
        uint256 i = pick % open.length;
        uint256 id = open[i];
        (,,, uint64 deadline,) = escrow.tasks(id);
        if (deadline == 0) return;
        vm.warp(uint256(deadline) + escrow.SETTLE_GRACE() + 1);
        escrow.expire(id);
        _close(i, id);
    }

    function _close(uint256 i, uint256 id) internal {
        outstanding -= held[id];
        held[id] = 0;
        open[i] = open[open.length - 1];
        open.pop();
    }
}

contract FieldworkEscrowInvariantTest is EscrowBase {
    EscrowHandler internal handler;

    function setUp() public override {
        super.setUp();
        usdc.mint(poster, 1_000_000_000_000);
        handler = new EscrowHandler(escrow, usdc, attestorKey, poster);
        targetContract(address(handler));
    }

    /// @dev Money in equals money out, plus what is still locked, at every point in every sequence.
    function invariant_escrowHoldsExactlyWhatIsStillFunded() public view {
        assertEq(usdc.balanceOf(address(escrow)), handler.outstanding());
    }
}
