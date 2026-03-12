const { ethers } = require("hardhat");

async function main() {
  console.log("\n========================================");
  console.log("RETRIEVE TOURIST INFORMATION");
  console.log("========================================\n");

  // Replace with your deployed contract address
  const DEPLOYED_CONTRACT_ADDRESS = "PASTE_YOUR_CONTRACT_ADDRESS_HERE";
  
  // Replace with the tourist's wallet address you want to look up
  const TOURIST_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

  const TouristIdentityFactory = await ethers.getContractFactory("TouristIdentity");
  const touristIdentity = await TouristIdentityFactory.attach(DEPLOYED_CONTRACT_ADDRESS);

  console.log(`🔍 Looking up tourist: ${TOURIST_ADDRESS}\n`);

  const isRegistered = await touristIdentity.isTouristRegistered(TOURIST_ADDRESS);
  
  if (!isRegistered) {
    console.log("❌ Tourist not found or inactive.\n");
    return;
  }

  const touristData = await touristIdentity.getTourist(TOURIST_ADDRESS);
  
  console.log("========================================");
  console.log("TOURIST PROFILE");
  console.log("========================================\n");
  
  console.log("🆔 IDENTIFICATION:");
  console.log(`   Wallet Address: ${TOURIST_ADDRESS}`);
  console.log(`   Passport Hash: ${touristData.passportHash}`);
  
  console.log("\n👤 PERSONAL INFORMATION:");
  console.log(`   Full Name: ${touristData.fullName}`);
  console.log(`   Nationality: ${touristData.nationality}`);
  
  console.log("\n🚨 EMERGENCY INFORMATION:");
  console.log(`   Emergency Contact: ${touristData.emergencyContact}`);
  console.log(`   Medical Info: ${touristData.medicalInfo}`);
  console.log(`   Embassy Contact: ${touristData.embassyContact}`);
  
  console.log("\n📅 ACCOUNT INFORMATION:");
  console.log(`   Registration Date: ${new Date(touristData.registrationTime * 1000).toUTCString()}`);
  console.log(`   Account Status: ${touristData.isActive ? "ACTIVE ✅" : "INACTIVE ❌"}`);
  
  console.log("\n========================================\n");

  // Get total tourist count
  const totalTourists = await touristIdentity.getTouristCount();
  console.log(`📊 Total Registered Tourists: ${totalTourists}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ ERROR:", error.message);
    process.exit(1);
  });