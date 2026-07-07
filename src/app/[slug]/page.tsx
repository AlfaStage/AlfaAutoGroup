import { getServerSession } from "next-auth/next"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import GroupClient from "./GroupClient"

export default async function GroupPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getServerSession()
  
  if (!session) {
    redirect('/login')
  }

  const { slug } = await params;

  const group = await prisma.group.findUnique({
    where: { slug: slug },
    include: {
      schedules: {
        orderBy: { adjustedAt: 'asc' }
      },
      members: true,
      messages: {
        orderBy: { timestamp: 'desc' },
        take: 50
      }
    }
  })

  if (!group) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Grupo não encontrado.</h2>
          <p className="text-muted-foreground">O grupo que você está procurando não existe ou foi removido.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <GroupClient initialGroup={group} />
    </div>
  )
}
