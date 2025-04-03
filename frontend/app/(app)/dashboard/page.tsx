import Dashboard from "@/components/dashboard"
import Navbar from "@/components/dashboard/navbar"
import { User } from "@/lib/types"
import { auth, currentUser } from "@clerk/nextjs"
import { redirect } from "next/navigation"

export default async function DashboardPage() {
  const user = await currentUser()
  const { getToken } = auth()

  if (!user) {
    redirect("/")
  }

  const token = await getToken()

  if (!token) {
    console.error("No token available")
    redirect("/")
  }

  const userRes = await fetch(
    `${process.env.NEXT_PUBLIC_SERVER_URL}/api/user?id=${user.id}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  )

  if (!userRes.ok) {
    const error = await userRes.text()
    console.error("Failed to fetch user:", error)
    if (userRes.status === 401) {
      redirect("/")
    }
    throw new Error(`Failed to fetch user: ${error}`)
  }

  const userData = (await userRes.json()) as User

  const sharedRes = await fetch(
    `${process.env.NEXT_PUBLIC_SERVER_URL}/api/sandbox/share?id=${user.id}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  )

  if (!sharedRes.ok) {
    const error = await sharedRes.text()
    console.error("Failed to fetch shared sandboxes:", error)
    if (sharedRes.status === 401) {
      redirect("/")
    }
    throw new Error(`Failed to fetch shared sandboxes: ${error}`)
  }

  const shared = (await sharedRes.json()) as {
    id: string
    name: string
    type: "react" | "node"
    author: string
    sharedOn: Date
    authorAvatarUrl: string
  }[]

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden overscroll-none">
      <Navbar userData={userData} />
      <Dashboard sandboxes={userData.sandbox} shared={shared} />
    </div>
  )
}
