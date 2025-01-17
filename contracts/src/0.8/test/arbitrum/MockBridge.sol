// SPDX-License-Identifier: MIT

pragma solidity 0.8.25;

/// @dev MockBridge to send a msg from L2 to L1.
contract MockBridge {
    address public outbox;

    constructor(address _outbox) {
        outbox = _outbox;
    }

    function activeOutbox() external view returns (address) {
        return outbox;
    }

    function sendAsBridge(
        address destination,
        bytes calldata calldataForL1
    ) external {
        (bool success, ) = destination.call(calldataForL1);
        require(success, "Failed TxToL1");
    }
}