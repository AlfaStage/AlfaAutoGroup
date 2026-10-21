'use client'

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Wifi, WifiOff, QrCode, Plus } from 'lucide-react'

export interface InstanceStatusBarProps {
  connectionState: string
  selectedInstance: string
  setSelectedInstance: (instanceName: string) => void
  instances: any[]
  onOpenQrCode: () => void
  onOpenNewInstance: () => void
}

export function InstanceStatusBar({
  connectionState,
  selectedInstance,
  setSelectedInstance,
  instances,
  onOpenQrCode,
  onOpenNewInstance,
}: InstanceStatusBarProps) {
  const isConnected = connectionState === 'open'
  const isConnecting = connectionState === 'connecting'

  return (
    <Card
      className={`border-border/40 shadow-sm backdrop-blur-sm transition-colors ${
        isConnected ? 'bg-card/60' : 'bg-red-500/5 border-red-500/30'
      }`}
    >
      <CardContent className="p-4 flex flex-wrap items-center gap-3">
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            isConnected
              ? 'bg-green-500/10 text-green-500'
              : isConnecting
                ? 'bg-yellow-500/10 text-yellow-500'
                : 'bg-red-500/10 text-red-500'
          }`}
        >
          {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          {isConnected ? 'Conectado' : isConnecting ? 'Conectando…' : 'Desconectado'}
        </div>

        <Select value={selectedInstance} onValueChange={setSelectedInstance}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="Selecione a instância…" />
          </SelectTrigger>
          <SelectContent>
            {instances.map((inst, i) => {
              const name = inst.instance?.instanceName || inst.name
              return (
                <SelectItem key={i} value={name}>
                  {name}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 ml-auto">
          {!isConnected && selectedInstance && (
            <Button variant="default" size="sm" onClick={onOpenQrCode}>
              <QrCode className="w-4 h-4 mr-2" />
              Conectar
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={onOpenNewInstance}
            title="Nova instância"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default InstanceStatusBar
