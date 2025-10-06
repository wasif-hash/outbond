"use client"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, Clock, Video, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react"

const bookings = [
  {
    id: 1,
    name: "Marco Ruiz",
    company: "FiberNorth",
    type: "Intro Call",
    date: "Sept 1",
    time: "10:00–10:30",
    meetingLink: "https://meet.google.com/abc-defg-hij",
    status: "confirmed"
  },
  {
    id: 2,
    name: "John Smith", 
    company: "UtilityCorp",
    type: "Discovery",
    date: "Sept 3",
    time: "14:00–14:45",
    meetingLink: "https://zoom.us/j/123456789",
    status: "confirmed"
  }
]

const calendarDays = [
  { day: 1, hasBooking: true, bookings: 1 },
  { day: 2, hasBooking: false, bookings: 0 },
  { day: 3, hasBooking: true, bookings: 1 },
  { day: 4, hasBooking: false, bookings: 0 },
  { day: 5, hasBooking: false, bookings: 0 },
  { day: 6, hasBooking: false, bookings: 0 },
  { day: 7, hasBooking: false, bookings: 0 },
]

export default function Bookings() {
  const [currentWeek, setCurrentWeek] = useState(0)

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-mono font-bold text-foreground">Bookings</h1>
        <p className="text-muted-text mt-1">Track and manage scheduled meetings</p>
      </div>

      <Tabs defaultValue="list" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="list">List</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="space-y-6">
          {/* Calendar Header */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-mono">September 2024</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-2 mb-4">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day} className="text-center text-sm font-medium text-muted-text p-2">
                    {day}
                  </div>
                ))}
              </div>
              
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 7 }, (_, i) => (
                  <div key={i} className="aspect-square border border-border rounded-md p-1 hover:bg-muted-bg transition-colors">
                    <div className="text-sm font-mono">{i + 1}</div>
                    {calendarDays[i]?.hasBooking && (
                      <div className="mt-1">
                        <div className="w-2 h-2 bg-cwt-plum rounded-full"></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="list" className="space-y-6">
          {/* Upcoming Bookings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-mono">Upcoming Meetings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {bookings.map((booking) => (
                  <div key={booking.id} className="p-4 border border-border rounded-lg hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-medium text-lg">{booking.name}</h3>
                        <p className="text-muted-text">{booking.company}</p>
                      </div>
                      <Badge variant="default">
                        {booking.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="flex items-center text-sm">
                        <Calendar className="h-4 w-4 mr-2 text-cwt-plum" />
                        <span>{booking.date}</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Clock className="h-4 w-4 mr-2 text-cwt-plum" />
                        <span>{booking.time}</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Video className="h-4 w-4 mr-2 text-cwt-plum" />
                        <Badge variant="outline" className="text-xs">
                          {booking.type}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-text font-mono truncate flex-1 mr-4">
                        {booking.meetingLink}
                      </div>
                      <Button variant="default" size="sm">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Join Meeting
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {bookings.length === 0 && (
                <div className="text-center py-12 text-muted-text">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-text/50" />
                  <p>No upcoming bookings.</p>
                  <p className="text-sm">Meetings will appear here when prospects book time.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Booking Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-2xl font-mono font-bold text-cwt-plum">2</div>
                <div className="text-sm text-muted-text">This Week</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-2xl font-mono font-bold text-status-positive">7</div>
                <div className="text-sm text-muted-text">This Month</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-2xl font-mono font-bold text-electric-blue">85%</div>
                <div className="text-sm text-muted-text">Show Rate</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}