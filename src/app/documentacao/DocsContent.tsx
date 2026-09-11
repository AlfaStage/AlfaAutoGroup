'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Copy, Check, Clock, MessageSquare, ShieldCheck, Image as ImageIcon, Plug, Bot, Megaphone, MousePointerClick, PencilRuler, Tag as TagIcon, Bell } from 'lucide-react'

function Bloco({ codigo }: { codigo: string }) {
  const [copiado, setCopiado] = useState(false)

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(codigo)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    } catch {
      /* clipboard bloqueado pelo navegador */
    }
  }

  return (
    <div className="relative group">
      <pre className="text-xs bg-muted/40 border border-border/50 rounded-lg p-4 overflow-x-auto">
        <code>{codigo}</code>
      </pre>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={copiar}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Copiar"
      >
        {copiado ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
      </Button>
    </div>
  )
}

function Secao({
  id, icone, titulo, descricao, children
}: {
  id: string
  icone: React.ReactNode
  titulo: string
  descricao?: string
  children: React.ReactNode
}) {
  return (
    <Card id={id} className="border-border/40 bg-card/40 scroll-mt-24">
      <CardHeader className="border-b border-border/40 pb-4">
        <CardTitle className="text-lg flex items-center gap-2">{icone} {titulo}</CardTitle>
        {descricao && <CardDescription>{descricao}</CardDescription>}
      </CardHeader>
      <CardContent className="pt-6 space-y-4 text-sm leading-relaxed">{children}</CardContent>
    </Card>
  )
}

function Tabela({ cabecalho, linhas }: { cabecalho: string[]; linhas: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border/60">
            {cabecalho.map(h => (
              <th key={h} className="text-left font-semibold py-2 pr-4 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i} className="border-b border-border/30 last:border-0">
              {l.map((c, j) => (
                <td key={j} className="py-2 pr-4 align-top">
                  {j === 0
                    ? <code className="text-xs bg-muted/50 px-1.5 py-0.5 rounded whitespace-nowrap">{c}</code>
                    : <span className="text-muted-foreground">{c}</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const INDICE = [
  { id: 'formato', texto: 'Formato geral' },
  { id: 'tipos', texto: 'Tipos de ação' },
  { id: 'text', texto: 'Enviar texto' },
  { id: 'media', texto: 'Enviar mídia' },
  { id: 'button', texto: 'Enviar botões' },
  { id: 'poll', texto: 'Enviar enquete' },
  { id: 'permission', texto: 'Trocar permissão' },
  { id: 'profile', texto: 'Editar grupo' },
  { id: 'execucao', texto: 'Como é executado' },
  { id: 'status', texto: 'Status possíveis' },
  { id: 'mencao', texto: 'Marcar todos' },
  { id: 'cliques', texto: 'Cliques em links' },
  { id: 'massa', texto: 'Edição em massa' },
  { id: 'tags', texto: 'Tags e lotação' },
  { id: 'alertas', texto: 'Alertas e relatório' },
  { id: 'api', texto: 'API' },
  { id: 'mcp', texto: 'MCP' }
]

export default function DocsContent() {
  return (
    <div className="container mx-auto px-4 py-6 grid lg:grid-cols-[220px_1fr] gap-6 items-start">
      {/* Índice */}
      <nav className="hidden lg:block sticky top-24 space-y-1">
        {INDICE.map(item => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className="block text-sm text-muted-foreground hover:text-foreground py-1 transition-colors"
          >
            {item.texto}
          </a>
        ))}
      </nav>

      <div className="space-y-6 min-w-0">
        <Secao
          id="formato"
          icone={<Clock className="w-5 h-5" />}
          titulo="Formato geral"
          descricao="O mesmo JSON que os botões Copiar e Colar da aba Agenda usam."
        >
          <p>
            O JSON é sempre um <strong>array</strong>. Cada item é um agendamento, com
            três campos obrigatórios:
          </p>

          <Tabela
            cabecalho={['Campo', 'Descrição']}
            linhas={[
              ['type', 'O que fazer. Um dos tipos da tabela abaixo.'],
              ['content', 'Objeto com os dados da ação. O formato muda conforme o type.'],
              ['scheduledAt', 'Data e hora em ISO 8601, ex.: 2026-12-25T09:00:00.000Z']
            ]}
          />

          <Bloco codigo={`[
  {
    "type": "text",
    "content": { "text": "Bom dia!" },
    "scheduledAt": "2026-12-25T09:00:00.000Z"
  }
]`} />

          <p className="text-muted-foreground">
            Ao colar, os agendamentos são criados no grupo em que você está — o JSON não
            carrega o grupo de origem. Isso permite copiar de um grupo e colar em outro.
          </p>
        </Secao>

        <Secao
          id="tipos"
          icone={<MessageSquare className="w-5 h-5" />}
          titulo="Tipos de ação"
        >
          <Tabela
            cabecalho={['type', 'O que faz']}
            linhas={[
              ['text', 'Envia uma mensagem de texto'],
              ['media', 'Envia imagem, vídeo, áudio ou documento'],
              ['button', 'Envia mensagem com botões interativos'],
              ['poll', 'Envia uma enquete'],
              ['permission', 'Muda permissões do grupo (quem fala, quem edita, etc.)'],
              ['profile', 'Muda nome, descrição e/ou foto do grupo']
            ]}
          />
          <p className="text-muted-foreground">
            Os quatro primeiros enviam mensagem. Os dois últimos mudam o grupo em si e
            seguem regras diferentes de execução — veja <a href="#execucao" className="underline">Como é executado</a>.
          </p>
        </Secao>

        <Secao id="text" icone={<MessageSquare className="w-5 h-5" />} titulo="Enviar texto">
          <Tabela
            cabecalho={['Campo', 'Obrigatório', 'Descrição']}
            linhas={[
              ['text', 'sim', 'O texto da mensagem']
            ]}
          />
          <Bloco codigo={`{
  "type": "text",
  "content": {
    "text": "Promoção começa agora! 🎉"
  },
  "scheduledAt": "2026-12-25T09:00:00.000Z"
}`} />
        </Secao>

        <Secao id="media" icone={<ImageIcon className="w-5 h-5" />} titulo="Enviar mídia">
          <Tabela
            cabecalho={['Campo', 'Obrigatório', 'Descrição']}
            linhas={[
              ['media', 'sim', 'URL do arquivo, ou caminho /api/uploads/<arquivo>'],
              ['mediatype', 'não', 'image, video, audio ou document (padrão: image)'],
              ['caption', 'não', 'Legenda que acompanha a mídia'],
              ['fileName', 'não', 'Nome do arquivo mostrado no WhatsApp']
            ]}
          />
          <Bloco codigo={`{
  "type": "media",
  "content": {
    "mediatype": "image",
    "media": "https://exemplo.com/banner.jpg",
    "caption": "Confira as novidades",
    "fileName": "banner.jpg"
  },
  "scheduledAt": "2026-12-25T09:00:00.000Z"
}`} />
          <p className="text-muted-foreground">
            Arquivos enviados pelo painel viram um caminho <code className="text-xs">/api/uploads/…</code>,
            que também funciona aqui.
          </p>
        </Secao>

        <Secao id="button" icone={<MessageSquare className="w-5 h-5" />} titulo="Enviar botões">
          <Tabela
            cabecalho={['Campo', 'Obrigatório', 'Descrição']}
            linhas={[
              ['title', 'sim', 'Título da mensagem'],
              ['description', 'sim', 'Corpo da mensagem'],
              ['footer', 'não', 'Rodapé'],
              ['buttons', 'sim', 'Lista de botões (veja abaixo)'],
              ['imageUrl / videoUrl', 'não', 'Mídia no topo. Só funciona quando todos os botões são do tipo reply']
            ]}
          />

          <div className="text-sm rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-1">
            <p className="font-medium text-amber-500">Limitações verificadas em campo</p>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1">
              <li>
                Botões <code className="text-xs">reply</code> estão sendo <strong>recusados pelo
                WhatsApp</strong> em contas comuns — o envio falha com erro 405, mesmo com um
                único botão. Use <code className="text-xs">url</code>,{' '}
                <code className="text-xs">copy</code> ou <code className="text-xs">call</code>.
              </li>
              <li>
                <code className="text-xs">reply</code> não pode ser misturado com nenhum outro
                tipo, e o máximo é 3 por mensagem. O painel bloqueia isso antes de agendar.
              </li>
              <li>
                O botão <code className="text-xs">pix</code> precisa ir sozinho na mensagem.
              </li>
            </ul>
          </div>

          <p>Cada botão aceita:</p>
          <Tabela
            cabecalho={['Campo', 'Descrição']}
            linhas={[
              ['type', 'reply, url, call ou copy'],
              ['displayText', 'Texto exibido no botão'],
              ['id', 'Identificador do botão (usado no tipo reply)'],
              ['url', 'Só para type url'],
              ['phoneNumber', 'Só para type call'],
              ['copyCode', 'Só para type copy']
            ]}
          />

          <Bloco codigo={`{
  "type": "button",
  "content": {
    "title": "Oferta da semana",
    "description": "Escolha uma opção abaixo",
    "footer": "Ice Laser",
    "buttons": [
      { "type": "reply", "displayText": "Quero saber mais", "id": "btn1" },
      { "type": "url", "displayText": "Abrir catálogo", "url": "https://exemplo.com" },
      { "type": "copy", "displayText": "Copiar cupom", "copyCode": "LASER10" }
    ]
  },
  "scheduledAt": "2026-12-25T09:00:00.000Z"
}`} />
        </Secao>

        <Secao id="poll" icone={<MessageSquare className="w-5 h-5" />} titulo="Enviar enquete">
          <Tabela
            cabecalho={['Campo', 'Obrigatório', 'Descrição']}
            linhas={[
              ['name', 'sim', 'A pergunta'],
              ['values', 'sim', 'Array com no mínimo 2 opções'],
              ['selectableCount', 'não', 'Quantas opções cada pessoa pode marcar (padrão: 1)']
            ]}
          />
          <Bloco codigo={`{
  "type": "poll",
  "content": {
    "name": "Qual horário prefere?",
    "values": ["Manhã", "Tarde", "Noite"],
    "selectableCount": 1
  },
  "scheduledAt": "2026-12-25T09:00:00.000Z"
}`} />
        </Secao>

        <Secao
          id="permission"
          icone={<ShieldCheck className="w-5 h-5" />}
          titulo="Trocar permissão"
          descricao="Exige que a instância seja administradora do grupo."
        >
          <p>
            <code className="text-xs bg-muted/50 px-1.5 py-0.5 rounded">content.actions</code> é
            um array com uma ou mais das oito ações abaixo. Elas vêm em pares: uma liga,
            a outra desliga.
          </p>

          <Tabela
            cabecalho={['Ação', 'Efeito']}
            linhas={[
              ['announcement', 'Somente administradores podem falar'],
              ['not_announcement', 'Todos os membros podem falar'],
              ['locked', 'Somente administradores editam nome, foto e descrição'],
              ['unlocked', 'Todos podem editar nome, foto e descrição'],
              ['admin_add', 'Somente administradores adicionam membros'],
              ['all_member_add', 'Todos podem adicionar membros'],
              ['approval_on', 'Quem entra pelo link precisa de aprovação'],
              ['approval_off', 'Entrada pelo link liberada']
            ]}
          />

          <Bloco codigo={`[
  {
    "type": "permission",
    "content": { "actions": ["not_announcement", "all_member_add"] },
    "scheduledAt": "2026-12-25T08:00:00.000Z"
  },
  {
    "type": "permission",
    "content": { "actions": ["announcement"] },
    "scheduledAt": "2026-12-25T22:00:00.000Z"
  }
]`} />

          <p className="text-muted-foreground">
            O exemplo acima libera o grupo às 8h e fecha às 22h. Se você mandar duas
            ações do mesmo par no mesmo agendamento (ex.: <code className="text-xs">locked</code> e
            <code className="text-xs"> unlocked</code>), a última vence — nunca fica indefinido.
          </p>
        </Secao>

        <Secao
          id="profile"
          icone={<ImageIcon className="w-5 h-5" />}
          titulo="Editar grupo"
          descricao="Nome, descrição e foto. Só o que você informar é alterado."
        >
          <Tabela
            cabecalho={['Campo', 'Descrição']}
            linhas={[
              ['name', 'Novo nome do grupo (até 100 caracteres)'],
              ['description', 'Nova descrição'],
              ['picture', 'URL da imagem, ou caminho /api/uploads/<arquivo>']
            ]}
          />

          <p>
            Os três são opcionais, mas é preciso informar ao menos um. Campos ausentes
            ficam como estão no grupo.
          </p>

          <Bloco codigo={`{
  "type": "profile",
  "content": {
    "name": "🎈 Ice Laser VIP",
    "description": "Ofertas exclusivas para membros",
    "picture": "https://exemplo.com/logo.png"
  },
  "scheduledAt": "2026-12-25T09:00:00.000Z"
}`} />

          <p className="text-muted-foreground">
            Trocar só a descrição, por exemplo, é um <code className="text-xs">content</code> com
            apenas <code className="text-xs">description</code>.
          </p>
        </Secao>

        <Secao id="execucao" icone={<Clock className="w-5 h-5" />} titulo="Como é executado">
          <p>
            Um processo verifica os agendamentos a cada 10 segundos e executa os que
            já venceram.
          </p>

          <div className="space-y-3">
            <div>
              <p className="font-medium">Mensagens passam por um ajuste anti-ban</p>
              <p className="text-muted-foreground">
                Se dois envios caem na mesma janela de um minuto, o segundo é adiado de
                15 a 60 segundos. Por isso o horário real pode diferir do pedido — o
                painel mostra os dois.
              </p>
            </div>

            <div>
              <p className="font-medium">Mudanças de grupo acontecem na hora exata</p>
              <p className="text-muted-foreground">
                <code className="text-xs">permission</code> e <code className="text-xs">profile</code> não
                sofrem esse ajuste: fechar o grupo às 22h precisa ser às 22h.
              </p>
            </div>

            <div>
              <p className="font-medium">O estado é conferido antes de aplicar</p>
              <p className="text-muted-foreground">
                Antes de mexer, o sistema lê como o grupo está de verdade. O que já
                estiver como pedido não é reaplicado. Se nada precisar mudar, o
                agendamento fecha como <code className="text-xs">skipped</code> sem
                nenhuma chamada ao WhatsApp.
              </p>
            </div>

            <div>
              <p className="font-medium">E confirmado depois</p>
              <p className="text-muted-foreground">
                Após aplicar, o estado é lido novamente. Se o WhatsApp não tiver
                mudado de fato, o agendamento é marcado como erro — não como sucesso.
              </p>
            </div>

            <div>
              <p className="font-medium">Falhas são repetidas</p>
              <p className="text-muted-foreground">
                Erros de rede geram nova tentativa em 2, 10 e 30 minutos. Só depois
                disso o agendamento é dado como erro.
              </p>
            </div>
          </div>
        </Secao>

        <Secao id="status" icone={<Check className="w-5 h-5" />} titulo="Status possíveis">
          <Tabela
            cabecalho={['Status', 'Significado']}
            linhas={[
              ['pending', 'Aguardando a hora marcada'],
              ['processing', 'Executando agora'],
              ['sent', 'Concluído com sucesso'],
              ['skipped', 'Não precisou fazer nada: o grupo já estava como pedido'],
              ['error', 'Falhou depois de todas as tentativas'],
              ['deactivated', 'Desativado manualmente no painel']
            ]}
          />
        </Secao>

        <Secao
          id="mencao"
          icone={<Megaphone className="w-5 h-5" />}
          titulo="Marcar todos"
          descricao="Notifica todo mundo sem escrever @ de ninguém."
        >
          <p>
            Os quatro tipos de mensagem aceitam{' '}
            <code className="text-xs bg-muted/50 px-1.5 py-0.5 rounded">mentionAll</code>. Com
            ele ligado, todos os participantes recebem notificação, mas nenhuma
            menção aparece escrita no texto — é a marcação invisível.
          </p>

          <Bloco codigo={`{
  "type": "text",
  "content": {
    "text": "Aviso importante para o grupo",
    "mentionAll": true
  },
  "scheduledAt": "2026-12-25T09:00:00.000Z"
}`} />

          <Tabela
            cabecalho={['Tipo', 'Aceita mentionAll']}
            linhas={[
              ['text', 'sim'],
              ['media', 'sim'],
              ['button', 'sim'],
              ['poll', 'sim'],
              ['permission', 'não se aplica'],
              ['profile', 'não se aplica']
            ]}
          />

          <p className="text-muted-foreground">
            No painel é a caixa <strong>Marcar todos os membros</strong>, no modal de
            agendamento. Use com parcimônia: marcar todo mundo com frequência é um
            dos comportamentos que o WhatsApp penaliza.
          </p>
        </Secao>

        <Secao
          id="cliques"
          icone={<MousePointerClick className="w-5 h-5" />}
          titulo="Cliques em links"
          descricao="Encurtador próprio, com contagem por grupo."
        >
          <p>
            Marque <strong>contar cliques</strong> ao agendar e cada link vira um
            endereço curto <code className="text-xs">/l/&lt;código&gt;</code> que
            redireciona para o destino real e registra a abertura. Em texto e mídia a
            troca vale para todos os links; em botões, é uma caixa por botão de link.
          </p>

          <p className="font-medium pt-1">No JSON</p>
          <Bloco codigo={`{
  "type": "text",
  "content": {
    "text": "Confira: https://exemplo.com/promo",
    "trackLinks": true
  },
  "scheduledAt": "2026-12-25T09:00:00.000Z"
}`} />

          <p>Em botões, a marcação é por botão:</p>
          <Bloco codigo={`{
  "type": "button",
  "content": {
    "title": "Promoção",
    "description": "Clique para ver",
    "footer": "Ice Laser",
    "buttons": [
      {
        "type": "url",
        "displayText": "Ver promoção",
        "url": "https://exemplo.com/black",
        "track": true
      }
    ]
  },
  "scheduledAt": "2026-12-25T09:00:00.000Z"
}`} />

          <Tabela
            cabecalho={['Campo', 'Onde vale', 'O que faz']}
            linhas={[
              ['trackLinks', 'text, media', 'Encurta todos os links do texto ou da legenda'],
              ['track', 'botão do tipo url', 'Encurta o link daquele botão']
            ]}
          />

          <p className="text-muted-foreground">
            A troca acontece no momento de agendar, então o código já existe quando a
            mensagem sai. <strong>Cada grupo recebe um código próprio</strong> para o
            mesmo endereço — dá para comparar qual grupo respondeu melhor à mesma
            campanha. As estatísticas ficam em <a href="/links" className="underline">Cliques</a>,
            com o total e a proporção sobre o tamanho do grupo.
          </p>

          <div className="text-sm rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <p className="text-muted-foreground">
              <strong className="text-amber-500">Atenção:</strong> link encurtado não gera
              o cartão de pré-visualização com imagem e título no WhatsApp. Se o visual
              importa mais que a métrica, deixe o link direto.
            </p>
          </div>
        </Secao>

        <Secao
          id="massa"
          icone={<PencilRuler className="w-5 h-5" />}
          titulo="Edição em massa"
          descricao="Renomear, redescrever e trocar a foto de vários grupos de uma vez."
        >
          <p>
            No painel, clique em <strong>Editar em massa</strong>, selecione os grupos e
            preencha o que quer mudar. Nada é aplicado de imediato: o sistema cria um
            agendamento por grupo, espaçados no tempo, e o executor confere o estado de
            cada um antes de mexer.
          </p>

          <p className="font-medium pt-1">Variáveis do template de nome</p>
          <Tabela
            cabecalho={['Variável', 'Vira']}
            linhas={[
              ['{n}', 'Posição do grupo na seleção: 1, 2, 3…'],
              ['{nn}', 'Posição com zero à esquerda: 01, 02…'],
              ['{total}', 'Quantidade de grupos selecionados'],
              ['{nome}', 'Nome atual do grupo']
            ]}
          />

          <p className="text-muted-foreground">
            <code className="text-xs">🎈 Ice Laser [{'{nn}'}/{'{total}'}]</code> numera os
            grupos. Sem nenhuma variável de número, todos ficam com o mesmo nome — a
            numeração é opcional.
          </p>

          <p className="font-medium pt-1">Antes de aplicar</p>
          <p>
            O botão <strong>Ver prévia</strong> mostra grupo a grupo o nome atual e o
            novo, e marca quais não mudam nada. Só depois disso o agendamento é criado.
          </p>

          <p className="font-medium pt-1">Desfazer</p>
          <p>
            Cada lote guarda os nomes e descrições anteriores. Desfazer reagenda os
            valores antigos e cancela o que ainda não saiu do lote.{' '}
            <strong>A foto não é restaurada</strong> — a imagem anterior não é guardada.
          </p>

          <p className="font-medium pt-1">Pela API</p>
          <Bloco codigo={`curl -X POST https://seu-dominio/api/bulk/profile \\
  -H "Authorization: Bearer aag_sua_chave_aqui" \\
  -H "Content-Type: application/json" \\
  -d '{
    "groupIds": ["id1", "id2"],
    "nameTemplate": "Ice Laser [{n}/{total}]",
    "spacingSeconds": 45,
    "dryRun": true
  }'`} />

          <p className="text-muted-foreground">
            Com <code className="text-xs">dryRun: true</code> devolve só a prévia.
            Sem ele, cria o lote e responde com o <code className="text-xs">loteId</code>,
            que serve para{' '}
            <code className="text-xs">POST /api/bulk/profile/{'{loteId}'}/undo</code>.
          </p>

          <div className="text-sm rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <p className="text-muted-foreground">
              O intervalo mínimo é de 10 segundos. Renomear dezenas de grupos em
              sequência rápida é exatamente o tipo de comportamento que o WhatsApp
              penaliza — o padrão de 45 segundos existe por isso.
            </p>
          </div>
        </Secao>

        <Secao
          id="tags"
          icone={<TagIcon className="w-5 h-5" />}
          titulo="Tags e lotação"
          descricao="Agrupe grupos parecidos e nunca fique sem grupo com vaga."
        >
          <p>
            Uma tag junta grupos com a mesma característica — cidade, unidade,
            serviço, o critério é seu. Além de organizar, ela controla a fila de
            entrada de gente nova.
          </p>

          <p className="font-medium pt-1">Link único de entrada</p>
          <p>
            Cada tag ganha um endereço <code className="text-xs">/g/&lt;código&gt;</code>.
            Quem clica é mandado para o <strong>primeiro grupo da fila que ainda tem
            vaga</strong>. A ordem dos grupos você define arrastando na tela da tag.
          </p>

          <p className="font-medium pt-1">Criação automática</p>
          <p>
            Com <strong>criar o próximo grupo automaticamente</strong> ligado, quando
            todos os grupos da tag atingem a capacidade o sistema cria mais um:
          </p>
          <Tabela
            cabecalho={['O que acontece', 'Detalhe']}
            linhas={[
              ['Nome', 'Segue o padrão da tag — {n} vira a posição, ex.: "Salvador 4"'],
              ['Participantes', 'Os números já conhecidos dos grupos da tag entram no grupo novo'],
              ['Agendamentos', 'Os pendentes do grupo anterior são copiados, se você deixar marcado'],
              ['Link de entrada', 'Passa a apontar para o grupo novo na mesma hora'],
              ['Aviso', 'Uma mensagem é enviada no grupo de gestão contando o que foi criado']
            ]}
          />

          <p className="text-muted-foreground">
            A verificação roda a cada 5 minutos e também no instante em que alguém
            clica no link — então a vaga nunca falta, mesmo num pico de entradas.
            Desligue a criação automática e a tag apenas organiza, sem criar nada.
          </p>

          <div className="text-sm rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <p className="text-muted-foreground">
              A instância precisa ser <strong>administradora</strong> dos grupos para
              conseguir o link de convite, e o WhatsApp não cria grupo vazio — por isso
              o grupo novo nasce com os números que o sistema já conhece. Se nenhum
              grupo da tag estiver sincronizado, a criação falha com essa mensagem.
            </p>
          </div>
        </Secao>

        <Secao
          id="alertas"
          icone={<Bell className="w-5 h-5" />}
          titulo="Alertas e relatório diário"
          descricao="O sistema avisa no WhatsApp quando algo falha, e resume o dia às 23:59."
        >
          <p>
            Escolha o grupo que recebe os avisos em{' '}
            <a href="/relatorios" className="underline">Relatórios</a>. Sem grupo
            escolhido, nada é enviado.
          </p>

          <p className="font-medium pt-1">Aviso de falha</p>
          <p>
            Quando um agendamento termina em erro, chega uma mensagem com o grupo, a
            instância, o tipo da ação, o horário, o erro cru, <strong>a causa provável
            e o caminho da solução</strong> — mais um botão que abre direto o
            agendamento no painel.
          </p>
          <p className="text-muted-foreground">
            O aviso sai uma vez por agendamento, nunca em repetição. E não avisa sobre
            erros no próprio grupo de gestão, para não virar eco.
          </p>

          <p className="font-medium pt-1">Relatório das 23:59</p>
          <Tabela
            cabecalho={['Métrica', 'O que mostra']}
            linhas={[
              ['Enviados / falhas / pulados', 'Total do dia e a quebra por instância e por grupo'],
              ['Mensagens vs ações', 'Quanto foi envio e quanto foi mudança de grupo'],
              ['Por tipo', 'Texto, mídia, botões, enquete, permissão e edição'],
              ['Cliques', 'Total e ranking dos links mais abertos, com o grupo de origem'],
              ['Enquetes', 'Pergunta, opções e votos de cada enquete disparada no dia'],
              ['Movimento de membros', 'Quantas pessoas entraram e saíram, por grupo'],
              ['Falhas', 'Lista com atalho para resolver cada uma']
            ]}
          />
          <p className="text-muted-foreground">
            No WhatsApp chega o resumo com um botão para o relatório completo, que é
            uma página do painel com barras comparativas em{' '}
            <code className="text-xs">/relatorios/AAAA-MM-DD</code>. Dá para abrir
            qualquer dia pelo seletor de data.
          </p>
          <p className="text-muted-foreground">
            O movimento de membros compara a contagem de hoje com a de ontem, então
            ele começa a aparecer a partir do segundo dia de uso.
          </p>
        </Secao>

        <Secao
          id="api"
          icone={<Plug className="w-5 h-5" />}
          titulo="API"
          descricao="Acesso externo por chave, nas mesmas rotas que o painel usa."
        >
          <p>
            Gere uma chave em <a href="/chaves" className="underline">Chaves de API</a>.
            A criação pede a senha da sua conta, e a chave aparece <strong>uma única
            vez</strong> — o sistema guarda apenas o hash. Se você perder, revogue e
            gere outra.
          </p>

          <p>
            Mande a chave no header <code className="text-xs bg-muted/50 px-1.5 py-0.5 rounded">Authorization</code>:
          </p>

          <Bloco codigo={`curl -H "Authorization: Bearer aag_sua_chave_aqui" \\
  https://seu-dominio/api/instances`} />

          <p className="text-muted-foreground">
            Toda rota <code className="text-xs">/api/*</code> aceita a chave. Sem ela, e
            sem sessão do painel, a resposta é 401.
          </p>

          <p className="font-medium pt-2">Principais rotas</p>
          <Tabela
            cabecalho={['Rota', 'O que faz']}
            linhas={[
              ['GET /api/instances', 'Lista as instâncias do WhatsApp'],
              ['GET /api/instances/{nome}/status', 'Status da conexão'],
              ['GET /api/instances/{nome}/connect', 'QR Code para parear'],
              ['POST /api/instances/{nome}/sync-groups', 'Sincroniza grupos, membros e fotos'],
              ['GET /api/schedules', 'Lista agendamentos'],
              ['POST /api/schedules', 'Cria agendamento (o JSON desta página)'],
              ['PATCH /api/schedules/{id}', 'Edita um agendamento'],
              ['POST /api/groups/{id}/settings', 'Muda permissões agora'],
              ['POST /api/groups/{id}/profile', 'Muda nome, descrição e/ou foto agora'],
              ['GET /api/groups/{id}/participants', 'Membros do grupo'],
              ['POST /api/bulk/profile', 'Edição em massa (aceita dryRun para prévia)'],
              ['POST /api/bulk/profile/{id}/undo', 'Desfaz um lote de edição em massa'],
              ['GET /api/links', 'Links rastreados e contagem de cliques'],
              ['GET /api/tags', 'Tags, grupos vinculados e situação de lotação'],
              ['POST /api/tags', 'Cria uma tag'],
              ['POST /api/tags/{id}/groups', 'Define os grupos da tag, na ordem da fila'],
              ['GET /api/reports/{data}', 'Relatório de um dia (YYYY-MM-DD)'],
              ['GET /api/settings', 'Grupo de alertas e interruptores'],
              ['POST /api/upload', 'Envia um arquivo e devolve o caminho para usar em media ou picture']
            ]}
          />

          <p className="font-medium pt-2">Criar um agendamento pela API</p>
          <Bloco codigo={`curl -X POST https://seu-dominio/api/schedules \\
  -H "Authorization: Bearer aag_sua_chave_aqui" \\
  -H "Content-Type: application/json" \\
  -d '{
    "groupId": "id-do-grupo",
    "type": "permission",
    "content": { "actions": ["announcement"] },
    "scheduledAt": "2026-12-25T22:00:00.000Z"
  }'`} />

          <p className="text-muted-foreground">
            <code className="text-xs">groupIds</code> (array) no lugar de{' '}
            <code className="text-xs">groupId</code> agenda a mesma ação em vários
            grupos de uma vez.
          </p>

          <p className="text-muted-foreground">
            A referência completa, gerada a partir do código, fica em{' '}
            <a href="/api-docs" className="underline">/api-docs</a>.
          </p>

          <p className="font-medium pt-2">Escopos</p>
          <Tabela
            cabecalho={['Escopo', 'Permite']}
            linhas={[
              ['read', 'Consultar grupos, agendamentos e status'],
              ['read,write', 'Tudo do read, mais criar, editar e executar ações']
            ]}
          />
        </Secao>

        <Secao
          id="mcp"
          icone={<Bot className="w-5 h-5" />}
          titulo="MCP"
          descricao="Conecte um assistente de IA direto ao painel."
        >
          <p>
            O endpoint <code className="text-xs bg-muted/50 px-1.5 py-0.5 rounded">/api/mcp</code> fala
            JSON-RPC 2.0 sobre HTTP e autentica com a mesma chave de API. Configure
            assim num cliente MCP:
          </p>

          <Bloco codigo={`{
  "mcpServers": {
    "alfaaltogrup": {
      "type": "http",
      "url": "https://seu-dominio/api/mcp",
      "headers": {
        "Authorization": "Bearer aag_sua_chave_aqui"
      }
    }
  }
}`} />

          <p className="font-medium pt-2">Ferramentas disponíveis</p>
          <Tabela
            cabecalho={['Ferramenta', 'O que faz']}
            linhas={[
              ['listar_grupos', 'Lista os grupos com membros e permissões atuais'],
              ['estado_do_grupo', 'Nome, descrição e as quatro permissões de um grupo'],
              ['listar_agendamentos', 'Agendamentos de um grupo, com status'],
              ['agendar_acao', 'Cria um agendamento de qualquer tipo'],
              ['cancelar_agendamento', 'Desativa um agendamento pendente'],
              ['trocar_permissao', 'Muda permissões agora'],
              ['editar_grupo', 'Muda nome, descrição e/ou foto agora']
            ]}
          />

          <p className="text-muted-foreground">
            As ferramentas localizam o grupo por <code className="text-xs">groupId</code>,{' '}
            <code className="text-xs">slug</code> ou <code className="text-xs">nome</code> —
            então dá para pedir em linguagem natural, tipo &quot;feche o grupo VIP Lauro às 22h&quot;.
          </p>

          <p className="text-muted-foreground">
            As mesmas proteções do painel valem aqui: o estado do grupo é conferido
            antes de qualquer mudança, e o que já estiver como pedido não é reaplicado.
          </p>

          <p className="font-medium pt-2">Testar rapidamente</p>
          <Bloco codigo={`curl -X POST https://seu-dominio/api/mcp \\
  -H "Authorization: Bearer aag_sua_chave_aqui" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`} />
        </Secao>
      </div>
    </div>
  )
}
