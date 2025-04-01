// SPDX-License-Identifier: MIT

pragma solidity 0.8.25;

import "../../RealitioHomeProxyOptimism.sol";
import "./MockCrossDomainMessenger.sol";

/// @dev MockHomeProxy to bypass the modifier and usage of precompile.
contract MockRealitioHomeProxyOptimism is RealitioHomeProxyOptimism {
    MockCrossDomainMessenger public mockMessenger;

    modifier onlyForeignProxy() override {
        require(msg.sender == address(mockMessenger), "NOT_MESSENGER");
        require(mockMessenger.xDomainMessageSender() == foreignProxy, "Can only be called by Foreign Proxy");
        _;
    }

    constructor(
        IRealitio _realitio,
        string memory _metadata,
        address _foreignProxy,
        uint256 _foreignChainId,
        MockCrossDomainMessenger _messenger
    ) RealitioHomeProxyOptimism(_realitio, _metadata, _foreignProxy, _foreignChainId) {
        mockMessenger = _messenger;
    }

    function sendToL1(bytes memory _data) internal override {
        mockMessenger.sendMessage(foreignProxy, _data, MIN_GAS_LIMIT);
    }
}
