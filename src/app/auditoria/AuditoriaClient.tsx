'use client'

import { useState } from 'react'
import PainelAuditoriaMembros from '@/components/PainelAuditoriaMembros'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tags } from 'lucide-react'

export default function AuditoriaClient({
  tags = []
}: {
  tags?: Array<{ id: string; name: string; color: string }>
}) {
  const [tagFiltro, setTagFiltro] = useState<string>('todas')

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
        <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
          <Tags className="w-4 h-4 text-primary shrink-0" />
          <span>Filtre a auditoria de membros duplicados e distribuição de DDDs por Tag ou veja todos os grupos:</span>
        </div>
        <div className="w-full sm:w-64">
          <Select value={tagFiltro} onValueChange={setTagFiltro}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Filtrar por Tag..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as Tags (Visão Global)</SelectItem>
              {tags.map(t => (
                <SelectItem key={t.id} value={t.id}>
                  <span className="inline-flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: t.color }} />
                    {t.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <PainelAuditoriaMembros tagId={tagFiltro !== 'todas' ? tagFiltro : undefined} />
    </div>
  )
}
