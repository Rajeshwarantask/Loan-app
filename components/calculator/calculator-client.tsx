"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export function CalculatorClient() {
  // Regular Calculator State
  const [display, setDisplay] = useState("0")
  const [previousValue, setPreviousValue] = useState<number | null>(null)
  const [operation, setOperation] = useState<string | null>(null)
  const [waitingForNewValue, setWaitingForNewValue] = useState(false)

  // Loan Calculator State
  const [loanAmount, setLoanAmount] = useState("")
  const [emi, setEmi] = useState("5000")
  const [interest, setInterest] = useState("")
  const [subscription, setSubscription] = useState("2100")
  const [loanTotal, setLoanTotal] = useState<number | null>(null)

  // Regular Calculator Functions
  const handleNumberClick = (num: string) => {
    if (waitingForNewValue) {
      setDisplay(num)
      setWaitingForNewValue(false)
    } else {
      setDisplay(display === "0" ? num : display + num)
    }
  }

  const handleDecimal = () => {
    if (!display.includes(".")) {
      setDisplay(display + ".")
      setWaitingForNewValue(false)
    }
  }

  const handleOperation = (op: string) => {
    const currentValue = parseFloat(display)

    if (previousValue === null) {
      setPreviousValue(currentValue)
    } else if (operation) {
      const result = calculate(previousValue, currentValue, operation)
      setDisplay(String(result))
      setPreviousValue(result)
    }

    setOperation(op)
    setWaitingForNewValue(true)
  }

  const calculate = (prev: number, current: number, op: string): number => {
    switch (op) {
      case "+":
        return prev + current
      case "-":
        return prev - current
      case "*":
        return prev * current
      case "/":
        return prev / current
      default:
        return current
    }
  }

  const handleEquals = () => {
    if (previousValue !== null && operation) {
      const result = calculate(previousValue, parseFloat(display), operation)
      setDisplay(String(result))
      setPreviousValue(null)
      setOperation(null)
      setWaitingForNewValue(true)
    }
  }

  const handleClear = () => {
    setDisplay("0")
    setPreviousValue(null)
    setOperation(null)
    setWaitingForNewValue(false)
  }

  const handleBackspace = () => {
    if (display.length === 1) {
      setDisplay("0")
    } else {
      setDisplay(display.slice(0, -1))
    }
  }

  // Loan Calculator Functions
  const handleLoanAmountChange = (value: string) => {
    setLoanAmount(value)
    // Automatically calculate 1.5% interest
    if (value) {
      const amount = parseFloat(value) || 0
      const calculatedInterest = (amount * 1.5) / 100
      setInterest(calculatedInterest.toString())
    } else {
      setInterest("")
    }
  }

  // Live calculation effect
  useEffect(() => {
    const loanAmountVal = parseFloat(loanAmount) || 0
    const emiVal = parseFloat(emi) || 0
    const subscriptionVal = parseFloat(subscription) || 0

    if (loanAmountVal > 0) {
      // Calculate interest on the loan amount (1.5%)
      const calculatedInterest = (loanAmountVal * 1.5) / 100
      setInterest(calculatedInterest.toFixed(2))
      
      // Calculate total payment (EMI + Interest + Subscription)
      const total = emiVal + calculatedInterest + subscriptionVal
      setLoanTotal(total)
    } else {
      setInterest("")
      setLoanTotal(null)
    }
  }, [loanAmount, emi, subscription])

  return (
    <div className="w-full max-w-2xl mx-auto">
      <Tabs defaultValue="loan" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="loan">Loan Calculator</TabsTrigger>
          <TabsTrigger value="regular">Regular Calculator</TabsTrigger>
        </TabsList>

        {/* Loan Calculator Tab */}
        <TabsContent value="loan" className="space-y-6">
          <Card className="p-8">
            <h3 className="text-2xl font-semibold mb-8">Loan Calculator</h3>

            <div className="space-y-6">
              {/* Single Row: Loan Amount, Interest, EMI, Subscription */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Loan Amount */}
                <div>
                  <Label className="text-sm font-semibold text-slate-700">Loan Amount</Label>
                  <Input
                    type="number"
                    placeholder="100000"
                    value={loanAmount}
                    onChange={(e) => handleLoanAmountChange(e.target.value)}
                    className="mt-2 text-center border-2 border-blue-500 focus:border-blue-600 text-lg font-semibold py-2 rounded-lg"
                  />
                </div>

                {/* Interest (Read-only) */}
                <div>
                  <Label className="text-sm font-medium text-slate-600">Interest (1.5%)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={interest}
                    className="mt-2 text-center border-2 border-slate-200 rounded-lg text-lg font-semibold py-2 bg-slate-100 text-slate-600"
                    readOnly
                  />
                </div>

                {/* EMI */}
                <div>
                  <Label className="text-sm font-medium text-slate-600">EMI</Label>
                  <Input
                    type="number"
                    placeholder="5000"
                    value={emi}
                    onChange={(e) => setEmi(e.target.value)}
                    className="mt-2 text-center border-2 border-blue-500 focus:border-blue-600 rounded-lg text-lg font-semibold py-2"
                  />
                </div>

                {/* Subscription */}
                <div>
                  <Label className="text-sm font-medium text-slate-600">Subscription</Label>
                  <Input
                    type="number"
                    placeholder="2100"
                    value={subscription}
                    onChange={(e) => setSubscription(e.target.value)}
                    className="mt-2 text-center border-2 border-blue-500 focus:border-blue-600 rounded-lg text-lg font-semibold py-2"
                  />
                </div>
              </div>

              {/* Total Result - Compact Display */}
              {loanTotal !== null && (
                <div className="mt-6 p-3 rounded-lg border-2 border-blue-400 bg-blue-50 w-fit">
                  <p className="text-lg font-bold text-blue-600">₹{loanTotal.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</p>
                </div>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* Regular Calculator Tab */}
        <TabsContent value="regular" className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Calculator</h3>

            <div className="space-y-4">
              {/* Keyboard Input Display */}
              <div>
                <Label htmlFor="calc-input">Enter Expression</Label>
                <Input
                  id="calc-input"
                  type="text"
                  value={display}
                  onChange={(e) => setDisplay(e.target.value)}
                  placeholder="Type your calculation (e.g., 5+3*2)"
                  className="text-lg font-mono p-4 mt-1"
                />
              </div>

              {/* Calculator Buttons Grid */}
              <div className="grid grid-cols-4 gap-2">
                {/* Row 1 */}
                <Button variant="outline" onClick={handleClear} className="col-span-2 bg-transparent">
                  Clear
                </Button>
                <Button variant="outline" onClick={() => handleOperation("/")}>
                  ÷
                </Button>
                <Button variant="outline" onClick={() => handleOperation("*")}>
                  ×
                </Button>

                {/* Row 2 */}
                <Button variant="outline" onClick={() => handleNumberClick("7")}>
                  7
                </Button>
                <Button variant="outline" onClick={() => handleNumberClick("8")}>
                  8
                </Button>
                <Button variant="outline" onClick={() => handleNumberClick("9")}>
                  9
                </Button>
                <Button variant="outline" onClick={() => handleOperation("-")}>
                  −
                </Button>

                {/* Row 3 */}
                <Button variant="outline" onClick={() => handleNumberClick("4")}>
                  4
                </Button>
                <Button variant="outline" onClick={() => handleNumberClick("5")}>
                  5
                </Button>
                <Button variant="outline" onClick={() => handleNumberClick("6")}>
                  6
                </Button>
                <Button variant="outline" onClick={() => handleOperation("+")}>
                  +
                </Button>

                {/* Row 4 */}
                <Button variant="outline" onClick={() => handleNumberClick("1")}>
                  1
                </Button>
                <Button variant="outline" onClick={() => handleNumberClick("2")}>
                  2
                </Button>
                <Button variant="outline" onClick={() => handleNumberClick("3")}>
                  3
                </Button>
                <Button variant="outline" onClick={handleBackspace} className="row-span-2 bg-transparent">
                  ⌫
                </Button>

                {/* Row 5 */}
                <Button variant="outline" onClick={() => handleNumberClick("0")} className="col-span-2">
                  0
                </Button>
                <Button variant="outline" onClick={handleDecimal}>
                  .
                </Button>

                {/* Equals */}
                <Button onClick={handleEquals} className="col-span-4 mt-2">
                  =
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
