import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { isAuthenticated } from '@/lib/auth'
import { montarRelatorio, resumoTexto } from '@shared/report'

const prisma = new PrismaClient()

/**
 * @swagger
 * /api/reports/{date}:
 *   get:
 *     summary: Relatório de um dia
 *     description: >
 *       `date` no formato YYYY-MM-DD, no fuso de São Paulo. Traz totais,
 *       quebra por grupo, por instância e por tipo, falhas, cliques em links,
 *       resultados das enquetes e crescimento de membros.
 *       Use `?resumo=1` para receber também o texto enviado no WhatsApp,
 *       e `?enquetes=0` para pular a consulta de resultados (mais rápido).
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Relatório do dia.
 *       400:
 *         description: Data inválida.
 */
export async function GET(request: Request, { params }: { params: Promise<{ date: string }> }) {
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { date } = await params
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Use o formato YYYY-MM-DD' }, { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  const comEnquetes = searchParams.get('enquetes') !== '0'

  try {
    const rel = await montarRelatorio(prisma, date, { comEnquetes })

    if (searchParams.get('resumo') === '1') {
      return NextResponse.json({ ...rel, resumo: resumoTexto(rel) })
    }
    return NextResponse.json(rel)
  } catch (error) {
    console.error('Erro ao montar relatório:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
