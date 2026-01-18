import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  BarChart3, 
  Users, 
  FileText, 
  Settings, 
  HelpCircle,
  Zap
} from "lucide-react";

interface SidebarProps {
  className?: string;
}

const navigation = [
  { name: "Dashboard", icon: LayoutDashboard, href: "#", current: true },
  { name: "Analytics", icon: BarChart3, href: "#", current: false },
  { name: "Team", icon: Users, href: "#", current: false },
  { name: "Reports", icon: FileText, href: "#", current: false },
];

const bottomNav = [
  { name: "Settings", icon: Settings, href: "#" },
  { name: "Help", icon: HelpCircle, href: "#" },
];

export function Sidebar({ className }: SidebarProps) {
  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-sidebar transition-transform",
        className
      )}
    >
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-border px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary animate-pulse-glow">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-foreground">
            DSG Dashboard
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navigation.map((item, index) => (
            <a
              key={item.name}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                item.current
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <item.icon
                className={cn(
                  "h-5 w-5 transition-colors",
                  item.current ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              {item.name}
              {item.current && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </a>
          ))}
        </nav>

        {/* Bottom navigation */}
        <div className="border-t border-border px-3 py-4">
          {bottomNav.map((item) => (
            <a
              key={item.name}
              href={item.href}
              className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-secondary hover:text-foreground"
            >
              <item.icon className="h-5 w-5 transition-colors group-hover:text-foreground" />
              {item.name}
            </a>
          ))}
        </div>
      </div>
    </aside>
  );
}
