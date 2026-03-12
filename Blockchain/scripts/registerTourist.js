const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n========================================");
  console.log("TOURIST REGISTRATION SYSTEM");
  console.log("========================================\n");

  // ✅ Read deployed address
  const filePath = path.join(__dirname, "../deployedAddress.json");
  const { address: DEPLOYED_CONTRACT_ADDRESS } = JSON.parse(fs.readFileSync(filePath, "utf8"));

  // ✅ Connect manually to localhost provider
  const provider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");

  // ✅ Use the first account as the signer
  const signer = provider.getSigner(0);

  // ✅ Connect to contract
  const abi = [
    "function registerTourist(string,string,string,string,string,string) public",
    "function getTourist(address) public view returns (tuple(string passportHash,string fullName,string nationality,string emergencyContact,string medicalInfo,string embassyContact,uint256 registrationTime,bool isActive))"
  ];
  const touristIdentity = new ethers.Contract(DEPLOYED_CONTRACT_ADDRESS, abi, signer);

  console.log(`🔑 Registering with wallet address: ${await signer.getAddress()}\n`);

  const touristData = {
    passportHash: "QmX4e8f9...ABC123",
    fullName: "Advika Raj",
    nationality: "United States Of America",
    emergencyContact: "+91-9345286729",
    medicalInfo: "Blood Type: O+, Allergies: Penicillin",
    embassyContact: "US Embassy Ladakh: +91-44-2857-4000"
  };

  console.log("📋 Tourist Information:");
  console.log("   Name:", touristData.fullName);
  console.log("   Nationality:", touristData.nationality);
  console.log("   Emergency Contact:", touristData.emergencyContact);
  console.log("   Medical Info:", touristData.medicalInfo);
  console.log("   Embassy Contact:", touristData.embassyContact);
  console.log("\n⏳ Submitting to blockchain...\n");

  const tx = await touristIdentity.registerTourist(
    touristData.passportHash,
    touristData.fullName,
    touristData.nationality,
    touristData.emergencyContact,
    touristData.medicalInfo,
    touristData.embassyContact
  );

  await tx.wait();
  console.log("✅ Registration successful!");
  console.log(`   Transaction Hash: ${tx.hash}\n`);
}

main().catch((error) => {
  console.error("\n❌ ERROR:", error.message);
  process.exit(1);
});
