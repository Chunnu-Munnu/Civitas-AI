// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/access/Ownable.sol";

contract SubsidyRegistry is Ownable {
    constructor() Ownable(msg.sender) {}
    struct Household {
        address wallet;
        uint256 panelCapacity;
        string location;
        bool isApproved;
        uint256 registeredAt;
    }

    mapping(address => Household) public households;
    address[] public householdList;

    event HouseholdRegistered(address indexed wallet, string location);
    event SubsidyApproved(address indexed household, uint256 amount);

    function registerHousehold(uint256 _panelCapacity, string memory _location) public {
        require(households[msg.sender].wallet == address(0), "Already registered");
        households[msg.sender] = Household(
            msg.sender,
            _panelCapacity,
            _location,
            false,
            block.timestamp
        );
        householdList.push(msg.sender);
        emit HouseholdRegistered(msg.sender, _location);
    }

    function approveSubsidy(address _household) public onlyOwner {
        require(households[_household].wallet != address(0), "Not registered");
        households[_household].isApproved = true;
    }

    function getHouseholdCount() public view returns (uint256) {
        return householdList.length;
    }
}
