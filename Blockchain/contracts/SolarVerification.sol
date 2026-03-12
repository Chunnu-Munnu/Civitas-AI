// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

contract SolarVerification {
    struct Verification {
        address household;
        uint256 kwh;
        uint256 timestamp;
        string ipfsHash;
        bool isValid;
    }

    mapping(uint256 => Verification) public verifications;
    uint256 public nextVerificationId;

    event VerificationStored(address indexed household, uint256 kwh, bool isValid);

    function storeVerification(
        address _household,
        uint256 _kwh,
        uint256 _timestamp,
        string memory _ipfsHash,
        bool _isValid
    ) public {
        verifications[nextVerificationId] = Verification(
            _household,
            _kwh,
            _timestamp,
            _ipfsHash,
            _isValid
        );
        emit VerificationStored(_household, _kwh, _isValid);
        nextVerificationId++;
    }

    function getVerification(uint256 _id) public view returns (Verification memory) {
        return verifications[_id];
    }
}
