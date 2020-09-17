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

    struct ArbitrationRequest {
        Status status;
        address requester;
        bytes32 requesterAnswer;
        bytes32 arbitratorAnswer;
    }

    /// @dev Associates an arbitration request with a question ID.
    mapping(bytes32 => ArbitrationRequest) public arbitrationRequestsByQuestionID;

    /**
     * @dev To be emitted when there is a pending arbitration request.
     * @notice This will happen if the best answer for a given question changes between
     * the arbitration is requested on the Foreign Chain and the cross-chain message
     * reaches the home chain and becomes the same answer as the one from requester.
     * @param _questionID The ID of the question.
     * @param _requesterAnswer The answer the requester deem to be correct.
     * @param _requester The address of the user that requested arbitration.
     */
    event ArbitrationRequested(bytes32 indexed _questionID, bytes32 _requesterAnswer, address indexed _requester);

    /**
     * @dev To be emitted when there arbitration request is acknowledged.
     * @param _questionID The ID of the question.
     */
    event ArbitrationAcknowledged(bytes32 indexed _questionID);

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
        ArbitrationRequest storage arbitrationRequest = arbitrationRequestsByQuestionID[_questionID];
        require(arbitrationRequest.status == Status.None, "Request already exists");

        bytes32 currentAnswer = realitio.getBestAnswer(_questionID);

        emit ArbitrationRequested(_questionID, _requesterAnswer, _requester);

        if (currentAnswer == _requesterAnswer) {
            arbitrationRequest.status = Status.Pending;
            arbitrationRequest.requester = _requester;
            arbitrationRequest.requesterAnswer = _requesterAnswer;
        } else {
            arbitrationRequest.status = Status.AwaitingRuling;

            realitio.notifyOfArbitrationRequest(_questionID, _requester, 0);

            bytes4 selector = IForeignArbitrationProxy(0).acknowledgeArbitration.selector;
            bytes memory data = abi.encodeWithSelector(selector, _questionID);
            amb.requireToPassMessage(foreignProxy, data, amb.maxGasPerTx());

            emit ArbitrationAcknowledged(_questionID);
        }
    }

    /**
     * @dev Handles changed answer for a given question.
     * @param _questionID The ID of the question.
     */
    function handleAnswerChanged(bytes32 _questionID) external {
        ArbitrationRequest storage arbitrationRequest = arbitrationRequestsByQuestionID[_questionID];
        require(arbitrationRequest.status == Status.Pending, "Invalid request status");

        bytes32 currentAnswer = realitio.getBestAnswer(_questionID);
        require(arbitrationRequest.requesterAnswer != currentAnswer, "Answers are the same");

        arbitrationRequest.status = Status.AwaitingRuling;

        realitio.notifyOfArbitrationRequest(_questionID, arbitrationRequest.requester, 0);

        bytes4 selector = IForeignArbitrationProxy(0).acknowledgeArbitration.selector;
        bytes memory data = abi.encodeWithSelector(selector, _questionID);
        amb.requireToPassMessage(foreignProxy, data, amb.maxGasPerTx());

        emit ArbitrationAcknowledged(_questionID);
    }

    /**
     * @dev Handles a given question being finalized.
     * @param _questionID The ID of the question.
     */
    function handleQuestionFinalized(bytes32 _questionID) external {
        ArbitrationRequest storage arbitrationRequest = arbitrationRequestsByQuestionID[_questionID];
        require(arbitrationRequest.status == Status.Pending, "Invalid request status");

        bool isFinalized = realitio.isFinalized(_questionID);
        require(isFinalized, "Question not finalized");

        delete arbitrationRequestsByQuestionID[_questionID];

        bytes4 selector = IForeignArbitrationProxy(0).cancelArbitration.selector;
        bytes memory data = abi.encodeWithSelector(selector, _questionID);
        amb.requireToPassMessage(foreignProxy, data, amb.maxGasPerTx());
    }

    /**
     * @dev Recieves the new address of the requester if it changed.
     * @param _questionID The ID of the question.
     * @param _requester The address of the new requester.
     */
    function receiveRequesterChange(bytes32 _questionID, address _requester)
        external
        override
        onlyAmb
        onlyForeignProxy
    {
        ArbitrationRequest storage arbitrationRequest = arbitrationRequestsByQuestionID[_questionID];
        require(arbitrationRequest.status == Status.AwaitingRuling, "Invalid request status");

        arbitrationRequest.requester = _requester;

        emit RequesterChanged(_questionID, _requester);
    }

    /**
     * @dev Recieves a failed attempt to request arbitration.
     * @param _questionID The ID of the question.
     */
    function receiveArbitrationFailure(bytes32 _questionID) external override onlyAmb onlyForeignProxy {
        ArbitrationRequest storage arbitrationRequest = arbitrationRequestsByQuestionID[_questionID];
        require(arbitrationRequest.status == Status.AwaitingRuling, "Invalid request status");

        arbitrationRequest.status = Status.Failed;

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
        ArbitrationRequest storage arbitrationRequest = arbitrationRequestsByQuestionID[_questionID];
        require(arbitrationRequest.status == Status.Failed, "Invalid request status");

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

        delete arbitrationRequestsByQuestionID[_questionID];

        realitio.submitAnswerByArbitrator(_questionID, realitio.getBestAnswer(_questionID), _lastAnswerer);
    }

    /**
     * @dev Recieves the answer to a specified question.
     * @param _questionID The ID of the question.
     * @param _answer The answer from the arbitratior.
     */
    function receiveArbitrationAnswer(bytes32 _questionID, bytes32 _answer) external override onlyAmb onlyForeignProxy {
        ArbitrationRequest storage arbitrationRequest = arbitrationRequestsByQuestionID[_questionID];
        require(arbitrationRequest.status == Status.AwaitingRuling, "Invalid request status");

        arbitrationRequest.status = Status.Ruled;
        arbitrationRequest.arbitratorAnswer = _answer;

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
        ArbitrationRequest storage arbitrationRequest = arbitrationRequestsByQuestionID[_questionID];
        require(arbitrationRequest.status == Status.Ruled, "Arbitrator has not ruled yet");

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
            arbitrationRequest.arbitratorAnswer,
            computeWinner(_questionID, _lastAnswerOrCommitmentID, _lastBond, _lastAnswerer, _isCommitment)
        );

        delete arbitrationRequestsByQuestionID[_questionID];
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
        ArbitrationRequest storage arbitrationRequest = arbitrationRequestsByQuestionID[_questionID];

        // If the question hasn't been answered, then the arbitration requester wins.
        if (_lastBond == 0) {
            return arbitrationRequest.requester;
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

        return
            isAnswered && lastAnswer == arbitrationRequest.arbitratorAnswer
                ? _lastAnswerer
                : arbitrationRequest.requester;
    }
}
