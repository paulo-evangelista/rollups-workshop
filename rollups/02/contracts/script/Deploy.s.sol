pragma solidity ^0.8.27;

import {Script, console} from "forge-std-1.9.7/src/Script.sol";
import {EmergencyWithdraw} from "../src/delegatecall/EmergencyWithdraw.sol";
import {SafeERC20Transfer} from "../src/delegatecall/SafeERC20Transfer.sol";
import {Token} from "../src/token/ERC20/Token.sol";

contract Deploy is Script {
    EmergencyWithdraw public emergencyWithdraw;
    SafeERC20Transfer public safeERC20Transfer;

    Token public token;


    function run() public returns (EmergencyWithdraw, SafeERC20Transfer, Token) {
        vm.startBroadcast();

        emergencyWithdraw = new EmergencyWithdraw{salt: keccak256("1596")}();
        safeERC20Transfer = new SafeERC20Transfer{salt: keccak256("1596")}();

        token = new Token();

        vm.stopBroadcast();

        _saveDeploymentInfo();

        return (emergencyWithdraw, safeERC20Transfer, token);
    }

    function _saveDeploymentInfo() internal {
        string memory deploymentInfo = string.concat(
            '{"deployer":{',
            '"chainId":',
            vm.toString(block.chainid),
            ",",
            '"timestamp":',
            vm.toString(block.timestamp),
            ",",
            '"contracts":{',
            '","emergencyWithdraw":"',
            vm.toString(address(emergencyWithdraw)),
            '","safeERC20Transfer":"',
            vm.toString(address(safeERC20Transfer)),
            '","token":"',
            vm.toString(address(token)),
            '"',
            "}",
            "}}"
        );

        vm.writeJson(deploymentInfo, string.concat("./deployments/", vm.toString(block.chainid), ".json"));
    }
}
