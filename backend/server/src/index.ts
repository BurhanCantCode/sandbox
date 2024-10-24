import cors from "cors"
import dotenv from "dotenv"
import { Sandbox } from "e2b"
import express, { Express } from "express"
import fs from "fs"
import { createServer } from "http"
import { Server } from "socket.io"
import { z } from "zod"
import { AIWorker } from "./AIWorker"
import { CONTAINER_TIMEOUT } from "./constants"
import { DokkuClient } from "./DokkuClient"
import { FileManager, SandboxFiles } from "./FileManager"
import {
  createFileRL,
  createFolderRL,
  deleteFileRL,
  renameFileRL,
  saveFileRL,
} from "./ratelimit"
import { SecureGitClient } from "./SecureGitClient"
import { handleCloseTerminal, handleCreateFile, handleCreateFolder, handleCreateTerminal, handleDeleteFile, handleDeleteFolder, handleDeploy, handleDisconnect, handleGenerateCode, handleGetFile, handleGetFolder, handleHeartbeat, handleListApps, handleMoveFile, handleRenameFile, handleResizeTerminal, handleSaveFile, handleTerminalData } from "./SocketHandlers"
import { TerminalManager } from "./TerminalManager"
import { DokkuResponse, User } from "./types"
import { LockManager } from "./utils"

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error)
  // Do not exit the process
  // You can add additional logging or recovery logic here
})

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason)
  // Do not exit the process
  // You can also handle the rejected promise here if needed
})

// Load environment variables
dotenv.config()

// Initialize Express app and create HTTP server
const app: Express = express()
const port = process.env.PORT || 4000
app.use(cors())
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
})

// Check if the sandbox owner is connected
function isOwnerConnected(sandboxId: string): boolean {
  return (connections[sandboxId] ?? 0) > 0
}

// Initialize containers and managers
const containers: Record<string, Sandbox> = {}
const connections: Record<string, number> = {}
const fileManagers: Record<string, FileManager> = {}
const terminalManagers: Record<string, TerminalManager> = {}

// Middleware for socket authentication
io.use(async (socket, next) => {
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

  const { sandboxId, userId } = parseQuery.data
  // Fetch user data from the database
  const dbUser = await fetch(
    `${process.env.DATABASE_WORKER_URL}/api/user?id=${userId}`,
    {
      headers: {
        Authorization: `${process.env.WORKERS_KEY}`,
      },
    }
  )
  const dbUserJSON = (await dbUser.json()) as User

  // Check if user data was retrieved successfully
  if (!dbUserJSON) {
    next(new Error("DB error."))
    return
  }

  // Check if the user owns the sandbox or has shared access
  const sandbox = dbUserJSON.sandbox.find((s) => s.id === sandboxId)
  const sharedSandboxes = dbUserJSON.usersToSandboxes.find(
    (uts) => uts.sandboxId === sandboxId
  )

  // If user doesn't own or have shared access to the sandbox, deny access
  if (!sandbox && !sharedSandboxes) {
    next(new Error("Invalid credentials."))
    return
  }

  // Set socket data with user information
  socket.data = {
    userId,
    sandboxId: sandboxId,
    isOwner: sandbox !== undefined,
  }

  // Allow the connection
  next()
})

// Initialize lock manager
const lockManager = new LockManager()

// Check for required environment variables
if (!process.env.DOKKU_HOST)
  console.error("Environment variable DOKKU_HOST is not defined")
if (!process.env.DOKKU_USERNAME)
  console.error("Environment variable DOKKU_USERNAME is not defined")
if (!process.env.DOKKU_KEY)
  console.error("Environment variable DOKKU_KEY is not defined")

// Initialize Dokku client
const client =
  process.env.DOKKU_HOST && process.env.DOKKU_KEY && process.env.DOKKU_USERNAME
    ? new DokkuClient({
      host: process.env.DOKKU_HOST,
      username: process.env.DOKKU_USERNAME,
      privateKey: fs.readFileSync(process.env.DOKKU_KEY),
    })
    : null
client?.connect()

// Initialize Git client used to deploy Dokku apps
const git =
  process.env.DOKKU_HOST && process.env.DOKKU_KEY
    ? new SecureGitClient(
      `dokku@${process.env.DOKKU_HOST}`,
      process.env.DOKKU_KEY
    )
    : null

// Add this near the top of the file, after other initializations
const aiWorker = new AIWorker(
  process.env.AI_WORKER_URL!,
  process.env.CF_AI_KEY!,
  process.env.DATABASE_WORKER_URL!,
  process.env.WORKERS_KEY!
)

// Handle a client connecting to the server
io.on("connection", async (socket) => {
  try {
    const data = socket.data as {
      userId: string
      sandboxId: string
      isOwner: boolean
    }

    // Handle connection based on user type (owner or not)
    if (data.isOwner) {
      connections[data.sandboxId] = (connections[data.sandboxId] ?? 0) + 1
    } else {
      if (!isOwnerConnected(data.sandboxId)) {
        socket.emit("disableAccess", "The sandbox owner is not connected.")
        return
      }
    }

    // Create or retrieve container
    const createdContainer = await lockManager.acquireLock(
      data.sandboxId,
      async () => {
        try {
          // Start a new container if the container doesn't exist or it timed out.
          if (
            !containers[data.sandboxId] ||
            !(await containers[data.sandboxId].isRunning())
          ) {
            containers[data.sandboxId] = await Sandbox.create({
              timeoutMs: CONTAINER_TIMEOUT,
            })
            console.log("Created container ", data.sandboxId)
            return true
          }
        } catch (e: any) {
          console.error(`Error creating container ${data.sandboxId}:`, e)
          socket.emit("error", `Error: container creation. ${e.message ?? e}`)
        }
      }
    )

    // Function to send loaded event
    const sendLoadedEvent = (files: SandboxFiles) => {
      socket.emit("loaded", files.files)
    }

    // Initialize file and terminal managers if container was created
    if (createdContainer) {
      fileManagers[data.sandboxId] = new FileManager(
        data.sandboxId,
        containers[data.sandboxId],
        sendLoadedEvent
      )
      terminalManagers[data.sandboxId] = new TerminalManager(
        containers[data.sandboxId]
      )
      console.log(`terminal manager set up for ${data.sandboxId}`)
      await fileManagers[data.sandboxId].initialize()
    }

    const fileManager = fileManagers[data.sandboxId]
    const terminalManager = terminalManagers[data.sandboxId]

    // Load file list from the file manager into the editor
    sendLoadedEvent(fileManager.sandboxFiles)

    // Handle various socket events (heartbeat, file operations, terminal operations, etc.)
    socket.on("heartbeat", async () => {
      try {
        handleHeartbeat(socket, data, containers)
      } catch (e: any) {
        console.error("Error setting timeout:", e)
        socket.emit("error", `Error: set timeout. ${e.message ?? e}`)
      }
    })

    socket.on("getFile", async (fileId: string, callback) => {
      try {
        callback(await handleGetFile(fileManager, fileId))
      } catch (e: any) {
        console.error("Error getting file:", e)
        socket.emit("error", `Error: get file. ${e.message ?? e}`)
      }
    })

    socket.on("getFolder", async (folderId: string, callback) => {
      try {
        callback(await handleGetFolder(fileManager, folderId))
      } catch (e: any) {
        console.error("Error getting folder:", e)
        socket.emit("error", `Error: get folder. ${e.message ?? e}`)
      }
    })

    socket.on("saveFile", async (fileId: string, body: string) => {
      try {
        await saveFileRL.consume(data.userId, 1)
        await handleSaveFile(fileManager, fileId, body)
      } catch (e: any) {
        console.error("Error saving file:", e)
        socket.emit("error", `Error: file saving. ${e.message ?? e}`)
      }
    })

    socket.on("moveFile", async (fileId: string, folderId: string, callback) => {
      try {
        callback(await handleMoveFile(fileManager, fileId, folderId))
      } catch (e: any) {
        console.error("Error moving file:", e)
        socket.emit("error", `Error: file moving. ${e.message ?? e}`)
      }
    })

    socket.on("list", async (callback: (response: DokkuResponse) => void) => {
      console.log("Retrieving apps list...")
      try {
        callback(await handleListApps(client))
      } catch (error) {
        callback({
          success: false,
          message: "Failed to retrieve apps list",
        })
      }
    })

    socket.on("deploy", async (callback: (response: DokkuResponse) => void) => {
      try {
        console.log("Deploying project ${data.sandboxId}...")
        callback(await handleDeploy(git, fileManager, data.sandboxId))
      } catch (error) {
        callback({
          success: false,
          message: "Failed to deploy project: " + error,
        })
      }
    })

    socket.on("createFile", async (name: string, callback) => {
      try {
        await createFileRL.consume(data.userId, 1)
        callback({ success: await handleCreateFile(fileManager, name) })
      } catch (e: any) {
        console.error("Error creating file:", e)
        socket.emit("error", `Error: file creation. ${e.message ?? e}`)
      }
    })

    socket.on("createFolder", async (name: string, callback) => {
      try {
        await createFolderRL.consume(data.userId, 1)
        await handleCreateFolder(fileManager, name)
        callback()
      } catch (e: any) {
        console.error("Error creating folder:", e)
        socket.emit("error", `Error: folder creation. ${e.message ?? e}`)
      }
    })

    socket.on("renameFile", async (fileId: string, newName: string) => {
      try {
        await renameFileRL.consume(data.userId, 1)
        await handleRenameFile(fileManager, fileId, newName)
      } catch (e: any) {
        console.error("Error renaming file:", e)
        socket.emit("error", `Error: file renaming. ${e.message ?? e}`)
      }
    })

    socket.on("deleteFile", async (fileId: string, callback) => {
      try {
        await deleteFileRL.consume(data.userId, 1)
        callback(await handleDeleteFile(fileManager, fileId))
      } catch (e: any) {
        console.error("Error deleting file:", e)
        socket.emit("error", `Error: file deletion. ${e.message ?? e}`)
      }
    })

    socket.on("deleteFolder", async (folderId: string, callback) => {
      try {
        callback(await handleDeleteFolder(fileManager, folderId))
      } catch (e: any) {
        console.error("Error deleting folder:", e)
        socket.emit("error", `Error: folder deletion. ${e.message ?? e}`)
      }
    })

    socket.on("createTerminal", async (id: string, callback) => {
      try {
        await handleCreateTerminal(lockManager, terminalManager, id, socket, containers, data)
        callback()
      } catch (e: any) {
        console.error(`Error creating terminal ${id}:`, e)
        socket.emit("error", `Error: terminal creation. ${e.message ?? e}`)
      }
    })

    socket.on("resizeTerminal", (dimensions: { cols: number; rows: number }) => {
      try {
        handleResizeTerminal(terminalManager, dimensions)
      } catch (e: any) {
        console.error("Error resizing terminal:", e)
        socket.emit("error", `Error: terminal resizing. ${e.message ?? e}`)
      }
    })

    socket.on("terminalData", async (id: string, data: string) => {
      try {
        await handleTerminalData(terminalManager, id, data)
      } catch (e: any) {
        console.error("Error writing to terminal:", e)
        socket.emit("error", `Error: writing to terminal. ${e.message ?? e}`)
      }
    })

    socket.on("closeTerminal", async (id: string, callback) => {
      try {
        await handleCloseTerminal(terminalManager, id)
        callback()
      } catch (e: any) {
        console.error("Error closing terminal:", e)
        socket.emit("error", `Error: closing terminal. ${e.message ?? e}`)
      }
    })

    socket.on("generateCode", async (fileName: string, code: string, line: number, instructions: string, callback) => {
      try {
        callback(await handleGenerateCode(aiWorker, data.userId, fileName, code, line, instructions))
      } catch (e: any) {
        console.error("Error generating code:", e)
        socket.emit("error", `Error: code generation. ${e.message ?? e}`)
      }
    })

    socket.on("disconnect", async () => {
      try {
        await handleDisconnect(data, connections, terminalManager, fileManager, socket)
      } catch (e: any) {
        console.log("Error disconnecting:", e)
        socket.emit("error", `Error: disconnecting. ${e.message ?? e}`)
      }
    })
  } catch (e: any) {
    console.error("Error connecting:", e)
    socket.emit("error", `Error: connection. ${e.message ?? e}`)
  }
})

// Start the server
httpServer.listen(port, () => {
  console.log(`Server running on port ${port}`)
})
