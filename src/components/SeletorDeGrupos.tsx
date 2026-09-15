'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Tag as TagIcon, CheckSquare, Square, Loader2 } from 'lucide-react'

/**
 * Seletor de grupos usado em todo lugar que precisa escolher varios grupos.
 *
 * O ponto principal: alem de marcar um por um, da para escolher por tag —
 * um clique traz todos os grupos daquela tag. Quem ja organizou os grupos em
 * "Salvador", "Feira" ou "Depilação" nao precisa repetir o trabalho a cada
 * disparo.
 */

export type GrupoSelecionavel = {
  id: string
  name: string
  participantCount?: number
  instanceName?: string | null
  _count?: { members?: number }
}

type TagResumo = {
  id: string
  name: string
  color: string
  grupos: { id: string }[]
  totalGrupos: number
}

export default function SeletorDeGrupos({
  grupos,
  selecionados,
  onChange,
  /** Filtra as tags pelas que têm ao menos um grupo da lista visível. */
  instanceName,
  altura = 'max-h-[260px]'
}: {
  grupos: GrupoSelecionavel[]
  selecionados: string[]
  onChange: (ids: string[]) => void
  instanceName?: string
  altura?: string
}) {
  const [busca, setBusca] = useState('')
  const [tags, setTags] = useState<TagResumo[]>([])
  const [carregandoTags, setCarregandoTags] = useState(true)

  useEffect(() => {
    let ativo = true
    fetch('/api/tags')
      .then(r => (r.ok ? r.json() : []))
      .then(d => { if (ativo) setTags(Array.isArray(d) ? d : []) })
      .catch(() => { /* sem tags o seletor ainda funciona */ })
      .finally(() => { if (ativo) setCarregandoTags(false) })
    return () => { ativo = false }
  }, [])

  const idsVisiveis = useMemo(() => new Set(grupos.map(g => g.id)), [grupos])

  // Só mostra tags que tocam os grupos desta tela
  const tagsUteis = useMemo(
    () => tags
      .map(t => ({ ...t, idsAqui: t.grupos.map(g => g.id).filter(id => idsVisiveis.has(id)) }))
      .filter(t => t.idsAqui.length > 0),
    [tags, idsVisiveis]
  )

  const termo = busca.trim().toLowerCase()
  const filtrados = termo
    ? grupos.filter(g => g.name.toLowerCase().includes(termo))
    : grupos

  const alternar = useCallback((id: string) => {
    onChange(
      selecionados.includes(id)
        ? selecionados.filter(x => x !== id)
        : [...selecionados, id]
    )
  }, [selecionados, onChange])

  const aplicarTag = (idsDaTag: string[]) => {
    const todosJa = idsDaTag.every(id => selecionados.includes(id))
    onChange(
      todosJa
        ? selecionados.filter(id => !idsDaTag.includes(id))
        : Array.from(new Set([...selecionados, ...idsDaTag]))
    )
  }

  const idsFiltrados = filtrados.map(g => g.id)
  const todosFiltradosMarcados =
    idsFiltrados.length > 0 && idsFiltrados.every(id => selecionados.includes(id))

  return (
    <div className="space-y-3">
      {/* ------------------------------------------------- por tag */}
      {(carregandoTags || tagsUteis.length > 0) && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TagIcon className="w-3.5 h-3.5" />
            Escolher por tag
            {carregandoTags && <Loader2 className="w-3 h-3 animate-spin" />}
          </div>
          <div className="flex flex-wrap gap-2">
            {tagsUteis.map(t => {
              const todosJa = t.idsAqui.every(id => selecionados.includes(id))
              const algunsJa = !todosJa && t.idsAqui.some(id => selecionados.includes(id))
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => aplicarTag(t.idsAqui)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 transition-colors ${
                    todosJa
                      ? 'border-transparent text-white'
                      : algunsJa
                        ? 'border-primary/50 bg-primary/10'
                        : 'border-border/60 bg-muted/20 hover:bg-muted/40'
                  }`}
                  style={todosJa ? { backgroundColor: t.color } : undefined}
                  title={todosJa ? 'Clique para desmarcar estes grupos' : 'Marcar os grupos desta tag'}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: todosJa ? 'rgba(255,255,255,.85)' : t.color }}
                  />
                  {t.name}
                  <span className="opacity-70">{t.idsAqui.length}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* --------------------------------------------- busca e tudo */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar grupo pelo nome…"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange(
            todosFiltradosMarcados
              ? selecionados.filter(id => !idsFiltrados.includes(id))
              : Array.from(new Set([...selecionados, ...idsFiltrados]))
          )}
          className="flex-shrink-0"
        >
          {todosFiltradosMarcados
            ? <><CheckSquare className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Desmarcar</span></>
            : <><Square className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Todos</span></>}
        </Button>
      </div>

      {/* ------------------------------------------------- a lista */}
      <div className={`${altura} overflow-y-auto space-y-1 rounded-lg border border-border/50 p-2`}>
        {filtrados.map(g => {
          const marcado = selecionados.includes(g.id)
          const membros = g.participantCount ?? g._count?.members ?? 0
          return (
            <label
              key={g.id}
              className={`flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer transition-colors ${
                marcado ? 'bg-primary/10' : 'hover:bg-muted/30'
              }`}
            >
              <input
                type="checkbox"
                className="rounded border-gray-300 text-primary focus:ring-primary"
                checked={marcado}
                onChange={() => alternar(g.id)}
              />
              <span className="flex-1 text-sm truncate">{g.name}</span>
              <span className="text-xs text-muted-foreground flex-shrink-0">{membros}</span>
            </label>
          )
        })}
        {filtrados.length === 0 && (
          <p className="text-xs text-muted-foreground p-2">
            {termo ? `Nenhum grupo com "${busca}".` : 'Nenhum grupo disponível.'}
          </p>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {selecionados.length} grupo(s) selecionado(s)
        {instanceName ? ` · instância ${instanceName}` : ''}
      </p>
    </div>
  )
}
