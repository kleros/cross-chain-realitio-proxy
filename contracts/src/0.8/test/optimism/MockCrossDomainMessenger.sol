// SPDX-License-Identifier: MIT

pragma solidity 0.8.25;

import {ICrossDomainMessenger} from "../../interfaces/optimism/ICrossDomainMessenger.sol";

// @dev https://github.com/ethereum-optimism/optimism/blob/v1.7.7/packages/contracts-bedrock/src/universal/CrossDomainMessenger.sol
contract MockCrossDomainMessenger is ICrossDomainMessenger {
    address public homeProxy;
    address public foreignProxy;

    /**
     * @notice Creating demo CrossDomainMessenger.
     * @param _homeProxy address of L2 contract
     * @param _foreignProxy address of L1 contract
     */
    constructor(address _homeProxy, address _foreignProxy) {
        homeProxy = _homeProxy;
        foreignProxy = _foreignProxy;
    }

    function sendMessage(address _target, bytes calldata _message, uint32 /*_gasLimit*/) external {
        (bool success, ) = _target.call(_message);
        require(success, "Failed TxToL1");
    }

    /// @notice Retrieves the address of the contract or wallet that initiated the currently
    ///         executing message on the other chain. Will throw an error if there is no message
    ///         currently being executed. Allows the recipient of a call to see who triggered it.
    /// @return Address of the sender of the currently executing message on the other chain.
    function xDomainMessageSender() external view returns (address) {
        if (msg.sender == homeProxy) return foreignProxy;
        return homeProxy;
    }

    function setHomeProxy(address _homeProxy) external {
        homeProxy = _homeProxy;
    }

    function setForeignProxy(address _foreignProxy) external {
        foreignProxy = _foreignProxy;
    }
}
