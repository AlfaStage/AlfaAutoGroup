import { getServerSession } from "next-auth/next"
import { validarChaveApi, chaveDoHeader } from "@/lib/api-keys"

/**
 * Duas formas de autenticar:
 *  - sessão do painel (next-auth), para quem está navegando;
 *  - chave de API no header Authorization: Bearer aag_..., para acesso externo.
 *
 * Não existe chave embutida no código: toda chave é criada pelo painel,
 * guardada como hash e pode ser revogada a qualquer momento.
 */
export async function isAuthenticated(request: Request) {
  const chave = chaveDoHeader(request)

  if (chave) {
    const registro = await validarChaveApi(chave)
    // Chave apresentada e inválida não cai para a sessão: se alguém está
    // usando a API, a resposta precisa ser sobre a chave.
    return Boolean(registro)
  }

  const session = await getServerSession()
  return Boolean(session)
}

/** Igual ao acima, mas informa por qual caminho a requisição entrou. */
export async function autenticar(request: Request) {
  const chave = chaveDoHeader(request)

  if (chave) {
    const registro = await validarChaveApi(chave)
    if (!registro) return { ok: false as const }
    return { ok: true as const, via: 'apiKey' as const, apiKey: registro }
  }

  const session = await getServerSession()
  if (!session) return { ok: false as const }
  return { ok: true as const, via: 'session' as const, session }
}
