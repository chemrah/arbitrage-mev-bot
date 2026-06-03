import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const deployContracts: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log('Deploying contracts with account:', deployer);

  // Deploy FlashTipping (abstract, no deployment needed)

  // Deploy TriangularArbExecutorV3
  const triArb = await deploy('TriangularArbExecutorV3', {
    from: deployer,
    args: [
      '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      '0xA0b86a33E6444eDF4DD3d35F1F2B5F8A5A2F3dF3',
      '0x514910771AF9Ca656af840dff83E8264EcF986CA',
      deployer,
    ],
    log: true,
    autoMine: true,
  });

  console.log('TriangularArbExecutorV3 deployed at:', triArb.address);

  // Deploy UniswapV4Executor
  const v4Executor = await deploy('UniswapV4Executor', {
    from: deployer,
    args: [
      '0x' + '00'.repeat(20),
      deployer,
    ],
    log: true,
    autoMine: true,
  });

  console.log('UniswapV4Executor deployed at:', v4Executor.address);

  // Deploy MakerDAOMintWrapper
  const mintWrapper = await deploy('MakerDAOMintWrapper', {
    from: deployer,
    args: [
      '0x' + '00'.repeat(20),
      '0x6B175474E89094C44Da98b950e0a2e71d311f68F',
      deployer,
    ],
    log: true,
    autoMine: true,
  });

  console.log('MakerDAOMintWrapper deployed at:', mintWrapper.address);
};

deployContracts.tags = ['all'];
export default deployContracts;