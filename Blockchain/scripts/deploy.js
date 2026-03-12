const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n========================================");
  console.log("DEPLOYING TOURIST IDENTITY CONTRACT");
  console.log("========================================\n");

  const TouristIdentity = await ethers.getContractFactory("TouristIdentity");
  const contract = await TouristIdentity.deploy();

  await contract.deployed();

  console.log(`✅ TouristIdentity Contract deployed to: ${contract.address}`);
  console.log(`   Network: ${network.name}`);
  console.log(`   Chain ID: ${network.config.chainId}`);

  // Save address for reuse
  const filePath = path.join(__dirname, "../deployedAddress.json");
  fs.writeFileSync(filePath, JSON.stringify({ address: contract.address }, null, 2));

  console.log("\n📁 Saved deployed address to deployedAddress.json");
  console.log("\n========================================");
  console.log("DEPLOYMENT COMPLETE!");
  console.log("========================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
