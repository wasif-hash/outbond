"use client"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Upload, Search, Filter } from "lucide-react"

const sampleLeads = [
  {
    name: "Jane Doe",
    title: "Head of Ops",
    company: "TelecomOne", 
    email: "jane.doe@telecomone.com",
    source: "Apollo",
    status: "new"
  },
  {
    name: "John Smith",
    title: "CIO", 
    company: "UtilityCorp",
    email: "john.smith@utilitycorp.com",
    source: "SalesNav",
    status: "queued"
  },
  {
    name: "Priya Patel",
    title: "VP RevOps",
    company: "GridWorks",
    email: "priya.patel@gridworks.co", 
    source: "Apollo",
    status: "outreaching"
  },
  {
    name: "Marco Ruiz",
    title: "COO",
    company: "FiberNorth",
    email: "marco@fibernorth.ca",
    source: "SalesNav", 
    status: "positive"
  },
  {
    name: "Lena Chen",
    title: "Director Ops",
    company: "EastHydro",
    email: "lena@easthydro.io",
    source: "Apollo",
    status: "unsub"
  },
]

const recentUploads = [
  { filename: "q3_utility_leads.csv", uploaded: "Aug 24, 2:30 PM", count: 47 },
  { filename: "telecom_contacts.csv", uploaded: "Aug 23, 11:15 AM", count: 23 },
  { filename: "apollo_export_082223.csv", uploaded: "Aug 22, 4:45 PM", count: 156 },
]

export default function Leads() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  const filteredLeads = sampleLeads.filter(lead => {
    const matchesSearch = lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         lead.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         lead.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || lead.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-mono font-bold text-foreground">Leads</h1>
        <p className="text-muted-foreground mt-1">Import and manage your outbound lead database</p>
      </div>

      <Tabs defaultValue="master" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="import">Raw Import</TabsTrigger>
          <TabsTrigger value="master">Master</TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="space-y-6">
          {/* CSV Upload Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-mono">Upload Leads</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed rounded-lg p-8 text-center transition-colors hover:opacity-80" 
                   style={{ borderColor: "hsl(var(--cwt-plum))" }}>
                <Upload className="mx-auto h-12 w-12 mb-4" style={{ color: "hsl(var(--cwt-plum))" }} />
                <div className="text-lg font-medium mb-2">Drop CSV files here</div>
                <div className="text-muted-foreground mb-4">or click to browse</div>
                <Button variant="outline" style={{ borderColor: "hsl(var(--cwt-plum))", color: "hsl(var(--cwt-plum))" }}>
                  Choose Files
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Uploads */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-mono">Recent Uploads</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentUploads.map((upload, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-md">
                    <div>
                      <div className="font-medium">{upload.filename}</div>
                      <div className="text-sm text-muted-foreground">{upload.uploaded}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold">{upload.count}</div>
                      <div className="text-xs text-muted-foreground">leads</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="master" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search leads..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Leads Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-mono">Master Lead Database</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 font-mono font-bold text-sm">Name</th>
                      <th className="text-left py-3 font-mono font-bold text-sm">Title</th>
                      <th className="text-left py-3 font-mono font-bold text-sm">Company</th>
                      <th className="text-left py-3 font-mono font-bold text-sm">Email</th>
                      <th className="text-left py-3 font-mono font-bold text-sm">Source</th>
                      <th className="text-left py-3 font-mono font-bold text-sm">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.map((lead, index) => (
                      <tr key={index} className="border-b border-border hover:bg-muted transition-colors">
                        <td className="py-3 font-medium">{lead.name}</td>
                        <td className="py-3 text-muted-foreground">{lead.title}</td>
                        <td className="py-3">{lead.company}</td>
                        <td className="py-3 text-muted-foreground font-mono text-sm">{lead.email}</td>
                        <td className="py-3">
                          <Badge variant="outline" className="text-xs">{lead.source}</Badge>
                        </td>
                        <td className="py-3">
                          <Badge 
                            className="text-xs px-2 py-1 rounded-full font-medium"
                            style={{
                              backgroundColor: lead.status === "new" ? "hsl(var(--status-new))" :
                                             lead.status === "queued" ? "hsl(var(--status-queued))" :
                                             lead.status === "outreaching" ? "hsl(var(--status-outreach))" :
                                             lead.status === "positive" ? "hsl(var(--status-positive))" :
                                             "hsl(var(--status-unsub))",
                              color: "white"
                            }}
                          >
                            {lead.status === "outreaching" ? "Outreaching" : 
                             lead.status === "positive" ? "Positive Reply" :
                             lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {filteredLeads.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  No leads found matching your criteria.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}