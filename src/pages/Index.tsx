import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { AnalyticsChart } from "@/components/dashboard/AnalyticsChart";
import { ActivityChart } from "@/components/dashboard/ActivityChart";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { DollarSign, Users, Activity, TrendingUp } from "lucide-react";

const metrics = [
  {
    title: "Total Revenue",
    value: "$45,231",
    change: "+20.1%",
    trend: "up" as const,
    icon: DollarSign,
  },
  {
    title: "Active Users",
    value: "2,350",
    change: "+15.3%",
    trend: "up" as const,
    icon: Users,
  },
  {
    title: "Active Sessions",
    value: "1,247",
    change: "+4.5%",
    trend: "up" as const,
    icon: Activity,
  },
  {
    title: "Conversion Rate",
    value: "3.24%",
    change: "-0.8%",
    trend: "down" as const,
    icon: TrendingUp,
  },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      <main className="ml-64">
        <Header />
        
        <div className="p-6">
          {/* Metrics Grid */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {metrics.map((metric, index) => (
              <MetricCard key={metric.title} {...metric} delay={index * 100} />
            ))}
          </div>
          
          {/* Charts Section */}
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <AnalyticsChart />
            <ActivityChart />
          </div>
          
          {/* Recent Activity */}
          <div className="mt-6">
            <RecentActivity />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
