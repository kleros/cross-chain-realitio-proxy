// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;

import "@kleros/erc-792/contracts/IArbitrator.sol";
import "@kleros/erc-792/contracts/IArbitrable.sol";
import "@kleros/ethereum-libraries/contracts/CappedMath.sol";
import "./dependencies/IAMB.sol";
import "./dependencies/RealitioInterface.sol";
import "./ArbitrationProxyInterfaces.sol";

contract RealitioHomeArbitrationProxy is IHomeArbitrationProxy {
    /// @dev The contract governor. TRUSTED.
    address public governor = msg.sender;

    /// @dev The address of the Realitio contract. TRUSTED.
    RealitioInterface public realitio;

    /// @dev ArbitraryMessageBridge contract address. TRUSTED.
    IAMB public amb;

    /// @dev Address of the counter-party proxy on the Foreign Chain. TRUSTED.
    address public foreignProxy;

    enum Status {None, Pending, AwaitingRuling, Ruled, Failed}

    struct Request {
        Status status;
        address requester;
        bytes32 requesterAnswer;
        bytes32 arbitratorAnswer;
    }

    /// @dev Associates an arbitration request with a question ID.
    mapping(bytes32 => Request) public questionIDToRequest;

    /**
     * @dev To be emitted when arbitration request is received but remained pending.
     * @notice This will happen if the best answer for a given question changes between
     * the arbitration is requested on the Foreign Chain and the cross-chain message
     * reaches the home chain and becomes the same answer as the one from requester.
     * @param _questionID The ID of the question.
     * @param _requesterAnswer The answer the requester deem to be correct.
     * @param _requester The address of the user that requested arbitration.
     */
    event RequestPending(bytes32 indexed _questionID, bytes32 _requesterAnswer, address indexed _requester);

    /**
     * @dev To be emitted when the Realitio contract has been notified of an arbitration request.
     * @notice This will happen if the best answer for a given question changes between
     * the arbitration is requested on the Foreign Chain and the cross-chain message
     * reaches the home chain and becomes the same answer as the one from requester.
     * @param _questionID The ID of the question.
     * @param _requesterAnswer The answer the requester deem to be correct.
     * @param _requester The address of the user that requested arbitration.
     */
    event RequestNotified(bytes32 indexed _questionID, bytes32 _requesterAnswer, address indexed _requester);

    /**
     * @dev To be emitted when there arbitration request acknowledgement is sent to the Foreign Chain.
     * @param _questionID The ID of the question.
     */
    event RequestAcknowledged(bytes32 indexed _questionID);

    /**
     * @dev To be emitted when there arbitration request is cancelled.
     * @param _questionID The ID of the question.
     */
    event RequestCancelled(bytes32 indexed _questionID);

    /**
     * @dev To be emitted when the arbitration requester changed.
     * @notice This will happen someone other than the original requester pays for
     * the remaining arbitration fee.
     * @param _questionID The ID of the question.
     * @param _requester The address of the new requester.
     */
    event RequesterChanged(bytes32 indexed _questionID, address indexed _requester);

    /**
     * @dev To be emitted when the dispute could not be created on the Foreign Chain.
     * @notice This will happen if there is a remaining arbitration fee users fail to pay.
     * @param _questionID The ID of the question.
     */
    event ArbitrationFailed(bytes32 indexed _questionID);

    /**
     * @dev To be emitted when receiving the answer from the arbitrator.
     * @param _questionID The ID of the question.
     * @param _answer The answer from the arbitrator.
     */
    event ArbitratorAnswered(bytes32 indexed _questionID, bytes32 _answer);

    modifier onlyGovernor() {
        require(msg.sender == governor, "Only governor allowed");
        _;
    }

    modifier onlyAmb() {
        require(msg.sender == address(amb), "Only AMB allowed");
        _;
    }

    modifier onlyForeignProxy() {
        require(amb.messageSender() == foreignProxy, "Only foreign proxy allowed");
        _;
    }

    /**
     * @dev Creates an arbitration proxy on the home chain.
     * @param _amb ArbitraryMessageBridge contract address.
     * @param _realitio Realitio contract address.
     */
    constructor(IAMB _amb, RealitioInterface _realitio) public {
        amb = _amb;
        realitio = _realitio;
    }

    /**
     * @dev Sets the address of a new governor.
     * @param _governor The address of the new governor.
     */
    function setGovernor(address _governor) external onlyGovernor {
        governor = _governor;
    }

    /**
     * @dev Sets the address of the ArbitraryMessageBridge.
     * @param _amb The address of the new ArbitraryMessageBridge.
     */
    function setAmb(IAMB _amb) external onlyGovernor {
        amb = _amb;
    }

    /**
     * @dev Sets the address of the arbitration proxy on the Foreign Chain.
     * @param _foreignProxy The address of the proxy.
     */
    function setForeignProxy(address _foreignProxy) external onlyGovernor {
        foreignProxy = _foreignProxy;
    }

    /**
     * @dev Recieves the requested arbitration for a question.
     * @param _questionID The ID of the question.
     * @param _requesterAnswer The answer the requester deem to be correct.
     * @param _requester The address of the user that requested arbitration.
     */
    function receiveArbitrationRequest(
        bytes32 _questionID,
        bytes32 _requesterAnswer,
        address _requester
    ) external override onlyAmb onlyForeignProxy {
        Request storage request = questionIDToRequest[_questionID];
        require(request.status == Status.None, "Request already exists");

        bytes32 currentAnswer = realitio.getBestAnswer(_questionID);

        if (currentAnswer == _requesterAnswer) {
            request.status = Status.Pending;
            request.requester = _requester;
            request.requesterAnswer = _requesterAnswer;

            emit RequestPending(_questionID, _requesterAnswer, _requester);
        } else {
            request.status = Status.AwaitingRuling;

            realitio.notifyOfArbitrationRequest(_questionID, _requester, 0);

            emit RequestNotified(_questionID, _requesterAnswer, _requester);
        }
    }

    /**
     * @dev Handles the notification of arbitration request for a given question.
     * @notice Sends the arbitration acknowledgement to the Foreign Chain.
     * @param _questionID The ID of the question.
     */
    function handleArbitrationRequestNotification(bytes32 _questionID) external {
        Request storage request = questionIDToRequest[_questionID];
        require(request.status == Status.AwaitingRuling, "Invalid request status");

        bytes4 selector = IForeignArbitrationProxy(0).acknowledgeArbitration.selector;
        bytes memory data = abi.encodeWithSelector(selector, _questionID);
        amb.requireToPassMessage(foreignProxy, data, amb.maxGasPerTx());

        emit RequestAcknowledged(_questionID);
    }

    /**
     * @dev Handles changed answer for a given question.
     * @notice Sends the arbitration acknowledgement to the Foreign Chain.
     * @param _questionID The ID of the question.
     */
    function handleAnswerChanged(bytes32 _questionID) external {
        Request storage request = questionIDToRequest[_questionID];
        require(request.status == Status.Pending, "Invalid request status");

        bytes32 currentAnswer = realitio.getBestAnswer(_questionID);
        require(request.requesterAnswer != currentAnswer, "Answers are the same");

        request.status = Status.AwaitingRuling;

        realitio.notifyOfArbitrationRequest(_questionID, request.requester, 0);

        emit RequestNotified(_questionID, request.requesterAnswer, request.requester);

        bytes4 selector = IForeignArbitrationProxy(0).acknowledgeArbitration.selector;
        bytes memory data = abi.encodeWithSelector(selector, _questionID);
        amb.requireToPassMessage(foreignProxy, data, amb.maxGasPerTx());

        emit RequestAcknowledged(_questionID);
    }

    /**
     * @dev Handles a given question being finalized.
     * @notice Sends the arbitration cancellation to the Foreign Chain.
     * @param _questionID The ID of the question.
     */
    function handleQuestionFinalized(bytes32 _questionID) external {
        Request storage request = questionIDToRequest[_questionID];
        require(request.status == Status.Pending, "Invalid request status");

        bool isFinalized = realitio.isFinalized(_questionID);
        require(isFinalized, "Question not finalized");

        delete questionIDToRequest[_questionID];

        bytes4 selector = IForeignArbitrationProxy(0).cancelArbitration.selector;
        bytes memory data = abi.encodeWithSelector(selector, _questionID);
        amb.requireToPassMessage(foreignProxy, data, amb.maxGasPerTx());

        emit RequestCancelled(_questionID);
    }

    /**
     * @dev Recieves a failed attempt to request arbitration.
     * @param _questionID The ID of the question.
     */
    function receiveArbitrationFailure(bytes32 _questionID) external override onlyAmb onlyForeignProxy {
        Request storage request = questionIDToRequest[_questionID];
        require(request.status == Status.AwaitingRuling, "Invalid request status");

        request.status = Status.Failed;

        emit ArbitrationFailed(_questionID);
    }

    /**
     * @dev Report the answer to a specified question when the arbitrator could not create a dispute.
     * @param _questionID The ID of the question.
     * @param _lastHistoryHash The history hash given with the last answer to the question in the Realitio contract.
     * @param _lastAnswerOrCommitmentID The last answer given, or its commitment ID if it was a commitment, to the question in the Realitio contract.
     * @param _lastBond The bond paid for the last answer to the question in the Realitio contract.
     * @param _lastAnswerer The last answerer to the question in the Realitio contract.
     * @param _isCommitment Whether the last answer to the question in the Realitio contract used commit or reveal or not. True if it did, false otherwise.
     */
    function reportAnswerForFailedArbitration(
        bytes32 _questionID,
        bytes32 _lastHistoryHash,
        bytes32 _lastAnswerOrCommitmentID,
        uint256 _lastBond,
        address _lastAnswerer,
        bool _isCommitment
    ) external {
        Request storage request = questionIDToRequest[_questionID];
        require(request.status == Status.Failed, "Invalid request status");

        require(
            realitio.getHistoryHash(_questionID) ==
                keccak256(
                    abi.encodePacked(
                        _lastHistoryHash,
                        _lastAnswerOrCommitmentID,
                        _lastBond,
                        _lastAnswerer,
                        _isCommitment
                    )
                ),
            "Invalid question params"
        );

        delete questionIDToRequest[_questionID];

        realitio.submitAnswerByArbitrator(_questionID, realitio.getBestAnswer(_questionID), _lastAnswerer);
    }

    /**
     * @dev Recieves the answer to a specified question.
     * @param _questionID The ID of the question.
     * @param _answer The answer from the arbitratior.
     */
    function receiveArbitrationAnswer(bytes32 _questionID, bytes32 _answer) external override onlyAmb onlyForeignProxy {
        Request storage request = questionIDToRequest[_questionID];
        require(request.status == Status.AwaitingRuling, "Invalid request status");

        request.status = Status.Ruled;
        request.arbitratorAnswer = _answer;

        emit ArbitratorAnswered(_questionID, _answer);
    }

    /**
     * @dev Report the answer provided by the arbitrator to a specified question.
     * @param _questionID The ID of the question.
     * @param _lastHistoryHash The history hash given with the last answer to the question in the Realitio contract.
     * @param _lastAnswerOrCommitmentID The last answer given, or its commitment ID if it was a commitment, to the question in the Realitio contract.
     * @param _lastBond The bond paid for the last answer to the question in the Realitio contract.
     * @param _lastAnswerer The last answerer to the question in the Realitio contract.
     * @param _isCommitment Whether the last answer to the question in the Realitio contract used commit or reveal or not. True if it did, false otherwise.
     */
    function reportAnswer(
        bytes32 _questionID,
        bytes32 _lastHistoryHash,
        bytes32 _lastAnswerOrCommitmentID,
        uint256 _lastBond,
        address _lastAnswerer,
        bool _isCommitment
    ) external {
        Request storage request = questionIDToRequest[_questionID];
        require(request.status == Status.Ruled, "Arbitrator has not ruled yet");

        require(
            realitio.getHistoryHash(_questionID) ==
                keccak256(
                    abi.encodePacked(
                        _lastHistoryHash,
                        _lastAnswerOrCommitmentID,
                        _lastBond,
                        _lastAnswerer,
                        _isCommitment
                    )
                ),
            "Invalid question params"
        );

        realitio.submitAnswerByArbitrator(
            _questionID,
            request.arbitratorAnswer,
            computeWinner(_questionID, _lastAnswerOrCommitmentID, _lastBond, _lastAnswerer, _isCommitment)
        );

        delete questionIDToRequest[_questionID];
    }

    /**
     * @dev Computes the Realitio answerer, of a specified question, that should win.
     * This function is needed to avoid the "stack too deep error".
     * @param _questionID The ID of the question.
     * @param _lastAnswerOrCommitmentID The last answer given, or its commitment ID if it was a commitment, to the question in the Realitio contract.
     * @param _lastBond The bond paid for the last answer to the question in the Realitio contract.
     * @param _lastAnswerer The last answerer to the question in the Realitio contract.
     * @param _isCommitment Whether the last answer to the question in the Realitio contract used commit or reveal or not. True if it did, false otherwise.
     * @return The computed winner address.
     */
    function computeWinner(
        bytes32 _questionID,
        bytes32 _lastAnswerOrCommitmentID,
        uint256 _lastBond,
        address _lastAnswerer,
        bool _isCommitment
    ) private view returns (address) {
        Request storage request = questionIDToRequest[_questionID];

        // If the question hasn't been answered, then the arbitration requester wins.
        if (_lastBond == 0) {
            return request.requester;
        }

        bytes32 lastAnswer;
        bool isAnswered;

        if (_isCommitment) {
            (uint32 revealTS, bool isRevealed, bytes32 revealedAnswer) = realitio.commitments(
                _lastAnswerOrCommitmentID
            );
            if (isRevealed) {
                lastAnswer = revealedAnswer;
                isAnswered = true;
            } else {
                require(revealTS <= uint32(block.timestamp), "Reveal deadline still pending");
                isAnswered = false;
            }
        } else {
            lastAnswer = _lastAnswerOrCommitmentID;
            isAnswered = true;
        }

        return isAnswered && lastAnswer == request.arbitratorAnswer ? _lastAnswerer : request.requester;
    }
}
