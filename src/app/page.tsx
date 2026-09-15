import { getServerSession } from "next-auth/next"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import DashboardClient from "./DashboardClient"
import AppShell from "@/components/AppShell"

export default async function Dashboard() {
  const session = await getServerSession()
  
  if (!session) {
    redirect('/login')
  }

  const groups = await prisma.group.findMany({
    include: {
      tags: {
        include: {
          tag: true
        }
      },
      schedules: {
        select: { status: true }
      },
      _count: {
        select: { members: true, schedules: true }
      }
    }
  })

  return (
    <AppShell
      titulo="AlfaAltoGrup"
      subtitulo="Gestão e disparo em grupos de WhatsApp"
      acoes={
        <div
          className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm border border-primary/20"
          title={session.user?.email || undefined}
        >
          {session.user?.email?.charAt(0).toUpperCase() || 'U'}
        </div>
      }
    >
      <DashboardClient initialGroups={groups} />
    </AppShell>
  )
}
