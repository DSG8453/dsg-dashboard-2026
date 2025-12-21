import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard,
  User,
  Users,
  Key,
  Shield,
  Smartphone,
  FileText,
  LogOut,
  Menu,
  ChevronDown,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Profile", href: "/profile", icon: User },
  { name: "Users", href: "/users", icon: Users },
  { name: "Credentials", href: "/credentials", icon: Key },
  { name: "IP Management", href: "/ip-management", icon: Shield },
  { name: "Devices", href: "/devices", icon: Smartphone },
  { name: "Activity Logs", href: "/activity-logs", icon: FileText },
];

export const Navbar = ({ currentUser }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="sticky top-0 z-50 glass-card-strong shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691ee53ded166d6334e8b9c6/0583cf617_315logodsg_.png"
              alt="DSG Transport LLC"
              className="h-10 w-auto"
            />
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-1">
            {navigation.map((item) => (
              <NavLink key={item.name} to={item.href}>
                {({ isActive }) => (
                  <Button
                    variant={isActive ? "navActive" : "nav"}
                    size="sm"
                    className="gap-2"
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="hidden xl:inline">{item.name}</span>
                  </Button>
                )}
              </NavLink>
            ))}
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-gradient-primary text-primary-foreground text-sm font-semibold">
                      {currentUser?.initials || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-semibold text-foreground">
                      {currentUser?.name || "User"}
                    </p>
                    <p className="text-xs text-admin">{currentUser?.role || "User"}</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div>
                    <p className="font-semibold">{currentUser?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {currentUser?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/profile")}>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile Menu */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild className="lg:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <div className="flex flex-col gap-4 mt-8">
                  <div className="flex items-center gap-3 pb-4 border-b border-border">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-gradient-primary text-primary-foreground font-semibold">
                        {currentUser?.initials || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{currentUser?.name}</p>
                      <p className="text-sm text-admin">{currentUser?.role}</p>
                    </div>
                  </div>

                  <nav className="flex flex-col gap-1">
                    {navigation.map((item) => (
                      <NavLink
                        key={item.name}
                        to={item.href}
                        onClick={() => setMobileOpen(false)}
                      >
                        {({ isActive }) => (
                          <Button
                            variant={isActive ? "navActive" : "nav"}
                            className="w-full justify-start gap-3"
                          >
                            <item.icon className="h-5 w-5" />
                            {item.name}
                          </Button>
                        )}
                      </NavLink>
                    ))}
                  </nav>

                  <div className="pt-4 border-t border-border">
                    <Button
                      variant="danger"
                      className="w-full justify-start gap-3"
                      onClick={handleLogout}
                    >
                      <LogOut className="h-5 w-5" />
                      Logout
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
};
