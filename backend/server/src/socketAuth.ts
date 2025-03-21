import { Socket } from "socket.io"
import { z } from "zod"
import { Project, User } from "./types"

// Middleware for socket authentication
export const socketAuth = async (socket: Socket, next: Function) => {
  try {
    // Define the schema for handshake query validation
    const handshakeSchema = z.object({
      userId: z.string(),
      sandboxId: z.string(),
      EIO: z.string(),
      transport: z.string(),
    })

    const q = socket.handshake.query
    const parseQuery = handshakeSchema.safeParse(q)

    // Check if the query is valid according to the schema
    if (!parseQuery.success) {
      next(new Error("Invalid request."))
      return
    }

    const { sandboxId: projectId, userId } = parseQuery.data

    // If we have a verified Clerk user from previous middleware
    // ensure the userId matches the authenticated user
    if (socket.data.clerkUser && socket.data.clerkUser.id !== userId) {
      next(new Error("User ID mismatch. Authentication failed."))
      return
    }
    
    // Fetch user data from the database
    const dbUser = await fetch(`${process.env.SERVER_URL}/api/user?id=${userId}`)
    const dbUserJSON = (await dbUser.json()) as User

    // Fetch project data from the database
    const dbProject = await fetch(
      `${process.env.SERVER_URL}/api/sandbox?id=${projectId}`
    )
    const dbProjectJSON = (await dbProject.json()) as Project

    // Check if user data was retrieved successfully
    if (!dbUserJSON) {
      next(new Error("DB error."))
      return
    }

    // Check if the user owns the project or has shared access
    const project = dbUserJSON.sandbox.find((s) => s.id === projectId)
    const sharedProjects = dbUserJSON.usersToSandboxes.find(
      (uts) => uts.sandboxId === projectId
    )

    // If user doesn't own or have shared access to the project, deny access
    if (!project && !sharedProjects) {
      next(new Error("Invalid credentials."))
      return
    }

    // When setting socket.data, preserve the clerkUser information
    socket.data = {
      ...socket.data, // Keep the clerkUser data
      userId,
      projectId: projectId,
      isOwner: project !== undefined,
      type: dbProjectJSON.type,
      containerId: dbProjectJSON.containerId,
    }

    next()
  } catch (error) {
    console.error("Socket authentication error:", error)
    next(new Error("Authentication error"))
  }
}
