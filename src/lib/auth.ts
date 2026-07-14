import { getServerSession } from "next-auth/next"

export async function isAuthenticated(request: Request) {
  const aiToken = request.headers.get('authorization')?.replace('Bearer ', '');
  if (aiToken && aiToken === process.env.AI_API_KEY) return true;
  
  const session = await getServerSession();
  if (session) return true;
  
  return false;
}
