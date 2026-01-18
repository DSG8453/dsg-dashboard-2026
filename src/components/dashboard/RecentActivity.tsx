import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const activities = [
  {
    id: 1,
    user: "Sarah Chen",
    action: "completed project",
    target: "Q4 Analytics Report",
    time: "2 min ago",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
    initials: "SC",
  },
  {
    id: 2,
    user: "Alex Morgan",
    action: "deployed to",
    target: "production",
    time: "15 min ago",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
    initials: "AM",
  },
  {
    id: 3,
    user: "Jordan Lee",
    action: "merged PR",
    target: "#428",
    time: "1 hour ago",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
    initials: "JL",
  },
  {
    id: 4,
    user: "Taylor Swift",
    action: "updated settings for",
    target: "API Gateway",
    time: "3 hours ago",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face",
    initials: "TS",
  },
];

export function RecentActivity() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 animate-fade-in" style={{ animationDelay: "400ms" }}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Recent Activity</h3>
          <p className="text-sm text-muted-foreground">Latest team updates</p>
        </div>
        <button className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">
          View all
        </button>
      </div>
      
      <div className="space-y-4">
        {activities.map((activity, index) => (
          <div
            key={activity.id}
            className="flex items-center gap-4 rounded-lg p-3 transition-colors hover:bg-secondary/50 animate-slide-in"
            style={{ animationDelay: `${400 + index * 100}ms` }}
          >
            <Avatar className="h-10 w-10 border border-border">
              <AvatarImage src={activity.avatar} />
              <AvatarFallback className="bg-secondary text-xs font-medium text-foreground">
                {activity.initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground">
                <span className="font-medium">{activity.user}</span>{" "}
                <span className="text-muted-foreground">{activity.action}</span>{" "}
                <span className="font-medium text-primary">{activity.target}</span>
              </p>
              <p className="text-xs text-muted-foreground">{activity.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
