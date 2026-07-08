const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log("Rodando seed do banco de dados...");
  
  const users = [
    { email: 'thejaovitor@outlook.com', password: 'AlfaStage2026' },
    { email: 'Icelaser@outlook.com', password: 'IceL@ser' }
  ]

  for (const u of users) {
    const hashedPassword = await bcrypt.hash(u.password, 10)
    await prisma.user.upsert({
      where: { email: u.email },
      update: {}, // Se já existir, não faz nada
      create: {
        email: u.email,
        password: hashedPassword,
      }
    })
    console.log(`Usuário ${u.email} inserido com sucesso.`)
  }
}

main()
  .catch(e => {
    console.error("Erro no seed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
