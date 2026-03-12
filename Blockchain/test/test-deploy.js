const { ethers } = require("hardhat");
const { expect, assert } = require("chai");

describe("SatelliteCommandLog", function () {
  let satelliteCommandLogFactory, satelliteCommandLog;

  beforeEach(async function () {
    satelliteCommandLogFactory = await ethers.getContractFactory(
      "SatelliteCommandLog"
    );
    satelliteCommandLog = await satelliteCommandLogFactory.deploy();
  });

  it("Should start with a log count of 0", async function () {
    const logCount = await satelliteCommandLog.getLogCount();
    assert.equal(logCount.toString(), "0");
  });

  it("Should add a new log and increment the log count", async function () {
    const commandData = '{"command_type":"TEST_COMMAND"}';
    const responseData = '{"status":"SUCCESS"}';
    const transactionResponse = await satelliteCommandLog.addLog(commandData, responseData);
    await transactionResponse.wait(1);

    const logCount = await satelliteCommandLog.getLogCount();
    assert.equal(logCount.toString(), "1");
  });

  it("Should store the command and response JSON strings correctly", async function () {
    const commandData = '{"satellite_id":"SAT-33","command_type":"DATA_COLLECT"}';
    const responseData = '{"anomaly_probability":0,"prediction":0}';
    const [sender] = await ethers.getSigners();

    const transactionResponse = await satelliteCommandLog.addLog(commandData, responseData);
    const receipt = await transactionResponse.wait(1);
    
    const block = await ethers.provider.getBlock(receipt.blockNumber);
    const timestamp = block.timestamp;
    
    const [storedCommand, storedResponse, storedTimestamp, storedOperator] = await satelliteCommandLog.getLog(0);

    assert.equal(storedCommand, commandData, "Command data does not match");
    assert.equal(storedResponse, responseData, "Response data does not match");
    assert.equal(storedTimestamp.toString(), timestamp.toString(), "Timestamp does not match");
    assert.equal(storedOperator, sender.address, "Operator address does not match");
  });

  it("Should emit a LogAdded event when a new log is added", async function () {
    const commandData = '{"command_type":"POWER_ON_PAYLOAD"}';
    const responseData = '{"status":"SUCCESS"}';
    const [sender] = await ethers.getSigners();
    
    const block = await ethers.provider.getBlock("latest");
    const expectedTimestamp = block.timestamp + 1;
    
    await expect(satelliteCommandLog.addLog(commandData, responseData))
      .to.emit(satelliteCommandLog, "LogAdded")
      .withArgs(0, commandData, responseData, expectedTimestamp, sender.address);
  });

  it("Should revert when trying to get a log with an out-of-bounds index", async function () {
    await expect(satelliteCommandLog.getLog(0)).to.be.revertedWith("Log index out of bounds");
  });
});
