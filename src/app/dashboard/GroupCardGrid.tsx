'use client'

import React from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Users,
  CalendarDays,
  CheckCircle2,
  Clock,
  AlertCircle,
  PowerOff,
} from 'lucide-react'

export interface GroupCardGridProps {
  filteredGroups: any[]
  modoSelecao: boolean
  selecionados: string[]
  setSelecionados: React.Dispatch<React.SetStateAction<string[]>>
  onOpenNewGroup: () => void
}

function ConditionalLink({
  href,
  desativado,
  children,
}: {
  href: string
  desativado: boolean
  children: React.ReactNode
}) {
  if (desativado) return <>{children}</>
  return <Link href={href}>{children}</Link>
}

export function GroupCardGrid({
  filteredGroups,
  modoSelecao,
  selecionados,
  setSelecionados,
  onOpenNewGroup,
}: GroupCardGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filteredGroups.map((g) => (
        <div
          key={g.id}
          onClick={
            modoSelecao
              ? () =>
                  setSelecionados((prev) =>
                    prev.includes(g.id)
                      ? prev.filter((i) => i !== g.id)
                      : [...prev, g.id]
                  )
              : undefined
          }
          className={modoSelecao ? 'cursor-pointer' : ''}
        >
          <ConditionalLink href={`/${g.slug}`} desativado={modoSelecao}>
            <Card
              className={`group h-full border-border/40 transition-all duration-300 bg-card/40 cursor-pointer ${
                modoSelecao && selecionados.includes(g.id)
                  ? 'border-primary ring-2 ring-primary/40'
                  : 'hover:border-primary/50 hover:shadow-lg hover:-translate-y-1'
              }`}
            >
              <CardHeader className="flex flex-row items-center gap-4 pb-2">
                {g.picture ? (
                  <img
                    src={g.picture}
                    alt={g.name}
                    className="w-12 h-12 rounded-lg object-cover ring-1 ring-border"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-lg ring-1 ring-border/50">
                    {g.name.substring(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 overflow-hidden">
                  <CardTitle className="text-base truncate group-hover:text-primary transition-colors">
                    {g.name}
                  </CardTitle>
                  <CardDescription className="truncate text-xs">
                    {g.description || 'Sem descrição'}
                  </CardDescription>
                  {Array.isArray(g.tags) && g.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {g.tags.map((gt: any) => {
                        const tag = gt.tag || gt
                        if (!tag?.name) return null
                        return (
                          <span
                            key={tag.id || gt.tagId}
                            className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium border"
                            style={{
                              borderColor: tag.color ? `${tag.color}40` : '#6366f140',
                              backgroundColor: tag.color ? `${tag.color}15` : '#6366f115',
                              color: tag.color || '#6366f1',
                            }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: tag.color || '#6366f1' }}
                            />
                            {tag.name}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {(() => {
                  const membros = g.participantCount || g._count?.members || 0
                  const cap = g.tags?.[0]?.tag?.capacity || 1024
                  const pct = Math.min(100, Math.max(0, Math.round((membros / cap) * 100)))
                  const vagas = Math.max(0, cap - membros)
                  const barColor =
                    pct >= 95
                      ? 'bg-red-500'
                      : pct >= 80
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                  const displayCapacity =
                    membros > cap ? `${membros}/${cap}+` : `${membros}/${cap}`

                  return (
                    <div className="space-y-1.5 bg-muted/30 p-2 rounded-md mb-2">
                      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5" />
                          <span>
                            {displayCapacity} ({pct}%)
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px]">{vagas} vagas</span>
                          <span className="flex items-center gap-1">
                            <CalendarDays className="w-3.5 h-3.5" />
                            {g._count?.schedules || 0}
                          </span>
                        </div>
                      </div>
                      <Progress
                        value={pct}
                        className="h-1.5 bg-muted/60"
                        indicatorClassName={barColor}
                      />
                    </div>
                  )
                })()}

                {/* Status Badges */}
                <div className="grid grid-cols-4 gap-1 text-[10px] text-center font-bold">
                  {(() => {
                    const sent =
                      g.schedules?.filter((s: any) => s.status === 'sent').length || 0
                    const pending =
                      g.schedules?.filter((s: any) => s.status === 'pending').length || 0
                    const error =
                      g.schedules?.filter((s: any) => s.status === 'error').length || 0
                    const deactivated =
                      g.schedules?.filter((s: any) => s.status === 'deactivated').length || 0

                    return (
                      <>
                        <div
                          className="bg-green-500/10 text-green-500 rounded p-1 flex flex-col items-center justify-center border border-green-500/20"
                          title="Enviadas"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mb-0.5" /> {sent}
                        </div>
                        <div
                          className="bg-primary/10 text-primary rounded p-1 flex flex-col items-center justify-center border border-primary/20"
                          title="Pendentes"
                        >
                          <Clock className="w-3.5 h-3.5 mb-0.5" /> {pending}
                        </div>
                        <div
                          className="bg-red-500/10 text-red-500 rounded p-1 flex flex-col items-center justify-center border border-red-500/20"
                          title="Falhas"
                        >
                          <AlertCircle className="w-3.5 h-3.5 mb-0.5" /> {error}
                        </div>
                        <div
                          className="bg-muted text-muted-foreground rounded p-1 flex flex-col items-center justify-center border border-border"
                          title="Desativadas"
                        >
                          <PowerOff className="w-3.5 h-3.5 mb-0.5" /> {deactivated}
                        </div>
                      </>
                    )
                  })()}
                </div>
              </CardContent>
            </Card>
          </ConditionalLink>
        </div>
      ))}
      {filteredGroups.length === 0 && (
        <div className="col-span-full py-12 text-center text-muted-foreground bg-muted/10 rounded-lg border border-dashed border-border/50">
          <p>Nenhum grupo cadastrado nesta instância.</p>
          <Button variant="link" onClick={onOpenNewGroup}>
            Clique aqui para adicionar seu primeiro grupo
          </Button>
        </div>
      )}
    </div>
  )
}

export default GroupCardGrid
