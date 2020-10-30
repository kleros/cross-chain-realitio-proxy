const {ethers} = require("hardhat");
const {solidity} = require("ethereum-waffle");
const {use, expect} = require("chai");

use(solidity);

const {BigNumber} = ethers;
const {hexZeroPad} = ethers.utils;

const ZERO_HASH = hexZeroPad(0, 32);
const ZERO_ADDRESS = hexZeroPad(0, 20);

let arbitrator;
let homeProxy;
let foreignProxy;
let amb;
let realitio;

let governor;
let asker;
let answerer;
let requester;

const arbitrationFee = BigNumber.from(BigInt(1e18));
const arbitratorExtraData = "0x00";
const metaEvidence = "ipfs/X";
const termsOfService = "ipfs/Y";

let questionId;
const question = "Whats the answer for everything in the universe?";
const currentAnswer = hexZeroPad(1, 32);
const otherAnswer = hexZeroPad(42, 32);
// const wrongAnswer = hexZeroPad(1, 31);

describe("Cross-Chain Arbitration", () => {
  beforeEach("Setup contracts", async () => {
    [governor, asker, answerer, requester] = await ethers.getSigners();

    const Arbitrator = await ethers.getContractFactory("MockArbitrator", governor);
    arbitrator = await Arbitrator.deploy(String(arbitrationFee));

    const AMB = await ethers.getContractFactory("MockAMB", governor);
    amb = await AMB.deploy();

    const ForeignProxy = await ethers.getContractFactory("RealitioForeignArbitrationProxy", governor);
    foreignProxy = await ForeignProxy.deploy(amb.address, arbitrator.address, arbitratorExtraData);

    const Realitio = await ethers.getContractFactory("MockRealitio", governor);
    realitio = await Realitio.deploy();

    const HomeProxy = await ethers.getContractFactory("RealitioHomeArbitrationProxy", governor);
    homeProxy = await HomeProxy.deploy(amb.address, realitio.address);

    const setArbitratorTx = await realitio.setArbitrator(homeProxy.address);
    await setArbitratorTx.wait();

    const setForeignProxyTx = await homeProxy.setForeignProxy(foreignProxy.address, 31337);
    await setForeignProxyTx.wait();

    const setHomeProxyTx = await foreignProxy.setHomeProxy(homeProxy.address);
    await setHomeProxyTx.wait();
    const initializeTx = await foreignProxy.initialize(metaEvidence, termsOfService);
    await initializeTx.wait();
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
        const {txPromise} = await requestArbitration(questionId, currentAnswer);

        await expect(txPromise)
          .to.emit(homeProxy, "RequestNotified")
          .withArgs(questionId, currentAnswer, await requester.getAddress());
        await expect(txPromise)
          .to.emit(realitio, "MockNotifyOfArbitrationRequest")
          .withArgs(questionId, await requester.getAddress());
      });

      it("should set the requester on the Home Proxy #regression", async () => {
        await requestArbitration(questionId, currentAnswer);

        const request = await homeProxy.questionIDToRequest(questionId);
        expect(request.requester).to.equal(await requester.getAddress());
      });

      it("should pass the message to create the dispute after notifying Realitio of the arbitration request", async () => {
        await requestArbitration(questionId, currentAnswer);

        const {txPromise} = await handleNotifiedRequest(questionId);

        await expect(txPromise).to.emit(foreignProxy, "ArbitrationCreated");
        await expect(txPromise).to.emit(arbitrator, "DisputeCreation");
      });
    });

    describe("When the requester contests an answer different than the current one", () => {
      it("should reject the request and not notify Realitio of the arbitration request", async () => {
        const {txPromise} = await requestArbitration(questionId, otherAnswer);

        await expect(txPromise)
          .to.emit(homeProxy, "RequestRejected")
          .withArgs(questionId, otherAnswer, await requester.getAddress());
        await expect(txPromise).not.to.emit(realitio, "MockNotifyOfArbitrationRequest");
      });

      it("should pass the message to cancel the arbitration", async () => {
        await requestArbitration(questionId, otherAnswer);

        const {txPromise} = await handleRejectedRequest(questionId);

        await expect(txPromise).to.emit(homeProxy, "RequestCanceled");
        await expect(txPromise).to.emit(foreignProxy, "ArbitrationCanceled");
        await expect(txPromise).not.to.emit(realitio, "MockNotifyOfArbitrationRequest");
        await expect(txPromise).not.to.emit(arbitrator, "DisputeCreation");
      });

      it("should reimbuser the requester", async () => {
        await requestArbitration(questionId, otherAnswer);

        const balanceBefore = await requester.getBalance();
        await handleRejectedRequest(questionId);
        const balanceAfter = await requester.getBalance();

        const expectedBalance = balanceBefore.add(arbitrationFee);
        expect(balanceAfter).to.equal(expectedBalance, "Requester was not properly reimbursed");
      });
    });

    describe("When the requester contests a finalized question", () => {
      it("should reject the request and not notify Realitio of the arbitration request", async () => {
        await finalizeQuestion(questionId);

        const {txPromise} = await requestArbitration(questionId, otherAnswer);

        await expect(txPromise)
          .to.emit(homeProxy, "RequestRejected")
          .withArgs(questionId, otherAnswer, await requester.getAddress());
        await expect(txPromise).not.to.emit(realitio, "MockNotifyOfArbitrationRequest");
      });

      it("should pass the message to cancel the arbitration", async () => {
        await finalizeQuestion(questionId);
        await requestArbitration(questionId, currentAnswer);

        const {txPromise} = await handleRejectedRequest(questionId);

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

        const {txPromise} = await handleNotifiedRequest(questionId);

        await expect(txPromise).to.emit(foreignProxy, "ArbitrationCreated");
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

        const {txPromise} = await handleNotifiedRequest(questionId);

        await expect(txPromise).to.emit(foreignProxy, "ArbitrationFailed").withArgs(questionId);
        await expect(txPromise).not.to.emit(arbitrator, "DisputeCreation");
      });

      it("Should pass the message informing the dispute creation failed due to an increase in arbitration cost", async () => {
        const newArbitrationFee = arbitrationFee.mul(2);
        await setArbitrationCost(newArbitrationFee);
        await handleNotifiedRequest(questionId);

        const {txPromise} = await handleFailedDisputeCreation(questionId);

        await expect(txPromise).to.emit(homeProxy, "ArbitrationFailed").withArgs(questionId);
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

    beforeEach("Create question, submit answer and requet arbitration", async () => {
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
      const {txPromise} = await rule(disputeId, ruling);

      await expect(txPromise).to.emit(homeProxy, "ArbitratorAnswered").withArgs(questionId, otherAnswer);
    });

    it("Should notify Realitio of the answer given by the arbitrator when the home proxy reports the answer", async () => {
      const ruling = normalizeRuling(currentAnswer); // rules in favor of the original answer
      await rule(disputeId, ruling);

      const {txPromise} = await reportArbitrationAnswer(questionId);
      await expect(txPromise).to.emit(realitio, "MockFinalize").withArgs(questionId, currentAnswer);
    });
  });

  async function submitAnswer(questionId, answer, signer = answerer) {
    const txPromise = realitio.connect(signer).submitAnswer(questionId, answer, 0);
    const tx = await txPromise;
    const receipt = await tx.wait();

    return {txPromise, tx, receipt};
  }

  async function requestArbitration(questionId, contestedAnswer, signer = requester) {
    const txPromise = foreignProxy
      .connect(signer)
      .requestArbitration(questionId, contestedAnswer, {value: arbitrationFee});
    const tx = await txPromise;
    const receipt = await tx.wait();

    return {txPromise, tx, receipt};
  }

  async function setArbitrationCost(cost, signer = governor) {
    const txPromise = arbitrator.connect(signer).setArbitrationCost(cost);
    const tx = await txPromise;
    const receipt = await tx.wait();

    return {txPromise, tx, receipt};
  }

  async function finalizeQuestion(questionId, signer = governor) {
    const txPromise = realitio.connect(signer).finalizeQuestion(questionId);
    const tx = await txPromise;
    const receipt = await tx.wait();

    return {txPromise, tx, receipt};
  }

  async function handleNotifiedRequest(questionId, signer = governor) {
    const txPromise = homeProxy.connect(signer).handleNotifiedRequest(questionId);
    const tx = await txPromise;
    const receipt = await tx.wait();

    return {txPromise, tx, receipt};
  }

  async function handleFailedDisputeCreation(questionId, signer = governor) {
    const txPromise = foreignProxy.connect(signer).handleFailedDisputeCreation(questionId);
    const tx = await txPromise;
    const receipt = await tx.wait();

    return {txPromise, tx, receipt};
  }

  async function handleRejectedRequest(questionId, signer = governor) {
    const txPromise = homeProxy.connect(signer).handleRejectedRequest(questionId);
    const tx = await txPromise;
    const receipt = await tx.wait();

    return {txPromise, tx, receipt};
  }

  async function rule(disputeID, ruling, signer = governor) {
    const txPromise = arbitrator.connect(signer).rule(disputeID, ruling);
    const tx = await txPromise;
    const receipt = await tx.wait();

    return {txPromise, tx, receipt};
  }

  async function reportArbitrationAnswer(questionId, signer = governor) {
    const txPromise = homeProxy.connect(signer).reportArbitrationAnswer(questionId, ZERO_HASH, ZERO_HASH, ZERO_ADDRESS);
    const tx = await txPromise;
    const receipt = await tx.wait();

    return {txPromise, tx, receipt};
  }

  function getEventArgs(eventName, events) {
    const event = events.find(({event}) => event === eventName);
    if (!event) {
      throw new Error(`Event ${eventName} not emitted in transaction`);
    }

    const omitIntegerKeysReducer = (acc, [key, value]) =>
      Number.isNaN(parseInt(key, 10)) ? Object.assign(acc, {[key]: value}) : acc;

    return Object.entries(event.args).reduce(omitIntegerKeysReducer, {});
  }

  function normalizeRuling(answer) {
    return BigNumber.from(answer).add(BigNumber.from(1));
  }
});
