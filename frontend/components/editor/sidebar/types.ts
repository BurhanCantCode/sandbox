export type TFolder = {
  id: string
  type: "folder"
  name: string
  children: (TFile | TFolder)[]
}

export type TFile = {
  id: string
  type: "file"
  name: string
}

export type TTab = TFile & {
  saved: boolean
}

export type TFileData = {
  id: string
  data: string
}