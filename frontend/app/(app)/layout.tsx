import { User } from "@/lib/types"
import { generateUniqueUsername } from "@/lib/username-generator"
import { auth, currentUser } from "@clerk/nextjs"
import { redirect } from "next/navigation"

export default async function AppAuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await currentUser()
  const { getToken } = auth()

  if (!user) {
    redirect("/")
  }

  try {
    // Get a fresh token without specifying a template
    const token = await getToken()

    if (!token) {
      console.error("No token available")
      redirect("/")
    }

    const dbUser = await fetch(
      `${process.env.NEXT_PUBLIC_SERVER_URL}/api/user?id=${user.id}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    if (!dbUser.ok) {
      const error = await dbUser.text()
      console.error("Failed to fetch user:", error)
      if (dbUser.status === 401) {
        redirect("/")
      }
      throw new Error(`Failed to fetch user: ${error}`)
    }

    const dbUserJSON = (await dbUser.json()) as User

    if (!dbUserJSON.id) {
      // Try to get GitHub username if available
      const githubUsername = user.externalAccounts.find(
        (account) => account.provider === "github"
      )?.username

      const username =
        githubUsername ||
        (await generateUniqueUsername(async (username) => {
          // Check if username exists in database
          const userCheck = await fetch(
            `${process.env.NEXT_PUBLIC_SERVER_URL}/api/user/check-username?username=${username}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          )
          if (!userCheck.ok) {
            throw new Error("Failed to check username")
          }
          const exists = await userCheck.json()
          return exists.exists
        }))

      const res = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: user.id,
          name: user.firstName + " " + user.lastName,
          email: user.emailAddresses[0].emailAddress,
          username: username,
          avatarUrl: user.imageUrl || null,
          createdAt: new Date().toISOString(),
        }),
      })

      if (!res.ok) {
        const error = await res.text()
        console.error("Failed to create user:", error)
        if (res.status === 401) {
          redirect("/")
        }
        throw new Error(`Failed to create user: ${error}`)
      } else {
        const data = await res.json()
        console.log("User created successfully:", data)
      }
    }

    return <>{children}</>
  } catch (error) {
    console.error("Authentication error:", error)
    redirect("/")
  }
}
