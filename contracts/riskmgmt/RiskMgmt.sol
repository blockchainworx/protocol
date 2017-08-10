pragma solidity ^0.4.11;

import './RiskMgmtInterface.sol';

/// @title RiskMgmt Contract
/// @author Melonport AG <team@melonport.com>
contract RiskMgmt is RiskMgmtInterface {

    // FIELDS

    // EVENTS

    // MODIFIERS

    // CONSTANT METHODS

    // NON-CONSTANT METHODS

    function isExchangeMakePermitted(
        ERC20   haveToken,
        ERC20   wantToken,
        uint    haveAmount,
        uint    wantAmount
    )
        returns (bool)
    {
        return true; // For testing purposes
    }

    function isExchangeTakePermitted(
        ERC20   haveToken,
        ERC20   wantToken,
        uint    haveAmount,
        uint    wantAmount,
        address orderOwner
    )
        returns (bool)
    {
        return true; // For testing purposes
    }
}
