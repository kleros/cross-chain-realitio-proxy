// SPDX-License-Identifier: MIT

pragma solidity 0.8.25;

import "../../RealitioHomeProxyZkSync.sol";

/**
 * @dev The purpose of this contract is to override the precompiled L1Messenger.
 */
contract MockZkHomeProxy is RealitioHomeProxyZkSync {
    event L1MessageSent(bytes _data);

    constructor(
        IRealitio _realitio,
        string memory _metadata,
        address _foreignProxy,
        address _foreignProxyAlias,
        uint256 _foreignChainId
    ) RealitioHomeProxyZkSync(_realitio, _metadata, _foreignProxy, _foreignProxyAlias, _foreignChainId) {}

    function sendToL1(bytes memory _data) internal override {
        emit L1MessageSent(_data);
    }
}
