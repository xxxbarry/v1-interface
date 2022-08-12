import * as React from 'react'
import {useState, useEffect, useContext} from 'react'
import {WalletContext} from '../context/WalletContext'
import {ethers, Contract, BigNumber, constants} from 'ethers'
import DepPool from '../../abis/v0-hackathon/DepositPool.json'
import IUniswapV2Pair from '../../abis/v0-hackathon/IUniswapV2Pair.json'
import IERC20 from '../../abis/v0-hackathon/ERC20.json'
import IERC20Metadata from '../../abis/v0-hackathon/IERC20Metadata.json'
import {sqrt} from '../utils/mathFunctions'
import Tokens, {Token} from '../components/Tokens'

const ZEROMIN = 0

export const useWithdrawLiquidityHandler = () => {
  const [depPool, setdepPool] = useState<Contract | null>(null)
  const [sliderPercentage, setsliderPercentage] = useState<number>(0)
  const {provider, accountInfo} = useContext(WalletContext)
  const [uniPrice, setUniPrice] = useState<string>('0')
  const [liquidityAmt, setLiquidityAmt] = useState<number>(0)
  const [totalLiquidityAmt, setTotalLiquidityAmt] = useState<string>('0')
  const [liqInTokB, setLiqInTokB] = useState<number>(0)
  const [token0, setToken0] = useState<Token>(Tokens[0])
  const [token1, setToken1] = useState<Token>(Tokens[1])
  const [enableRemove, setEnableRemove] = useState<Boolean>(false)

  async function changeSliderPercentage(percentage: number) {
    setsliderPercentage(percentage)
  }

  async function sliderPercentChange(value: number | number[]) {
    if (typeof value === 'number') {
      setsliderPercentage(value)
    }
  }

  async function approveTransaction() {
    // Deposit pool contract address
    let address = process.env.NEXT_PUBLIC_DEPOSIT_POOL_ADDRESS
    if (provider && address) {
      if (accountInfo && accountInfo?.address) {
        setdepPool(new ethers.Contract(address, DepPool.abi, provider.getSigner(accountInfo?.address)))
      } else {
        setdepPool(new ethers.Contract(address, DepPool.abi, provider))
      }
    } else {
      console.log('Please connect wallet')
    }

    if (!accountInfo || !accountInfo.address) {
      console.log('Wallet not connected.')
      return
    }

    if (depPool === null) {
      return
    }
    approveWithdraw(depPool, depPool.address)
      .then(() => {
        setEnableRemove(true)
      })
      .catch((err: any) => {
        setEnableRemove(false)
        console.log(err)
      })
  }

  async function withdrawLiquidity(balance: number) {
    let amt = '0'
    if (balance === 100) {
      amt = totalLiquidityAmt.toString()
    } else {
      amt = ethers.utils.parseEther(((liquidityAmt * balance) / 100).toString()).toString()
    }
    // Deposit pool contract address
    let address = process.env.NEXT_PUBLIC_DEPOSIT_POOL_ADDRESS
    if (provider && address) {
      if (accountInfo && accountInfo?.address) {
        setdepPool(new ethers.Contract(address, DepPool.abi, provider.getSigner(accountInfo?.address)))
      } else {
        setdepPool(new ethers.Contract(address, DepPool.abi, provider))
      }
    } else {
      console.log('Please connect wallet')
    }

    if (!accountInfo || !accountInfo.address) {
      console.log('Wallet not connected.')
      return
    }

    if (depPool === null) {
      return
    }

    try {
      let tx = await depPool.removeLiquidity(amt, ZEROMIN, ZEROMIN, accountInfo.address, {
        gasLimit: 10000000,
      })
      return await tx.wait()
    } catch (e) {
      return e
    }
  }

  async function approveWithdraw(depPool: Contract | null, depPoolAddr: string) {
    if (!accountInfo || !accountInfo.address) {
      console.log('Wallet not connected.')
      return
    }
    if (depPool === null) {
      return null
    } else {
      if (provider !== null) {
        try {
          let tx = await depPool.approve(depPoolAddr, constants.MaxUint256.toString())
          return await tx.wait()
        } catch (e) {
          throw e
        }
      } else {
        console.log('Please connect wallet')
      }
    }
  }

  async function approve(fromToken: string, toAddr: string) {
    if (!provider) {
      console.log('provider or accountInfo not set')
      return
    }
    if (!accountInfo || !accountInfo.address) {
      console.log('Wallet not connected.')
      return
    }
    if (depPool === null) {
      return
    }
    let erc20 = new ethers.Contract(fromToken, IERC20.abi, provider.getSigner(accountInfo?.address))
    let allowance = await erc20
      .allowance(accountInfo.address, toAddr)
      .then((res: string) => {
        console.log('check allowance ', res.toString())
        return res
      })
      .catch((err: Error) => {
        console.error('checkAllowance', err)
      })
    if (parseFloat(allowance.toString()) <= 0) {
      await erc20.approve(toAddr, constants.MaxUint256)
    }
  }

  useEffect(() => {
    async function fetchContract() {
      if (!provider) {
        console.log('Please connect wallet.')
        return
      }

      // Deposit pool contract address
      let address = process.env.NEXT_PUBLIC_DEPOSIT_POOL_ADDRESS

      if (provider && address) {
        // Variable to hold deposit pool contract
        let _depPool = null

        _depPool = new ethers.Contract(address, DepPool.abi, accountInfo && accountInfo?.address ? provider.getSigner(accountInfo?.address) : provider)
        if (_depPool) {
          setdepPool(_depPool)
        }
      } else {
        console.log('Please connect wallet')
      }
    }
    fetchContract()
  }, [provider])

  useEffect(() => {
    async function fetchData() {
      if (!depPool) {
        return
      }
      const liqBal = await depPool.balanceOf(accountInfo?.address)
      setTotalLiquidityAmt(liqBal.toString())
      setLiquidityAmt(parseFloat(ethers.utils.formatEther(liqBal)))

      const uniPair = await depPool.getUniPair()
      if (!provider) {
        return
      }

      const uniPairContract = new ethers.Contract(uniPair, IUniswapV2Pair.abi, provider)
      const reserves = await uniPairContract.getReserves()
      const _uniPrice = BigNumber.from(reserves.reserve1).mul(BigNumber.from(10).pow(18)).div(reserves.reserve0)
      setUniPrice(_uniPrice.toString())
      const liqBalNum = BigNumber.from(liqBal.toString())

      if (liqBalNum.gt(constants.Zero) && _uniPrice.gt(constants.Zero)) {
        setLiqInTokB(
          parseFloat(
            ethers.utils.formatEther(
              sqrt(_uniPrice.mul(BigNumber.from(10).pow(18)))
                .mul(liqBalNum)
                .div(BigNumber.from(10).pow(18))
                .mul(2)
            )
          )
        )
      } else {
        setLiqInTokB(0)
      }
    }

    // TODO: This section is commented because we do not have a factory of all the tokens. Once that is integrated then we will add the logic to get the tokens from the contract. For now we are getting the tokens from the token file
    // async function initializeTokens() {
    //   if (depPool !== null && provider !== null) {
    //     // Variable to hold address of token0
    //     let token0Addr = null

    //     // Variable to hold address of token1
    //     let token1Addr = null

    //     // Variable to hold contract token0
    //     let _token0: Contract

    //     // Variable to hold contract token0
    //     let _token1: Contract

    //     // Variable to hold symbol of token0
    //     let symbol0 = null

    //     // Variable to hold symbol of token1
    //     let symbol1 = null

    //     token0Addr = await depPool.token0()
    //     token1Addr = await depPool.token1()

    //     if (token0Addr) {
    //       _token0 = new ethers.Contract(token0Addr, IERC20Metadata.abi, accountInfo && accountInfo?.address ? provider.getSigner(accountInfo?.address) : provider)
    //       symbol0 = await _token0.symbol()
    //       setToken0({address: token0Addr, symbol: symbol0, contract: _token0})
    //     }

    //     if (token1Addr) {
    //       _token1 = new ethers.Contract(token1Addr, IERC20Metadata.abi, accountInfo && accountInfo?.address ? provider.getSigner(accountInfo?.address) : provider)
    //       symbol1 = await _token1.symbol()
    //       setToken1({address: token1Addr, symbol: symbol1, contract: _token1})
    //     }
    //   }
    // }

    // initializeTokens()
    fetchData()
  }, [depPool])

  return {
    sliderPercentage,
    changeSliderPercentage,
    sliderPercentChange,
    withdrawLiquidity,
    approveTransaction,
    token0,
    token1,
    liquidityAmt,
    liqInTokB,
    enableRemove,
  }
}
