import StatCard from "./StatCard";

const StatsGrid = () => {
  const stats = [
    {
      title: "Total Leads",
      value: "248",
      change: "+12%",
      trend: "up" as const,
      icon: "users",
      color: "primary" as const,
    },
    {
      title: "Pending",
      value: "64",
      change: "-5%",
      trend: "down" as const,
      icon: "clock",
      color: "warning" as const,
    },
    {
      title: "Contacted",
      value: "142",
      change: "+18%",
      trend: "up" as const,
      icon: "phone",
      color: "success" as const,
    },
    {
      title: "Callbacks",
      value: "42",
      change: "+8%",
      trend: "up" as const,
      icon: "calendar",
      color: "secondary" as const,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((stat, index) => (
        <div key={index} className="animate-fade-in-up" style={{ animationDelay: `${index * 0.05}s` }}>
          <StatCard {...stat} />
        </div>
      ))}
    </div>
  );
};

export default StatsGrid;
