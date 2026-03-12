// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

/**
 * @title TouristIdentity
 * @dev Blockchain-based digital identity system for tourists
 * Stores encrypted passport data, emergency contacts, and medical info
 */
contract TouristIdentity {
    
    struct Tourist {
        string passportHash;        // IPFS hash or encrypted passport data
        string fullName;
        string nationality;
        string emergencyContact;    // Phone number or contact info
        string medicalInfo;         // Blood type, allergies, medications
        string embassyContact;      // Embassy contact based on nationality
        address walletAddress;      // Tourist's wallet address
        uint256 registrationTime;
        bool isActive;
    }
    
    // Mapping from wallet address to tourist data
    mapping(address => Tourist) public tourists;
    
    // Array to keep track of all registered tourists
    address[] public touristList;
    
    // Events
    event TouristRegistered(
        address indexed touristAddress,
        string nationality,
        uint256 timestamp
    );
    
    event TouristUpdated(
        address indexed touristAddress,
        uint256 timestamp
    );
    
    event TouristDeactivated(
        address indexed touristAddress,
        uint256 timestamp
    );
    
    /**
     * @dev Register a new tourist with their identity information
     */
    function registerTourist(
        string memory _passportHash,
        string memory _fullName,
        string memory _nationality,
        string memory _emergencyContact,
        string memory _medicalInfo,
        string memory _embassyContact
    ) public {
        require(!tourists[msg.sender].isActive, "Tourist already registered");
        require(bytes(_fullName).length > 0, "Name cannot be empty");
        require(bytes(_nationality).length > 0, "Nationality cannot be empty");
        
        tourists[msg.sender] = Tourist({
            passportHash: _passportHash,
            fullName: _fullName,
            nationality: _nationality,
            emergencyContact: _emergencyContact,
            medicalInfo: _medicalInfo,
            embassyContact: _embassyContact,
            walletAddress: msg.sender,
            registrationTime: block.timestamp,
            isActive: true
        });
        
        touristList.push(msg.sender);
        
        emit TouristRegistered(msg.sender, _nationality, block.timestamp);
    }
    
    /**
     * @dev Update tourist information
     */
    function updateTouristInfo(
        string memory _emergencyContact,
        string memory _medicalInfo
    ) public {
        require(tourists[msg.sender].isActive, "Tourist not registered");
        
        tourists[msg.sender].emergencyContact = _emergencyContact;
        tourists[msg.sender].medicalInfo = _medicalInfo;
        
        emit TouristUpdated(msg.sender, block.timestamp);
    }
    
    /**
     * @dev Get tourist information by address
     */
    function getTourist(address _touristAddress) public view returns (
        string memory passportHash,
        string memory fullName,
        string memory nationality,
        string memory emergencyContact,
        string memory medicalInfo,
        string memory embassyContact,
        uint256 registrationTime,
        bool isActive
    ) {
        Tourist memory tourist = tourists[_touristAddress];
        return (
            tourist.passportHash,
            tourist.fullName,
            tourist.nationality,
            tourist.emergencyContact,
            tourist.medicalInfo,
            tourist.embassyContact,
            tourist.registrationTime,
            tourist.isActive
        );
    }
    
    /**
     * @dev Check if a tourist is registered and active
     */
    function isTouristRegistered(address _touristAddress) public view returns (bool) {
        return tourists[_touristAddress].isActive;
    }
    
    /**
     * @dev Get total number of registered tourists
     */
    function getTouristCount() public view returns (uint256) {
        return touristList.length;
    }
    
    /**
     * @dev Deactivate tourist account (for checkout or leaving)
     */
    function deactivateTourist() public {
        require(tourists[msg.sender].isActive, "Tourist not registered");
        
        tourists[msg.sender].isActive = false;
        
        emit TouristDeactivated(msg.sender, block.timestamp);
    }
}