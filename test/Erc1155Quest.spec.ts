import { expect } from 'chai'
import { ethers, upgrades } from 'hardhat'
import { Wallet, utils } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import {
  Erc1155Quest__factory,
  RabbitHoleReceipt__factory,
  SampleErc1155__factory,
  Erc1155Quest,
  SampleErc1155,
  RabbitHoleReceipt,
} from '../typechain-types'

describe('Erc1155Quest', () => {
  let deployedQuestContract: Erc1155Quest
  let deployedSampleErc1155Contract: SampleErc1155
  let deployedRabbitholeReceiptContract: RabbitHoleReceipt
  let expiryDate: number, startDate: number
  const mockAddress = '0x0000000000000000000000000000000000000000'
  const questId = 'asdf'
  const allowList = 'ipfs://someCidToAnArrayOfAddresses'
  const totalRewards = 10
  const rewardAmount = 1
  const mnemonic = 'announce room limb pattern dry unit scale effort smooth jazz weasel alcohol'
  let owner: SignerWithAddress
  let firstAddress: SignerWithAddress
  let secondAddress: SignerWithAddress
  let thirdAddress: SignerWithAddress
  let fourthAddress: SignerWithAddress
  let questContract: Erc1155Quest__factory
  let sampleERC20Contract: SampleErc1155__factory
  let rabbitholeReceiptContract: RabbitHoleReceipt__factory
  let messageHash: string
  let wallet: Wallet
  let signature: string

  beforeEach(async () => {
    const [local_owner, local_firstAddress, local_secondAddress, local_thirdAddress, local_fourthAddress] =
      await ethers.getSigners()
    questContract = await ethers.getContractFactory('Erc1155Quest')
    sampleERC20Contract = await ethers.getContractFactory('SampleErc1155')
    rabbitholeReceiptContract = await ethers.getContractFactory('RabbitHoleReceipt')

    owner = local_owner
    firstAddress = local_firstAddress
    secondAddress = local_secondAddress
    thirdAddress = local_thirdAddress
    fourthAddress = local_fourthAddress

    wallet = Wallet.fromMnemonic(mnemonic)

    expiryDate = Math.floor(Date.now() / 1000) + 10000
    startDate = Math.floor(Date.now() / 1000) + 1000
    await deployRabbitholeReceiptContract()
    await deploySampleErc20Contract()
    await deployQuestContract()
    await transferRewardsToDistributor()

    messageHash = utils.solidityKeccak256(
      ['address', 'string', 'uint'],
      [owner.address.toLowerCase(), questId, startDate]
    )
    signature = await wallet.signMessage(utils.arrayify(messageHash))
  })

  const deployRabbitholeReceiptContract = async () => {
    deployedRabbitholeReceiptContract = (await upgrades.deployProxy(rabbitholeReceiptContract, [
      owner.address,
      owner.address,
      10,
    ])) as RabbitHoleReceipt
  }

  const deployQuestContract = async () => {
    deployedQuestContract = await questContract.deploy(
      deployedSampleErc1155Contract.address,
      expiryDate,
      startDate,
      totalRewards,
      allowList,
      rewardAmount,
      questId,
      deployedRabbitholeReceiptContract.address
    )
    await deployedQuestContract.deployed()
  }

  const deploySampleErc20Contract = async () => {
    deployedSampleErc1155Contract = await sampleERC20Contract.deploy()
    await deployedSampleErc1155Contract.deployed()
  }

  const transferRewardsToDistributor = async () => {
    const distributorContractAddress = await deployedQuestContract.address
    await deployedSampleErc1155Contract.safeTransferFrom(
      owner.address,
      distributorContractAddress,
      rewardAmount,
      100,
      '0x00'
    )
  }

  describe('Deployment', () => {
    describe('when start time is in past', () => {
      it('Should revert', async () => {
        expect(
          upgrades.deployProxy(questContract, [mockAddress, expiryDate, startDate - 1000, totalRewards])
        ).to.be.revertedWithCustomError(questContract, 'StartTimeInPast')
      })
    })

    describe('when end time is in past', () => {
      it('Should revert', async () => {
        expect(
          upgrades.deployProxy(questContract, [mockAddress, startDate - 1000, startDate, totalRewards])
        ).to.be.revertedWithCustomError(questContract, 'EndTimeInPast')
      })
    })

    describe('setting public variables', () => {
      it('Should set the token address with correct value', async () => {
        const rewardContractAddress = await deployedQuestContract.rewardToken()
        expect(rewardContractAddress).to.equal(deployedSampleErc1155Contract.address)
      })

      it('Should set the total reward amount with correct value', async () => {
        const totalAmount = await deployedQuestContract.totalAmount()
        expect(totalAmount).to.equal(totalRewards)
      })

      it('Should set has started with correct value', async () => {
        const hasStarted = await deployedQuestContract.hasStarted()
        expect(hasStarted).to.equal(false)
      })

      it('Should set the end time with correct value', async () => {
        const endTime = await deployedQuestContract.endTime()
        expect(endTime).to.equal(expiryDate)
      })

      it('Should set the start time with correct value', async () => {
        const startTime = await deployedQuestContract.startTime()
        expect(startTime).to.equal(startDate)
      })

      it('Should set the allowList with correct value', async () => {
        const currentAllowList = await deployedQuestContract.allowList()
        expect(currentAllowList).to.equal(allowList)
      })
    })

    it('Deployment should set the correct owner address', async () => {
      expect(await deployedQuestContract.owner()).to.equal(owner.address)
    })
  })

  describe('start()', () => {
    it('should only allow the owner to start', async () => {
      await expect(deployedQuestContract.connect(firstAddress).start()).to.be.revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('should set start correctly', async () => {
      expect(await deployedQuestContract.hasStarted()).to.equal(false)
      await deployedQuestContract.connect(owner).start()
      expect(await deployedQuestContract.hasStarted()).to.equal(true)
    })
  })

  describe('pause()', () => {
    it('should only allow the owner to pause', async () => {
      await expect(deployedQuestContract.connect(firstAddress).pause()).to.be.revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('should set pause correctly', async () => {
      expect(await deployedQuestContract.hasStarted()).to.equal(false)
      await deployedQuestContract.connect(owner).start()
      expect(await deployedQuestContract.isPaused()).to.equal(false)
      await deployedQuestContract.connect(owner).pause()
      expect(await deployedQuestContract.isPaused()).to.equal(true)
    })
  })

  describe('unPause()', () => {
    it('should only allow the owner to pause', async () => {
      await expect(deployedQuestContract.connect(firstAddress).unPause()).to.be.revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('should set unPause correctly', async () => {
      expect(await deployedQuestContract.hasStarted()).to.equal(false)
      expect(await deployedQuestContract.isPaused()).to.equal(false)
      await deployedQuestContract.connect(owner).start()
      expect(await deployedQuestContract.isPaused()).to.equal(false)
      await deployedQuestContract.connect(owner).pause()
      expect(await deployedQuestContract.isPaused()).to.equal(true)
      await deployedQuestContract.connect(owner).unPause()
      expect(await deployedQuestContract.isPaused()).to.equal(false)
    })
  })

  describe('setAllowList()', () => {
    it('should set start correctly', async () => {
      expect(await deployedQuestContract.allowList()).to.equal(allowList)
      await deployedQuestContract.connect(owner).setAllowList('ipfs://someOtherCid')
      expect(await deployedQuestContract.allowList()).to.equal('ipfs://someOtherCid')
    })

    it('should only allow the owner to start', async () => {
      await expect(deployedQuestContract.connect(firstAddress).setAllowList('ipfs://someOtherCid')).to.be.revertedWith(
        'Ownable: caller is not the owner'
      )
    })
  })

  describe('claim()', async () => {
    it('should fail if quest has not started yet', async () => {
      expect(await deployedQuestContract.hasStarted()).to.equal(false)
      await expect(deployedQuestContract.claim()).to.be.revertedWithCustomError(questContract, 'NotStarted')
    })

    it('should fail if quest is paused', async () => {
      await deployedQuestContract.start()
      await deployedQuestContract.pause()

      await expect(deployedQuestContract.claim()).to.be.revertedWithCustomError(questContract, 'QuestPaused')
    })

    it('should fail if before start time stamp', async () => {
      await deployedQuestContract.start()
      await expect(deployedQuestContract.claim()).to.be.revertedWithCustomError(questContract, 'ClaimWindowNotStarted')
    })

    it('should fail if the contract is out of rewards', async () => {
      await deployedQuestContract.start()
      await ethers.provider.send('evm_increaseTime', [10000])
      await deployedQuestContract.withdraw()
      await expect(deployedQuestContract.claim()).to.be.revertedWithCustomError(questContract, 'AmountExceedsBalance')
      await ethers.provider.send('evm_increaseTime', [-10000])
    })

    it('should fail if there are no tokens to claim', async () => {
      await deployedQuestContract.start()
      await ethers.provider.send('evm_increaseTime', [1000])

      await expect(deployedQuestContract.claim()).to.be.revertedWithCustomError(questContract, 'NoTokensToClaim')
      await ethers.provider.send('evm_increaseTime', [-1000])
    })

    it('should only transfer the correct amount of rewards', async () => {
      await deployedRabbitholeReceiptContract.mint(owner.address, 1, questId)
      await deployedQuestContract.start()

      await ethers.provider.send('evm_increaseTime', [86400])

      const startingBalance = await deployedSampleErc1155Contract.balanceOf(owner.address, rewardAmount)
      expect(startingBalance.toString()).to.equal('0')

      const totalTokens = await deployedRabbitholeReceiptContract.getOwnedTokenIdsOfQuest(questId, owner.address)
      expect(totalTokens.length).to.equal(1)

      expect(await deployedQuestContract.isClaimed(1)).to.equal(false)

      await deployedQuestContract.claim()
      const endingBalance = await deployedSampleErc1155Contract.balanceOf(owner.address, rewardAmount)
      expect(endingBalance.toString()).to.equal('1')
      await ethers.provider.send('evm_increaseTime', [-86400])
    })

    it('should let you claim mulitiple rewards if you have multiple tokens', async () => {
      await deployedRabbitholeReceiptContract.mint(owner.address, 2, questId)
      await deployedQuestContract.start()

      await ethers.provider.send('evm_increaseTime', [86400])

      const startingBalance = await deployedSampleErc1155Contract.balanceOf(owner.address, rewardAmount)
      expect(startingBalance.toString()).to.equal('0')

      const totalTokens = await deployedRabbitholeReceiptContract.getOwnedTokenIdsOfQuest(questId, owner.address)
      expect(totalTokens.length).to.equal(2)

      expect(await deployedQuestContract.isClaimed(1)).to.equal(false)

      await deployedQuestContract.claim()
      const endingBalance = await deployedSampleErc1155Contract.balanceOf(owner.address, rewardAmount)
      expect(endingBalance.toString()).to.equal('2')
      await ethers.provider.send('evm_increaseTime', [-86400])
    })

    it('should let multiple claim if you have already claimed', async () => {
      await deployedRabbitholeReceiptContract.mint(owner.address, 3, questId)
      await deployedRabbitholeReceiptContract.transferFrom(owner.address, firstAddress.address, 2)
      await deployedRabbitholeReceiptContract.transferFrom(owner.address, secondAddress.address, 3)
      await deployedQuestContract.start()

      await ethers.provider.send('evm_increaseTime', [86400])

      const startingBalance = await deployedSampleErc1155Contract.balanceOf(owner.address, rewardAmount)
      expect(startingBalance.toString()).to.equal('0')

      const totalTokens = await deployedRabbitholeReceiptContract.getOwnedTokenIdsOfQuest(questId, owner.address)
      expect(totalTokens.length).to.equal(1)

      expect(await deployedQuestContract.isClaimed(1)).to.equal(false)

      await deployedQuestContract.claim()
      const endingBalance = await deployedSampleErc1155Contract.balanceOf(owner.address, rewardAmount)
      expect(endingBalance.toString()).to.equal('1')

      await deployedQuestContract.connect(firstAddress).claim()
      const secondEndingBalance = await deployedSampleErc1155Contract.balanceOf(firstAddress.address, rewardAmount)
      expect(secondEndingBalance.toString()).to.equal('1')

      await deployedQuestContract.connect(secondAddress).claim()
      const thirdEndingBalance = await deployedSampleErc1155Contract.balanceOf(secondAddress.address, rewardAmount)
      expect(thirdEndingBalance.toString()).to.equal('1')

      await ethers.provider.send('evm_increaseTime', [-86400])
    })

    it('should not let you claim if you have already claimed', async () => {
      await deployedRabbitholeReceiptContract.mint(owner.address, 1, questId)
      await deployedQuestContract.start()

      await ethers.provider.send('evm_increaseTime', [86400])

      const beginningContractBalance = await deployedSampleErc1155Contract.balanceOf(
        deployedQuestContract.address,
        rewardAmount
      )

      expect(beginningContractBalance.toString()).to.equal('100')

      await deployedQuestContract.claim()
      await expect(deployedQuestContract.claim()).to.be.revertedWithCustomError(questContract, 'AlreadyClaimed')
      await ethers.provider.send('evm_increaseTime', [-86400])
    })
  })

  describe('withDraw()', async () => {
    it('should only allow the owner to withdraw', async () => {
      await expect(deployedQuestContract.connect(firstAddress).withdraw()).to.be.revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('should revert if trying to withdraw before end date', async () => {
      await expect(deployedQuestContract.connect(owner).withdraw()).to.be.revertedWithCustomError(
        questContract,
        'NoWithdrawDuringClaim'
      )
    })

    it('should transfer all rewards back to owner', async () => {
      const beginningContractBalance = await deployedSampleErc1155Contract.balanceOf(
        deployedQuestContract.address,
        rewardAmount
      )
      const beginningOwnerBalance = await deployedSampleErc1155Contract.balanceOf(owner.address, rewardAmount)
      expect(beginningContractBalance.toString()).to.equal('100')
      expect(beginningOwnerBalance.toString()).to.equal('0')
      await ethers.provider.send('evm_increaseTime', [10001])
      await deployedQuestContract.connect(owner).withdraw()

      const endContactBalance = await deployedSampleErc1155Contract.balanceOf(
        deployedQuestContract.address,
        rewardAmount
      )
      expect(endContactBalance.toString()).to.equal('0')
      await ethers.provider.send('evm_increaseTime', [-10001])
    })
  })
})
