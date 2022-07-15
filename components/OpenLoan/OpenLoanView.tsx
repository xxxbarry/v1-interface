import { useState, useEffect,  Dispatch, SetStateAction, useCallback, ChangeEvent } from 'react'
import { Token } from '../Tokens'
import { CollateralType } from './CollateralType'
import SelectCollateralModal from './SelectCollateralModal'
import { FieldValues, useForm } from 'react-hook-form'
import useNotification from '../../hooks/useNotification'
import { FaInfoCircle } from 'react-icons/fa'
import { ChevronDownIcon } from '@heroicons/react/solid'
import PairsSelector from '../PairsSelector'

const style = {
  wrapper: "w-screen flex justify-center items-center",
  formContent: "bg-gray-900 w-[40rem] rounded-2xl p-4 max-w-lg",
  vStack: "items-center flex-col",
  vStackItem: "mt-3",
  formHeader: "px-2 flex justify-between items-center font-semibold text-xl text-gray-200",
  numberInputContainer: "bg-gray-800 rounded-2xl p-4 border-2 border-gray-800 hover:border-gray-600 flex justify-between w-full",
  numberInput: "bg-transparent placeholder:text-gray-600 outline-none w-full text-3xl text-gray-300",
  nonSelectedTokenContainer: "flex items-center text-gray-200",
  nonSelectedTokenContent: "w-full h-min flex justify-center items-center bg-blue-500 rounded-2xl text-xl font-medium cursor-pointer p-2 mt-[-0.2rem] shadow-lg shadow-blue-500/30 hover:bg-blue-600 hover:shadow-blue-600/30",
  tokenSelectorContainer: "flex items-center text-gray-200",
  tokenSelectorContent: "w-full h-min flex justify-between items-center bg-gray-700 rounded-2xl text-xl font-medium cursor-pointer p-2 mt-[-0.2rem] shadow-lg shadow-gray-700/30 hover:bg-gray-900 hover:shadow-gray-900/30",
  tokenSelectorIcon: "flex items-center",
  tokenSelectorTicker: "mx-2",
  dropdownArrow: "w-4 h-3",
  invalidatedButton: "disabled my-2 rounded-2xl py-4 px-6 text-xl font-semibold flex justify-center items-center text-gray-600 mt-8 border-2 border-gray-700",
  confirmButton: "bg-blue-400 my-2 rounded-2xl py-4 px-6 text-xl font-semibold flex justify-center items-center cursor-pointer text-white mt-8 border-2 border-blue-400 hover:border-blue-300",
  infoGroup: "inline-flex w-full place-content-center pt-1",
  loanInfoButton: "bg-teal-900 rounded-2xl text-slate-200 text-[8px] font-semibold inline-flex mr-2 px-2 py-1 items-center",
  infoIcon: "mr-1",
  sectionHeader: "font-semibold text-gray-200 w-full",
  collateralHeader: "inline-flex w-full place-content-start",
  collateralHeaderText: "font-semibold text-gray-200",
  selectCollateralButton: "bg-[#274060] rounded-2xl text-slate-200 text-[8px] font-semibold inline-flex px-2 py-1 items-center mx-4",
  chrevronIcon: "ml-1",
  confirmGrey: "bg-[#274060] w-full rounded-2xl text-gray-500 inline-flex place-content-center py-2 font-semibold",
  confirmInsuffBal: "bg-red-400 w-full rounded-2xl text-slate-200 inline-flex place-content-center py-2 font-semibold",
  confirmGreen: "bg-green-300 w-full rounded-2xl text-slate-200 inline-flex place-content-center py-2 font-semibold",
  confirmButtonContainer: "pb-4 w-full",
  interestRateText: "w-full text-right text-gray-200 pr-4",
  spacer: "p-5",
}

type OpenLoanProps = {
  openLoanHandler: (data: FieldValues) => Promise<void>
  token0: Token
  token1: Token
  setToken0: Dispatch<SetStateAction<Token>>
  setToken1: Dispatch<SetStateAction<Token>>
}

const OpenLoanView = ({openLoanHandler, token0, token1, setToken0, setToken1}: OpenLoanProps) => {
  const [collateralType, setCollateralType] = useState<CollateralType>(CollateralType.None)
  const [collateralButtonText, setCollateralButtonText] = useState<string>("Select collateral type")
  const [confirmStyle, setConfirmStyle] = useState<string>(style.confirmGrey)
  const [loanAmt, setLoanAmt] = useState<number>(0)
  const [loanAmtStr, setLoanAmtStr] = useState<string>('')
  const [collateralAmt0, setCollateralAmt0] = useState<number>(0)
  const [collateralAmt0Str, setCollateralAmt0Str] = useState<string>('')
  const [collateralAmt1, setCollateralAmt1] = useState<number>(0)
  const [collateralAmt1Str, setCollateralAmt1Str] = useState<string>('')
  const [showToken1, setShowToken1] = useState<boolean>(false)
  const { register, handleSubmit } = useForm()
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const { notifyError, notifySuccess } = useNotification()
    
  useEffect(() => {
      resetCollateralType()
      console.log("before validate", token0, token1)
      validate()
  }, [token0, token1])

  useEffect(() => {
    setIsOpen(false)
    console.log("selected collateral type", CollateralType[collateralType])
    setCollateralButtonText(getCollateralTypeButtonText(collateralType))
    setShowToken1(collateralType == CollateralType.Both)
    validate()
  }, [collateralType])

  function getCollateralTypeButtonText(collateralType: CollateralType) {
      switch(collateralType) {
          case CollateralType.None:
              return "Select collateral type"
          case CollateralType.LPToken:
              return "Liquidity pool tokens"
          case CollateralType.Token0:
              return token0.symbol
          case CollateralType.Token1:
              return token1.symbol
          case CollateralType.Both:
              return "Both"
          default:
              return "Select collateral type"
      }
      return ""
  }

  function resetCollateralType() {
    setCollateralType(CollateralType.None)
    setCollateralButtonText(getCollateralTypeButtonText(CollateralType.None))
    setConfirmStyle(style.confirmGrey)
    setShowToken1(false)
    setCollateralAmt1(0)
  }

  function validate() {
    if (token0 == token1) {
      console.log("Tokens must be different.", token0, token1)
      setConfirmStyle(style.confirmGrey)
      return false
    }
    if (isTokenEmpty(token1)) {
      console.log("Token must be selected.")
      setConfirmStyle(style.confirmGrey)
      return false
    }
    if (collateralType == CollateralType.None) {
      console.log("Collateral must be selected")
      setConfirmStyle(style.confirmGrey)
      return false
    }
    if (loanAmt <= 0) {
      console.log("Loan amount must be positive.")
      setConfirmStyle(style.confirmGrey)
      return false
    }
    if (collateralAmt0 <= 0) {
      console.log(token0.symbol, "collateral amount must be positive.")
      setConfirmStyle(style.confirmGrey)
      return false
    }
    if (collateralType == CollateralType.Both && collateralAmt1 <= 0) {
      console.log(token1.symbol, "collateral amount must be positive.")
      setConfirmStyle(style.confirmGrey)
      return false
    }
    console.log("Valid inputs.")
    setConfirmStyle(style.confirmGreen)
    return true
  }

  function isTokenEmpty(tokenToCheck: Token): boolean {
    return Object.values(tokenToCheck).every(tokenProp => tokenProp === "")
  }

  async function validateBeforeSubmit(data: FieldValues):Promise<void> {
    if (!validate()) {
      return
    }
    return openLoanHandler(data)
  }

  // checks for non-numeric value inputs
  const validateNumberInput = (
    e: ChangeEvent<HTMLInputElement> | string,
    setNumberInputStr: Dispatch<SetStateAction<string>>,
    setNumberInputval: Dispatch<SetStateAction<number>>

  ): void => {
    let numberInputStr: string
    if (typeof e !== "string") numberInputStr = (e.target as HTMLInputElement).value
    else numberInputStr = e
    
    var strToSet = ""
    var i = numberInputStr.indexOf('.')
    if (i >= 0 && i+1 < numberInputStr.length) {
      strToSet = numberInputStr.substring(0, i+1) + numberInputStr.substring(i+1).replace(/[^0-9]/g, '')
    } else {
      strToSet = (numberInputStr.replace(/[^0-9\.]/g, ''))
    }
    setNumberInputStr(strToSet)

    // clamp the value
    var inputVal = parseFloat(strToSet)
    if (!isNaN(inputVal)) {
      setNumberInputval(inputVal)
    }
  }

  const handleNumberInput = useCallback((
    e: ChangeEvent<HTMLInputElement> | string,
    setNumberInputStr: Dispatch<SetStateAction<string>>,
    setNumberInputval: Dispatch<SetStateAction<number>>
  ) => {
    try {
      if (e) {
        const numberInput = typeof e !== "string" ? e.target.value : e
        if (numberInput === "") {
          setNumberInputStr('')
          return
        }
        validateNumberInput(numberInput, setNumberInputStr, setNumberInputval)
      }
    } catch (error) {
      let message
      if (error instanceof Error) message = error.message
      else message = String(error)

      notifyError(message)
    }
    return null
  }, [validateNumberInput])

  return (
    <>
      <div className={style.wrapper}>
        <form className= {style.formContent} onSubmit={handleSubmit(validateBeforeSubmit)}>
          <div className={style.vStack}>
            <div className={style.formHeader}>Open Your Loan</div>
            <div className={style.vStackItem}>
              <PairsSelector token0={token0} token1={token1} setToken0={setToken0} setToken1={setToken1} />
            </div>
            <div className={style.vStackItem}>
              <div className={style.infoGroup} >
                <div className={style.loanInfoButton} onClick={() => setIsOpen(true)} >
                  <div className={style.infoIcon}><FaInfoCircle /></div>
                  MaxLTV --%
                </div>
                <div className={style.loanInfoButton} onClick={() => setIsOpen(true)} >
                <div className={style.infoIcon}><FaInfoCircle /></div>
                  Liquidation Threshold --%
                </div>
                <div className={style.loanInfoButton} onClick={() => setIsOpen(true)} >
                  <div className={style.infoIcon}><FaInfoCircle /></div>
                  Liquidation Penalty --%
                </div>
              </div>
            </div>
            <div className={style.vStackItem}>
              <div className={style.sectionHeader}>Your Loan Amount</div>
            </div>
            <div className={style.vStackItem}>
              <div className={style.numberInputContainer}>
                <input 
                  type="text" 
                  value={loanAmtStr} 
                  placeholder="0.0" 
                  className={style.numberInput}
                  {...register('loanAmt', {
                    onChange: (e) => handleNumberInput(e, setLoanAmtStr, setLoanAmt),
                    onBlur: (e) => validate()
                  })}/>
              </div>
            </div>
            <div className={style.vStackItem}>
              <div className={style.collateralHeader}>
                <div className={style.collateralHeaderText}>Your Collateral</div>
                <div className={style.selectCollateralButton} onClick={() => setIsOpen(true)} >
                  {collateralButtonText}
                  <ChevronDownIcon className={style.dropdownArrow}/>
                </div>
                <SelectCollateralModal 
                    token0={token0} 
                    token1={token1} 
                    isOpen={isOpen} 
                    setIsOpen={setIsOpen}
                    setCollateralType={setCollateralType} 
                />
              </div>
            </div>
            <div className={style.vStackItem}>
              <div className={style.numberInputContainer}>
                <input 
                  type="text" 
                  value={collateralAmt0Str} 
                  placeholder="0.0" 
                  className={style.numberInput}
                  {...register('collateralAmt0', {
                    onChange: (e) => handleNumberInput(e, setCollateralAmt0Str, setCollateralAmt0),
                    onBlur: (e) => validate()
                  })} />
              </div>
            </div>
            <div className={style.vStackItem}>
              { showToken1 ? 
              <div className={style.numberInputContainer}>
                <input 
                  type="text" 
                  value={collateralAmt1Str} 
                  placeholder="0.0" 
                  className={style.numberInput}
                  {...register('collateralAmt1', {
                    onChange: (e) => handleNumberInput(e, setCollateralAmt1Str, setCollateralAmt1),
                    onBlur: (e) => validate()
                  })} />
              </div>
              : null }
            </div>
            <div className={style.vStackItem}>
              <div className={style.spacer} />
            </div>
            <div className={style.vStackItem}>
              <div className={style.interestRateText}>
                Interest Rate --%
              </div>
            </div>
            <div className={style.vStackItem}>
              <button className={confirmStyle} type="submit">
                Confirm
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  )
}

export default OpenLoanView