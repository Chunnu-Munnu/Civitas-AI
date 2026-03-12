import { ethers } from "ethers";

// Contract ABIs (simplified — replace with full ABI from artifacts after compile)
export const GREENCOIN_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function mint(address to, uint256 amount)",
  "function burn(address from, uint256 amount)",
];

export const SOLAR_VERIFICATION_ABI = [
  "function storeVerification(address household, uint256 kwh, uint256 timestamp, string ipfsHash, bool isValid)",
  "function getVerification(uint256 id) view returns (tuple(address household, uint256 kwh, uint256 timestamp, string ipfsHash, bool isValid))",
  "function nextVerificationId() view returns (uint256)",
  "event VerificationStored(address indexed household, uint256 kwh, bool isValid)",
];

export const SUBSIDY_REGISTRY_ABI = [
  "function registerHousehold(uint256 panelCapacity, string location)",
  "function approveSubsidy(address household)",
  "function households(address) view returns (address wallet, uint256 panelCapacity, string location, bool isApproved, uint256 registeredAt)",
];

// Addresses (update after deploy)
export const CONTRACT_ADDRESSES = {
  GreenCoin: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  SolarVerification: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  SubsidyRegistry: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
};

export async function connectWallet() {
  if (!window.ethereum) throw new Error("MetaMask not installed");
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  const signer = provider.getSigner();
  const address = await signer.getAddress();
  return { provider, signer, address };
}

export function getGreenCoinContract(signer) {
  return new ethers.Contract(CONTRACT_ADDRESSES.GreenCoin, GREENCOIN_ABI, signer);
}

export function getSolarVerificationContract(signer) {
  return new ethers.Contract(CONTRACT_ADDRESSES.SolarVerification, SOLAR_VERIFICATION_ABI, signer);
}

export function getSubsidyRegistryContract(signer) {
  return new ethers.Contract(CONTRACT_ADDRESSES.SubsidyRegistry, SUBSIDY_REGISTRY_ABI, signer);
}
