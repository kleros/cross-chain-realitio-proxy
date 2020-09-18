// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;

import "@kleros/erc-792/contracts/IArbitrator.sol";
import "@kleros/erc-792/contracts/IArbitrable.sol";
import "@kleros/erc-792/contracts/erc-1497/IEvidence.sol";
import "@kleros/ethereum-libraries/contracts/CappedMath.sol";
import "./dependencies/IAMB.sol";
import "./ArbitrationProxyInterfaces.sol";

contract RealitioForeignArbitrationProxy is IForeignArbitrationProxy, IArbitrable, IEvidence {
    using CappedMath for uint256;

    /// @dev The contract governor. TRUSTED.
    address public governor = msg.sender;

    /// @dev Whether the contract has been properly initialized or not.
    bool public initialized;

    /// @dev The address of the arbitrator. TRUSTED.
    IArbitrator public arbitrator;

    /// @dev The extra data used to raise a dispute in the arbitrator.
    bytes public arbitratorExtraData;

    /// @dev The number of choices for the arbitrator.
    uint256 public constant NUMBER_OF_CHOICES_FOR_ARBITRATOR = (2**256) - 2;

    /**
     * @dev Timeout for the requester to update the arbitration fee.
     * @notice Required if there is a mismatch between the deposit and the arbitration fee.
     * This will happen if the arbitration fee increases between the arbitration request
     * and the notification of Realitio contract that an arbitration has been requested.
     */
    uint32 public updateFeeTimeoutForRequester = 1 days;

    /**
     * @dev Timeout for anyone to update the arbitration fee.
     * @notice This will start only after the timeout for the requester is expired.
     */
    uint32 public updateFeeTimeoutForAnyone = 1 days;

    /// @dev ArbitraryMessageBridge contract address. TRUSTED.
    IAMB public amb;

    /// @dev Address of the counter-party proxy on the Home Chain. TRUSTED.
    address public homeProxy;

    enum Status {None, Requested, PendingFee, Created}

    struct ArbitrationRequest {
        // Status of the request.
        Status status;
        // Address that made the request or paid the remaining fee.
        address requester;
        // Approximate time in which the arbitration request was acknowledged by the home chain.
        // Because the asynchronous nature of cross-chain communication, the actual time the
        // arbitration was acknowledged will be before registered here.
        uint32 acknowledgedAt;
        // The deposit paid by the requester at the time of the request.
        uint256 deposit;
        // The associated dispute ID after the dispute is created.
        uint256 disputeID;
    }

    /// @dev Tracks arbitration requests for question ID.
    mapping(bytes32 => ArbitrationRequest) public arbitrationRequestsByQuestionID;

    /// @dev Associates dispute IDs to question IDs.
    mapping(uint256 => bytes32) public questionIDsByDisputeID;

    /**
     * @dev Should be emitted when there is a mismatch between the deposit and the arbitration fee.
     * @param _questionID The ID of the question to be arbitrated.
     * @param _requester The address of the original arbitration requester.
     */
    event ArbitrationFeeUpdateRequired(bytes32 indexed _questionID, address indexed _requester);

    /**
     * @dev Should be emitted when the dispute is created.
     * @param _questionID The ID of the question to be arbitrated.
     * @param _disputeID The ID of the dispute.
     */
    event ArbitrationCreated(bytes32 indexed _questionID, uint256 indexed _disputeID);

    /**
     * @dev Should be emitted when the arbitration request is cancelled.
     * @param _questionID The ID of the question to be arbitrated.
     */
    event ArbitrationCancelled(bytes32 indexed _questionID);

    modifier onlyArbitrator() {
        require(msg.sender == address(arbitrator), "Only arbitrator allowed");
        _;
    }

    modifier onlyGovernor() {
        require(msg.sender == governor, "Only governor allowed");
        _;
    }

    modifier onlyAmb() {
        require(msg.sender == address(amb), "Only AMB allowed");
        _;
    }

    modifier onlyHomeProxy() {
        require(amb.messageSender() == homeProxy, "Only home proxy allowed");
        _;
    }

    modifier onlyIfInitialized() {
        require(initialized, "Not initialized yet");
        _;
    }

    /**
     * @dev Creates an arbitration proxy on the foreign chain.
     * @notice Contract will still require initialization before being usable.
     * @param _amb ArbitraryMessageBridge contract address.
     * @param _arbitrator Arbitrator contract address.
     * @param _arbitratorExtraData The extra data used to raise a dispute in the arbitrator.
     */
    constructor(
        IAMB _amb,
        IArbitrator _arbitrator,
        bytes memory _arbitratorExtraData
    ) public {
        amb = _amb;
        arbitrator = _arbitrator;
        arbitratorExtraData = _arbitratorExtraData;
    }

    /**
     * @dev Initializes the contract so it can start receiving arbitration requests.
     * @notice This function can only be called once, after `homeProxy` has already been set for the first time.
     * Since there is a circular dependency between `RealitioForeignArbitrationProxy` and `RealitioHomeArbitrationProxy`,
     * it is not possible to require the home proxy to be a constructor param.
     * @param _metaEvidence The URI of the meta evidence file.
     */
    function initialize(string calldata _metaEvidence) external onlyGovernor {
        require(!initialized, "Proxy already initialized");
        require(homeProxy != address(0), "Home proxy not set");

        initialized = true;

        emit MetaEvidence(0, _metaEvidence);
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
     * @dev Sets the address of the arbitrator.
     * @param _arbitrator The address of the new arbitrator.
     */
    function setArbitrator(IArbitrator _arbitrator) external onlyGovernor {
        arbitrator = _arbitrator;
    }

    /**
     * @dev Sets the address of the arbitration proxy on the Home Chain.
     * @param _homeProxy The address of the proxy.
     */
    function setHomeProxy(address _homeProxy) external onlyGovernor {
        homeProxy = _homeProxy;
    }

    /**
     * @dev Sets the extra data for disputes.
     * @param _arbitratorExtraData The extra data used to raise a dispute in the arbitrator.
     */
    function setArbitratorExtraData(bytes calldata _arbitratorExtraData) external onlyGovernor {
        arbitratorExtraData = _arbitratorExtraData;
    }

    /**
     * @dev Sets the timeout for updating the arbitration fee for the requester.
     * @param _updateFeeTimeoutForRequester The timeout for the requester.
     */
    function setUpdateFeeTimeoutForRequester(uint32 _updateFeeTimeoutForRequester) external onlyGovernor {
        updateFeeTimeoutForRequester = _updateFeeTimeoutForRequester;
    }

    /**
     * @dev Sets the timeout for updating the arbitration fee for anyone else.
     * @param _updateFeeTimeoutForAnyone The timeout for the anyone else.
     */
    function setUpdateFeeTimeoutForAnyone(uint32 _updateFeeTimeoutForAnyone) external onlyGovernor {
        updateFeeTimeoutForAnyone = _updateFeeTimeoutForAnyone;
    }

    /**
     * @dev Requests arbitration for given question ID.
     * @notice Can be executed only if the contract has been initialized.
     * @param _questionID The ID of the question.
     * @param _requesterAnswer The answer the requester deem to be correct.
     */
    function requestArbitration(bytes32 _questionID, bytes32 _requesterAnswer) external payable onlyIfInitialized {
        ArbitrationRequest storage arbitrationRequest = arbitrationRequestsByQuestionID[_questionID];
        require(arbitrationRequest.status == Status.None, "Arbitration already requested");

        uint256 arbitrationCost = arbitrator.arbitrationCost(arbitratorExtraData);
        require(msg.value >= arbitrationCost, "Deposit value too low");

        arbitrationRequest.status = Status.Requested;
        arbitrationRequest.requester = msg.sender;
        arbitrationRequest.deposit = msg.value;

        bytes4 methodSelector = IHomeArbitrationProxy(0).receiveArbitrationRequest.selector;
        bytes memory data = abi.encodeWithSelector(methodSelector, _questionID, _requesterAnswer, msg.sender);
        amb.requireToPassMessage(homeProxy, data, amb.maxGasPerTx());
    }

    /**
     * @dev Requests arbitration for given question ID.
     * @param _questionID The ID of the question.
     */
    function acknowledgeArbitration(bytes32 _questionID) external override onlyAmb onlyHomeProxy {
        ArbitrationRequest storage arbitrationRequest = arbitrationRequestsByQuestionID[_questionID];
        require(arbitrationRequest.status == Status.Requested, "Invalid request status");

        arbitrationRequest.acknowledgedAt = uint32(block.timestamp);

        uint256 arbitrationCost = arbitrator.arbitrationCost(arbitratorExtraData);
        if (arbitrationRequest.deposit < arbitrationCost) {
            arbitrationRequest.status = Status.PendingFee;

            emit ArbitrationFeeUpdateRequired(_questionID, arbitrationRequest.requester);

            return;
        }

        // At this point, arbitrationRequest.deposit is guaranteed to be greater than or equal arbitration cost.
        uint256 remainder = arbitrationRequest.deposit - arbitrationCost;

        uint256 disputeID = arbitrator.createDispute{value: arbitrationCost}(
            NUMBER_OF_CHOICES_FOR_ARBITRATOR,
            arbitratorExtraData
        );
        questionIDsByDisputeID[disputeID] = _questionID;
        arbitrationRequest.status = Status.Created;
        arbitrationRequest.disputeID = disputeID;
        arbitrationRequest.deposit = 0;

        payable(arbitrationRequest.requester).send(remainder);

        emit ArbitrationCreated(_questionID, disputeID);
    }

    /**
     * @dev Updates the arbitration fee for to allow the dispute creation.
     * @param _questionID The ID of the question.
     */
    function updateArbitrationFee(bytes32 _questionID) external payable {
        ArbitrationRequest storage arbitrationRequest = arbitrationRequestsByQuestionID[_questionID];
        require(arbitrationRequest.status == Status.PendingFee, "Invalid request status");
        require(
            block.timestamp <=
                arbitrationRequest.acknowledgedAt + updateFeeTimeoutForRequester + updateFeeTimeoutForAnyone,
            "Request already expired"
        );

        uint256 arbitrationCost = arbitrator.arbitrationCost(arbitratorExtraData);
        uint256 requiredDeposit = arbitrationCost.subCap(arbitrationRequest.deposit);
        require(msg.value >= requiredDeposit, "Deposit value too low");

        // Window for the original requester to pay remaining fee
        if (block.timestamp <= arbitrationRequest.acknowledgedAt + updateFeeTimeoutForRequester) {
            require(arbitrationRequest.requester == msg.sender, "Only requester is allowed");
        } else if (arbitrationRequest.requester != msg.sender) {
            // If the original requester fails to pay the remaining fee within
            // updateFeeTimeoutForRequester, anyone can provide the value and become the requester.
            // Notice that the requester can still be the one updating the fee,
            // so we only execute this block if it did change.
            arbitrationRequest.requester = msg.sender;

            bytes4 methodSelector = IHomeArbitrationProxy(0).receiveRequesterChange.selector;
            bytes memory data = abi.encodeWithSelector(methodSelector, _questionID, msg.sender);
            amb.requireToPassMessage(homeProxy, data, amb.maxGasPerTx());
        }

        // At this point, msg.value is guaranteed to be greater than or equal arbitration cost.
        uint256 remainder = msg.value - requiredDeposit;

        uint256 disputeID = arbitrator.createDispute{value: arbitrationCost}(
            NUMBER_OF_CHOICES_FOR_ARBITRATOR,
            arbitratorExtraData
        );
        questionIDsByDisputeID[disputeID] = _questionID;
        arbitrationRequest.status = Status.Created;
        arbitrationRequest.disputeID = disputeID;
        arbitrationRequest.deposit = 0;

        payable(arbitrationRequest.requester).send(remainder);

        emit ArbitrationCreated(_questionID, disputeID);
    }

    /**
     * @dev Cancels the arbitration request.
     * @param _questionID The ID of the question.
     */
    function cancelArbitration(bytes32 _questionID) external override onlyAmb onlyHomeProxy {
        ArbitrationRequest storage arbitrationRequest = arbitrationRequestsByQuestionID[_questionID];
        require(arbitrationRequest.status == Status.Requested, "Invalid request status");

        uint256 deposit = arbitrationRequest.deposit;

        delete arbitrationRequestsByQuestionID[_questionID];

        payable(arbitrationRequest.requester).send(deposit);

        emit ArbitrationCancelled(_questionID);
    }

    /**
     * @dev Cancels the arbitration request in case it has pending fees.
     * @param _questionID The ID of the question.
     */
    function cancelArbitrationWithPendingFee(bytes32 _questionID) external onlyIfInitialized {
        ArbitrationRequest storage arbitrationRequest = arbitrationRequestsByQuestionID[_questionID];
        require(arbitrationRequest.status == Status.PendingFee, "Invalid request status");
        require(
            block.timestamp >
                arbitrationRequest.acknowledgedAt + updateFeeTimeoutForRequester + updateFeeTimeoutForAnyone,
            "Request not expired yet"
        );

        uint256 deposit = arbitrationRequest.deposit;

        delete arbitrationRequestsByQuestionID[_questionID];

        bytes4 methodSelector = IHomeArbitrationProxy(0).receiveArbitrationFailure.selector;
        bytes memory data = abi.encodeWithSelector(methodSelector, _questionID);
        amb.requireToPassMessage(homeProxy, data, amb.maxGasPerTx());

        payable(arbitrationRequest.requester).send(deposit);

        emit ArbitrationCancelled(_questionID);
    }

    /**
     * @dev Execute the ruling of a specified dispute.
     * @notice Note that 0 is reserved for "Unable/refused to arbitrate" and we map it to `bytes32(-1)` which has a similar connotation in Realitio.
     * @param _disputeID The ID of the dispute in the ERC792 arbitrator.
     * @param _ruling The ruling given by the arbitrator.
     */
    function rule(uint256 _disputeID, uint256 _ruling) external override onlyArbitrator {
        bytes32 questionID = questionIDsByDisputeID[_disputeID];
        bytes32 answer = bytes32(_ruling == 0 ? uint256(-1) : _ruling - 1);

        delete arbitrationRequestsByQuestionID[questionID];

        bytes4 methodSelector = IHomeArbitrationProxy(0).receiveArbitrationAnswer.selector;
        bytes memory data = abi.encodeWithSelector(methodSelector, questionID, answer);
        amb.requireToPassMessage(homeProxy, data, amb.maxGasPerTx());

        emit Ruling(arbitrator, _disputeID, _ruling);
    }

    /**
     * @dev Gets the remaining arbitration fee.
     * @param _questionID The ID of the question.
     * @return The remaining arbitration fee in case there is one or 0 otherwise.
     */
    function getRemainingArbitrationFee(bytes32 _questionID) external view onlyIfInitialized returns (uint256) {
        ArbitrationRequest storage arbitrationRequest = arbitrationRequestsByQuestionID[_questionID];

        if (arbitrationRequest.status != Status.PendingFee) {
            return 0;
        }

        uint256 arbitrationCost = arbitrator.arbitrationCost(arbitratorExtraData);
        return arbitrationCost.subCap(arbitrationRequest.deposit);
    }
}
