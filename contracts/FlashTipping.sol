// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.24;

abstract contract FlashTipping {
    address public owner;
    address public executor;
    uint256 public constant TIP_PERCENTAGE = 85; // 85% of profit to block builder

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _executor) {
        owner = msg.sender;
        executor = _executor;
    }

    function setExecutor(address _executor) external onlyOwner {
        executor = _executor;
    }

    function calculateTip(uint256 profit) external pure returns (uint256) {
        return (profit * TIP_PERCENTAGE) / 100;
    }

    // Transfer tip to block builder (coinbase)
    function tipBlockBuilder(uint256 amount) internal {
        require(amount > 0, "Invalid tip amount");
        block.coinbase.transfer(amount);
    }
}