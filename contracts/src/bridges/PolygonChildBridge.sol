pragma solidity ^0.7.2;

import {IBridge} from "./IBridge.sol";
import {FxBaseChildTunnel} from "../dependencies/FxBaseChildTunnel.sol";

/**
 * @title Polygon FxChildTunnel Bridge for the Home chain
 */
contract PolygonChildBridge is IBridge, FxBaseChildTunnel {
    function foreignProxy() external view override returns (address) {
        return fxRootTunnel;
    }

    constructor(address _fxChild, address _fxRootTunnel) FxBaseChildTunnel(_fxChild, _fxRootTunnel) {}

    function onlyForeignProxy() external override {
        require(msg.sender == address(this), "Can only be called via the bridge");
    }

    function sendMessage(address _recipient, bytes memory _data) external override {
        _sendMessageToRoot(_data);
    }

    function _processMessageFromRoot(
        uint256 _stateId,
        address _sender,
        bytes memory _data
    ) internal override validateSender(_sender) {
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, ) = address(this).call(_data);
        require(success, "Failed to call contract");
    }
}
