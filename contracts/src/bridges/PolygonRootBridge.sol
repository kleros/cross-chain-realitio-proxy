pragma solidity ^0.7.2;

import {IBridge} from "./IBridge.sol";
import {FxBaseRootTunnel} from "../dependencies/FxBaseRootTunnel.sol";

/**
 * @title Polygon FxRootTunnel Bridge for the Foreign chain
 */
contract PolygonRootBridge is IBridge, FxBaseRootTunnel {
    function homeProxy() external view override returns (address) {
        return fxChildTunnel;
    }

    constructor(
        address _checkpointManager,
        address _fxRoot,
        address _fxChildTunnel
    ) FxBaseRootTunnel(_checkpointManager, _fxRoot, _fxChildTunnel) {}

    function onlyHomeProxy() external override {
        require(msg.sender == address(this), "Can only be called via the bridge");
    }

    function sendMessage(address _recipient, bytes memory _data) external override {
        _sendMessageToChild(_data);
    }

    function _processMessageFromChild(bytes memory _data) internal override {
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, ) = address(this).call(_data);
        require(success, "Failed to call contract");
    }
}
