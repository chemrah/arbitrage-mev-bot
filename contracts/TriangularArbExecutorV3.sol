// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.24;

import "./FlashTipping.sol";

interface IUniswapV3Pool {
    function swap(
        address recipient,
        bool zeroForOne,
        int256 amountSpecified,
        uint160 sqrtPriceLimitX96,
        bytes calldata data
    ) external returns (int256 amount0, int256 amount1);
    function token0() external view returns (address);
    function token1() external view returns (address);
    function fee() external view returns (uint24);
}

interface IERC20 {
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function decimals() external view returns (uint8);
}

struct SwapParams {
    address pool;
    address tokenIn;
    address tokenOut;
    uint24 fee;
    uint256 amountIn;
    uint256 amountOutMin;
    bool zeroForOne;
}

contract TriangularArbExecutorV3 is FlashTipping {
    address public immutable weth;
    address public immutable usdc;
    address public immutable link;

    mapping(address => bool) public authorizedPools;

    event ArbitrageExecuted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 profit,
        uint256 gasUsed,
        uint256 tipAmount
    );

    event ArbitrageFailed(string reason);

    modifier onlyExecutor() {
        require(
            msg.sender == owner || msg.sender == executor,
            "Unauthorized executor"
        );
        _;
    }

    constructor(
        address _weth,
        address _usdc,
        address _link,
        address _executor
    ) FlashTipping(_executor) {
        weth = _weth;
        usdc = _usdc;
        link = _link;
    }

    function executeTriangularArbitrage(
        SwapParams[3] calldata swaps,
        uint256 expectedProfit
    ) external onlyExecutor {
        // Record initial token balances
        uint256 initialToken0 = IERC20(swaps[0].tokenIn).balanceOf(address(this));
        uint256 initialToken1 = IERC20(swaps[1].tokenIn).balanceOf(address(this));
        uint256 initialToken2 = IERC20(swaps[2].tokenIn).balanceOf(address(this));

        // Execute flash swap from first pool
        IUniswapV3Pool(swaps[0].pool).swap(
            address(this),
            swaps[0].zeroForOne,
            -int256(swaps[0].amountIn),
            swaps[0].zeroForOne ? MIN_SQRT_RATIO + 1 : MAX_SQRT_RATIO - 1,
            abi.encode(swaps, expectedProfit)
        );

        // After callback executes all 3 swaps, calculate profit
        uint256 finalToken0 = IERC20(swaps[0].tokenIn).balanceOf(address(this));
        uint256 profit = finalToken0 > initialToken0 ?
            finalToken0 - initialToken0 : 0;

        require(profit >= expectedProfit, "Insufficient profit");

        uint256 gasUsed = gasleft();
        uint256 tipAmount = (profit * TIP_PERCENTAGE) / 100;

        if (tipAmount > 0) {
            block.coinbase.transfer(tipAmount);
        }

        emit ArbitrageExecuted(
            swaps[0].tokenIn,
            swaps[2].tokenOut,
            profit,
            gasUsed,
            tipAmount
        );
    }

    // Uniswap V3 callback for flash swap
    function uniswapV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external {
        require(amount0Delta > 0 || amount1Delta > 0, "Invalid swap amounts");

        (SwapParams[3] memory swaps, uint256 expectedProfit) = abi.decode(
            data,
            (SwapParams[3], uint256)
        );

        // Verify callback comes from one of the authorized pools
        require(
            msg.sender == swaps[0].pool ||
            msg.sender == swaps[1].pool ||
            msg.sender == swaps[2].pool,
            "Unauthorized callback"
        );

        // Step 1: Pay back the flash swap debt
        if (amount0Delta > 0) {
            IERC20(IUniswapV3Pool(msg.sender).token0()).transfer(
                msg.sender,
                uint256(amount0Delta)
            );
        }
        if (amount1Delta > 0) {
            IERC20(IUniswapV3Pool(msg.sender).token1()).transfer(
                msg.sender,
                uint256(amount1Delta)
            );
        }

        // Step 2: Execute remaining swaps in the triangular path
        // The callback happens after the first swap, so now we execute swap 2 and 3
        for (uint256 i = 1; i < 3; i++) {
            IUniswapV3Pool pool = IUniswapV3Pool(swaps[i].pool);
            pool.swap(
                address(this),
                swaps[i].zeroForOne,
                -int256(swaps[i].amountIn),
                swaps[i].zeroForOne ? MIN_SQRT_RATIO + 1 : MAX_SQRT_RATIO - 1,
                ""
            );
        }
    }

    uint160 private constant MIN_SQRT_RATIO = 4295128739;
    uint160 private constant MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342;

    receive() external payable {}

    function emergencyWithdraw(address token) external onlyOwner {
        if (token == address(0)) {
            payable(owner).transfer(address(this).balance);
        } else {
            IERC20(token).transfer(
                owner,
                IERC20(token).balanceOf(address(this))
            );
        }
    }
}
