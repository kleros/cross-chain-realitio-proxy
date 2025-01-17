// SPDX-License-Identifier: MIT

pragma solidity 0.8.25;

contract MockOutbox {
    address public sender;

    function setSender(address _sender) external {
        sender = _sender; // Set to home proxy address.
    }

    function l2ToL1Sender() external view returns (address) {
        return sender;
    }
}