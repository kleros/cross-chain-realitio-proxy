// SPDX-License-Identifier: MIT

pragma solidity 0.8.25;

import "../../RealitioHomeProxyArbitrum.sol";
import "./MockBridge.sol";

/// @dev MockHomeProxy to bypass the modifier and usage of precompile.
contract MockRealitioHomeProxyArbitrum is RealitioHomeProxyArbitrum {
    address public mockInbox;
    MockBridge public mockBridge;

    /// @dev Override the original one
    modifier onlyForeignProxyAlias() override {
        require(msg.sender == mockInbox, "Can only be called by foreign proxy");
        _;
    }

    constructor(
        IRealitio _realitio,
        string memory _metadata,
        address _foreignProxy,
        uint256 _foreignChainId,
        address _mockInbox,
        MockBridge _mockBridge
    ) RealitioHomeProxyArbitrum(_realitio, _metadata, _foreignProxy, _foreignChainId) {
        mockInbox = _mockInbox;
        mockBridge = _mockBridge;
    }

    function sendToL1(bytes memory _data) internal override {
        mockBridge.sendAsBridge(foreignProxy, _data);
    }
}
