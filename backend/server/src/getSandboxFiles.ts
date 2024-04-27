import {
  R2FileBody,
  R2Files,
  Sandbox,
  TFile,
  TFileData,
  TFolder,
  User,
} from "./types"

const getSandboxFiles = async (id: string) => {
  const sandboxRes = await fetch(
    `https://storage.ishaan1013.workers.dev/api?sandboxId=${id}`
  )
  const sandboxData: R2Files = await sandboxRes.json()

  const paths = sandboxData.objects.map((obj) => obj.key)
  const processedFiles = await processFiles(paths, id)
  // console.log("processedFiles.fileData:", processedFiles.fileData)
  return processedFiles
}

const processFiles = async (paths: string[], id: string) => {
  const root: TFolder = { id: "/", type: "folder", name: "/", children: [] }
  const fileData: TFileData[] = []

  paths.forEach((path) => {
    const allParts = path.split("/")
    if (allParts[1] !== id) {
      console.log("invalid path!!!!")
      return
    }

    const parts = allParts.slice(2)
    let current: TFolder = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isFile = i === parts.length - 1 && part.includes(".")
      const existing = current.children.find((child) => child.name === part)

      if (existing) {
        if (!isFile) {
          current = existing as TFolder
        }
      } else {
        if (isFile) {
          const file: TFile = { id: path, type: "file", name: part }
          current.children.push(file)
          fileData.push({ id: path, data: "" })
        } else {
          const folder: TFolder = {
            id: path,
            type: "folder",
            name: part,
            children: [],
          }
          current.children.push(folder)
          current = folder
        }
      }
    }
  })

  await Promise.all(
    fileData.map(async (file) => {
      const data = await fetchFileContent(file.id)
      file.data = data
    })
  )

  return {
    files: root.children,
    fileData,
  }
}

const fetchFileContent = async (fileId: string): Promise<string> => {
  try {
    const fileRes = await fetch(
      `https://storage.ishaan1013.workers.dev/api?fileId=${fileId}`
    )
    return await fileRes.text()
  } catch (error) {
    console.error("ERROR fetching file:", error)
    return ""
  }
}

export default getSandboxFiles
