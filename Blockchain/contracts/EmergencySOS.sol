// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import "./TouristIdentity.sol";

/**
 * @title EmergencySOS
 * @dev Emergency alert system with automatic embassy notification
 * Logs SOS events on blockchain for immutable emergency records
 */
contract EmergencySOS {
    
    TouristIdentity public touristIdentityContract;
    
    struct SOSAlert {
        address touristAddress;
        string location;            // GPS coordinates or location description
        string emergencyType;       // Medical, Safety, Lost, etc.
        uint256 timestamp;
        bool isResolved;
        string resolutionNotes;
        address responder;          // Who responded to the emergency
    }
    
    // Array of all SOS alerts
    SOSAlert[] public sosAlerts;
    
    // Mapping from tourist address to their SOS alert indices
    mapping(address => uint256[]) public touristSOSHistory;
    
    // Events
    event SOSTriggered(
        uint256 indexed alertId,
        address indexed touristAddress,
        string nationality,
        string embassyContact,
        string location,
        string emergencyType,
        uint256 timestamp
    );
    
    event SOSResolved(
        uint256 indexed alertId,
        address indexed responder,
        string resolutionNotes,
        uint256 timestamp
    );
    
    constructor(address _touristIdentityAddress) {
        touristIdentityContract = TouristIdentity(_touristIdentityAddress);
    }
    
    /**
     * @dev Trigger an SOS alert
     * Automatically retrieves tourist identity and embassy info
     */
    function triggerSOS(
        string memory _location,
        string memory _emergencyType
    ) public {
        require(
            touristIdentityContract.isTouristRegistered(msg.sender),
            "Tourist not registered. Please register first."
        );
        
        // Get tourist information from identity contract
        (
            ,  // passportHash
            ,  // fullName
            string memory nationality,
            string memory emergencyContact,
            string memory medicalInfo,
            string memory embassyContact,
            ,  // registrationTime
               // isActive
        ) = touristIdentityContract.getTourist(msg.sender);
        
        uint256 alertId = sosAlerts.length;
        
        sosAlerts.push(SOSAlert({
            touristAddress: msg.sender,
            location: _location,
            emergencyType: _emergencyType,
            timestamp: block.timestamp,
            isResolved: false,
            resolutionNotes: "",
            responder: address(0)
        }));
        
        touristSOSHistory[msg.sender].push(alertId);
        
        // Emit event with all necessary info for embassy/emergency services
        emit SOSTriggered(
            alertId,
            msg.sender,
            nationality,
            embassyContact,
            _location,
            _emergencyType,
            block.timestamp
        );
    }
    
    /**
     * @dev Mark an SOS alert as resolved (only responders/authorities)
     */
    function resolveAlertSOS(
        uint256 _alertId,
        string memory _resolutionNotes
    ) public {
        require(_alertId < sosAlerts.length, "Invalid alert ID");
        require(!sosAlerts[_alertId].isResolved, "Alert already resolved");
        
        sosAlerts[_alertId].isResolved = true;
        sosAlerts[_alertId].resolutionNotes = _resolutionNotes;
        sosAlerts[_alertId].responder = msg.sender;
        
        emit SOSResolved(_alertId, msg.sender, _resolutionNotes, block.timestamp);
    }
    
    /**
     * @dev Get SOS alert details
     */
    function getSOSAlert(uint256 _alertId) public view returns (
        address touristAddress,
        string memory location,
        string memory emergencyType,
        uint256 timestamp,
        bool isResolved,
        string memory resolutionNotes,
        address responder
    ) {
        require(_alertId < sosAlerts.length, "Invalid alert ID");
        
        SOSAlert memory alert = sosAlerts[_alertId];
        return (
            alert.touristAddress,
            alert.location,
            alert.emergencyType,
            alert.timestamp,
            alert.isResolved,
            alert.resolutionNotes,
            alert.responder
        );
    }
    
    /**
     * @dev Get all SOS alerts for a specific tourist
     */
    function getTouristSOSHistory(address _touristAddress) public view returns (uint256[] memory) {
        return touristSOSHistory[_touristAddress];
    }
    
    /**
     * @dev Get total number of SOS alerts in the system
     */
    function getTotalSOSAlerts() public view returns (uint256) {
        return sosAlerts.length;
    }
    
    /**
     * @dev Get all active (unresolved) SOS alerts
     */
    function getActiveAlertsCount() public view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < sosAlerts.length; i++) {
            if (!sosAlerts[i].isResolved) {
                count++;
            }
        }
        return count;
    }
}