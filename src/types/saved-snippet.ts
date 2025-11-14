export type SavedSnippetType = "PROMPT" | "SIGNATURE"

export type SavedSnippet = {
  id: string
  userId?: string
  name: string
  type: SavedSnippetType
  content: string
  createdAt: string
  updatedAt: string
}
