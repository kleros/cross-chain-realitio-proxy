const { ethers } = require("hardhat");
const { solidity } = require("ethereum-waffle");
const { use, expect } = require("chai");
const getDeployAddress = require("../deploy-helpers/getDeployAddress");

use(solidity);

const { BigNumber } = ethers;
const { hexZeroPad } = ethers.utils;
const ADDRESS_ZERO = ethers.constants.AddressZero;
const HASH_ZERO = ethers.constants.HashZero;

let arbitrator;
let homeProxy;
let foreignProxy;
let realitio;

let governor;
let asker;
let answerer;
let requester;

const homeChainId = 0;
const foreignChainId = 0;

const arbitrationFee = BigNumber.from(BigInt(1e18));
const arbitratorExtraData = "0x00";
const metaEvidence = "ipfs/X";
const termsOfService = "ipfs/Y";

let questionId;
const question = "Whats the answer for everything in the universe?";
const currentAnswer = hexZeroPad(1, 32);
const otherAnswer = hexZeroPad(42, 32);

describe("Cross-Chain Arbitration", () => {
  beforeEach("Setup contracts", async () => {
    [governor, asker, answerer, requester] = await ethers.getSigners();
    ({ arbitrator, realitio, foreignProxy, homeProxy } = await deployContracts(governor));
  });

  describe("Request Arbitration", () => {
    beforeEach("Create question and submit answer", async () => {
      const askTx = await realitio.connect(asker).askQuestion(question);
      const askTxReceipt = await askTx.wait();
      questionId = getEventArgs("MockNewQuestion", askTxReceipt.events)._questionId;

      await submitAnswer(questionId, currentAnswer);
    });

    describe("When requester contests an answer", () => {
      it("should immediately notify Realitio of the arbitration request when the requester answer is different from the current one", async () => {
        const { txPromise } = await requestArbitration(questionId, currentAnswer);

        await expect(txPromise)
          .to.emit(homeProxy, "RequestNotified")
          .withArgs(questionId, currentAnswer, await requester.getAddress());
        await expect(txPromise)
          .to.emit(realitio, "MockNotifyOfArbitrationRequest")
          .withArgs(questionId, await requester.getAddress());
      });

      it("should set the requester on the Home Proxy #regression", async () => {
        await requestArbitration(questionId, currentAnswer);

        const request = await homeProxy.requests(questionId, currentAnswer);
        expect(request.requester).to.equal(await requester.getAddress());
      });

      it("should create the dispute after notifying Realitio of the arbitration request", async () => {
        await requestArbitration(questionId, currentAnswer);

        const { txPromise } = await handleNotifiedRequest(questionId);

        await expect(txPromise).to.emit(foreignProxy, "ArbitrationCreated");
        await expect(txPromise).to.emit(foreignProxy, "Dispute").withArgs(arbitrator.address, "0", "0", questionId);
        await expect(txPromise).to.emit(arbitrator, "DisputeCreation");
      });
    });

    describe("When the requester contests an answer different than the current one", () => {
      it("should reject the request and not notify Realitio of the arbitration request", async () => {
        const { txPromise } = await requestArbitration(questionId, otherAnswer);

        await expect(txPromise)
          .to.emit(homeProxy, "RequestRejected")
          .withArgs(questionId, otherAnswer, await requester.getAddress());
        await expect(txPromise).not.to.emit(realitio, "MockNotifyOfArbitrationRequest");
      });

      it("should pass the message to cancel the arbitration", async () => {
        await requestArbitration(questionId, otherAnswer);

        const { txPromise } = await handleRejectedRequest(questionId, otherAnswer);

        await expect(txPromise).to.emit(homeProxy, "RequestCanceled");
        await expect(txPromise).to.emit(foreignProxy, "ArbitrationCanceled");
        await expect(txPromise).not.to.emit(realitio, "MockNotifyOfArbitrationRequest");
        await expect(txPromise).not.to.emit(arbitrator, "DisputeCreation");
      });

      it("should reimbuser the requester", async () => {
        await requestArbitration(questionId, otherAnswer);

        const balanceBefore = await requester.getBalance();
        await handleRejectedRequest(questionId, otherAnswer);
        const balanceAfter = await requester.getBalance();

        const expectedBalance = balanceBefore.add(arbitrationFee);
        expect(balanceAfter).to.equal(expectedBalance, "Requester was not properly reimbursed");
      });
    });

    describe("When requester contests an unanswered question #regression", () => {
      let unansweredQuestionId;

      beforeEach("Create question and do not submit an answer", async () => {
        const askTx = await realitio.connect(asker).askQuestion(question);
        const askTxReceipt = await askTx.wait();
        unansweredQuestionId = getEventArgs("MockNewQuestion", askTxReceipt.events)._questionId;
      });

      it("should reject the arbitration request and not notify Realitio", async () => {
        const { txPromise } = await requestArbitration(unansweredQuestionId, currentAnswer);

        await expect(txPromise)
          .to.emit(homeProxy, "RequestRejected")
          .withArgs(unansweredQuestionId, currentAnswer, await requester.getAddress());
        await expect(txPromise).not.to.emit(realitio, "MockNotifyOfArbitrationRequest");
      });
    });

    describe("When the requester contests a finalized question", () => {
      it("should reject the request and not notify Realitio of the arbitration request", async () => {
        await finalizeQuestion(questionId);

        const { txPromise } = await requestArbitration(questionId, otherAnswer);

        await expect(txPromise)
          .to.emit(homeProxy, "RequestRejected")
          .withArgs(questionId, otherAnswer, await requester.getAddress());
        await expect(txPromise).not.to.emit(realitio, "MockNotifyOfArbitrationRequest");
      });

      it("should pass the message to cancel the arbitration", async () => {
        await finalizeQuestion(questionId);
        await requestArbitration(questionId, currentAnswer);

        const { txPromise } = await handleRejectedRequest(questionId);

        await expect(txPromise).to.emit(homeProxy, "RequestCanceled");
        await expect(txPromise).to.emit(foreignProxy, "ArbitrationCanceled");
        await expect(txPromise).not.to.emit(realitio, "MockNotifyOfArbitrationRequest");
        await expect(txPromise).not.to.emit(arbitrator, "DisputeCreation");
      });

      it("should reimbuser the requester", async () => {
        await finalizeQuestion(questionId);
        await requestArbitration(questionId, currentAnswer);

        const balanceBefore = await requester.getBalance();
        await handleRejectedRequest(questionId);
        const balanceAfter = await requester.getBalance();

        const expectedBalance = balanceBefore.add(arbitrationFee);
        expect(balanceAfter).to.equal(expectedBalance, "Requester was not properly reimbursed");
      });
    });

    describe("When arbitration cost changes between the arbitration request and acknowledgement", () => {
      beforeEach("Request arbitration", async () => {
        await requestArbitration(questionId, currentAnswer);
      });

      it("Should create the dispute when arbitration cost decreases", async () => {
        const newArbitrationFee = arbitrationFee.div(2);
        await setArbitrationCost(newArbitrationFee);

        const { txPromise } = await handleNotifiedRequest(questionId);

        await expect(txPromise).to.emit(foreignProxy, "ArbitrationCreated");
        await expect(txPromise).to.emit(foreignProxy, "Dispute");
        await expect(txPromise).to.emit(arbitrator, "DisputeCreation");
      });

      it("Should send the remaining arbitration fee to the requester when arbitration cost decreases", async () => {
        const newArbitrationFee = arbitrationFee.div(2);
        await setArbitrationCost(newArbitrationFee);

        const balanceBefore = await requester.getBalance();
        await handleNotifiedRequest(questionId);
        const balanceAfter = await requester.getBalance();

        const expectedBalance = balanceBefore.add(newArbitrationFee);
        expect(balanceAfter).to.equal(expectedBalance, "Requester was not properly reimbursed");
      });

      it("Should cancel the dispute creation when arbitration cost increases", async () => {
        const newArbitrationFee = arbitrationFee.mul(2);
        await setArbitrationCost(newArbitrationFee);

        const { txPromise } = await handleNotifiedRequest(questionId);

        await expect(txPromise).to.emit(foreignProxy, "ArbitrationFailed").withArgs(questionId, currentAnswer);
        await expect(txPromise).not.to.emit(arbitrator, "DisputeCreation");
      });

      it("Should pass the message informing the dispute creation failed due to an increase in arbitration cost", async () => {
        const newArbitrationFee = arbitrationFee.mul(2);
        await setArbitrationCost(newArbitrationFee);
        await handleNotifiedRequest(questionId);

        const { txPromise } = await handleFailedDisputeCreation(questionId);

        await expect(txPromise).to.emit(homeProxy, "ArbitrationFailed").withArgs(questionId, currentAnswer);
        await expect(txPromise).to.emit(realitio, "MockCancelArbitrationRequest").withArgs(questionId);
      });

      it("Should reimburse the requester when the dispute creation failed due to an increase in arbitration cost", async () => {
        const newArbitrationFee = arbitrationFee.mul(2);
        await setArbitrationCost(newArbitrationFee);
        await handleNotifiedRequest(questionId);

        const balanceBefore = await requester.getBalance();
        await handleFailedDisputeCreation(questionId);
        const balanceAfter = await requester.getBalance();

        const expectedBalance = balanceBefore.add(arbitrationFee);
        expect(balanceAfter).to.equal(expectedBalance, "Requester was not properly reimbursed");
      });
    });
  });

  describe("Arbitrator provide ruling", () => {
    let disputeId;

    beforeEach("Create question, submit answer and request arbitration", async () => {
      const askTx = await realitio.connect(asker).askQuestion(question);
      const askTxReceipt = await askTx.wait();
      questionId = getEventArgs("MockNewQuestion", askTxReceipt.events)._questionId;

      await submitAnswer(questionId, currentAnswer);
      await requestArbitration(questionId, currentAnswer);
      await handleNotifiedRequest(questionId);

      disputeId = getEventArgs(
        "ArbitrationCreated",
        await foreignProxy.queryFilter(foreignProxy.filters.ArbitrationCreated(questionId))
      )._disputeID;
    });

    it("Should pass the message with the ruling when the arbitrator rules", async () => {
      const ruling = normalizeRuling(otherAnswer); // rules in favor of the requester
      const { txPromise } = await rule(disputeId, ruling);

      await expect(txPromise).to.emit(homeProxy, "ArbitratorAnswered").withArgs(questionId, otherAnswer);
    });

    it("Should notify Realitio of the answer given by the arbitrator when the home proxy reports the answer", async () => {
      const ruling = normalizeRuling(currentAnswer); // rules in favor of the original answer
      await rule(disputeId, ruling);

      const { txPromise } = await reportArbitrationAnswer(questionId);
      await expect(txPromise).to.emit(realitio, "MockFinalize").withArgs(questionId, currentAnswer);
    });
  });

  describe("When arbitration requests are issued at the same time", () => {
    beforeEach("Create question and submit answer", async () => {
      const askTx = await realitio.connect(asker).askQuestion(question);
      const askTxReceipt = await askTx.wait();
      questionId = getEventArgs("MockNewQuestion", askTxReceipt.events)._questionId;

      await submitAnswer(questionId, currentAnswer);
    });

    it("Should allow requests for different answers to enter the sytem", async () => {
      const req1 = await requestArbitration(questionId, currentAnswer);
      const req2 = await requestArbitration(questionId, otherAnswer);

      await expect(req1.txPromise)
        .to.emit(foreignProxy, "ArbitrationRequested")
        .withArgs(questionId, currentAnswer, await requester.getAddress());
      await expect(req2.txPromise)
        .to.emit(foreignProxy, "ArbitrationRequested")
        .withArgs(questionId, otherAnswer, await requester.getAddress());
    });

    it("Should accept only the request regarding the current answer", async () => {
      const req1 = await requestArbitration(questionId, currentAnswer);
      const req2 = await requestArbitration(questionId, otherAnswer);

      await expect(req1.txPromise)
        .to.emit(homeProxy, "RequestNotified")
        .withArgs(questionId, currentAnswer, await requester.getAddress());

      await expect(req2.txPromise)
        .to.emit(homeProxy, "RequestRejected")
        .withArgs(questionId, otherAnswer, await requester.getAddress());
    });

    it("Should not allow multiple requests for the same answer", async () => {
      const req1 = await requestArbitration(questionId, currentAnswer);
      const req2 = await requestArbitration(questionId, currentAnswer);

      await expect(req1.txPromise)
        .to.emit(foreignProxy, "ArbitrationRequested")
        .withArgs(questionId, currentAnswer, await requester.getAddress());
      await expect(req2.txPromise).to.be.revertedWith("Arbitration already requested");
    });
  });

  describe("When an arbitration request has already been accepted for a given question", () => {
    beforeEach("Create question, submit answer, request arbitration and acknowlege it", async () => {
      const askTx = await realitio.connect(asker).askQuestion(question);
      const askTxReceipt = await askTx.wait();
      questionId = getEventArgs("MockNewQuestion", askTxReceipt.events)._questionId;

      await submitAnswer(questionId, currentAnswer);
      await requestArbitration(questionId, currentAnswer);
      await handleNotifiedRequest(questionId, currentAnswer);
    });

    it("Should not allow other arbitration requests for the same question", async () => {
      const { txPromise } = await requestArbitration(questionId, currentAnswer);

      await expect(txPromise).to.be.revertedWith("Dispute already exists");
    });
  });

  async function deployContracts(signer) {
    const Arbitrator = await ethers.getContractFactory("MockArbitrator", signer);
    const arbitrator = await Arbitrator.deploy(String(arbitrationFee));

    const AMB = await ethers.getContractFactory("MockAMB", signer);
    const amb = await AMB.deploy();

    const Realitio = await ethers.getContractFactory("MockRealitio", signer);
    const realitio = await Realitio.deploy();

    const ForeignProxy = await ethers.getContractFactory("RealitioForeignArbitrationProxy", signer);
    const HomeProxy = await ethers.getContractFactory("RealitioHomeArbitrationProxy", signer);

    const address = await signer.getAddress();
    const nonce = await signer.getTransactionCount();

    const foreignProxyAddress = getDeployAddress(address, nonce);
    const homeProxyAddress = getDeployAddress(address, nonce + 1);

    const foreignProxy = await ForeignProxy.deploy(
      amb.address,
      homeProxyAddress,
      homeChainId,
      arbitrator.address,
      arbitratorExtraData,
      metaEvidence,
      termsOfService
    );

    const homeProxy = await HomeProxy.deploy(amb.address, foreignProxyAddress, foreignChainId, realitio.address);

    return {
      amb,
      arbitrator,
      realitio,
      foreignProxy,
      homeProxy,
    };
  }

  async function submitAnswer(questionId, answer, signer = answerer) {
    return await submitTransaction(realitio.connect(signer).submitAnswer(questionId, answer, 0));
  }

  async function requestArbitration(questionId, contestedAnswer, signer = requester) {
    return await submitTransaction(
      foreignProxy.connect(signer).requestArbitration(questionId, contestedAnswer, { value: arbitrationFee })
    );
  }

  async function setArbitrationCost(cost, signer = governor) {
    return await submitTransaction(arbitrator.connect(signer).setArbitrationCost(cost));
  }

  async function finalizeQuestion(questionId, signer = governor) {
    return await submitTransaction(realitio.connect(signer).finalizeQuestion(questionId));
  }

  async function handleNotifiedRequest(questionId, contestedAnswer = currentAnswer, { signer = governor } = {}) {
    return await submitTransaction(homeProxy.connect(signer).handleNotifiedRequest(questionId, contestedAnswer));
  }

  async function handleFailedDisputeCreation(questionId, contestedAnswer = currentAnswer, { signer = governor } = {}) {
    return await submitTransaction(
      foreignProxy.connect(signer).handleFailedDisputeCreation(questionId, contestedAnswer)
    );
  }

  async function handleRejectedRequest(questionId, contestedAnswer = currentAnswer, { signer = governor } = {}) {
    return await submitTransaction(homeProxy.connect(signer).handleRejectedRequest(questionId, contestedAnswer));
  }

  async function rule(disputeID, ruling, signer = governor) {
    return await submitTransaction(arbitrator.connect(signer).rule(disputeID, ruling));
  }

  async function reportArbitrationAnswer(questionId, signer = governor) {
    return await submitTransaction(
      homeProxy.connect(signer).reportArbitrationAnswer(questionId, HASH_ZERO, HASH_ZERO, ADDRESS_ZERO)
    );
  }

  async function submitTransaction(txPromise) {
    try {
      const tx = await txPromise;
      const receipt = await tx.wait();

      return { txPromise, tx, receipt };
    } catch (err) {
      return { txPromise };
    }
  }

  function getEventArgs(eventName, events) {
    const event = events.find(({ event }) => event === eventName);
    if (!event) {
      throw new Error(`Event ${eventName} not emitted in transaction`);
    }

    const omitIntegerKeysReducer = (acc, [key, value]) =>
      Number.isNaN(parseInt(key, 10)) ? Object.assign(acc, { [key]: value }) : acc;

    return Object.entries(event.args).reduce(omitIntegerKeysReducer, {});
  }

  function normalizeRuling(answer) {
    return BigNumber.from(answer).add(BigNumber.from(1));
  }
});
