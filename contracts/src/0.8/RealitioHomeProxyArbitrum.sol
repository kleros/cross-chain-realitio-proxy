// SPDX-License-Identifier: MIT

/**
 *  @authors: [@unknownunknown1]
 *  @reviewers: [@jaybuidl]
 *  @auditors: []
 *  @bounties: []
 *  @deployments: []
 */

pragma solidity 0.8.25;

import "./interfaces/IRealitio.sol";
import {IForeignArbitrationProxy, IHomeArbitrationProxy} from "./interfaces/IArbitrationProxies.sol";
import "@arbitrum/nitro-contracts/src/precompiles/ArbSys.sol";
import "@arbitrum/nitro-contracts/src/libraries/AddressAliasHelper.sol";

/**
 * @title Arbitration proxy for Realitio on Arbitrum.
 * @dev This contract is meant to be deployed to L2 where Reality.eth is deployed.
 * https://docs.arbitrum.io/arbos/l2-to-l1-messaging
 * Example https://github.com/OffchainLabs/arbitrum-tutorials/blob/2c1b7d2db8f36efa496e35b561864c0f94123a5f/packages/greeter/contracts/arbitrum/GreeterL2.sol
 */
contract RealitioHomeProxyArbitrum is IHomeArbitrationProxy {
    // Precompiled contract for L2 -> L1 communication
    // https://docs.arbitrum.io/build-decentralized-apps/precompiles/reference#arbsys
    ArbSys constant ARB_SYS = ArbSys(address(100));

    /// @dev The address of the Realitio contract (v3.0 required). TRUSTED.
    IRealitio public immutable realitio;
    /// @dev Address of the proxy on L1. Note that it needs to be precomputed before deployment by using deployer's address and tx nonce.
    address public immutable foreignProxy;
    /// @dev ID of the foreign chain, required for Realitio.
    bytes32 public immutable foreignChainId;

    /// @dev Metadata for Realitio interface.
    string public override metadata;

    enum Status {
        None,
        Rejected,
        Notified,
        AwaitingRuling,
        Ruled,
        Finished
    }

    struct Request {
        Status status;
        bytes32 arbitratorAnswer;
    }

    /// @dev Associates an arbitration request with a question ID and a requester address. requests[questionID][requester]
    mapping(bytes32 => mapping(address => Request)) public requests;

    /// @dev Associates a question ID with the requester who succeeded in requesting arbitration. questionIDToRequester[questionID]
    mapping(bytes32 => address) public questionIDToRequester;

    event L2ToL1TxCreated(uint256 indexed withdrawalId);

    /// @dev Foreign proxy uses its alias to make calls on L2.
    modifier onlyForeignProxyAlias() virtual {
        require(msg.sender == AddressAliasHelper.applyL1ToL2Alias(foreignProxy), "Can only be called by foreign proxy");
        _;
    }

    /**
     * @notice Creates an arbitration proxy on the home chain.
     * @param _realitio Realitio contract address.
     * @param _metadata Metadata for Realitio.
     * @param _foreignProxy Address of the proxy on L1. Note that it needs to be precomputed before deployment by using deployer's address and tx nonce.
     * @param _foreignChainId The ID of foreign chain (Sepolia/Mainnet).
     */
    constructor(IRealitio _realitio, string memory _metadata, address _foreignProxy, uint256 _foreignChainId) {
        realitio = _realitio;
        metadata = _metadata;
        foreignChainId = bytes32(_foreignChainId);
        foreignProxy = _foreignProxy;
    }

    /**
     * @dev Receives the requested arbitration for a question. TRUSTED.
     * @param _questionID The ID of the question.
     * @param _requester The address of the user that requested arbitration.
     * @param _maxPrevious The maximum value of the previous bond for the question.
     */
    function receiveArbitrationRequest(
        bytes32 _questionID,
        address _requester,
        uint256 _maxPrevious
    ) external override onlyForeignProxyAlias {
        Request storage request = requests[_questionID][_requester];
        require(request.status == Status.None, "Request already exists");

        try realitio.notifyOfArbitrationRequest(_questionID, _requester, _maxPrevious) {
            request.status = Status.Notified;
            questionIDToRequester[_questionID] = _requester;

            emit RequestNotified(_questionID, _requester, _maxPrevious);
        } catch Error(string memory reason) {
            /*
             * Will fail if:
             *  - The question does not exist.
             *  - The question was not answered yet.
             *  - Another request was already accepted.
             *  - Someone increased the bond on the question to a value > _maxPrevious
             */
            request.status = Status.Rejected;

            emit RequestRejected(_questionID, _requester, _maxPrevious, reason);
        } catch {
            // In case `reject` did not have a reason string or some other error happened
            request.status = Status.Rejected;

            emit RequestRejected(_questionID, _requester, _maxPrevious, "");
        }
    }

    /**
     * @dev Relays arbitration request back to L1 after it has been notified by Realitio for a given question.
     * @param _questionID The ID of the question.
     * @param _requester The address of the user that requested arbitration.
     */
    function handleNotifiedRequest(bytes32 _questionID, address _requester) external override {
        Request storage request = requests[_questionID][_requester];
        require(request.status == Status.Notified, "Invalid request status");

        request.status = Status.AwaitingRuling;

        bytes4 selector = IForeignArbitrationProxy.receiveArbitrationAcknowledgement.selector;
        bytes memory data = abi.encodeWithSelector(selector, _questionID, _requester);
        sendToL1(data);
        emit RequestAcknowledged(_questionID, _requester);
    }

    /**
     * @dev Relays arbitration request back to L1 after it has been rejected.
     * Reasons why the request might be rejected:
     *  - The question does not exist
     *  - The question was not answered yet
     *  - The question bond value changed while the arbitration was being requested
     *  - Another request was already accepted
     * @param _questionID The ID of the question.
     * @param _requester The address of the user that requested arbitration.
     */
    function handleRejectedRequest(bytes32 _questionID, address _requester) external override {
        Request storage request = requests[_questionID][_requester];
        require(request.status == Status.Rejected, "Invalid request status");

        // At this point, only the request.status is set, simply resetting the status to Status.None is enough.
        request.status = Status.None;

        bytes4 selector = IForeignArbitrationProxy.receiveArbitrationCancelation.selector;
        bytes memory data = abi.encodeWithSelector(selector, _questionID, _requester);
        sendToL1(data);
        emit RequestCanceled(_questionID, _requester);
    }

    /**
     * @notice Receives a failed attempt to request arbitration. TRUSTED.
     * @dev Currently this can happen only if the arbitration cost increased.
     * @param _questionID The ID of the question.
     * @param _requester The address of the user that requested arbitration.
     */
    function receiveArbitrationFailure(
        bytes32 _questionID,
        address _requester
    ) external override onlyForeignProxyAlias {
        Request storage request = requests[_questionID][_requester];
        require(request.status == Status.AwaitingRuling, "Invalid request status");

        // At this point, only the request.status is set, simply resetting the status to Status.None is enough.
        request.status = Status.None;

        realitio.cancelArbitration(_questionID);

        emit ArbitrationFailed(_questionID, _requester);
    }

    /**
     * @notice Receives an answer to a specified question. TRUSTED.
     * @param _questionID The ID of the question.
     * @param _answer The answer from the arbitrator.
     */
    function receiveArbitrationAnswer(bytes32 _questionID, bytes32 _answer) external override onlyForeignProxyAlias {
        address requester = questionIDToRequester[_questionID];
        Request storage request = requests[_questionID][requester];
        require(request.status == Status.AwaitingRuling, "Invalid request status");

        request.status = Status.Ruled;
        request.arbitratorAnswer = _answer;

        emit ArbitratorAnswered(_questionID, _answer);
    }

    /**
     * @notice Reports the answer provided by the arbitrator to a specified question.
     * @dev The Realitio contract validates the input parameters passed to this method,
     * so making this publicly accessible is safe.
     * @param _questionID The ID of the question.
     * @param _lastHistoryHash The history hash given with the last answer to the question in the Realitio contract.
     * @param _lastAnswerOrCommitmentID The last answer given, or its commitment ID if it was a commitment,
     * to the question in the Realitio contract.
     * @param _lastAnswerer The last answerer to the question in the Realitio contract.
     */
    function reportArbitrationAnswer(
        bytes32 _questionID,
        bytes32 _lastHistoryHash,
        bytes32 _lastAnswerOrCommitmentID,
        address _lastAnswerer
    ) external {
        address requester = questionIDToRequester[_questionID];
        Request storage request = requests[_questionID][requester];
        require(request.status == Status.Ruled, "Arbitrator has not ruled yet");

        request.status = Status.Finished;

        realitio.assignWinnerAndSubmitAnswerByArbitrator(
            _questionID,
            request.arbitratorAnswer,
            requester,
            _lastHistoryHash,
            _lastAnswerOrCommitmentID,
            _lastAnswerer
        );

        emit ArbitrationFinished(_questionID);
    }

    /**
     * @notice Sends a message to L1.
     * @param _data The data sent.
     */
    function sendToL1(bytes memory _data) internal virtual {
        uint256 withdrawalId = ARB_SYS.sendTxToL1(foreignProxy, _data);
        emit L2ToL1TxCreated(withdrawalId);
    }
}
