'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sparkles, ChevronDown, ChevronUp, Check } from 'lucide-react'

type VariavelItem = {
  token: string
  desc: string
  exemplo: string
}

type CategoriaVariavel = {
  id: string
  nome: string
  itens: VariavelItem[]
}

const CATEGORIAS: CategoriaVariavel[] = [
  {
    id: 'grupo',
    nome: 'Grupo',
    itens: [
      { token: '{grupo}', desc: 'Nome completo do grupo', exemplo: 'VIP São Paulo #03' },
      { token: '{grupo_base}', desc: 'Nome sem numeração', exemplo: 'VIP São Paulo' },
      { token: '{n}', desc: 'Número do grupo', exemplo: '3' },
      { token: '{nn}', desc: 'Número com zero', exemplo: '03' },
      { token: '{link_grupo}', desc: 'Link de convite direto', exemplo: 'https://chat.whatsapp.com/...' }
    ]
  },
  {
    id: 'lotacao',
    nome: 'Lotação & Escassez',
    itens: [
      { token: '{membros}', desc: 'Membros atuais', exemplo: '842' },
      { token: '{vagas}', desc: 'Vagas restantes', exemplo: '108' },
      { token: '{capacidade}', desc: 'Capacidade máxima', exemplo: '950' },
      { token: '{ocupacao}', desc: '% de ocupação', exemplo: '89%' },
      { token: '{vagas_status}', desc: 'Frase automática de urgência', exemplo: 'Últimas vagas!' }
    ]
  },
  {
    id: 'tag',
    nome: 'Tag / Praça / Funil',
    itens: [
      { token: '{tag}', desc: 'Nome da Tag', exemplo: 'São Paulo' },
      { token: '{cidade}', desc: 'Alias de praça/cidade', exemplo: 'São Paulo' },
      { token: '{link_tag}', desc: 'Link inteligente /g/ da Tag', exemplo: 'https://.../g/sp-vip' },
      { token: '{total_grupos_tag}', desc: 'Total de grupos na Tag', exemplo: '5' },
      { token: '{total_membros_tag}', desc: 'Soma de membros na Tag', exemplo: '4120' }
    ]
  },
  {
    id: 'tempo',
    nome: 'Data, Hora & Saudação (SP)',
    itens: [
      { token: '{saudacao}', desc: 'Bom dia / Boa tarde / Boa noite', exemplo: 'Bom dia' },
      { token: '{saudacao_emoji}', desc: 'Saudação com emoji', exemplo: 'Bom dia ☀️' },
      { token: '{hoje}', desc: 'Data de hoje', exemplo: '19/10/2026' },
      { token: '{data_curta}', desc: 'Dia e mês', exemplo: '19/10' },
      { token: '{amanha}', desc: 'Data de amanhã', exemplo: '20/10/2026' },
      { token: '{dia_semana}', desc: 'Dia da semana', exemplo: 'segunda-feira' },
      { token: '{hora}', desc: 'Hora do disparo', exemplo: '14:30' }
    ]
  },
  {
    id: 'anti_spam',
    nome: 'Spintax & Campanha',
    itens: [
      { token: '{Olá|Oi|Fala pessoal}', desc: 'Sorteia 1 variação por grupo (anti-spam)', exemplo: 'Olá' },
      { token: '{🔥|🚀|⚡}', desc: 'Sorteia emoji por disparo', exemplo: '🔥' },
      { token: '{campanha}', desc: 'Nome da campanha do agendamento', exemplo: 'Black Friday' },
      { token: '{id_curto}', desc: 'Código único anti-bloqueio (4 chars)', exemplo: 'A7F2' }
    ]
  }
]

export default function InserirVariavel({
  onInsert,
  compact = false
}: {
  onInsert: (token: string) => void
  compact?: boolean
}) {
  const [aberto, setAberto] = useState(false)
  const [aba, setAba] = useState('grupo')
  const [ultimoInserido, setUltimoInserido] = useState<string | null>(null)

  const lidarClique = (token: string) => {
    onInsert(token)
    setUltimoInserido(token)
    try {
      navigator.clipboard.writeText(token)
    } catch {
      /* ignora */
    }
    setTimeout(() => setUltimoInserido(null), 1400)
  }

  const categoriaAtiva = CATEGORIAS.find(c => c.id === aba) || CATEGORIAS[0]

  return (
    <div className="rounded-lg border border-border/50 bg-muted/15 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
        <button
          type="button"
          onClick={() => setAberto(!aberto)}
          className="flex items-center gap-2 text-xs font-medium text-foreground hover:text-primary transition-colors w-full text-left"
        >
          <Sparkles className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          <span>Variáveis Dinâmicas &amp; Spintax</span>
          <span className="text-[11px] text-muted-foreground font-normal hidden sm:inline">
            — clique para inserir {'{grupo}'}, {'{vagas}'}, {'{saudacao}'}, {'{opção 1|opção 2}'}
          </span>
          <span className="ml-auto flex items-center gap-1 text-muted-foreground">
            {aberto ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </span>
        </button>
      </div>

      {aberto && (
        <div className="p-3 space-y-3 border-t border-border/40">
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIAS.map(cat => (
              <Button
                key={cat.id}
                type="button"
                variant={aba === cat.id ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => setAba(cat.id)}
              >
                {cat.nome}
              </Button>
            ))}
          </div>

          <div className={`grid gap-1.5 ${compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
            {categoriaAtiva.itens.map(item => {
              const copiado = ultimoInserido === item.token
              return (
                <button
                  key={item.token}
                  type="button"
                  onClick={() => lidarClique(item.token)}
                  className="flex items-center justify-between gap-2 p-2 rounded-md border border-border/40 bg-background/60 hover:bg-primary/10 hover:border-primary/40 transition-colors text-left group"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <code className="text-xs font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                        {item.token}
                      </code>
                      {copiado && (
                        <span className="text-[10px] text-green-500 flex items-center gap-0.5 font-medium">
                          <Check className="w-3 h-3" /> inserido
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {item.desc}
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground/80 bg-muted/50 px-1.5 py-0.5 rounded truncate max-w-[110px] flex-shrink-0">
                    Ex: {item.exemplo}
                  </span>
                </button>
              )
            })}
          </div>

          <p className="text-[11px] text-muted-foreground">
            💡 <strong>Links rastreados:</strong> qualquer link <code>/l/codigo</code> enviado pelo agendador recebe automaticamente <code>?grupid=ID_DO_GRUPO</code> para medir os cliques de cada grupo separadamente.
          </p>
        </div>
      )}
    </div>
  )
}
