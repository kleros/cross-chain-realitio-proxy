// SPDX-License-Identifier: MIT

/**
 *  @authors: [@hbarcelos]
 *  @reviewers: [@ferittuncer*, @fnanni-0*, @nix1g*, @epiqueras*]
 *  @auditors: []
 *  @bounties: []
 *  @deployments: []
 */

pragma solidity ^0.7.2;

import "./dependencies/IAMB.sol";
import "./dependencies/RealitioInterface.sol";
import "./ArbitrationProxyInterfaces.sol";

/**
 * @title Arbitration proxy for Realitio on the side-chain side (A.K.A. the Home Chain).
 * @dev This contract is meant to be deployed to side-chains (i.e.: xDAI) in which Reality.eth is been deployed.
 */
contract RealitioHomeArbitrationProxy is IHomeArbitrationProxy {
    /// @dev The contract governor. TRUSTED.
    address public governor = msg.sender;

    /// @dev The address of the Realitio contract (v2.1+ required). TRUSTED.
    RealitioInterface public immutable realitio;

    /// @dev ArbitraryMessageBridge contract address. TRUSTED.
    IAMB public immutable amb;

    /// @dev Address of the counter-party proxy on the Foreign Chain. TRUSTED.
    address public foreignProxy;

    /// @dev The chain ID where the foreign proxy is deployed.
    uint256 public foreignChainId;

    /// @dev Metadata for Realitio interface.
    string public constant metadata = '{"foreignProxy":true}';

    enum Status {None, Rejected, Notified, AwaitingRuling, Ruled, Finished}

    struct Request {
        Status status;
        address requester;
        bytes32 arbitratorAnswer;
    }

    /// @dev Associates an arbitration request with a question ID and a contested answer.
    mapping(bytes32 => mapping(bytes32 => Request)) public requests;

    /// @dev Associates a question ID with the contested answer that led to the arbitration be requested.
    mapping(bytes32 => bytes32) public questionIDToContestedAnswer;

    modifier onlyGovernor() {
        require(msg.sender == governor, "Only governor allowed");
        _;
    }

    modifier onlyForeignProxy() {
        require(msg.sender == address(amb), "Only AMB allowed");
        require(amb.messageSourceChainId() == bytes32(foreignChainId), "Only foreign chain allowed");
        require(amb.messageSender() == foreignProxy, "Only foreign proxy allowed");
        _;
    }

    /**
     * @notice Creates an arbitration proxy on the home chain.
     * @param _amb ArbitraryMessageBridge contract address.
     * @param _realitio Realitio contract address.
     */
    constructor(IAMB _amb, RealitioInterface _realitio) {
        amb = _amb;
        realitio = _realitio;
    }

    /**
     * @notice Sets the address of a new governor.
     * @param _governor The address of the new governor.
     */
    function setGovernor(address _governor) external onlyGovernor {
        governor = _governor;
    }

    /**
     * @notice Sets the address of the arbitration proxy on the Foreign Chain.
     * @param _foreignProxy The address of the proxy.
     * @param _foreignChainId The ID of the chain where the foreign proxy is deployed.
     */
    function setForeignProxy(address _foreignProxy, uint256 _foreignChainId) external onlyGovernor {
        require(foreignProxy == address(0), "Foreign proxy already set");

        foreignProxy = _foreignProxy;
        foreignChainId = _foreignChainId;
    }

    /**
     * @notice Receives the requested arbitration for a question.
     * @param _questionID The ID of the question.
     * @param _contestedAnswer The answer the requester deems to be incorrect.
     * @param _requester The address of the user that requested arbitration.
     */
    function receiveArbitrationRequest(
        bytes32 _questionID,
        bytes32 _contestedAnswer,
        address _requester
    ) external override onlyForeignProxy {
        Request storage request = requests[_questionID][_contestedAnswer];
        require(request.status == Status.None, "Request already exists");

        if (realitio.getBestAnswer(_questionID) == _contestedAnswer) {
            try realitio.notifyOfArbitrationRequest(_questionID, _requester, 0) {
                request.status = Status.Notified;
                request.requester = _requester;
                questionIDToContestedAnswer[_questionID] = _contestedAnswer;

                emit RequestNotified(_questionID, _contestedAnswer, _requester);
            } catch {
                request.status = Status.Rejected;

                emit RequestRejected(_questionID, _contestedAnswer, _requester);
            }
        } else {
            request.status = Status.Rejected;

            emit RequestRejected(_questionID, _contestedAnswer, _requester);
        }
    }

    /**
     * @notice Sends the arbitration acknowledgement to the Foreign Chain.
     * @dev Handles arbitration request after it has been notified to Realitio for a given question.
     * @param _questionID The ID of the question.
     * @param _contestedAnswer The answer the requester deems to be incorrect.
     */
    function handleNotifiedRequest(bytes32 _questionID, bytes32 _contestedAnswer) external override {
        Request storage request = requests[_questionID][_contestedAnswer];
        require(request.status == Status.Notified, "Invalid request status");

        request.status = Status.AwaitingRuling;

        bytes4 selector = IForeignArbitrationProxy(0).acknowledgeArbitration.selector;
        bytes memory data = abi.encodeWithSelector(selector, _questionID, _contestedAnswer);
        amb.requireToPassMessage(foreignProxy, data, amb.maxGasPerTx());

        emit RequestAcknowledged(_questionID, _contestedAnswer);
    }

    /**
     * @notice Sends the arbitration rejection to the Foreign Chain.
     * @dev Handles arbitration request after it has been rejected due to the quesiton
     * being finalized or the contested answer being different from the current one.
     * @param _questionID The ID of the question.
     * @param _contestedAnswer The answer the requester deems to be incorrect.
     */
    function handleRejectedRequest(bytes32 _questionID, bytes32 _contestedAnswer) external override {
        Request storage request = requests[_questionID][_contestedAnswer];
        require(request.status == Status.Rejected, "Invalid request status");

        // At this point, only the request.status is set, simply reseting the status to Status.None is enough.
        request.status = Status.None;

        bytes4 selector = IForeignArbitrationProxy(0).cancelArbitration.selector;
        bytes memory data = abi.encodeWithSelector(selector, _questionID, _contestedAnswer);
        amb.requireToPassMessage(foreignProxy, data, amb.maxGasPerTx());

        emit RequestCanceled(_questionID, _contestedAnswer);
    }

    /**
     * @dev Receives a failed attempt to request arbitration.
     * @param _questionID The ID of the question.
     * @param _contestedAnswer The answer the requester deems to be incorrect.
     */
    function receiveArbitrationFailure(bytes32 _questionID, bytes32 _contestedAnswer)
        external
        override
        onlyForeignProxy
    {
        Request storage request = requests[_questionID][_contestedAnswer];
        require(request.status == Status.AwaitingRuling, "Invalid request status");

        delete requests[_questionID][_contestedAnswer];

        realitio.cancelArbitration(_questionID);

        emit ArbitrationFailed(_questionID, _contestedAnswer);
    }

    /**
     * @dev Receives the answer to a specified question.
     * @param _questionID The ID of the question.
     * @param _answer The answer from the arbitratior.
     */
    function receiveArbitrationAnswer(bytes32 _questionID, bytes32 _answer) external override onlyForeignProxy {
        bytes32 contestedAnswer = questionIDToContestedAnswer[_questionID];
        Request storage request = requests[_questionID][contestedAnswer];
        require(request.status == Status.AwaitingRuling, "Invalid request status");

        request.status = Status.Ruled;
        request.arbitratorAnswer = _answer;

        emit ArbitratorAnswered(_questionID, _answer);
    }

    /**
     * @notice Report the answer provided by the arbitrator to a specified question.
     * @dev The Realitio contract validates the input parameters passed to this method, so it is safe to publicly accessible.
     * @param _questionID The ID of the question.
     * @param _lastHistoryHash The history hash given with the last answer to the question in the Realitio contract.
     * @param _lastAnswerOrCommitmentID The last answer given, or its commitment ID if it was a commitment, to the question in the Realitio contract.
     * @param _lastAnswerer The last answerer to the question in the Realitio contract.
     */
    function reportArbitrationAnswer(
        bytes32 _questionID,
        bytes32 _lastHistoryHash,
        bytes32 _lastAnswerOrCommitmentID,
        address _lastAnswerer
    ) external {
        bytes32 contestedAnswer = questionIDToContestedAnswer[_questionID];
        Request storage request = requests[_questionID][contestedAnswer];
        require(request.status == Status.Ruled, "Arbitrator has not ruled yet");

        realitio.assignWinnerAndSubmitAnswerByArbitrator(
            _questionID,
            request.arbitratorAnswer,
            request.requester,
            _lastHistoryHash,
            _lastAnswerOrCommitmentID,
            _lastAnswerer
        );

        request.status = Status.Finished;

        emit ArbitrationFinished(_questionID);
    }
}
