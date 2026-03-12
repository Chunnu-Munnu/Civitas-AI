const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying CIVITAS contracts with account:", deployer.address);

  // 1. GreenCoin
  const GreenCoin = await hre.ethers.getContractFactory("GreenCoin");
  const greenCoin = await GreenCoin.deploy();
  await greenCoin.deployed();
  console.log("✅ GreenCoin deployed to:", greenCoin.address);

  // 2. SolarVerification
  const SolarVerification = await hre.ethers.getContractFactory("SolarVerification");
  const solarVerification = await SolarVerification.deploy();
  await solarVerification.deployed();
  console.log("✅ SolarVerification deployed to:", solarVerification.address);

  // 3. SubsidyRegistry
  const SubsidyRegistry = await hre.ethers.getContractFactory("SubsidyRegistry");
  const subsidyRegistry = await SubsidyRegistry.deploy();
  await subsidyRegistry.deployed();
  console.log("✅ SubsidyRegistry deployed to:", subsidyRegistry.address);

  // Save addresses for frontend
  const fs = require("fs");
  const addresses = {
    GreenCoin: greenCoin.address,
    SolarVerification: solarVerification.address,
    SubsidyRegistry: subsidyRegistry.address,
  };
  fs.writeFileSync("deployedAddress.json", JSON.stringify(addresses, null, 2));
  console.log("\n📄 Addresses saved to deployedAddress.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
