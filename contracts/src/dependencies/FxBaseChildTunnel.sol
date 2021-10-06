// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <0.8.0;

// IFxMessageProcessor represents interface to process message
interface IFxMessageProcessor {
    function processMessageFromRoot(
        uint256 stateId,
        address rootMessageSender,
        bytes calldata data
    ) external;
}

/**
 * @notice Mock child tunnel contract to receive and send message from L2
 */
contract FxBaseChildTunnel is IFxMessageProcessor {
    // MessageTunnel on L1 will get data from this event
    event MessageSent(bytes message);
    address public fxChild;
    address public fxRootTunnel;
    address public foreignProxy;

    constructor(
        address _fxChild,
        address _fxRootTunnel,
        address _foreignProxy
    ) {
        fxChild = _fxChild;
        fxRootTunnel = _fxRootTunnel;
        foreignProxy = _foreignProxy;
    }

    // Sender must be fxRootTunnel in case of ERC20 tunnel
    modifier validateSender(address sender) {
        require(sender == fxRootTunnel, "FxBaseChildTunnel: INVALID_SENDER_FROM_ROOT");
        _;
    }

    function processMessageFromRoot(
        uint256 stateId,
        address rootMessageSender,
        bytes calldata data
    ) external override {
        require(msg.sender == fxChild, "FxBaseChildTunnel: INVALID_SENDER");
        _processMessageFromRoot(stateId, rootMessageSender, data);
    }

    /**
     * @notice Emit message that can be received on Root Tunnel
     * @dev Call the internal function when need to emit message
     * @param message bytes message that will be sent to Root Tunnel
     * some message examples -
     *   abi.encode(tokenId);
     *   abi.encode(tokenId, tokenMetadata);
     *   abi.encode(messageType, messageData);
     */
    function _sendMessageToRoot(bytes memory message) internal {
        emit MessageSent(message);
    }

    /**
     * @notice Process message received from Root Tunnel
     * @dev function needs to be implemented to handle message as per requirement
     * This is called by onStateReceive function.
     * Since it is called via a system call, any event will not be emitted during its execution.
     * @param _stateId unique state id
     * @param _sender root message sender
     * @param _data bytes message that was sent from Root Tunnel
     */
    function _processMessageFromRoot(
        uint256 _stateId,
        address _sender,
        bytes memory _data
    ) internal validateSender(_sender) {
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, ) = address(foreignProxy).call(_data);
        require(success, "Failed to call contract");
    }

    function sendMessageToRoot(bytes memory _message) external {
        require(msg.sender == foreignProxy, "Only Home Proxy");
        _sendMessageToRoot(_message);
    }
}
