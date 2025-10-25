import { redirect } from "next/navigation"

import { getCurrentUser } from "@/lib/auth"

import { RepliesClient, ReplyRecord } from "./replies-client"

const mockReplies: ReplyRecord[] = [
  {
    id: 1,
    lead: "Marco Ruiz",
    company: "FiberNorth",
    campaign: "Q3 Utility Outreach",
    disposition: "positive",
    snippet: "Looks good, can we talk Friday?",
    timestamp: "Aug 24, 10:21",
    fullReply:
      "Hi there,\n\nThanks for reaching out. Your solution looks interesting and could be a good fit for our Q4 infrastructure planning. Can we schedule a call for Friday afternoon to discuss further?\n\nBest regards,\nMarco",
  },
  {
    id: 2,
    lead: "Jane Doe",
    company: "TelecomOne",
    campaign: "Telecom Decision Makers",
    disposition: "neutral",
    snippet: "Send details.",
    timestamp: "Aug 24, 09:55",
    fullReply: "Send me more details about pricing and implementation timeline.",
  },
  {
    id: 3,
    lead: "Lena Chen",
    company: "EastHydro",
    campaign: "Energy Sector Pilots",
    disposition: "unsub",
    snippet: "Remove me.",
    timestamp: "Aug 23, 16:10",
    fullReply: "Please remove me from your mailing list.",
  },
]

export const dynamic = "force-dynamic"

export default async function RepliesPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  return <RepliesClient replies={mockReplies} />
}
