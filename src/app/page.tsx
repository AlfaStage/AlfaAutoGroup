import { getServerSession } from "next-auth/next"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import DashboardClient from "./DashboardClient"

export default async function Dashboard() {
  const session = await getServerSession()
  
  if (!session) {
    redirect('/login')
  }

  const groups = await prisma.group.findMany({
    include: {
      _count: {
        select: { members: true, schedules: true }
      }
    }
  })

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/40 bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50 sticky top-0 z-10">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 lg:px-8">
          <h1 className="text-xl font-bold tracking-tight">AlfaAutoGroup</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:inline-block">
              {session.user?.email}
            </span>
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm border border-primary/20 shadow-sm">
              {session.user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto py-8 px-4 lg:px-8">
        <DashboardClient initialGroups={groups} />
      </main>
    </div>
  )
}
