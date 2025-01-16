// SPDX-License-Identifier: MIT

pragma solidity 0.8.25;
// @dev https://github.com/ethereum-optimism/optimism/blob/v1.7.7/packages/contracts-bedrock/src/universal/CrossDomainMessenger.sol
interface ICrossDomainMessenger {
    function sendMessage(
        address _target,
        bytes calldata _message,
        uint32 _gasLimit
    ) external;

    function xDomainMessageSender() external view returns (address);
}
