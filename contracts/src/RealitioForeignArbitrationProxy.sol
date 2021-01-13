// SPDX-License-Identifier: MIT

/**
 *  @authors: [@hbarcelos]
 *  @reviewers: [@ferittuncer*, @fnanni-0*, @nix1g*, @epiqueras*]
 *  @auditors: []
 *  @bounties: []
 *  @deployments: []
 */

pragma solidity ^0.7.2;

import "@kleros/erc-792/contracts/IArbitrator.sol";
import "./dependencies/IAMB.sol";
import "./ArbitrationProxyInterfaces.sol";

/**
 * @title Arbitration proxy for Realitio on Ethereum side (A.K.A. the Foreign Chain).
 * @dev This contract is meant to be deployed to the Ethereum chains where Kleros is deployed.
 */
contract RealitioForeignArbitrationProxy is IForeignArbitrationProxy {
    /// @dev The contract governor. TRUSTED.
    address public governor = msg.sender;

    /// @dev The address of the arbitrator. TRUSTED.
    IArbitrator public immutable arbitrator;

    /// @dev The extra data used to raise a dispute in the arbitrator.
    bytes public arbitratorExtraData;

    /// @dev The ID of the MetaEvidence for disputes.
    uint256 public metaEvidenceID;

    /// @dev The number of choices for the arbitrator.
    uint256 public constant NUMBER_OF_CHOICES_FOR_ARBITRATOR = (2**256) - 2;

    /// @dev ArbitraryMessageBridge contract address. TRUSTED.
    IAMB public immutable amb;

    /// @dev Address of the counter-party proxy on the Home Chain. TRUSTED.
    address public homeProxy;

    /// @dev The chain ID where the home proxy is deployed.
    uint256 public homeChainId;

    /// @dev The path for the Terms of Service for Kleros as an arbitrator for Realitio.
    string public termsOfService;

    enum Status {None, Requested, Created, Ruled, Failed}

    struct ArbitrationRequest {
        // Status of the arbitration.
        Status status;
        // Address that made the arbitration request.
        address payable requester;
        // The deposit paid by the requester at the time of the arbitration.
        uint256 deposit;
    }

    /// @dev Tracks arbitration requests for question ID.
    mapping(bytes32 => mapping(bytes32 => ArbitrationRequest)) public arbitrationRequests;

    /// @dev Associates dispute ID to question ID and the contested answer.
    mapping(uint256 => bytes32[2]) public disputeIDToQuestionAndAnswer;

    /// @dev Whether a dispute has already been created for the given question ID or not.
    mapping(bytes32 => bool) public questionIDToDisputeExists;

    modifier onlyArbitrator() {
        require(msg.sender == address(arbitrator), "Only arbitrator allowed");
        _;
    }

    modifier onlyGovernor() {
        require(msg.sender == governor, "Only governor allowed");
        _;
    }

    modifier onlyHomeProxy() {
        require(msg.sender == address(amb), "Only AMB allowed");
        require(amb.messageSourceChainId() == bytes32(homeChainId), "Only home chain allowed");
        require(amb.messageSender() == homeProxy, "Only home proxy allowed");
        _;
    }

    modifier onlyIfInitialized() {
        require(homeProxy != address(0), "Not initialized yet");
        _;
    }

    /**
     * @notice Creates an arbitration proxy on the foreign chain.
     * @dev Contract will still require initialization before being usable.
     * @param _amb ArbitraryMessageBridge contract address.
     * @param _arbitrator Arbitrator contract address.
     * @param _arbitratorExtraData The extra data used to raise a dispute in the arbitrator.
     * @param _metaEvidence The URI of the meta evidence file.
     * @param _termsOfService The path for the Terms of Service for Kleros as an arbitrator for Realitio.
     */
    constructor(
        IAMB _amb,
        IArbitrator _arbitrator,
        bytes memory _arbitratorExtraData,
        string memory _metaEvidence,
        string memory _termsOfService
    ) {
        amb = _amb;
        arbitrator = _arbitrator;
        arbitratorExtraData = _arbitratorExtraData;
        termsOfService = _termsOfService;

        emit MetaEvidence(metaEvidenceID, _metaEvidence);
    }

    /**
     * @notice Changes the address of a new governor.
     * @param _governor The address of the new governor.
     */
    function changeGovernor(address _governor) external onlyGovernor {
        governor = _governor;
    }

    /**
     * @notice Sets the address of the arbitration proxy on the Home Chain.
     * @param _homeProxy The address of the proxy.
     * @param _homeChainId The chain ID where the home proxy is deployed.
     */
    function setHomeProxy(address _homeProxy, uint256 _homeChainId) external onlyGovernor {
        require(homeProxy == address(0), "Home proxy already set");

        homeProxy = _homeProxy;
        homeChainId = _homeChainId;
    }

    /**
     * @notice Changes the meta evidence used for disputes.
     * @param _metaEvidence URI to the new meta evidence file.
     */
    function changeMetaEvidence(string calldata _metaEvidence) external onlyGovernor {
        metaEvidenceID += 1;
        emit MetaEvidence(metaEvidenceID, _metaEvidence);
    }

    /**
     * @notice Changes the terms of service for Realitio.
     * @param _termsOfService URI to the new Terms of Service file.
     */
    function changeTermsOfService(string calldata _termsOfService) external onlyGovernor {
        termsOfService = _termsOfService;
    }

    /**
     * @notice Requests arbitration for given the question and contested answer.
     * @dev Can be executed only if the contract has been initialized.
     * @param _questionID The ID of the question.
     * @param _contestedAnswer The answer the requester deems to be incorrect.
     */
    function requestArbitration(bytes32 _questionID, bytes32 _contestedAnswer)
        external
        payable
        override
        onlyIfInitialized
    {
        require(!questionIDToDisputeExists[_questionID], "Dispute already exists");

        ArbitrationRequest storage arbitration = arbitrationRequests[_questionID][_contestedAnswer];
        require(arbitration.status == Status.None, "Arbitration already requested");

        uint256 arbitrationCost = arbitrator.arbitrationCost(arbitratorExtraData);
        require(msg.value >= arbitrationCost, "Deposit value too low");

        arbitration.status = Status.Requested;
        arbitration.requester = msg.sender;
        arbitration.deposit = msg.value;

        bytes4 methodSelector = IHomeArbitrationProxy(0).receiveArbitrationRequest.selector;
        bytes memory data = abi.encodeWithSelector(methodSelector, _questionID, _contestedAnswer, msg.sender);
        amb.requireToPassMessage(homeProxy, data, amb.maxGasPerTx());

        emit ArbitrationRequested(_questionID, _contestedAnswer, msg.sender);
    }

    /**
     * @dev Acknowledges the arbitration request for the given question and contested answer. TRUSTED.
     * @param _questionID The ID of the question.
     * @param _contestedAnswer The answer the requester deems to be incorrect.
     */
    function acknowledgeArbitration(bytes32 _questionID, bytes32 _contestedAnswer) external override onlyHomeProxy {
        ArbitrationRequest storage arbitration = arbitrationRequests[_questionID][_contestedAnswer];
        require(arbitration.status == Status.Requested, "Invalid arbitration status");

        uint256 arbitrationCost = arbitrator.arbitrationCost(arbitratorExtraData);

        if (arbitration.deposit >= arbitrationCost) {
            try
                arbitrator.createDispute{value: arbitrationCost}(NUMBER_OF_CHOICES_FOR_ARBITRATOR, arbitratorExtraData)
            returns (uint256 disputeID) {
                disputeIDToQuestionAndAnswer[disputeID][0] = _questionID;
                disputeIDToQuestionAndAnswer[disputeID][1] = _contestedAnswer;
                questionIDToDisputeExists[_questionID] = true;

                // At this point, arbitration.deposit is guaranteed to be greater than or equal to the arbitration cost.
                uint256 remainder = arbitration.deposit - arbitrationCost;

                arbitration.status = Status.Created;
                arbitration.deposit = 0;

                if (remainder > 0) {
                    arbitration.requester.send(remainder);
                }

                emit ArbitrationCreated(_questionID, _contestedAnswer, disputeID);
                emit Dispute(arbitrator, disputeID, metaEvidenceID, uint256(_questionID));
            } catch {
                arbitration.status = Status.Failed;
                emit ArbitrationFailed(_questionID, _contestedAnswer);
            }
        } else {
            arbitration.status = Status.Failed;
            emit ArbitrationFailed(_questionID, _contestedAnswer);
        }
    }

    /**
     * @dev Cancels the arbitration request. TRUSTED.
     * @param _questionID The ID of the question.
     * @param _contestedAnswer The answer the requester deems to be incorrect.
     */
    function cancelArbitration(bytes32 _questionID, bytes32 _contestedAnswer) external override onlyHomeProxy {
        ArbitrationRequest storage arbitration = arbitrationRequests[_questionID][_contestedAnswer];
        require(arbitration.status == Status.Requested, "Invalid arbitration status");

        arbitration.requester.send(arbitration.deposit);

        delete arbitrationRequests[_questionID][_contestedAnswer];

        emit ArbitrationCanceled(_questionID, _contestedAnswer);
    }

    /**
     * @notice Cancels the arbitration in case the dispute could not be created.
     * @param _questionID The ID of the question.
     * @param _contestedAnswer The answer the requester deems to be incorrect.
     */
    function handleFailedDisputeCreation(bytes32 _questionID, bytes32 _contestedAnswer)
        external
        override
        onlyIfInitialized
    {
        ArbitrationRequest storage arbitration = arbitrationRequests[_questionID][_contestedAnswer];
        require(arbitration.status == Status.Failed, "Invalid arbitration status");

        arbitration.requester.send(arbitration.deposit);

        delete arbitrationRequests[_questionID][_contestedAnswer];

        bytes4 methodSelector = IHomeArbitrationProxy(0).receiveArbitrationFailure.selector;
        bytes memory data = abi.encodeWithSelector(methodSelector, _questionID, _contestedAnswer);
        amb.requireToPassMessage(homeProxy, data, amb.maxGasPerTx());

        emit ArbitrationCanceled(_questionID, _contestedAnswer);
    }

    /**
     * @notice Rules a specified dispute.
     * @dev Note that 0 is reserved for "Unable/refused to arbitrate" and we map it to `bytes32(-1)` which has a similar connotation in Realitio.
     * @param _disputeID The ID of the dispute in the ERC792 arbitrator.
     * @param _ruling The ruling given by the arbitrator.
     */
    function rule(uint256 _disputeID, uint256 _ruling) external override onlyArbitrator {
        bytes32 questionID = disputeIDToQuestionAndAnswer[_disputeID][0];
        bytes32 contestedAnswer = disputeIDToQuestionAndAnswer[_disputeID][1];

        ArbitrationRequest storage arbitration = arbitrationRequests[questionID][contestedAnswer];
        require(arbitration.status == Status.Created, "Invalid arbitration status");

        arbitration.status = Status.Ruled;

        // Realitio ruling is shifted by 1 compared to Kleros.
        // For example, jurors refusing to rule is `0` on Kleros, but uint(-1) on Realitio.
        // The line below could be written more explicitly as:
        //     bytes32(_ruling == 0 ? uint256(-1) : _ruling - 1)
        // But the way it is written saves some gas.
        bytes32 answer = bytes32(_ruling - 1);

        bytes4 methodSelector = IHomeArbitrationProxy(0).receiveArbitrationAnswer.selector;
        bytes memory data = abi.encodeWithSelector(methodSelector, questionID, answer);
        amb.requireToPassMessage(homeProxy, data, amb.maxGasPerTx());

        emit Ruling(arbitrator, _disputeID, _ruling);
    }

    /**
     * @notice Gets the fee to create a dispute.
     * @return The fee to create a dispute.
     */
    function getDisputeFee(bytes32 questionID) external view override returns (uint256) {
        return arbitrator.arbitrationCost(arbitratorExtraData);
    }
}
