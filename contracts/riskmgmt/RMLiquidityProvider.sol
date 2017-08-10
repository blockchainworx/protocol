pragma solidity ^0.4.11;

import './RiskMgmtInterface.sol';

/// @title RiskMgmt Contract
/// @author Melonport AG <team@melonport.com>
contract RMLiquididtyProvider is RiskMgmtInterface {

      // FIELDS

      address public constant LIQUIDITY_PROVIDER = 0x00360d2b7D240Ec0643B6D819ba81A09e40E5bCd;

      // NON-CONSTANT METHODS

      function isExchangeMakePermitted(
          ERC20   haveToken,
          ERC20   wantToken,
          uint    haveAmount,
          uint    wantAmount
      )
          returns (bool)
      {
          return false; // Inital version of risk management does not allow to make orders
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
          return orderOwner == LIQUIDITY_PROVIDER; // Inital version of risk management restricts trading to liquidity provider
      }
}
