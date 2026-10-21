'use client'

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle2, Clock, AlertCircle, PowerOff } from 'lucide-react'

export interface DashboardKpisProps {
  totalSent: number
  totalPending: number
  totalError: number
  totalDeactivated: number
}

export function DashboardKpis({
  totalSent,
  totalPending,
  totalError,
  totalDeactivated,
}: DashboardKpisProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card className="border-border/40 shadow-sm bg-green-500/5">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-green-600/80 uppercase">Enviadas</p>
            <p className="text-2xl font-bold mt-1 text-green-600">{totalSent}</p>
          </div>
          <div className="p-2 bg-green-500/10 rounded-full">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/40 shadow-sm bg-primary/5">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-primary/80 uppercase">Pendentes</p>
            <p className="text-2xl font-bold mt-1 text-primary">{totalPending}</p>
          </div>
          <div className="p-2 bg-primary/10 rounded-full">
            <Clock className="w-5 h-5 text-primary" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/40 shadow-sm bg-red-500/5">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-red-600/80 uppercase">Com Falha</p>
            <p className="text-2xl font-bold mt-1 text-red-600">{totalError}</p>
          </div>
          <div className="p-2 bg-red-500/10 rounded-full">
            <AlertCircle className="w-5 h-5 text-red-500" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/40 shadow-sm bg-muted/20">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase">Desativadas</p>
            <p className="text-2xl font-bold mt-1 text-foreground">{totalDeactivated}</p>
          </div>
          <div className="p-2 bg-muted rounded-full">
            <PowerOff className="w-5 h-5 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default DashboardKpis
