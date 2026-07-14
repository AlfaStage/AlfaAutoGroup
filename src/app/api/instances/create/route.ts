import { NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'

/**
 * @swagger
 * /api/instances/create:
 *   post:
 *     summary: Cria uma nova instância
 *     description: Cria uma nova instância de WhatsApp na Evolution API.
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - instanceName
 *             properties:
 *               instanceName:
 *                 type: string
 *               proxyHost:
 *                 type: string
 *               proxyPort:
 *                 type: integer
 *               proxyProtocol:
 *                 type: string
 *               proxyUsername:
 *                 type: string
 *               proxyPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Instância criada com sucesso.
 *       401:
 *         description: Não autorizado.
 *       500:
 *         description: Erro ao criar instância.
 */
export async function POST(request: Request) {
  try {
    if (!(await isAuthenticated(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const apiUrl = process.env.EVOLUTION_API_URL
    const apiKey = process.env.EVOLUTION_API_KEY

    if (!apiUrl || !apiKey) {
      return NextResponse.json({ error: 'Evolution API credentials missing' }, { status: 500 })
    }

    const data = await request.json()
    
    // Validar e montar o proxy se foi preenchido
    let proxySettings = undefined;
    if (data.proxyHost && data.proxyPort) {
      proxySettings = {
        host: data.proxyHost,
        port: String(data.proxyPort),
        protocol: data.proxyProtocol || 'http',
        username: data.proxyUsername || '',
        password: data.proxyPassword || ''
      }
    }

    const payload: any = {
      instanceName: data.instanceName,
      name: data.instanceName,
      qrcode: true,
      token: `${data.instanceName}_${Date.now()}`
    }

    if (proxySettings) {
      payload.proxy = proxySettings;
    }

    console.log("Criando instância na Evolution API:", payload);

    const res = await fetch(`${apiUrl}/instance/create`, {
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error("Evolution API erro ao criar instancia:", errText)
      return NextResponse.json({ error: 'Failed to create instance in Evolution API', details: errText }, { status: res.status })
    }

    const responseData = await res.json()
    return NextResponse.json({ success: true, data: responseData })

  } catch (error) {
    console.error("Erro interno ao criar instancia:", error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
