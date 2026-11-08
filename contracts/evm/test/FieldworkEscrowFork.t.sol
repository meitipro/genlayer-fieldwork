// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {FieldworkEscrow, IERC20} from "../src/FieldworkEscrow.sol";

/// @notice The same flow against Circle's real USDC on a fork of Base Sepolia.
///
///     BASE_SEPOLIA_RPC_URL=https://sepolia.base.org forge test --match-contract Fork
///
/// Skipped when no RPC is set, so the suite stays offline by default.
contract FieldworkEscrowForkTest is Test {
    address internal constant USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    FieldworkEscrow internal escrow;
    uint256 internal attestorKey = 0xA77E5;
    // Fresh labelled addresses, and every assertion below is a balance change: on a live chain a hand-picked
    // address such as 0xCAFE already holds USDC, so an absolute balance would test somebody else's money.
    address internal poster = makeAddr("poster");
    address internal worker = makeAddr("worker");
    address internal treasury = makeAddr("treasury");

    function setUp() public {
        string memory rpc = vm.envOr("BASE_SEPOLIA_RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(rpc);
        escrow = new FieldworkEscrow(USDC, vm.addr(attestorKey), treasury, 500);
        deal(USDC, poster, 10_000_000);
        vm.prank(poster);
        (bool ok,) = USDC.call(abi.encodeWithSignature("approve(address,uint256)", address(escrow), type(uint256).max));
        require(ok, "approve");
    }

    function test_chainAndTokenAreWhatTheDocsSay() public view {
        assertEq(block.chainid, 84532);
        (bool ok, bytes memory out) = USDC.staticcall(abi.encodeWithSignature("decimals()"));
        assertTrue(ok);
        assertEq(abi.decode(out, (uint8)), 6);
    }

    /// @dev 0.100 USDC reward, 5% fee: 0.100 to the worker, 0.005 to the treasury, nothing stranded.
    function test_payOnRealUsdc() public {
        uint256 workerBefore = IERC20(USDC).balanceOf(worker);
        uint256 treasuryBefore = IERC20(USDC).balanceOf(treasury);
        vm.prank(poster);
        escrow.fund(1, 100_000, 0);
        assertEq(IERC20(USDC).balanceOf(address(escrow)), 105_000);

        uint256 expiry = block.timestamp + 1 days;
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(attestorKey, escrow.settlementDigest(1, worker, 1, expiry));
        escrow.settle(1, worker, 1, expiry, abi.encodePacked(r, s, v));

        assertEq(IERC20(USDC).balanceOf(worker) - workerBefore, 100_000);
        assertEq(IERC20(USDC).balanceOf(treasury) - treasuryBefore, 5_000);
        assertEq(IERC20(USDC).balanceOf(address(escrow)), 0);
    }

    function test_refundOnRealUsdc() public {
        uint256 before = IERC20(USDC).balanceOf(poster);
        vm.prank(poster);
        escrow.fund(2, 100_000, 0);
        uint256 expiry = block.timestamp + 1 days;
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(attestorKey, escrow.settlementDigest(2, address(0), 2, expiry));
        escrow.settle(2, address(0), 2, expiry, abi.encodePacked(r, s, v));
        assertEq(IERC20(USDC).balanceOf(poster), before);
        assertEq(IERC20(USDC).balanceOf(address(escrow)), 0);
    }
}
