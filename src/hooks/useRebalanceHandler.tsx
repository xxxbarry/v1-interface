import { ChangeEvent, Dispatch, SetStateAction, useCallback, useContext, useEffect, useState } from 'react'
import Tokens, { Token } from '../components/Tokens'
import { WalletContext } from '../context/WalletContext'
import PositionManager from '../../abis/v1-periphery/PositionManager.sol/PositionManager.json'
import GammaPool from '../../abis/v1-core/GammaPool.sol/GammaPool.json'
import { Contract, ethers } from 'ethers'
import { notifySuccess, notifyError } from '../hooks/useNotification'
import { getTokenBalance } from '../utils/getSmartContract'

export const useRebalanceHandler = () => {
  const { accountInfo, connectWallet, provider } = useContext(WalletContext)

  const POSITION_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_POSITION_MANAGER_ADDRESS
  const GAMMAPOOL_ADDRESS = process.env.NEXT_PUBLIC_GAMMAPOOL_ADDRESS
  const CFMM_ADDRESS = process.env.NEXT_PUBLIC_CFMM_ADDRESS

  const [tokenAInputVal, setTokenAInputVal] = useState<string>('')
  const [tokenBInputVal, setTokenBInputVal] = useState<string>('')

  const [tokenASelected, setTokenASelected] = useState<Token>(Tokens[0])
  const [tokenBSelected, setTokenBSelected] = useState<Token>({
    imgPath: '',
    symbol: '',
    address: '',
    decimals: 18,
  })
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [tokenSelected, setTokenSelected] = useState<string>('')
  const [isSlippageOpen, setIsSlippageOpen] = useState<boolean>(false)
  const [slippage, setSlippage] = useState<string>('')
  const [slippageMinutes, setSlippageMinutes] = useState<string>('')

  const [posManager, setPosManager] = useState<Contract | null>(null)
  const [gammaPool, setGammaPool] = useState<Contract | null>(null)
  const [loanLiquidity, setLoanLiquidity] = useState<string>('')
  const [tokenABalance, setTokenABalance] = useState<string>('0')
  const [tokenBBalance, setTokenBBalance] = useState<string>('0')

  const openSlippage = () => {
    setIsSlippageOpen((prevState) => !prevState)
  }

  const getTokenBalanceAsync = async (setTokenBalance: Dispatch<SetStateAction<string>>, token: Token) => {
    if (provider && token.address) {
      let accountAddress = accountInfo?.address || ''
      let balance = await getTokenBalance(accountAddress, token.address, token.symbol, provider)
      setTokenBalance(balance || '0')
    }
  }

  useEffect(() => {
    getTokenBalanceAsync(setTokenABalance, tokenASelected)
  }, [provider, tokenASelected])

  useEffect(() => {
    getTokenBalanceAsync(setTokenBBalance, tokenBSelected)
  }, [provider, tokenBSelected])

  const handleSlippageMinutes = (e: ChangeEvent<HTMLInputElement> | string) => {
    let minuteInput: string
    if (typeof e !== 'string') minuteInput = (e.target as HTMLInputElement).value
    else minuteInput = e
    let strToSet = ''
    let i = minuteInput.indexOf('.')
    if (i >= 0 && i + 1 < minuteInput.length) {
      strToSet = minuteInput.substring(0, i + 1) + minuteInput.substring(i + 1).replace(/[^0-9]/g, '')
    } else {
      strToSet = minuteInput.replace(/[^0-9\.]/g, '')
    }
    if (strToSet === '') {
      setSlippageMinutes('')
    } else {
      setSlippageMinutes(strToSet)
    }
  }

  const handleSlippageInput = (e: ChangeEvent<HTMLInputElement> | string) => {
    let slippageInput: string
    if (typeof e !== 'string') slippageInput = (e.target as HTMLInputElement).value
    else slippageInput = e
    let strToSet = ''
    let i = slippageInput.indexOf('.')
    if (i >= 0 && i + 1 < slippageInput.length) {
      strToSet = slippageInput.substring(0, i + 1) + slippageInput.substring(i + 1).replace(/[^0-9]/g, '')
    } else {
      strToSet = slippageInput.replace(/[^0-9\.]/g, '')
    }
    if (strToSet === '') {
      setSlippage('')
    } else if (parseInt(strToSet) <= 100) {
      setSlippage(strToSet)
    }
  }

  const validateTokenInput = (
    e: ChangeEvent<HTMLInputElement> | string,
    setToken: Dispatch<SetStateAction<string>>
  ): void => {
    let tokenInput: string
    if (typeof e !== 'string') tokenInput = (e.target as HTMLInputElement).value
    else tokenInput = e
    let strToSet = ''
    let i = tokenInput.indexOf('.')
    if (i >= 0 && i + 1 < tokenInput.length) {
      strToSet = tokenInput.substring(0, i + 1) + tokenInput.substring(i + 1).replace(/[^0-9]/g, '')
    } else {
      strToSet = tokenInput.replace(/[^0-9\.]/g, '')
    }
    setToken(strToSet)
  }

  const handleTokenInput = useCallback(
    (
      e: ChangeEvent<HTMLInputElement> | string,
      setTokenInputVal: Dispatch<SetStateAction<string>>,
      setCounterTokenInputVal: Dispatch<SetStateAction<string>>
    ) => {
      try {
        if (e) {
          const tokenInput = typeof e !== 'string' ? e.target.value : e
          if (tokenInput === '') {
            setTokenInputVal('')
            setCounterTokenInputVal('')
            return
          }

          validateTokenInput(tokenInput, setTokenInputVal)
        }
      } catch (error) {
        let message
        if (error instanceof Error) message = error.message
        else message = String(error)
        notifyError(message)
      }
      return null
    },
    [validateTokenInput]
  )

  const handleTokenSelector = (tokenSelected: string): void => {
    setTokenSelected(tokenSelected)
    setIsOpen(true)
  }

  const isTokenEmpty = (tokenToCheck: Token): boolean => {
    return Object.values(tokenToCheck).every((tokenProp) => tokenProp === '' || tokenProp === 18)
  }

  const changeSlippagePercent = (data: string) => {
    setSlippage(data)
  }

  const swapTokenInputs = () => {
    let tokenA = tokenASelected
    let tokenB = tokenBSelected
    let tokenAVal = tokenAInputVal
    let tokenBVal = tokenBInputVal
    setTokenASelected(tokenB)
    setTokenAInputVal(tokenBVal)
    setTokenBSelected(tokenA)
    setTokenBInputVal(tokenAVal)
  }

  const rebalance = () => {
    if (!tokenAInputVal || !tokenBInputVal) {
      notifyError('Please enter a valid token value')
      return
    }
    let liquidityLoan = loanLiquidity
    if (!liquidityLoan) {
      getLoan()
        .then((res) => {
          setLoanLiquidity(res.liquidity.toString())
          liquidityLoan = res.liquidity.toString()
        })
        .catch((err) => {
          notifyError('An error occurred while getting loan')
          console.log(err)
        })
    }
    // TODO: Hardcoded the tokenId value. We will get it from subgraph when we query user's positions
    doRebalance(19, parseFloat(liquidityLoan))
      .then((result) => {
        notifySuccess('Rebalance was successfully')
        console.log(result)
      })
      .catch((err) => {
        notifyError('An error occurred while Rebalance Collateral')
        console.log(err)
      })
  }

  const doRebalance = async (tokenId: number, liquidity: number) => {
    if (posManager) {
      const RebalanceCollateralParams = {
        cfmm: CFMM_ADDRESS,
        protocol: 1,
        tokenId: tokenId,
        deltas: [tokenAInputVal, tokenBInputVal],
        liquidity: liquidity,
        to: accountInfo?.address,
        deadline: ethers.constants.MaxUint256,
      }
      try {
        const tx = await posManager.rebalanceCollateral(RebalanceCollateralParams)
        return await tx.wait()
      } catch (e) {
        throw e
      }
    }
  }

  useEffect(() => {
    if (!posManager && provider) {
      let _posManager = new ethers.Contract(
        POSITION_MANAGER_ADDRESS || '',
        PositionManager.abi,
        accountInfo && accountInfo?.address ? provider.getSigner(accountInfo?.address) : provider
      )
      setPosManager(_posManager)
    }
  }, [posManager, provider])

  useEffect(() => {
    if (!gammaPool && provider) {
      let _gammaPool = new ethers.Contract(
        GAMMAPOOL_ADDRESS || '',
        GammaPool.abi,
        accountInfo && accountInfo?.address ? provider.getSigner(accountInfo?.address) : provider
      )
      setGammaPool(_gammaPool)
    }
  }, [gammaPool, provider])

  const getLoan = useCallback(async () => {
    if (posManager) {
      try {
        let cfmm_address = CFMM_ADDRESS
        if (!cfmm_address && gammaPool) {
          cfmm_address = await gammaPool.cfmm()
          console.log(cfmm_address)
        }
        // TODO: Hardcoded the tokenId value. We will get it from subgraph when we query user's positions
        return await posManager.loan(cfmm_address, 1, 19)
      } catch (e) {
        throw e
      }
    }
  }, [posManager, gammaPool])

  useEffect(() => {
    getLoan()
      .then((res) => {
        if (res) {
          setLoanLiquidity(res.liquidity.toString())
        }
      })
      .catch((err) => {
        notifyError('An error occurred while getting loan')
        console.log(err)
      })
  }, [posManager, gammaPool])

  return {
    tokenAInputVal,
    setTokenAInputVal,
    tokenBInputVal,
    setTokenBInputVal,
    handleTokenInput,
    tokenASelected,
    setTokenASelected,
    tokenBSelected,
    setTokenBSelected,
    isOpen,
    setIsOpen,
    tokenSelected,
    handleTokenSelector,
    isTokenEmpty,
    accountInfo,
    connectWallet,
    isSlippageOpen,
    openSlippage,
    slippage,
    handleSlippageInput,
    slippageMinutes,
    handleSlippageMinutes,
    changeSlippagePercent,
    swapTokenInputs,
    rebalance,
    tokenABalance,
    tokenBBalance,
  }
}
