"use client"

import { useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils/loan-calculator"

interface VerificationMismatchDialogProps {
  isOpen: boolean
  periodKey: string
  method1Label: string
  method1Value: number
  method2Label: string
  method2Value: number
  onSelectMethod: (method: 1 | 2) => void
  onCancel: () => void
}

export function VerificationMismatchDialog({
  isOpen,
  periodKey,
  method1Label,
  method1Value,
  method2Label,
  method2Value,
  onSelectMethod,
  onCancel,
}: VerificationMismatchDialogProps) {
  const discrepancy = Math.abs(method1Value - method2Value)
  const method1Highlighted = method1Value > method2Value

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-amber-600">Balance Verification Mismatch</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3 pt-2">
            <div className="text-sm">
              <p className="font-medium text-foreground mb-2">Period: {periodKey}</p>
              <p className="text-xs text-muted-foreground mb-3">
                Two calculation methods returned different values. Choose which to use:
              </p>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => onSelectMethod(1)}
                className={`w-full p-2 rounded border-2 text-left text-sm transition ${
                  method1Highlighted
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 bg-slate-50 hover:border-slate-300"
                }`}
              >
                <div className="font-medium">METHOD 1: {method1Label}</div>
                <div className="text-sm font-semibold text-blue-600">{formatCurrency(method1Value)}</div>
              </button>

              <button
                onClick={() => onSelectMethod(2)}
                className={`w-full p-2 rounded border-2 text-left text-sm transition ${
                  !method1Highlighted
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 bg-slate-50 hover:border-slate-300"
                }`}
              >
                <div className="font-medium">METHOD 2: {method2Label}</div>
                <div className="text-sm font-semibold text-blue-600">{formatCurrency(method2Value)}</div>
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded p-2">
              <p className="text-xs text-amber-800">
                <strong>Discrepancy:</strong> {formatCurrency(discrepancy)}
              </p>
              <p className="text-xs text-amber-700 mt-1">⚠️ Proceed at your own risk</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="h-8">Cancel</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
