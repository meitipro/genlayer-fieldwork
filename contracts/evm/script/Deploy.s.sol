// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {FieldworkEscrow} from "../src/FieldworkEscrow.sol";

/// @notice Deploy the escrow.
///
///     export DEPLOYER_PRIVATE_KEY=0x...      # funded with Base Sepolia ETH, never committed
///     export ATTESTOR_ADDRESS=0x...          # the address that signs verdicts
///     export TREASURY_ADDRESS=0x...          # optional, defaults to the deployer
///     export FEE_BPS=500                     # optional, defaults to 500 (5%)
///     forge script script/Deploy.s.sol --rpc-url https://sepolia.base.org --broadcast
///
/// On Base Sepolia (84532) the token is Circle's USDC. On any other chain USDC_ADDRESS must be given, which is
/// how the local dry run points it at a mock.
contract Deploy is Script {
    address internal constant BASE_SEPOLIA_USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    function run() external returns (FieldworkEscrow escrow) {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address attestor = vm.envAddress("ATTESTOR_ADDRESS");
        address treasury = vm.envOr("TREASURY_ADDRESS", deployer);
        uint16 feeBps = uint16(vm.envOr("FEE_BPS", uint256(500)));
        address usdc = block.chainid == 84532 ? BASE_SEPOLIA_USDC : vm.envAddress("USDC_ADDRESS");

        vm.startBroadcast(pk);
        escrow = new FieldworkEscrow(usdc, attestor, treasury, feeBps);
        vm.stopBroadcast();

        console2.log("chain id        :", block.chainid);
        console2.log("FieldworkEscrow :", address(escrow));
        console2.log("usdc            :", usdc);
        console2.log("owner           :", escrow.owner());
        console2.log("attestor        :", escrow.attestor());
        console2.log("treasury        :", escrow.treasury());
        console2.log("feeBps          :", uint256(escrow.feeBps()));
    }
}
