pub const SUBSCRIBED_POOLS: &[&str] = &[
    "0x8ad599c3A0dF1f866EF4F0f84ec126f03E472005",
    "0xcbcDf9626bBf0a43d46BD4dC3D55D18f3C7cBDC1",
    "0xC36442b4a4522E871399CD717aDDDD9830726f3a",
    "0x60594a405d53811D3BC5766F3e2f736f7e46E56DE",
];

pub const Q96: u128 = 2u128.pow(96);
pub const MAX_FEE: u32 = 1_000_000;
pub const FEE_DENOMINATOR: u32 = 1_000_000;

pub fn get_output_amount(
    input_amount: u128,
    input_reserve: u128,
    output_reserve: u128,
    fee: u32,
) -> u128 {
    let fee_amount = (input_amount * fee as u128) / FEE_DENOMINATOR as u128;
    let input_after_fee = input_amount - fee_amount;
    let numerator = input_after_fee * output_reserve;
    let denominator = input_reserve + input_after_fee;
    numerator / denominator
}

pub fn estimate_gas_cost(gas_units: u64, gas_price_gwei: u64) -> u128 {
    (gas_units as u128) * (gas_price_gwei as u128) * 1_000_000_000
}

pub fn calculate_optimal_loan(price_path: &[(u128, u128, u32)]) -> Option<u128> {
    let mut low = 1u128;
    let mut high = u128::MAX / 2;
    let mut max_profit = 0u128;
    let mut optimal_loan = 0u128;

    while low <= high {
        let mid = low + (high - low) / 2;
        let mut current = mid;
        for &(ir, or, fee) in price_path {
            current = get_output_amount(current, ir, or, fee);
            if current == 0 {
                break;
            }
        }
        let profit = if current > mid { current - mid } else { 0 };
        if profit > max_profit {
            max_profit = profit;
            optimal_loan = mid;
        }
        if current > mid { low = mid + 1 } else { high = mid - 1 }
    }
    if optimal_loan > 0 { Some(optimal_loan) } else { None }
}
